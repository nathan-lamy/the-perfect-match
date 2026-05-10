use reqwest;
use scraper::{Html, Selector};
use std::collections::HashMap;
use std::error::Error;

use crate::types::CollesCount;

pub async fn fetch_historical_counts(
    cookie: &str,
    discs: &[i32],
) -> Result<Vec<CollesCount>, Box<dyn Error>> {
    let mut results = Vec::new();

    for &disc in discs {
        let client = reqwest::Client::new();

        let response = client
            .get(format!(
                "https://bjcolle.fr/counting_orals_cdt.php?disc={}",
                disc
            ))
            .header("Cookie", cookie)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("HTTP error for disc {}: {}", disc, response.status()).into());
        }

        let html_text = response.text().await?;
        let document = Html::parse_document(&html_text);

        // Extract selected option text (equivalent to document.querySelector("option[selected]").textContent)
        let option_selector = Selector::parse("option[selected]").unwrap();
        let disc_name = document
            .select(&option_selector)
            .next()
            .map(|el| el.text().collect::<String>().trim().to_string())
            .ok_or_else(|| format!("No selected option found for disc {}", disc))?;

        // Reuse table parsing logic
        let table_selector = Selector::parse("table[style='border-collapse:collapse;']").unwrap();
        let row_selector = Selector::parse("tr").unwrap();
        let header_selector = Selector::parse("th").unwrap();
        let cell_selector = Selector::parse("td").unwrap();

        let table = document
            .select(&table_selector)
            .next()
            .ok_or_else(|| format!("No table found for disc {}", disc))?;

        let mut teacher_names: Vec<String> = Vec::new();
        let mut counts: HashMap<String, HashMap<String, i32>> = HashMap::new();

        let rows: Vec<_> = table.select(&row_selector).collect();

        if let Some(first_row) = rows.first() {
            for th in first_row.select(&header_selector) {
                if let Some(id_val) = th.value().attr("id") {
                    if id_val.starts_with("nom") {
                        let title = th.text().collect::<String>().trim().to_string();
                        if !title.is_empty() {
                            teacher_names.push(title);
                        }
                    }
                }
            }
        }

        for row in rows.iter().skip(1) {
            let student_name_th: Vec<_> = row.select(&header_selector).collect();

            if let Some(name_th) = student_name_th.first() {
                if name_th.value().attr("class") != Some("liste_g") {
                    continue;
                }

                let full_name = name_th.text().collect::<String>().trim().to_string();
                let parts: Vec<&str> = full_name.splitn(2, ' ').collect();
                if parts.len() != 2 {
                    continue;
                }

                let mut teacher_counts: HashMap<String, i32> = HashMap::new();
                let td_cells: Vec<_> = row
                    .select(&cell_selector)
                    .filter(|td| {
                        matches!(
                            td.value().attr("class"),
                            Some("liste5_pair") | Some("liste5_impair")
                        )
                    })
                    .collect();

                for (i, td) in td_cells.iter().enumerate() {
                    if let Some(teacher) = teacher_names.get(i) {
                        let count = td
                            .text()
                            .collect::<String>()
                            .trim()
                            .parse::<i32>()
                            .unwrap_or(0);
                        teacher_counts.insert(teacher.clone(), count);
                    }
                }

                counts.insert(full_name, teacher_counts);
            }
        }

        results.push(CollesCount {
            name: disc_name,
            id: disc,
            counts,
        });
    }

    Ok(results)
}
