use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

// Re-export types from crate::types to avoid duplication
pub use crate::types::{Student, Restriction, Group};

// Helper for Student ID generation
impl Student {
    pub fn generate_id(first_name: &str, last_name: &str) -> String {
        format!("{}@{}", first_name, last_name)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppData {
    pub students: Vec<Student>,
    pub restrictions: Vec<Restriction>,
    pub groups: Vec<Group>,
    #[serde(default)]
    pub slot_rules: Vec<crate::types::SlotRule>,
    #[serde(default)]
    pub assignment_passes: Vec<crate::types::AssignmentPass>,
    #[serde(default)]
    pub subject_quotas: Vec<crate::types::SubjectQuota>,
    #[serde(default)]
    pub global_weights: Option<crate::types::Weights>,
}

impl Default for AppData {
    fn default() -> Self {
        AppData {
            students: Vec::new(),
            restrictions: Vec::new(),
            groups: Vec::new(),
            slot_rules: Vec::new(),
            assignment_passes: Vec::new(),
            subject_quotas: Vec::new(),
            global_weights: None,
        }
    }
}

fn get_data_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())
        .map(|path| path.join("data.json"))
}

fn load_data(app: AppHandle) -> Result<AppData, String> {
    let path = get_data_path(&app)?;

    if !path.exists() {
        return Ok(AppData::default());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("Error reading file: {}", e))?;

    serde_json::from_str(&content).map_err(|e| format!("Error parsing JSON: {}", e))
}

fn save_data(app: AppHandle, data: &AppData) -> Result<(), String> {
    let path = get_data_path(&app)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Error creating directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Error serializing JSON: {}", e))?;

    fs::write(&path, json).map_err(|e| format!("Error writing file: {}", e))
}

#[tauri::command]
pub fn save_students(app: AppHandle, students: Vec<Student>) -> Result<Vec<Student>, String> {
    let mut data = load_data(app.clone())?;
    data.students = students;
    save_data(app, &data)?;
    Ok(data.students.clone())
}

#[tauri::command]
pub fn load_students(app: AppHandle) -> Result<Vec<Student>, String> {
    let data = load_data(app)?;
    Ok(data.students)
}

// ============= Tauri Commands - Restrictions =============

#[tauri::command]
pub fn add_restriction(
    app: AppHandle,
    activity_name: String,
    start_time: String,
    end_time: String,
    day: String,
    student_ids: Vec<String>,
) -> Result<Restriction, String> {
    let mut data = load_data(app.clone())?;

    let restriction = Restriction {
        id: Uuid::new_v4().to_string(),
        activity_name,
        start_time,
        end_time,
        day,
        student_ids,
    };

    data.restrictions.push(restriction.clone());
    save_data(app, &data)?;

    Ok(restriction)
}

#[tauri::command]
pub fn update_restriction(
    app: AppHandle,
    id: String,
    activity_name: String,
    start_time: String,
    end_time: String,
    day: String,
    student_ids: Vec<String>,
) -> Result<Restriction, String> {
    let mut data = load_data(app.clone())?;

    let restriction = data
        .restrictions
        .iter_mut()
        .find(|r| r.id == id)
        .ok_or("Restriction not found")?;

    restriction.activity_name = activity_name;
    restriction.start_time = start_time;
    restriction.end_time = end_time;
    restriction.day = day;
    restriction.student_ids = student_ids;
    let updated_restriction = restriction.clone();

    save_data(app, &data)?;
    Ok(updated_restriction)
}

#[tauri::command]
pub fn delete_restriction(app: AppHandle, id: String) -> Result<(), String> {
    let mut data = load_data(app.clone())?;

    data.restrictions.retain(|r| r.id != id);

    save_data(app, &data)
}

#[tauri::command]
pub fn load_restrictions(app: AppHandle) -> Result<Vec<Restriction>, String> {
    let data = load_data(app)?;
    Ok(data.restrictions)
}

// ============= Tauri Commands - Groups =============

#[tauri::command]
pub fn add_group(app: AppHandle, name: String, student_ids: Vec<String>) -> Result<Group, String> {
    let mut data = load_data(app.clone())?;

    let group = Group {
        id: Uuid::new_v4().to_string(),
        name,
        student_ids,
    };

    data.groups.push(group.clone());
    save_data(app, &data)?;

    Ok(group)
}

#[tauri::command]
pub fn update_group(
    app: AppHandle,
    id: String,
    name: String,
    student_ids: Vec<String>,
) -> Result<(), String> {
    let mut data = load_data(app.clone())?;

    let group = data
        .groups
        .iter_mut()
        .find(|g| g.id == id)
        .ok_or("Group not found")?;

    group.name = name;
    group.student_ids = student_ids;

    save_data(app, &data)
}

#[tauri::command]
pub fn delete_group(app: AppHandle, id: String) -> Result<(), String> {
    let mut data = load_data(app.clone())?;

    data.groups.retain(|g| g.id != id);

    save_data(app, &data)
}

#[tauri::command]
pub fn load_groups(app: AppHandle) -> Result<Vec<Group>, String> {
    let data = load_data(app)?;
    Ok(data.groups)
}

// ============= Tauri Commands - Slot Rules =============

#[tauri::command]
pub fn add_slot_rule(
    app: AppHandle,
    rule: crate::types::SlotRule,
) -> Result<crate::types::SlotRule, String> {
    let mut data = load_data(app.clone())?;
    data.slot_rules.push(rule.clone());
    save_data(app, &data)?;
    Ok(rule)
}

#[tauri::command]
pub fn update_slot_rule(
    app: AppHandle,
    rule: crate::types::SlotRule,
) -> Result<crate::types::SlotRule, String> {
    let mut data = load_data(app.clone())?;
    let existing = data
        .slot_rules
        .iter_mut()
        .find(|r| r.id == rule.id)
        .ok_or("Slot rule not found")?;
    *existing = rule.clone();
    save_data(app, &data)?;
    Ok(rule)
}

#[tauri::command]
pub fn delete_slot_rule(app: AppHandle, id: String) -> Result<(), String> {
    let mut data = load_data(app.clone())?;
    data.slot_rules.retain(|r| r.id != id);
    save_data(app, &data)
}

#[tauri::command]
pub fn load_slot_rules(app: AppHandle) -> Result<Vec<crate::types::SlotRule>, String> {
    let data = load_data(app)?;
    Ok(data.slot_rules)
}

// ============= Tauri Commands - Assignment Passes =============

#[tauri::command]
pub fn add_assignment_pass(
    app: AppHandle,
    pass: crate::types::AssignmentPass,
) -> Result<crate::types::AssignmentPass, String> {
    let mut data = load_data(app.clone())?;
    data.assignment_passes.push(pass.clone());
    save_data(app, &data)?;
    Ok(pass)
}

#[tauri::command]
pub fn update_assignment_pass(
    app: AppHandle,
    pass: crate::types::AssignmentPass,
) -> Result<crate::types::AssignmentPass, String> {
    let mut data = load_data(app.clone())?;
    let existing = data
        .assignment_passes
        .iter_mut()
        .find(|p| p.id == pass.id)
        .ok_or("Assignment pass not found")?;
    *existing = pass.clone();
    save_data(app, &data)?;
    Ok(pass)
}

#[tauri::command]
pub fn delete_assignment_pass(app: AppHandle, id: String) -> Result<(), String> {
    let mut data = load_data(app.clone())?;
    data.assignment_passes.retain(|p| p.id != id);
    save_data(app, &data)
}

#[tauri::command]
pub fn load_assignment_passes(
    app: AppHandle,
) -> Result<Vec<crate::types::AssignmentPass>, String> {
    let data = load_data(app)?;
    Ok(data.assignment_passes)
}

#[tauri::command]
pub fn reorder_assignment_passes(
    app: AppHandle,
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    let mut data = load_data(app.clone())?;
    
    // Create a new ordered vector
    let mut reordered = Vec::new();
    for id in ordered_ids {
        if let Some(pass) = data.assignment_passes.iter().find(|p| p.id == id) {
            reordered.push(pass.clone());
        }
    }
    
    data.assignment_passes = reordered;
    save_data(app, &data)
}

// ============= Tauri Commands - Subject Quotas =============

#[tauri::command]
pub fn add_subject_quota(
    app: AppHandle,
    quota: crate::types::SubjectQuota,
) -> Result<crate::types::SubjectQuota, String> {
    let mut data = load_data(app.clone())?;
    data.subject_quotas.push(quota.clone());
    save_data(app, &data)?;
    Ok(quota)
}

#[tauri::command]
pub fn update_subject_quota(
    app: AppHandle,
    quota: crate::types::SubjectQuota,
) -> Result<crate::types::SubjectQuota, String> {
    let mut data = load_data(app.clone())?;
    let existing = data
        .subject_quotas
        .iter_mut()
        .find(|q| q.id == quota.id)
        .ok_or("Subject quota not found")?;
    *existing = quota.clone();
    save_data(app, &data)?;
    Ok(quota)
}

#[tauri::command]
pub fn delete_subject_quota(app: AppHandle, id: String) -> Result<(), String> {
    let mut data = load_data(app.clone())?;
    data.subject_quotas.retain(|q| q.id != id);
    save_data(app, &data)
}

#[tauri::command]
pub fn load_subject_quotas(
    app: AppHandle,
) -> Result<Vec<crate::types::SubjectQuota>, String> {
    let data = load_data(app)?;
    Ok(data.subject_quotas)
}

// ============= Tauri Commands - Global Weights =============

#[tauri::command]
pub fn save_global_weights(
    app: AppHandle,
    weights: crate::types::Weights,
) -> Result<(), String> {
    let mut data = load_data(app.clone())?;
    data.global_weights = Some(weights);
    save_data(app, &data)
}

#[tauri::command]
pub fn load_global_weights(app: AppHandle) -> Result<crate::types::Weights, String> {
    let data = load_data(app)?;
    Ok(data.global_weights.unwrap_or(crate::types::DEFAULT_WEIGHTS))
}
