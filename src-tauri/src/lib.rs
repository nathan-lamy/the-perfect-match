mod auth;
mod session;
mod students;

use auth::{auth_exists, read_auth, save_auth};
use session::authenticate;
use students::{fetch_students_table, Student};

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
async fn get_students(cookie: String) -> Result<Vec<Student>, String> {
    println!("Getting students with cookie: {}", cookie);
    // Discipline 1 is for Maths
    let students_data = fetch_students_table(&cookie, 1)
        .await
        .map_err(|e| format!("Failed to fetch students: {}", e))?;
    let students = students_data.students;
    Ok(students)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            check_auth_exists,
            authenticate_and_save,
            load_session,
            get_students
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
