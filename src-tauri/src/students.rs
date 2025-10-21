use reqwest;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use std::error::Error;

use crate::store::Student;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentWithCounts {
    pub student: Student,
    pub counts: Vec<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentsData {
    pub colles_counts: CollesCount,
    pub students: Vec<Student>, // Just the list of students
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollesCount {
    pub header: Vec<String>,
    pub data: Vec<StudentWithCounts>,
}

pub async fn fetch_students_table(cookie: &str, disc: i32) -> Result<StudentsData, Box<dyn Error>> {
    // Create HTTP client
    let client = reqwest::Client::new();

    // Make request with cookie
    let response = client
        .get(format!(
            "https://bjcolle.fr/counting_orals_cdt.php?disc={}",
            disc
        ))
        .header("Cookie", cookie)
        .send()
        .await?;

    // Check if request was successful
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()).into());
    }

    // Get response text
    let html_text = response.text().await?;

    // Parse HTML
    let document = Html::parse_document(&html_text);

    // Selectors
    let table_selector = Selector::parse("table[style='border-collapse:collapse;']").unwrap();
    let row_selector = Selector::parse("tr").unwrap();
    let header_selector = Selector::parse("th").unwrap();
    let cell_selector = Selector::parse("td").unwrap();

    // Find the specific table
    let table = document
        .select(&table_selector)
        .next()
        .ok_or("No table with style='border-collapse:collapse;' found")?;

    let mut column_titles = Vec::new();
    let mut students = Vec::new();
    let mut students_with_counts = Vec::new();

    let rows: Vec<_> = table.select(&row_selector).collect();

    // First row contains column titles (teacher names)
    if let Some(first_row) = rows.first() {
        for th in first_row.select(&header_selector) {
            let id = th.value().attr("id");
            if let Some(id_val) = id {
                if id_val.starts_with("nom") {
                    let title = th.text().collect::<String>().trim().to_string();
                    if !title.is_empty() {
                        column_titles.push(title);
                    }
                }
            }
        }
    }

    // Process remaining rows (students)
    for (_, row) in rows.iter().skip(1).enumerate() {
        // Get student name from first <th class="liste_g">
        let student_name_th: Vec<_> = row.select(&header_selector).collect();

        if let Some(name_th) = student_name_th.first() {
            let class_attr = name_th.value().attr("class");
            if class_attr == Some("liste_g") {
                let full_name = name_th.text().collect::<String>().trim().to_string();

                // Parse "LASTNAME Firstname" format
                let parts: Vec<&str> = full_name.splitn(2, ' ').collect();
                if parts.len() == 2 {
                    let lastname = parts[0].to_string();
                    let firstname = parts[1].to_string();

                    let student = Student {
                        id: Student::generate_id(&firstname, &lastname),
                        last_name: lastname,
                        first_name: firstname,
                    };

                    // Get counts from <td> cells
                    let mut counts = Vec::new();
                    for td in row.select(&cell_selector) {
                        let class_attr = td.value().attr("class");
                        // Only get cells with liste5_pair or liste5_impair (skip total)
                        if class_attr == Some("liste5_pair") || class_attr == Some("liste5_impair")
                        {
                            let count_text = td.text().collect::<String>().trim().to_string();
                            if let Ok(count) = count_text.parse::<i32>() {
                                counts.push(count);
                            }
                        }
                    }

                    students.push(student.clone());
                    students_with_counts.push(StudentWithCounts { student, counts });
                }
            }
        }
    }

    println!("Fetched {} students", students.len());

    Ok(StudentsData {
        students,
        colles_counts: CollesCount {
            header: column_titles,
            data: students_with_counts,
        },
    })
}
