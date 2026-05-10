use chrono::{Datelike, NaiveDate};
use regex::Regex;
use reqwest;
use scraper::{Html, Selector};
use serde::Serialize;
use std::collections::HashSet;
use std::error::Error;

#[derive(Debug, Clone, Serialize)]
pub struct Colle {
    pub id: String,
    pub teacher: String,
    pub date: String,       // Format: YYYY-MM-DD
    pub start_hour: String, // Format: HH:MM
    pub end_hour: String,   // Format: HH:MM
    pub subject: String,
    pub is_assigned: bool,
}

#[derive(Debug, Serialize)]
pub struct FutureCollesResponse {
    pub colles: Vec<Colle>,
    pub url: String,
}

/// Generate all Monday dates between start_date and end_date (inclusive)
fn mondays_in_range(start_date: &str, end_date: &str) -> Result<Vec<String>, Box<dyn Error>> {
    let start = NaiveDate::parse_from_str(start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start_date format: {}", e))?;
    let end = NaiveDate::parse_from_str(end_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end_date format: {}", e))?;

    let mut mondays = Vec::new();
    let mut current = start;

    while current <= end {
        if current.weekday() == chrono::Weekday::Mon {
            mondays.push(current.format("%d/%m").to_string());
        }
        current = current.succ_opt().ok_or("Date overflow")?;
    }

    Ok(mondays)
}

/// Finds the page URL for a given date
async fn find_page_for_date(target_date: &str, cookie: &str) -> Result<String, Box<dyn Error>> {
    let url = "https://bjcolle.fr/timetable_dashboard_period.php";
    let _ = reqwest::Client::new()
        .get("https://bjcolle.fr/index.php?an=1")
        .header("Cookie", cookie)
        .send()
        .await?;
    let response = reqwest::Client::new()
        .get(url)
        .header("Cookie", cookie)
        .send()
        .await?;
    let html_content = response.text().await?;

    let document = Html::parse_document(&html_content);
    let link_selector =
        Selector::parse(r#"a.numero_page, a.numero_page_du_jour_active, a.numero_page_du_jour, a.numero_page_active"#)
            .map_err(|e| format!("Invalid selector: {:?}", e))?;

    for link in document.select(&link_selector) {
        let link_text = link.text().collect::<String>().trim().to_string();

        if link_text == target_date {
            if let Some(href) = link.value().attr("href") {
                let full_url = if href.starts_with("http") {
                    href.to_string()
                } else {
                    format!("https://bjcolle.fr/{}", href.trim_start_matches('/'))
                };
                return Ok(full_url);
            }
        }
    }

    Err(format!("Date {} not found in dashboard", target_date).into())
}

/// Fetches and parses all future colles for a given date
pub async fn fetch_colles(
    date: &str,
    cookie: &str,
) -> Result<FutureCollesResponse, Box<dyn Error>> {
    // Find the page URL
    let page_url = find_page_for_date(date, cookie).await?;

    // Fetch the page
    let response = reqwest::Client::new()
        .get(&page_url)
        .header("Cookie", cookie)
        .send()
        .await?;
    let html_content = response.text().await?;

    // Parse HTML
    let document = Html::parse_document(&html_content);

    // Selectors
    let table_selector = Selector::parse(r#"table[style="width:100%"]"#)
        .map_err(|e| format!("Invalid table selector: {:?}", e))?;
    let tr_selector = Selector::parse("tr").unwrap();
    let td_selector = Selector::parse("td").unwrap();
    let input_selector = Selector::parse("input.submit_plus").unwrap();
    // Presence of this span means the slot has NO assigned students (i.e. not yet assigned)
    let avertissement_selector = Selector::parse("span.avertissement").unwrap();

    // Compiled regexes (once, outside the loop)
    let duration_regex = Regex::new(r"\((\d+)\s*min\)").unwrap();
    // Matches "à HH h MM" anywhere
    let time_regex = Regex::new(r"à\s*(\d{1,2})\s*h\s*(\d{2})").unwrap();
    // Matches "Tirage à HH h MM" (case-insensitive)
    let tirage_regex = Regex::new(r"(?i)tirage\s+à\s*(\d{1,2})\s*h\s*(\d{2})").unwrap();
    // Strips "/ Tirage à HH h MM", "Tirage", "anticipé" and surrounding separators
    let subject_cleanup_regex =
        Regex::new(r"(?i)\s*/?\s*tirage(\s+à\s*\d{1,2}\s*h\s*\d{2})?\s*|\s*anticip[eé]e?\s*")
            .unwrap();

    let mut colles = Vec::new();

    for table in document.select(&table_selector) {
        for row in table.select(&tr_selector) {
            // ---- is_assigned: true when span.avertissement is ABSENT from the row ----
            let is_assigned = row.select(&avertissement_selector).next().is_none();

            // All parsing is done on the first <td> of the row
            let cell = match row.select(&td_selector).next() {
                Some(c) => c,
                None => continue,
            };

            let mut cell_text = cell.text().collect::<String>().trim().to_string();

            // Normalize non-breaking spaces
            cell_text = cell_text.replace('\u{00A0}', " ");

            // ---- Parse the date ----
            // Example: "Mercredi 12 novembre 2025"
            let mut current_date = String::new();
            if let Some(pos_a) = cell_text.find('à') {
                let before_time = cell_text[..pos_a].trim();
                let parts: Vec<&str> = before_time.split_whitespace().collect();
                if parts.len() >= 4 {
                    let day_str = parts[1].replace("er", "");
                    let day = day_str.parse::<u32>().unwrap_or(1);
                    let month = parse_french_month(parts[2]);
                    let year = parts[3];
                    current_date = format!("{}-{:02}-{:02}", year, month, day);
                }
            }
            if current_date.is_empty() {
                continue;
            }

            // ---- Parse the time ----
            //
            // Case A — with "Tirage":
            //   "Jeudi 21 mai 2026 à 15 h 00 (30 min) / Tirage à 14 h 30Français..."
            //   • The first "à HH h MM" before "(" is the COLLE time (15h00)
            //   • "Tirage à HH h MM" is the START time (14h30)
            //   • end = colle time + duration = 15h00 + 30min = 15h30
            //
            // Case B — without "Tirage":
            //   "Mercredi 20 mai 2026 à 15 h 40 (40 min) Mathématiques..."
            //   • The first "à HH h MM" before "(" is the START time (15h40)
            //   • end = start + duration = 15h40 + 40min = 16h20

            // Locate the opening parenthesis to split colle-time from duration
            let paren_pos = match cell_text.find('(') {
                Some(p) => p,
                None => continue,
            };

            // Extract duration in minutes from "(XX min)"
            let duration: u32 = duration_regex
                .captures(&cell_text[paren_pos..])
                .and_then(|caps| caps.get(1))
                .and_then(|m| m.as_str().parse::<u32>().ok())
                .unwrap_or(0);

            // The first "à HH h MM" before "(" is always the colle time
            let text_before_paren = &cell_text[..paren_pos];
            let (colle_h, colle_m) = match time_regex.captures(text_before_paren) {
                Some(caps) => (
                    caps[1].parse::<u32>().unwrap_or(0),
                    caps[2].parse::<u32>().unwrap_or(0),
                ),
                None => continue,
            };

            // end is always colle_time + duration
            let end_total = colle_h * 60 + colle_m + duration;
            let end_h = end_total / 60;
            let end_m = end_total % 60;

            let (start_hour, end_hour) =
                if let Some(tirage_caps) = tirage_regex.captures(&cell_text) {
                    // Case A: start = Tirage time, end = colle time + duration
                    let start_h: u32 = tirage_caps[1].parse().unwrap_or(0);
                    let start_m: u32 = tirage_caps[2].parse().unwrap_or(0);
                    (
                        format!("{:02}:{:02}", start_h, start_m),
                        format!("{:02}:{:02}", end_h, end_m),
                    )
                } else {
                    // Case B: start = colle time, end = colle time + duration
                    (
                        format!("{:02}:{:02}", colle_h, colle_m),
                        format!("{:02}:{:02}", end_h, end_m),
                    )
                };

            // ---- Parse subject and teacher ----
            // After the closing ")" of the duration, the remaining text is:
            //   " / Tirage à 14 h 30Anglais LV1 : M. VANDOMME Salle : ..."
            //   " Mathématiques : M. NOUGAYREDES Salle : ..."
            // Find the closing ")" then look for the first ":" after it.
            // Everything between them is the raw subject; everything up to "Salle" is the teacher.
            let close_paren_pos = cell_text[paren_pos..].find(')').map(|p| paren_pos + p + 1);
            let (subject, teacher) = {
                let after_paren = match close_paren_pos {
                    Some(p) => p,
                    None => continue,
                };
                let rest = &cell_text[after_paren..];
                let colon_pos = match rest.find(':') {
                    Some(p) => p,
                    None => continue,
                };
                let after_colon = &rest[colon_pos + 1..];
                let salle_pos = match after_colon.find("Salle") {
                    Some(p) => p,
                    None => continue,
                };

                // Subject: text before ":" in `rest`, stripped of "/ Tirage à HH h MM" fragments
                let subject_raw = rest[..colon_pos].trim().to_string();
                let subject_raw = subject_cleanup_regex
                    .replace_all(&subject_raw, "")
                    .trim()
                    .to_string();
                // Strip any leftover leading "/" separator
                let subject = subject_raw.trim_start_matches('/').trim().to_string();

                // Teacher: text between ":" and "Salle"
                let teacher_part = after_colon[..salle_pos].trim().to_string();
                let teacher_cleaned = teacher_part
                    .replace(" :", "")
                    .replace("  ", " ")
                    .trim()
                    .to_string();

                (subject, teacher_cleaned)
            };

            // Extract the COCHER_XX value if present
            let cocher_name = cell
                .select(&input_selector)
                .filter_map(|input| input.value().attr("name"))
                .find(|n| n.starts_with("COCHER_"))
                .map(|s| s.to_string());

            colles.push(Colle {
                id: cocher_name.unwrap_or_default(),
                teacher,
                date: current_date.clone(),
                start_hour,
                end_hour,
                subject,
                is_assigned,
            });
        }
    }

    println!("Extracted {} future colles", colles.len());

    Ok(FutureCollesResponse {
        colles,
        url: page_url,
    })
}

fn parse_french_month(month: &str) -> u32 {
    match month.to_lowercase().as_str() {
        "janvier" => 1,
        "février" | "fevrier" => 2,
        "mars" => 3,
        "avril" => 4,
        "mai" => 5,
        "juin" => 6,
        "juillet" => 7,
        "août" | "aout" => 8,
        "septembre" => 9,
        "octobre" => 10,
        "novembre" => 11,
        "décembre" | "decembre" => 12,
        _ => 1,
    }
}

#[tauri::command(async)]
pub async fn fetch_future_colles(
    start_date: &str,
    end_date: &str,
    cookie: &str,
) -> Result<FutureCollesResponse, String> {
    // Generate all Mondays in the date range
    let mondays = mondays_in_range(start_date, end_date)
        .map_err(|e| format!("Failed to generate date range: {}", e))?;

    if mondays.is_empty() {
        return Err("No Mondays found in the specified date range".to_string());
    }

    let monday_count = mondays.len();
    println!("Fetching colles for {} weeks: {:?}", monday_count, mondays);

    // Fetch colles for each Monday
    let mut all_colles = Vec::new();
    let mut last_url = String::new();
    let mut seen_ids = HashSet::new();

    for monday in mondays {
        match fetch_colles(&monday, cookie).await {
            Ok(response) => {
                last_url = response.url;
                for colle in response.colles {
                    // Deduplicate by ID
                    if !colle.id.is_empty() && seen_ids.insert(colle.id.clone()) {
                        all_colles.push(colle);
                    } else if colle.id.is_empty() {
                        all_colles.push(colle);
                    }
                }
            }
            Err(e) => {
                eprintln!("Warning: Failed to fetch colles for {}: {}", monday, e);
            }
        }
    }

    println!(
        "Fetched {} unique colles across {} weeks",
        all_colles.len(),
        monday_count
    );

    Ok(FutureCollesResponse {
        colles: all_colles,
        url: last_url,
    })
}
