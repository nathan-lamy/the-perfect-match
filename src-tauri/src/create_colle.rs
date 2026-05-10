use regex::Regex;
use reqwest::Client;
use std::collections::HashMap;
use tauri::Emitter;

#[derive(Debug, serde::Deserialize)]
pub struct AssignmentToPublish {
    pub student: String,
    pub slot_id: String, // e.g. "COCHER_XXX"
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ColleProgressEvent {
    pub slot_id: String,
    pub done: usize,
    pub total: usize,
    pub error: Option<String>,
}

/// Groups assignments by slot, then publishes each slot's students.
#[tauri::command]
pub async fn publish_colles(
    app: tauri::AppHandle,
    assignments: Vec<AssignmentToPublish>,
    cookie: String,
    origin: String,
) -> Result<(), String> {
    let client = Client::new();

    let mut by_slot: HashMap<String, Vec<String>> = HashMap::new();
    for a in assignments {
        by_slot.entry(a.slot_id).or_default().push(a.student);
    }

    let total = by_slot.len();
    for (done, (slot_id, students)) in by_slot.iter().enumerate() {
        let result = async {
            let choice_path = post_timetable_dashboard(&client, &slot_id, &cookie, &origin).await?;
            let choice_url = format!("https://bjcolle.fr/{}", choice_path);
            post_timetable_choice_students(&client, &choice_url, &students, &cookie).await
        }
        .await;

        app.emit(
            "colle-progress",
            ColleProgressEvent {
                slot_id: slot_id.clone(),
                done: done + 1,
                total,
                error: result.err(),
            },
        )
        .ok();

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    Ok(())
}

/// Clears all students from the given slots.
#[tauri::command]
pub async fn clear_colles(
    slot_ids: Vec<String>,
    cookie: String,
    origin: String,
) -> Result<(), String> {
    // Empty student list for each slot = nuke
    let by_slot: HashMap<String, Vec<String>> =
        slot_ids.into_iter().map(|id| (id, vec![])).collect();

    publish_slots(&by_slot, &cookie, &origin).await
}

/// Shared logic: for each slot, POST to dashboard then POST to choice students.
async fn publish_slots(
    by_slot: &HashMap<String, Vec<String>>,
    cookie: &str,
    origin: &str,
) -> Result<(), String> {
    let client = Client::new();

    for (slot_id, students) in by_slot {
        // Step 1: POST to dashboard to get the choice URL
        let choice_path = post_timetable_dashboard(&client, slot_id, cookie, origin).await?;
        let choice_url = format!("https://bjcolle.fr/{}", choice_path);

        // Step 2: POST students to the choice endpoint
        post_timetable_choice_students(&client, &choice_url, students, cookie).await?;

        tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
    }

    Ok(())
}

async fn post_timetable_dashboard(
    client: &Client,
    checkbox_id: &str,
    cookie: &str,
    origin: &str,
) -> Result<String, String> {
    // Warm up the session
    client
        .get(origin)
        .header("Cookie", cookie)
        .send()
        .await
        .map_err(|e| format!("Initial GET failed: {}", e))?;

    let url = "https://bjcolle.fr/timetable_dashboard_period.php";

    let mut form_data = HashMap::new();
    form_data.insert(
        "Liste2",
        "timetable_dashboard_period.php%3Fdisc%3D0".to_string(),
    );
    form_data.insert("NOM_COLLEUR_SEARCH", "".to_string());
    form_data.insert(checkbox_id, "Choisir+les+%C3%A9l%C3%A8ves".to_string());

    let text = client
        .post(url)
        .header("Cookie", cookie)
        .header("Referer", origin)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&form_data)
        .send()
        .await
        .map_err(|e| format!("Dashboard POST failed: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Failed to read dashboard response: {}", e))?;

    let re = Regex::new(r"timetable_choice_students_period\.php\?creneau=\d+&hzgedytr23treyu=\d+")
        .map_err(|e| format!("Regex error: {}", e))?;

    re.find(&text)
        .map(|m| m.as_str().to_string())
        .ok_or_else(|| {
            format!(
                "Choice URL not found in dashboard response for slot {}",
                checkbox_id
            )
        })
}

async fn post_timetable_choice_students(
    client: &Client,
    url: &str,
    students: &[String],
    cookie: &str,
) -> Result<(), String> {
    let mut form_data = HashMap::new();
    form_data.insert("Liste_tribu".to_string(), format!("{}%26tribe%3D0", url));
    form_data.insert("Liste_groupe".to_string(), format!("{}%26group%3D0", url));
    form_data.insert(
        "Liste_colles_matiere".to_string(),
        format!("{}%26c%3D282983%26d%3D1%26e%3D%26cm%3D-1", url),
    );
    form_data.insert(
        "Liste_colles_colleur".to_string(),
        format!("{}%26c%3D282983%26d%3D1%26e%3D%26cc%3D-1", url),
    );
    form_data.insert("datepicker_go".to_string(), "25%2F08%2F2025".to_string());
    for student in students {
        form_data.insert(student.clone(), "on".to_string());
    }
    form_data.insert("VALIDER_STUDENTS".to_string(), "Enregistrer".to_string());

    let response = client
        .post(url)
        .header("Cookie", cookie)
        .header("Referer", url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&form_data)
        .send()
        .await
        .map_err(|e| format!("Choice POST failed: {}", e))?;

    if response.status().is_success() || response.status().is_redirection() {
        Ok(())
    } else {
        Err(format!(
            "Choice POST returned status: {}",
            response.status()
        ))
    }
}
