mod assignment;
mod auth;
mod create_colle;
mod future_colles;
mod past_colles;
mod session;
mod store;
mod students;
mod types;

use std::vec;

use auth::{auth_exists, read_auth, save_auth};
use create_colle::{post_timetable_choice_students, post_timetable_dashboard};
use future_colles::fetch_future_colles;
use past_colles::fetch_last_week_colles;
use session::authenticate;
use students::fetch_students_table;

use crate::students::StudentsData;
use assignment::compute_best_pipeline;
use crate::types::*;

// Import store functions but not types (to avoid conflicts with crate::types)
use store::{
    add_restriction, update_restriction, delete_restriction, load_restrictions,
    add_group, update_group, delete_group, load_groups,
    add_slot_rule, update_slot_rule, delete_slot_rule, load_slot_rules,
    add_assignment_pass, update_assignment_pass, delete_assignment_pass,
    load_assignment_passes, reorder_assignment_passes,
    add_subject_quota, update_subject_quota, delete_subject_quota, load_subject_quotas,
    save_global_weights, load_global_weights,
    save_students, load_students,
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

/// Tauri command wrapper for compute_best_pipeline
///
/// This function is called from the frontend via invoke("compute_assignment", {...})
/// It implements the new N-pass pipeline architecture with configurable rules,
/// weights, and quotas.
///
/// # Arguments
/// * `students` - List of students
/// * `slots` - List of available time slots
/// * `restrictions` - List of restrictions (unavailabilities)
/// * `past_colles` - History of previous colles
/// * `colles_count` - Count of colles per teacher
/// * `global_rules` - Global slot rules (capacity/ignore)
/// * `global_weights` - Global scoring weights
/// * `passes` - Assignment passes to execute
/// * `groups` - Student groups
/// * `quotas` - Subject quotas
/// * `n` - Number of parallel attempts to make
///
/// # Returns
/// Result containing the best assignment with quota tracking or an error message
#[tauri::command]
async fn compute_assignment(
    students: Vec<Student>,
    slots: Vec<Slot>,
    restrictions: Vec<Restriction>,
    past_colles: Vec<PastColle>,
    colles_count: CollesCount,
    global_rules: Vec<SlotRule>,
    global_weights: Weights,
    passes: Vec<AssignmentPass>,
    groups: Vec<Group>,
    quotas: Vec<SubjectQuota>,
    n: usize,
) -> Result<ComputeResult, String> {
    // Log for debugging
    println!("Starting N-pass pipeline computation with {} attempts", n);
    println!(
        "Students: {}, Slots: {}, Restrictions: {}, Passes: {}, Quotas: {}",
        students.len(),
        slots.len(),
        restrictions.len(),
        passes.len(),
        quotas.len()
    );

    // Validate inputs
    if students.is_empty() {
        return Err("Aucun étudiant fourni".to_string());
    }
    if slots.is_empty() {
        return Err("Aucun créneau fourni".to_string());
    }

    // Run the computation in a blocking task to avoid blocking the async runtime
    // This is important because the computation is CPU-intensive
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
            quotas,
            n,
        )
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    // Return the result or an error
    match result {
        Some(compute_result) => {
            println!("Pipeline computation successful!");
            println!(
                "Passes completed: {}, Total assignments: {}, Quota violations: {}",
                compute_result.passes.len(),
                compute_result
                    .passes
                    .iter()
                    .map(|p| p.assignments.len())
                    .sum::<usize>(),
                compute_result.quota_violations.len()
            );
            Ok(compute_result)
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
            add_slot_rule,
            update_slot_rule,
            delete_slot_rule,
            load_slot_rules,
            add_assignment_pass,
            update_assignment_pass,
            delete_assignment_pass,
            load_assignment_passes,
            reorder_assignment_passes,
            add_subject_quota,
            update_subject_quota,
            delete_subject_quota,
            load_subject_quotas,
            save_global_weights,
            load_global_weights,
            fetch_last_week_colles,
            fetch_future_colles,
            post_timetable_dashboard,
            post_timetable_choice_students,
            compute_assignment,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
