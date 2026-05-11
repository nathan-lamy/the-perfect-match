#[tauri::command]
pub async fn fetch_last_week_colles(class_name: String, date: String) -> Result<serde_json::Value, String> {
    let url = format!(
        "https://api.khollise.fr/last-week-colles?className={}&date={}",
        class_name, date
    );

    // Perform the GET request
    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        let json = response.json::<serde_json::Value>()
            .await
            .map_err(|e| e.to_string())?;
        Ok(json)
    } else {
        Err(format!("API returned error status: {}", response.status()))
    }
}
