mod auth;
mod future_colles;
mod past_colles;
mod session;
mod store;
mod students;
mod create_colle;
mod assignment;

use std::vec;

use auth::{auth_exists, read_auth, save_auth};
use future_colles::fetch_future_colles;
use past_colles::fetch_last_week_colles;
use session::authenticate;
use store::*;
use students::fetch_students_table;
use create_colle::{post_timetable_dashboard, post_timetable_choice_students};

use crate::students::StudentsData;

use assignment::compute_best_assignment;

/* === AUTH === */
#[tauri::command(async)]
async fn authenticate_and_save(
    app_handle: tauri::AppHandle,
    username: String,
    password: String,
) -> Result<String, String> {
    match authenticate(&username, &password).await {
        Ok(session) => {
            if let Err(e) = save_auth(&app_handle, &username, &password) {
                return Err(format!("Failed to save credentials: {}", e));
            }
            Ok(session)
        }
        Err(e) => Err(format!("Authentication failed: {}", e)),
    }
}

#[tauri::command(async)]
async fn load_session(app_handle: tauri::AppHandle) -> Result<String, String> {
    let (username, password) = read_auth(&app_handle)
        .map_err(|e| format!("Failed to read saved credentials: {}", e))
        .map(|r| (r.username, r.password))?;
    match authenticate(&username, &password).await {
        Ok(session) => Ok(session),
        Err(e) => Err(format!("Failed to load session: {}", e)),
    }
}

#[tauri::command]
fn check_auth_exists(app_handle: tauri::AppHandle) -> bool {
    auth_exists(&app_handle)
}

/* === STUDENTS === */
#[tauri::command(async)]
async fn get_students(
    app: tauri::AppHandle,
    cookie: String,
    disc: i32,
) -> Result<StudentsData, String> {
    // Discipline 1 is for Maths
    let students_data = fetch_students_table(&cookie, disc)
        .await
        .map_err(|e| format!("Failed to fetch students: {}", e))?;
    // Save students to local store
    let data = students_data.clone();
    let students = students_data.students;
    save_students(app, students)?;
    Ok(data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            check_auth_exists,
            authenticate_and_save,
            load_session,
            get_students,
            load_students,
            add_restriction,
            update_restriction,
            delete_restriction,
            load_restrictions,
            add_group,
            update_group,
            delete_group,
            load_groups,
            fetch_last_week_colles,
            fetch_future_colles,
            post_timetable_dashboard,
            post_timetable_choice_students,
            compute_best_assignment,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
