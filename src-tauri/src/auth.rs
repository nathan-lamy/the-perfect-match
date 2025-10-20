use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AuthData {
    pub username: String,
    pub password: String,
}

fn get_auth_file_path(app_handle: &tauri::AppHandle) -> io::Result<PathBuf> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| io::Error::new(io::ErrorKind::NotFound, e.to_string()))?;

    std::fs::create_dir_all(&dir)?;

    Ok(dir.join("auth.json"))
}

pub fn save_auth(app_handle: &tauri::AppHandle, username: &str, password: &str) -> io::Result<()> {
    let auth = AuthData {
        username: username.to_string(),
        password: password.to_string(),
    };
    let data = serde_json::to_string_pretty(&auth)?;
    let file_path = get_auth_file_path(app_handle)?;

    // Directory creation is already handled in get_auth_file_path
    let mut file = fs::File::create(file_path)?;
    file.write_all(data.as_bytes())?;
    Ok(())
}

pub fn read_auth(app_handle: &tauri::AppHandle) -> io::Result<AuthData> {
    let file_path = get_auth_file_path(app_handle)?;
    let data = fs::read_to_string(file_path)?;
    let auth: AuthData =
        serde_json::from_str(&data).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    Ok(auth)
}

pub fn auth_exists(app_handle: &tauri::AppHandle) -> bool {
    get_auth_file_path(app_handle)
        .map(|p| p.exists())
        .unwrap_or(false)
}
