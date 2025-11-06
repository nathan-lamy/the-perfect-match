use regex::Regex;
use reqwest::Client;
use std::collections::HashMap;

/// Posts to the timetable dashboard and returns the Location header from the redirect
///
/// # Arguments
/// * `checkbox_id` - The checkbox ID to include in parameter
/// * `cookie` - The cookie string for authentication
///
/// # Returns
/// * `Ok(String)` - The Location header value if present
/// * `Err` - If the request fails or Location header is missing
#[tauri::command(async)]
pub async fn post_timetable_dashboard(
    checkbox_id: &str,
    cookie: &str,
    from: &str,
) -> Result<String, String> {
    // Build request client, request from URL then POST to URL; keep session cookies
    let client = Client::builder()
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let _ = client
        .get(from) // "https://bjcolle.fr/"
        .header("Cookie", cookie)
        .send()
        .await
        .map_err(|e| format!("Initial GET request failed: {}", e))?;

    let url = "https://bjcolle.fr/timetable_dashboard_period.php";

    // Build form data
    let mut form_data = HashMap::new();
    form_data.insert("Liste2", "timetable_dashboard_period.php%3Fdisc%3D0");
    form_data.insert("NOM_COLLEUR_SEARCH", "");
    form_data.insert(checkbox_id, "Choisir+les+%C3%A9l%C3%A8ves");

    // Make POST request
    let response = client
        .post(url)
        .header("Cookie", cookie)
        .header("Referer", from)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&form_data)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    // Find target URL
    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response text: {}", e))?;
    // Regex pattern to match the target URL
    let re = Regex::new(r"timetable_choice_students_period\.php\?creneau=\d+&hzgedytr23treyu=\d+")
        .map_err(|e| format!("Failed to compile regex: {}", e))?;

    // Find the first match or return an empty string
    let result = re
        .find(&text)
        .map(|m| m.as_str().to_string())
        .unwrap_or_else(|| "".to_string());

    Ok(result)
}

/// Posts to the timetable choice students endpoint with dynamic form data
///
/// # Arguments
/// * `url` - The full URL to POST to (e.g., "https://bjcolle.fr/timetable_choice_students_period.php?creneau=282983&hzgedytr23treyu=568742")
/// * `student_id` - The student ID for the checkbox (e.g., "E30")
/// * `date` - The date in format DD/MM/YYYY (e.g., "25/08/2025")
/// * `cookie` - The cookie string for authentication
///
/// # Returns
/// * `Ok(())` - If the request succeeds
/// * `Err` - If the request fails
#[tauri::command(async)]
pub async fn post_timetable_choice_students(
    url: &str,
    students_id: Vec<&str>,
    cookie: &str,
) -> Result<(), String> {
    let client = Client::new();

    // Build form data dynamically
    let mut form_data = HashMap::new();

    form_data.insert("Liste_tribu", format!("{}%26tribe%3D0", url));
    form_data.insert("Liste_groupe", format!("{}%26group%3D0", url));
    form_data.insert(
        "Liste_colles_matiere",
        format!("{}%26c%3D282983%26d%3D1%26e%3D%26cm%3D-1", url),
    );
    form_data.insert(
        "Liste_colles_colleur",
        format!("{}%26c%3D282983%26d%3D1%26e%3D%26cc%3D-1", url),
    );
    form_data.insert("datepicker_go", "25%2F08%2F2025".to_string());
    for student_id in students_id {
        form_data.insert(student_id, "on".to_string());
    }
    form_data.insert("VALIDER_STUDENTS", "Enregistrer".to_string());

    // Make POST request
    let response = client
        .post(url)
        .header("Cookie", cookie)
        .header("Referer", url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&form_data)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    // Check if request was successful
    if response.status().is_success() || response.status().is_redirection() {
        Ok(())
    } else {
        Err(format!("Request failed with status: {}", response.status()).into())
    }
}
