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
    pub is_assigned: bool,  // TODO: Parse from HTML
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

    // Select the main table
    let table_selector = Selector::parse(r#"table[style="width:100%"]"#)
        .map_err(|e| format!("Invalid table selector: {:?}", e))?;
    let td_selector = Selector::parse("td").unwrap();
    let input_selector = Selector::parse("input.submit_plus").unwrap();
    let duration_regex = Regex::new(r"\((\d+)\s*min\)").unwrap();

    let mut colles = Vec::new();

    for table in document.select(&table_selector) {
        for cell in table.select(&td_selector) {
            let mut cell_text = cell.text().collect::<String>().trim().to_string();

            // Normalize non-breaking spaces
            cell_text = cell_text.replace('\u{00A0}', " ");

            // ---- Parse the date ----
            // Example: "Mercredi 12 novembre 2025"
            let mut current_date = String::new();
            if let Some(pos_a) = cell_text.find('à') {
                // Text before "à" likely contains the date
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
            // Example: "à 17 h 00 (60 min)"
            let (start_hour, end_hour) = if let Some(pos_a) = cell_text.find('à') {
                let time_part = &cell_text[pos_a..];
                if let Some(paren_pos) = time_part.find('(') {
                    let main_time = time_part[..paren_pos].trim(); // "à 17 h 00"
                    let duration_part = &time_part[paren_pos..]; // "(60 min)"

                    // Extract numbers from "à 17 h 00"
                    let digits: Vec<u32> = main_time
                        .split(|c: char| !c.is_ascii_digit())
                        .filter_map(|s| s.parse::<u32>().ok())
                        .collect();

                    let hour = *digits.get(0).unwrap_or(&0);
                    let minute = *digits.get(1).unwrap_or(&0);

                    // Extract duration from "(60 min)"
                    let duration: u32 = duration_regex
                        .captures(&duration_part)
                        .and_then(|caps| caps.get(1))
                        .and_then(|m| m.as_str().parse::<u32>().ok())
                        .unwrap_or(0);

                    let start = format!("{:02}:{:02}", hour, minute);

                    // Compute end time
                    let total_minutes = hour * 60 + minute + duration;
                    let end_hour_val = total_minutes / 60;
                    let end_minute_val = total_minutes % 60;
                    let end = format!("{:02}:{:02}", end_hour_val, end_minute_val);

                    (start, end)
                } else {
                    continue;
                }
            } else {
                continue;
            };

            // ---- Parse subject and teacher ----
            // Example: "Physique-Chimie : M. LAFITTE Salle : ND 007 - NOTRE-DAME - RDC"
            let (subject, teacher) = if let Some(colon_pos) = cell_text.find(':') {
                // Split subject / teacher part
                let after_colon = &cell_text[colon_pos + 1..];
                if let Some(salle_pos) = after_colon.find("Salle") {
                    let subject_part = cell_text[..colon_pos].trim().to_string();
                    // Keep only last word
                    let subject = subject_part
                        .split_whitespace()
                        .last()
                        .unwrap_or(&subject_part)
                        .to_string();
                    // If subject starts with 00, remove it
                    let subject = if subject.starts_with("00") {
                        subject.trim_start_matches("00").to_string()
                    } else {
                        subject
                    };
                    let teacher_part = after_colon[..salle_pos].trim().to_string();

                    // Clean up teacher prefix (optional)
                    let teacher_cleaned = teacher_part
                        .replace(" :", "")
                        .replace("  ", " ")
                        .trim()
                        .to_string();

                    (subject, teacher_cleaned)
                } else {
                    continue;
                }
            } else {
                continue;
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
                is_assigned: false, // TODO: Parse from HTML
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
                        // If no ID, add anyway (shouldn't happen but be safe)
                        all_colles.push(colle);
                    }
                }
            }
            Err(e) => {
                eprintln!("Warning: Failed to fetch colles for {}: {}", monday, e);
                // Continue with other weeks
            }
        }
    }
    
    println!("Fetched {} unique colles across {} weeks", all_colles.len(), monday_count);
    
    Ok(FutureCollesResponse {
        colles: all_colles,
        url: last_url,
    })
}
