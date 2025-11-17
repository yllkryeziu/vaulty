// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod db;
pub mod commands;
pub mod gemini;

use tauri::Manager;
use commands::{DbPath, AppDir};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize database on startup
            let app_dir = app.path().app_data_dir().expect("Failed to get app data directory");
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data directory");

            let db_path = app_dir.join("vaulty.db");
            db::init_db(&db_path).expect("Failed to initialize database");

            // Store paths in app state with wrapper types
            app.manage(DbPath(db_path));
            app.manage(AppDir(app_dir));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::save_api_key,
            commands::get_api_key,
            commands::extract_exercises_with_ai,
            commands::save_week_data,
            commands::get_all_courses,
            commands::get_course_data,
            commands::update_exercise,
            commands::delete_exercise,
            commands::search_exercises,
            commands::filter_by_tags,
            commands::save_image,
            commands::get_image_path,
            commands::delete_week_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
