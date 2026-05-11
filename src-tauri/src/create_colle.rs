use reqwest::Client;
use std::collections::HashMap;
use tauri::Emitter;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ColleProgressEvent {
    pub slot_id: String,
    pub done: Vec<String>,
    pub total: usize,
    pub error: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct AssignmentToPublish {
    pub slot_id: String,
    pub student: String,
}

/// Parse student name -> id map from the billboard HTML
/// Format: <tr id=3155><th class=liste2><div ... >LAST NAME First Name<div class=flex-container_creneaux>
fn parse_student_map(html: &str) -> Result<HashMap<String, String>, String> {
    let mut map = HashMap::new();

    // Each student row starts with <tr id=DIGITS>
    for tr_chunk in html.split("<tr id=") {
        // Extract the tr id (student id)
        let Some(id_end) = tr_chunk.find('>') else {
            continue;
        };
        let student_id = tr_chunk[..id_end].trim().to_string();

        // Must be purely numeric to be a student row
        if !student_id.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }

        // Find the name: it sits between the last '>' before <div class=flex-container_creneaux
        // and that div itself
        let Some(flex_pos) = tr_chunk.find("<div class=flex-container_creneaux") else {
            continue;
        };

        // Walk backwards from flex_pos to find the preceding '>'
        let before_flex = &tr_chunk[..flex_pos];
        let Some(last_gt) = before_flex.rfind('>') else {
            continue;
        };

        let name = before_flex[last_gt + 1..].trim().to_string();

        if !name.is_empty() {
            map.insert(name, student_id);
        }
    }

    eprintln!("[parse_student_map] Found {} students", map.len());

    if map.is_empty() {
        return Err("No students found in billboard page — check cookie or date".to_string());
    }

    Ok(map)
}

/// Extract all (student_id, slot_id) pairs from assigned td cells
/// td id format: j2e3155c400073d1  =>  student=3155, slot=400073
fn parse_assigned_pairs(html: &str) -> Vec<(String, String)> {
    let mut pairs = Vec::new();

    // Each assigned cell contains draggable='true', and its td has an id like j2e3155c400073d1
    // Split on draggable='true' and look backwards for the enclosing td id
    for chunk in html.split("draggable='true'") {
        // Find the last td id= before this draggable div
        let Some(td_id_pos) = chunk.rfind("id='j") else {
            continue;
        };

        let after_id = &chunk[td_id_pos + 4..]; // skip "id='"
        let Some(quote_end) = after_id.find('\'') else {
            continue;
        };

        let td_id = &after_id[..quote_end]; // e.g. "j2e3155c400073d1"

        // Parse j{day}e{student}c{slot}d{n}
        let Some(e_pos) = td_id.find('e') else {
            continue;
        };
        let Some(c_pos) = td_id.find('c') else {
            continue;
        };
        let Some(d_pos) = td_id.find('d') else {
            continue;
        };

        let student_id = td_id[e_pos + 1..c_pos].to_string();
        let slot_id = td_id[c_pos + 1..d_pos].to_string();

        if !student_id.is_empty() && !slot_id.is_empty() {
            pairs.push((student_id, slot_id));
        }
    }

    pairs
}

async fn fetch_student_map(
    client: &Client,
    cookie: &str,
    date: &str,
) -> Result<HashMap<String, String>, String> {
    let url = format!(
        "https://bjcolle.fr/timetable_week_billboard_cdt2.php?page={}",
        date
    );
    let html = fetch_page(client, cookie, &url).await?;
    parse_student_map(&html)
}

async fn fetch_page(client: &Client, cookie: &str, url: &str) -> Result<String, String> {
    client
        .get(url)
        .header("Cookie", cookie)
        .send()
        .await
        .map_err(|e| format!("GET {} failed: {}", url, e))?
        .text()
        .await
        .map_err(|e| format!("Failed to read response from {}: {}", url, e))
}

async fn visit_slot(client: &Client, cookie: &str, slot_id: &str) -> Result<(), String> {
    let url = format!(
        "https://bjcolle.fr/timetable_week_billboard_cdt2.php?crt={}",
        slot_id
    );
    fetch_page(client, cookie, &url).await?;
    Ok(())
}

async fn insert_student(
    client: &Client,
    cookie: &str,
    slot_id: &str,
    student_id: &str,
) -> Result<(), String> {
    let url = format!(
        "https://bjcolle.fr/timetable_week_billboard_cdt2_insert.php?c={}&el={}",
        slot_id, student_id
    );
    let response = client
        .get(&url)
        .header("Cookie", cookie)
        .send()
        .await
        .map_err(|e| {
            format!(
                "Insert failed for student {} in slot {}: {}",
                student_id, slot_id, e
            )
        })?;

    if response.status().is_success() || response.status().is_redirection() {
        Ok(())
    } else {
        Err(format!(
            "Insert returned {} for student {} in slot {}",
            response.status(),
            student_id,
            slot_id
        ))
    }
}

async fn delete_assignment(
    client: &Client,
    cookie: &str,
    student_id: &str,
    slot_id: &str,
) -> Result<(), String> {
    let url = format!(
        "https://bjcolle.fr/timetable_week_billboard_cdt2_delete.php?eleve={}&c={}",
        student_id, slot_id
    );
    let response = client
        .get(&url)
        .header("Cookie", cookie)
        .send()
        .await
        .map_err(|e| {
            format!(
                "Delete failed for student {} in slot {}: {}",
                student_id, slot_id, e
            )
        })?;

    if response.status().is_success() || response.status().is_redirection() {
        Ok(())
    } else {
        Err(format!(
            "Delete returned {} for student {} in slot {}",
            response.status(),
            student_id,
            slot_id
        ))
    }
}

#[tauri::command]
pub async fn publish_colles(
    app: tauri::AppHandle,
    assignments: Vec<AssignmentToPublish>,
    cookie: String,
    date: String,
) -> Result<(), String> {
    let client = Client::new();

    let mut by_slot: HashMap<String, Vec<String>> = HashMap::new();
    for a in assignments {
        by_slot.entry(a.slot_id).or_default().push(a.student);
    }

    let total = by_slot.len();
    let student_map = fetch_student_map(&client, &cookie, &date).await?;
    let mut done: Vec<String> = Vec::new();
    let mut last_slot_id = String::new();

    for (slot_id, students) in &by_slot {
        let result: Result<(), String> = async {
            visit_slot(&client, &cookie, slot_id).await?;
            for student_name in students {
                let student_id = student_map
                    .get(student_name)
                    .ok_or_else(|| format!("Student '{}' not found in billboard", student_name))?;
                insert_student(&client, &cookie, slot_id, student_id).await?;
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
            Ok(())
        }
        .await;

        if result.is_ok() {
            done.push(slot_id.clone());
            last_slot_id = slot_id.clone();
        }

        app.emit(
            "colle-progress",
            ColleProgressEvent {
                slot_id: slot_id.clone(),
                done: done.clone(),
                total,
                error: result.err(),
            },
        )
        .ok();

        tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
    }

    if !last_slot_id.is_empty() {
        visit_slot(&client, &cookie, &last_slot_id).await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn clear_colles(
    app: tauri::AppHandle,
    cookie: String,
    date: String,
) -> Result<(), String> {
    let client = Client::new();

    let url = format!(
        "https://bjcolle.fr/timetable_week_billboard_cdt2.php?page={}",
        date
    );
    let html = fetch_page(&client, &cookie, &url).await?;
    let pairs = parse_assigned_pairs(&html);

    if pairs.is_empty() {
        return Ok(());
    }

    let total = pairs.len();
    let mut done: Vec<String> = Vec::new();

    for (student_id, slot_id) in &pairs {
        delete_assignment(&client, &cookie, student_id, slot_id).await?;
        done.push(slot_id.clone());

        app.emit(
            "nuke-progress",
            ColleProgressEvent {
                slot_id: slot_id.clone(),
                done: done.clone(),
                total,
                error: None,
            },
        )
        .ok();

        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
    }

    Ok(())
}
