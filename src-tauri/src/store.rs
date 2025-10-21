use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Student {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
}
impl Student {
    pub fn generate_id(first_name: &str, last_name: &str) -> String {
        format!("{}@{}", first_name, last_name)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Restriction {
    pub id: String,
    pub activity_name: String,
    pub start_time: String,
    pub end_time: String,
    pub day: String,
    pub student_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub id: String,
    pub name: String,
    pub student_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppData {
    pub students: Vec<Student>,
    pub restrictions: Vec<Restriction>,
    pub groups: Vec<Group>,
}

impl Default for AppData {
    fn default() -> Self {
        AppData {
            students: Vec::new(),
            restrictions: Vec::new(),
            groups: Vec::new(),
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
