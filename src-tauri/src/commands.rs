use crate::db;
use crate::gemini;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::State;
use base64::Engine;

// Wrapper types to distinguish between different PathBuf states
pub struct DbPath(pub std::path::PathBuf);
pub struct AppDir(pub std::path::PathBuf);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExerciseData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<i64>,
    pub name: String,
    pub tags: Vec<String>,
    pub image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeekData {
    pub exercises: Vec<ExerciseData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseData {
    pub weeks: std::collections::HashMap<String, WeekData>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseState {
    pub courses: std::collections::HashMap<String, CourseData>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseInfo {
    pub id: i64,
    pub name: String,
    pub tags: Vec<String>,
    pub image_path: Option<String>,
}

// API Key Management
#[tauri::command]
pub async fn save_api_key(
    api_key: String,
    db_path: State<'_, DbPath>,
) -> Result<(), String> {
    let conn = db::get_connection(&db_path.0).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?1, ?2)",
        params!["gemini_api_key", api_key],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_api_key(db_path: State<'_, DbPath>) -> Result<Option<String>, String> {
    let conn = db::get_connection(&db_path.0).map_err(|e| e.to_string())?;

    let result = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params!["gemini_api_key"],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

// Gemini AI Integration
#[tauri::command]
pub async fn extract_exercises_with_ai(
    images: Vec<String>,
    db_path: State<'_, DbPath>,
) -> Result<gemini::GeminiResponse, String> {
    // Get API key from database
    let api_key = get_api_key(db_path)
        .await?
        .ok_or("API key not configured")?;

    // Call Gemini API
    let response = gemini::extract_exercises_from_images(&api_key, images)
        .await
        .map_err(|e| e.to_string())?;

    Ok(response)
}

// Database Operations
#[tauri::command]
pub async fn save_week_data(
    course_name: String,
    week_number: i32,
    exercises: Vec<ExerciseData>,
    db_path: State<'_, DbPath>,
) -> Result<(), String> {
    eprintln!("save_week_data called: course={}, week={}, exercises_count={}", course_name, week_number, exercises.len());

    let conn = db::get_connection(&db_path.0).map_err(|e| {
        eprintln!("Failed to get DB connection: {}", e);
        e.to_string()
    })?;

    // Start transaction
    let tx = conn.unchecked_transaction().map_err(|e| {
        eprintln!("Failed to start transaction: {}", e);
        e.to_string()
    })?;

    // Insert or get course
    tx.execute(
        "INSERT OR IGNORE INTO courses (name) VALUES (?1)",
        params![course_name],
    )
    .map_err(|e| {
        eprintln!("Failed to insert course: {}", e);
        e.to_string()
    })?;

    let course_id: i64 = tx
        .query_row(
            "SELECT id FROM courses WHERE name = ?1",
            params![course_name],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Insert or get week
    tx.execute(
        "INSERT OR REPLACE INTO weeks (course_id, week_number) VALUES (?1, ?2)",
        params![course_id, week_number],
    )
    .map_err(|e| e.to_string())?;

    let week_id: i64 = tx
        .query_row(
            "SELECT id FROM weeks WHERE course_id = ?1 AND week_number = ?2",
            params![course_id, week_number],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Delete existing exercises for this week
    tx.execute(
        "DELETE FROM exercises WHERE week_id = ?1",
        params![week_id],
    )
    .map_err(|e| e.to_string())?;

    // Insert exercises
    for exercise in exercises {
        let tags_json = serde_json::to_string(&exercise.tags).map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO exercises (week_id, name, tags_json, image_path) VALUES (?1, ?2, ?3, ?4)",
            params![week_id, exercise.name, tags_json, exercise.image],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| {
        eprintln!("Failed to commit transaction: {}", e);
        e.to_string()
    })?;

    eprintln!("save_week_data completed successfully");
    Ok(())
}

#[tauri::command]
pub async fn get_all_courses(db_path: State<'_, DbPath>) -> Result<DatabaseState, String> {
    let conn = db::get_connection(&db_path.0).map_err(|e| e.to_string())?;

    let mut courses_map = std::collections::HashMap::new();

    // Get all courses
    let mut stmt = conn
        .prepare("SELECT id, name FROM courses ORDER BY name")
        .map_err(|e| e.to_string())?;

    let courses = stmt
        .query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;

    for course_result in courses {
        let (course_id, course_name) = course_result.map_err(|e| e.to_string())?;

        // Get all weeks for this course
        let mut weeks_stmt = conn
            .prepare("SELECT id, week_number FROM weeks WHERE course_id = ?1 ORDER BY week_number")
            .map_err(|e| e.to_string())?;

        let weeks = weeks_stmt
            .query_map(params![course_id], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, i32>(1)?))
            })
            .map_err(|e| e.to_string())?;

        let mut weeks_map = std::collections::HashMap::new();

        for week_result in weeks {
            let (week_id, week_number) = week_result.map_err(|e| e.to_string())?;

            // Get all exercises for this week
            let mut exercises_stmt = conn
                .prepare("SELECT id, name, tags_json, image_path FROM exercises WHERE week_id = ?1")
                .map_err(|e| e.to_string())?;

            let exercises = exercises_stmt
                .query_map(params![week_id], |row| {
                    let tags_json: String = row.get(2)?;
                    let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

                    Ok(ExerciseData {
                        id: Some(row.get(0)?),
                        name: row.get(1)?,
                        tags,
                        image: row.get(3)?,
                    })
                })
                .map_err(|e| e.to_string())?;

            let exercises_vec: Result<Vec<_>, _> = exercises.collect();
            let exercises_vec = exercises_vec.map_err(|e| e.to_string())?;

            weeks_map.insert(
                format!("week{}", week_number),
                WeekData {
                    exercises: exercises_vec,
                },
            );
        }

        courses_map.insert(
            course_name,
            CourseData { weeks: weeks_map },
        );
    }

    Ok(DatabaseState {
        courses: courses_map,
    })
}

#[tauri::command]
pub async fn get_course_data(
    course_name: String,
    db_path: State<'_, DbPath>,
) -> Result<Option<CourseData>, String> {
    let all_data = get_all_courses(db_path).await?;
    Ok(all_data.courses.get(&course_name).cloned())
}

#[tauri::command]
pub async fn update_exercise(
    exercise_id: i64,
    name: String,
    tags: Vec<String>,
    db_path: State<'_, DbPath>,
) -> Result<(), String> {
    let conn = db::get_connection(&db_path.0).map_err(|e| e.to_string())?;
    let tags_json = serde_json::to_string(&tags).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE exercises SET name = ?1, tags_json = ?2 WHERE id = ?3",
        params![name, tags_json, exercise_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_exercise(
    exercise_id: i64,
    db_path: State<'_, DbPath>,
    app_dir: State<'_, AppDir>,
) -> Result<(), String> {
    let conn = db::get_connection(&db_path.0).map_err(|e| e.to_string())?;

    // Get image path before deletion
    let image_path: Option<String> = conn
        .query_row(
            "SELECT image_path FROM exercises WHERE id = ?1",
            params![exercise_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();

    // Delete from database
    conn.execute("DELETE FROM exercises WHERE id = ?1", params![exercise_id])
        .map_err(|e| e.to_string())?;

    // Delete image file if it exists
    if let Some(img_path) = image_path {
        let full_path = app_dir.0.join(&img_path);
        let _ = fs::remove_file(full_path); // Ignore errors if file doesn't exist
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_week_data(
    course_name: String,
    week_number: i32,
    db_path: State<'_, DbPath>,
) -> Result<(), String> {
    let conn = db::get_connection(&db_path.0).map_err(|e| e.to_string())?;

    // Get course ID
    let course_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM courses WHERE name = ?1",
            params![course_name],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(course_id) = course_id {
        // Delete week (exercises will cascade delete)
        conn.execute(
            "DELETE FROM weeks WHERE course_id = ?1 AND week_number = ?2",
            params![course_id, week_number],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn search_exercises(
    query: String,
    db_path: State<'_, DbPath>,
) -> Result<Vec<ExerciseInfo>, String> {
    let conn = db::get_connection(&db_path.0).map_err(|e| e.to_string())?;

    let search_pattern = format!("%{}%", query);

    let mut stmt = conn
        .prepare(
            "SELECT id, name, tags_json, image_path FROM exercises
             WHERE name LIKE ?1
             ORDER BY name",
        )
        .map_err(|e| e.to_string())?;

    let exercises = stmt
        .query_map(params![search_pattern], |row| {
            let tags_json: String = row.get(2)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

            Ok(ExerciseInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                tags,
                image_path: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let result: Result<Vec<_>, _> = exercises.collect();
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn filter_by_tags(
    tags: Vec<String>,
    db_path: State<'_, DbPath>,
) -> Result<Vec<ExerciseInfo>, String> {
    let conn = db::get_connection(&db_path.0).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, name, tags_json, image_path FROM exercises")
        .map_err(|e| e.to_string())?;

    let exercises = stmt
        .query_map([], |row| {
            let tags_json: String = row.get(2)?;
            let exercise_tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                exercise_tags,
                row.get::<_, Option<String>>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    for exercise_result in exercises {
        let (id, name, exercise_tags, image_path) = exercise_result.map_err(|e| e.to_string())?;

        // Check if any of the filter tags match
        let has_matching_tag = tags.iter().any(|tag| {
            exercise_tags
                .iter()
                .any(|et| et.to_lowercase() == tag.to_lowercase())
        });

        if has_matching_tag {
            result.push(ExerciseInfo {
                id,
                name,
                tags: exercise_tags,
                image_path,
            });
        }
    }

    Ok(result)
}

// File System Operations
#[tauri::command]
pub async fn save_image(
    image_data: String,
    exercise_name: String,
    app_dir: State<'_, AppDir>,
) -> Result<String, String> {
    eprintln!("save_image called: exercise_name={}", exercise_name);
    eprintln!("app_dir: {:?}", app_dir.0);

    // Create images directory if it doesn't exist
    let images_dir = app_dir.0.join("images");
    eprintln!("images_dir path: {:?}", images_dir);
    eprintln!("images_dir exists: {}", images_dir.exists());

    if images_dir.exists() {
        eprintln!("images_dir is_dir: {}", images_dir.is_dir());
        eprintln!("images_dir is_file: {}", images_dir.is_file());

        if images_dir.is_file() {
            eprintln!("Found 'images' as a file, removing it to create directory");
            fs::remove_file(&images_dir).map_err(|e| {
                eprintln!("Failed to remove 'images' file: {}", e);
                e.to_string()
            })?;
        } else if images_dir.is_symlink() {
            eprintln!("Found 'images' as a symlink, removing it");
            fs::remove_file(&images_dir).map_err(|e| {
                eprintln!("Failed to remove 'images' symlink: {}", e);
                e.to_string()
            })?;
        }
    }

    fs::create_dir_all(&images_dir).map_err(|e| {
        eprintln!("Failed to create images directory at {:?}: {}", images_dir, e);
        eprintln!("Attempting to read directory metadata...");
        if let Ok(metadata) = fs::metadata(&images_dir) {
            eprintln!("Metadata: is_dir={}, is_file={}, is_symlink={}",
                metadata.is_dir(), metadata.is_file(), metadata.is_symlink());
        }
        format!("Failed to create images directory: {}", e)
    })?;

    // Generate filename from exercise name
    let safe_name = exercise_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' { c } else { '_' })
        .collect::<String>();
    let filename = format!("{}.png", safe_name);
    let file_path = images_dir.join(&filename);

    // Remove data URL prefix if present
    let base64_data = if image_data.contains("base64,") {
        image_data.split("base64,").nth(1).unwrap_or(&image_data)
    } else {
        &image_data
    };

    // Decode base64 and save
    let image_bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| {
            eprintln!("Failed to decode base64 image data: {}", e);
            e.to_string()
        })?;

    fs::write(&file_path, image_bytes).map_err(|e| {
        eprintln!("Failed to write image file: {}", e);
        e.to_string()
    })?;

    eprintln!("Image saved successfully: {:?}", file_path);

    // Return relative path from app_dir
    Ok(format!("images/{}", filename))
}

#[tauri::command]
pub async fn get_image_path(
    relative_path: String,
    app_dir: State<'_, AppDir>,
) -> Result<String, String> {
    let full_path = app_dir.0.join(&relative_path);

    // Read image and convert to base64
    let image_bytes = fs::read(full_path).map_err(|e| e.to_string())?;
    let base64_data = base64::engine::general_purpose::STANDARD.encode(image_bytes);

    Ok(format!("data:image/png;base64,{}", base64_data))
}
