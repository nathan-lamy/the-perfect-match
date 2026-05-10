mod assignment;
mod create_colle;
mod future_colles;
mod past_colles;
mod session;
mod students;
mod types;

use std::vec;

use create_colle::{clear_colles, publish_colles};
use future_colles::fetch_future_colles;
use past_colles::fetch_last_week_colles;
use session::{login, request_session};
use students::fetch_historical_counts;

use crate::types::*;
use assignment::compute_best_pipeline;

/* === AUTHENTICATION === */
#[tauri::command(async)]
async fn authenticate(username: &str, password: &str) -> Result<String, String> {
    let session_id = request_session()
        .await
        .map_err(|e| format!("Failed to request session: {}", e))?;
    login(username, password, &session_id)
        .await
        .map_err(|e| format!("Login failed: {}", e))?;
    Ok(session_id)
}

/* === STUDENTS === */
#[tauri::command(async)]
async fn get_students(session: String, disc: Vec<i32>) -> Result<Vec<CollesCount>, String> {
    let data = fetch_historical_counts(&session, &disc)
        .await
        .map_err(|e| format!("Failed to fetch students: {}", e))?;
    Ok(data)
}

/* === ASSIGNMENT === */
#[tauri::command]
async fn compute_assignment(
    students: Vec<Student>,
    slots: Vec<Slot>,
    restrictions: Vec<Restriction>,
    past_colles: Vec<PastColle>,
    colles_count: Vec<CollesCount>,
    global_rules: Vec<SlotRule>,
    global_weights: Weights,
    passes: Vec<AssignmentPass>,
    groups: Vec<Group>,
    n: usize,
) -> Result<Vec<PassResult>, String> {
    println!(
        "Starting N-pass pipeline: {} attempts | students={} slots={} restrictions={} passes={}",
        n,
        students.len(),
        slots.len(),
        restrictions.len(),
        passes.len(),
    );

    if students.is_empty() {
        return Err("Aucun étudiant fourni".to_string());
    }
    if slots.is_empty() {
        return Err("Aucun créneau fourni".to_string());
    }

    let result = tokio::task::spawn_blocking(move || {
        compute_best_pipeline(
            students,
            slots,
            restrictions,
            past_colles,
            colles_count,
            global_rules,
            global_weights,
            passes,
            groups,
            n,
        )
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    match result {
        Some(passes) => {
            println!(
                "Pipeline successful: {} passes, {} total assignments",
                passes.len(),
                passes.iter().map(|p| p.assignments.len()).sum::<usize>(),
            );
            Ok(passes)
        }
        None => Err(
            "Impossible de trouver une attribution valide après tous les essais. \
             Vérifiez les contraintes (restrictions, créneaux disponibles)."
                .to_string(),
        ),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            authenticate,
            get_students,
            fetch_last_week_colles,
            fetch_future_colles,
            compute_assignment,
            publish_colles,
            clear_colles,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
