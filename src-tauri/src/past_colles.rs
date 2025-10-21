use reqwest;
use scraper::{Html, Selector};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct StudentColles {
    pub name: String,
    pub teachers: Vec<String>,
}

#[tauri::command(async)]
pub async fn fetch_last_week_colles(
    date: &str,
    cookie: &str,
) -> Result<Vec<StudentColles>, String> {
    // Remove slashes from date format YYYY/MM/DD -> YYYYMMDD
    let formatted_date = date.replace("/", "");

    // Build the URL
    let url = format!(
        "https://bjcolle.fr/timetable_week_billboard_cdt2.php?page={}",
        formatted_date
    );
    println!("Fetching colles for date {}: {}", date, &url);
    println!("Using cookie: {}", cookie);

    // Fetch the HTML content
    // I don't know why but we need to make an initial request to another page first
    let _ = reqwest::Client::new()
        .get("https://bjcolle.fr/index.php?an=1")
        .header("Cookie", cookie)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;
    let response = reqwest::Client::new()
        .get(&url)
        .header("Cookie", cookie)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;
    // Check if request was successful
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()).into());
    }
    let html_content = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response text: {}", e))?;

    // Parse HTML
    let document = Html::parse_document(&html_content);

    // Select the table with the specific style
    let table_selector = Selector::parse(r#"table[style="width:100%;border-collapse: collapse;"]"#)
        .map_err(|e| format!("Invalid table selector: {:?}", e))?;
    let table = document
        .select(&table_selector)
        .next()
        .ok_or("Table not found")?;

    // Select all rows (tr elements)
    let row_selector = Selector::parse("tr").unwrap();
    let th_selector = Selector::parse("th.liste2").unwrap();
    let td_selector = Selector::parse("td").unwrap();

    let mut students = Vec::new();

    // Skip the first row (header row)
    for row in table.select(&row_selector).skip(1) {
        // Get student name from the first th element
        let student_name = if let Some(th) = row.select(&th_selector).next() {
            extract_student_name(&th)
        } else {
            continue;
        };

        // Extract teachers from all td elements in the row
        let mut teachers = Vec::new();
        let div_selector = Selector::parse("div").unwrap();

        for cell in row.select(&td_selector) {
            // Iterate over div elements in each cell
            for div in cell.select(&div_selector) {
                let div_text = div.text().collect::<String>();

                // Skip divs containing "Forum" (case insensitive)
                if div_text.to_lowercase().contains("forum") {
                    continue;
                }

                // Extract teacher names (lines containing "M." or "Mme")
                for line in div_text.lines() {
                    let trimmed = line.trim();

                    // Find "M. " in the line and extract everything after it
                    if let Some(pos) = trimmed.find("M. ") {
                        let teacher = trimmed[pos..].trim().to_string();
                        if !teacher.is_empty() {
                            teachers.push(teacher);
                        }
                    }
                    // Find "Mme " in the line and extract everything after it
                    else if let Some(pos) = trimmed.find("Mme ") {
                        let teacher = trimmed[pos..].trim().to_string();
                        if !teacher.is_empty() {
                            teachers.push(teacher);
                        }
                    }
                }
            }
        }

        if !student_name.is_empty() {
            students.push(StudentColles {
                name: student_name,
                teachers,
            });
        }
    }

    println!("Extracted {} students' colles", students.len());

    Ok(students)
}

fn extract_student_name(th: &scraper::ElementRef) -> String {
    // Get all text from the th element
    let full_text = th.text().collect::<String>();

    // The student name is typically the first line
    // Example: "ALADJIDI Camille" appears before other content
    full_text.lines().next().unwrap_or("").trim().to_string()
}
