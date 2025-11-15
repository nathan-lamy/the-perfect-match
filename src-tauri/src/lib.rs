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

use assignment::{
    Student, FutureSlot, Restriction, PastColle, 
    StudentCounts, CollesCount, Assignment, 
    AssignmentResult, ComputeResult
};

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

/// Tauri command wrapper for compute_best_assignment
/// 
/// This function is called from the frontend via invoke("compute_best_assignment", {...})
/// It takes ownership of the data (Vec instead of &[]) because Tauri passes owned data
/// 
/// # Arguments
/// * `students` - List of students
/// * `slots` - List of available time slots
/// * `restrictions` - List of restrictions (unavailabilities)
/// * `past_colles` - History of previous colles
/// * `math_count` - Count of math colles per teacher
/// * `phys_group` - IDs of students in physics group
/// * `phys_count` - Count of physics colles per teacher
/// * `n` - Number of parallel attempts to make
/// 
/// # Returns
/// Result containing the best assignment or an error message
#[tauri::command]
pub async fn compute_best_assignment(
    students: Vec<Student>,
    slots: Vec<FutureSlot>,
    restrictions: Vec<Restriction>,
    past_colles: Vec<PastColle>,
    math_count: CollesCount,
    phys_group: Vec<String>,
    phys_count: CollesCount,
    n: usize,
) -> Result<ComputeResult, String> {
    // Log for debugging
    println!("Starting assignment computation with {} attempts", n);
    println!("Students: {}, Slots: {}, Restrictions: {}", 
             students.len(), slots.len(), restrictions.len());
    
    // Validate inputs
    if students.is_empty() {
        return Err("Aucun étudiant fourni".to_string());
    }
    if slots.is_empty() {
        return Err("Aucun créneau fourni".to_string());
    }
    if n == 0 {
        return Err("Le nombre d'essais doit être supérieur à 0".to_string());
    }
    if n > 100 {
        return Err("Le nombre d'essais ne peut pas dépasser 100 pour éviter une surcharge".to_string());
    }

    // Run the computation in a blocking task to avoid blocking the async runtime
    // This is important because the computation is CPU-intensive
    let result = tokio::task::spawn_blocking(move || {
        assignment_algorithm::compute_best_assignment(
            students,
            slots,
            restrictions,
            past_colles,
            math_count,
            phys_group,
            phys_count,
            n,
        )
    })
    .await
    .map_err(|e| format!("Erreur lors de l'exécution du calcul: {}", e))?;

    // Return the result or an error
    match result {
        Some(compute_result) => {
            println!("Assignment computation successful!");
            println!("Math assignments: {}, Physics assignments: {}", 
                     compute_result.math.assignments.len(),
                     compute_result.physics.assignments.len());
            Ok(compute_result)
        }
        None => {
            Err("Impossible de trouver une attribution valide après tous les essais. Vérifiez les contraintes (restrictions, créneaux disponibles).".to_string())
        }
    }
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
