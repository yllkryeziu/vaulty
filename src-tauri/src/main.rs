#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use base64::{engine::general_purpose, Engine as _};
use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{command, AppHandle, Runtime};
use uuid::Uuid;
use image::{DynamicImage, ImageBuffer, Rgba};
use lopdf::Document;

#[derive(Debug, Serialize, Deserialize)]
struct BoundingBox {
    y: f64,
    height: f64,
}

#[derive(Debug, Serialize, Deserialize)]
struct Exercise {
    id: String,
    name: String,
    tags: Vec<String>,
    course: String,
    week: i64,
    content: Option<String>,
    #[serde(rename = "imageUri")]
    image_uri: Option<String>,
    #[serde(rename = "pageImageUri")]
    page_image_uri: Option<String>,
    #[serde(rename = "boundingBox")]
    bounding_box: Option<BoundingBox>,
    #[serde(rename = "createdAt")]
    created_at: i64,
}

fn get_db_path<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    let path = app
        .path_resolver()
        .app_data_dir()
        .expect("failed to get app data dir");
    fs::create_dir_all(&path).expect("failed to create app data dir");
    path.join("vaulty.db")
}

fn get_images_dir<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    let path = app
        .path_resolver()
        .app_data_dir()
        .expect("failed to get app data dir")
        .join("images");
    fs::create_dir_all(&path).expect("failed to create images dir");
    path
}

fn init_db<R: Runtime>(app: &AppHandle<R>) -> SqlResult<()> {
    let db_path = get_db_path(app);
    let conn = Connection::open(db_path)?;

    // Check if table exists and has correct schema
    let table_info: Result<Vec<String>, _> = conn
        .prepare("PRAGMA table_info(exercises)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .collect();

    let columns = table_info.unwrap_or_default();

    // If table doesn't have 'tags' column, drop and recreate
    if !columns.is_empty() && !columns.contains(&"tags".to_string()) {
        eprintln!("[DB] Old schema detected, dropping and recreating exercises table...");
        conn.execute("DROP TABLE IF EXISTS exercises", [])?;
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS exercises (
            id TEXT PRIMARY KEY,
            name TEXT,
            tags TEXT,
            course TEXT,
            week INTEGER,
            content TEXT,
            image_path TEXT,
            page_image_path TEXT,
            bounding_box TEXT,
            created_at INTEGER
        )",
        [],
    )?;

    eprintln!("[DB] Database initialized successfully");
    Ok(())
}

#[command]
fn save_image<R: Runtime>(app: AppHandle<R>, base64_data: String) -> Result<String, String> {
    eprintln!("[RUST SAVE_IMAGE] Starting save, data length: {}", base64_data.len());
    let images_dir = get_images_dir(&app);
    let file_name = format!("{}.png", Uuid::new_v4());
    let file_path = images_dir.join(&file_name);
    eprintln!("[RUST SAVE_IMAGE] Saving to: {:?}", file_path);

    // Handle data:image/png;base64, prefix if present
    let base64_clean = if let Some(idx) = base64_data.find(',') {
        eprintln!("[RUST SAVE_IMAGE] Stripping data URI prefix");
        &base64_data[idx + 1..]
    } else {
        &base64_data
    };

    eprintln!("[RUST SAVE_IMAGE] Clean base64 length: {}", base64_clean.len());

    let data = general_purpose::STANDARD
        .decode(base64_clean)
        .map_err(|e| {
            eprintln!("[RUST SAVE_IMAGE] ERROR: Failed to decode base64: {}", e);
            e.to_string()
        })?;

    eprintln!("[RUST SAVE_IMAGE] Decoded {} bytes", data.len());

    fs::write(&file_path, data).map_err(|e| {
        eprintln!("[RUST SAVE_IMAGE] ERROR: Failed to write file: {}", e);
        e.to_string()
    })?;

    eprintln!("[RUST SAVE_IMAGE] Image saved successfully");
    Ok(file_path.to_string_lossy().into_owned())
}

#[command]
fn get_all_exercises<R: Runtime>(app: AppHandle<R>) -> Result<Vec<Exercise>, String> {
    let db_path = get_db_path(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, name, tags, course, week, content, image_path, page_image_path, bounding_box, created_at FROM exercises")
        .map_err(|e| e.to_string())?;

    let exercise_iter = stmt
        .query_map([], |row| {
            let tags_str: String = row.get(2)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();

            let bbox_str: Option<String> = row.get(8)?;
            let bounding_box: Option<BoundingBox> = bbox_str
                .and_then(|s| serde_json::from_str(&s).ok());

            Ok(Exercise {
                id: row.get(0)?,
                name: row.get(1)?,
                tags,
                course: row.get(3)?,
                week: row.get(4)?,
                content: row.get(5)?,
                image_uri: row.get(6)?,
                page_image_uri: row.get(7)?,
                bounding_box,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut exercises = Vec::new();
    for exercise in exercise_iter {
        exercises.push(exercise.map_err(|e| e.to_string())?);
    }

    Ok(exercises)
}

#[command]
fn save_exercise<R: Runtime>(app: AppHandle<R>, exercise: Exercise) -> Result<(), String> {
    eprintln!("[RUST SAVE_EXERCISE] Saving exercise: {}", exercise.name);
    eprintln!("[RUST SAVE_EXERCISE] Course: {}, Week: {}", exercise.course, exercise.week);
    eprintln!("[RUST SAVE_EXERCISE] Image URI: {:?}", exercise.image_uri.as_ref().map(|s| &s[..50.min(s.len())]));
    eprintln!("[RUST SAVE_EXERCISE] Page Image URI: {:?}", exercise.page_image_uri.as_ref().map(|s| &s[..50.min(s.len())]));

    let db_path = get_db_path(&app);
    let conn = Connection::open(db_path).map_err(|e| {
        eprintln!("[RUST SAVE_EXERCISE] ERROR: Failed to open DB: {}", e);
        e.to_string()
    })?;

    let tags_str = serde_json::to_string(&exercise.tags).map_err(|e| e.to_string())?;
    let bbox_str = serde_json::to_string(&exercise.bounding_box).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO exercises (id, name, tags, course, week, content, image_path, page_image_path, bounding_box, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            exercise.id,
            exercise.name,
            tags_str,
            exercise.course,
            exercise.week,
            exercise.content,
            exercise.image_uri,
            exercise.page_image_uri,
            bbox_str,
            exercise.created_at,
        ],
    )
    .map_err(|e| {
        eprintln!("[RUST SAVE_EXERCISE] ERROR: Failed to execute insert: {}", e);
        e.to_string()
    })?;

    eprintln!("[RUST SAVE_EXERCISE] Exercise saved successfully");
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
struct PartialExercise {
    id: String,
    name: String,
    tags: Vec<String>,
    #[serde(rename = "createdAt")]
    created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiExerciseResponse {
    exercises: Vec<GeminiExercise>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiExercise {
    name: String,
    #[serde(rename = "exerciseType")]
    exercise_type: String,
    tags: Vec<String>,
}

#[command]
async fn analyze_page_image(base64_image: Option<String>, image_path: Option<String>, api_key: String) -> Result<Vec<PartialExercise>, String> {
    eprintln!("[RUST ANALYZE] Starting analysis");
    eprintln!("[RUST ANALYZE] base64_image provided: {}", base64_image.is_some());
    eprintln!("[RUST ANALYZE] image_path provided: {:?}", image_path);

    let final_base64 = if let Some(b64) = base64_image {
        eprintln!("[RUST ANALYZE] Using base64 image, length: {}", b64.len());
        b64
    } else if let Some(path) = image_path {
        eprintln!("[RUST ANALYZE] Reading image from path: {}", path);
        let data = fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
        eprintln!("[RUST ANALYZE] Read {} bytes from file", data.len());
        general_purpose::STANDARD.encode(data)
    } else {
        eprintln!("[RUST ANALYZE] ERROR: No image provided");
        return Err("No image provided".to_string());
    };

    // Clean base64 string if it contains metadata prefix
    eprintln!("[RUST ANALYZE] Cleaning base64 prefix...");
    let clean_base64 = final_base64
        .strip_prefix("data:image/png;base64,")
        .or_else(|| final_base64.strip_prefix("data:image/jpeg;base64,"))
        .or_else(|| final_base64.strip_prefix("data:image/jpg;base64,"))
        .or_else(|| final_base64.strip_prefix("data:image/webp;base64,"))
        .unwrap_or(&final_base64);

    eprintln!("[RUST ANALYZE] Clean base64 length: {}", clean_base64.len());

    let client = reqwest::Client::new();

    let request_body = serde_json::json!({
        "contents": [{
            "parts": [
                {
                    "inline_data": {
                        "mime_type": "image/png",
                        "data": clean_base64
                    }
                },
                {
                    "text": "Analyze this textbook/PDF page. Identify all distinct exercises or questions. For each exercise, provide:\n\n1. A 4-WORD NAME starting with the exercise number (e.g., 'Ex 1.2 Ridge Regression', 'Problem 5 Calculate MSE', 'Q3 Prove Convergence'). Format: [Exercise Number] [Task Description]. Maximum 4 words total. ALWAYS include the exercise number as the first part of the name.\n\n2. The type of exercise - must be EXACTLY one of: 'exercise', 'homework', or 'programming'\n\n3. Relevant topic tags - should be specific keywords about the concepts, techniques, or topics covered.\n\nIMPORTANT FORMATTING:\n- The 'exerciseType' field should contain ONLY: 'exercise', 'homework', or 'programming'\n- The 'tags' array should contain topic keywords ONLY (do NOT include the exercise type in tags)\n- The exercise type will be automatically added as the first tag by the system"
                }
            ]
        }],
        "generationConfig": {
            "response_mime_type": "application/json",
            "response_schema": {
                "type": "object",
                "properties": {
                    "exercises": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {
                                    "type": "string",
                                    "description": "A 4-word name starting with exercise number (e.g., 'Ex 1.2 Ridge Regression', 'Problem 5 Calculate MSE')"
                                },
                                "exerciseType": {
                                    "type": "string",
                                    "description": "Type of exercise - EXACTLY one of: 'exercise', 'homework', or 'programming'"
                                },
                                "tags": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "Topic keywords only (e.g., 'ridge regression', 'regularization', 'linear algebra'). Do NOT include exercise type."
                                }
                            },
                            "required": ["name", "exerciseType", "tags"]
                        }
                    }
                }
            }
        },
        "system_instruction": {
            "parts": [{
                "text": "You are an educational assistant. Your job is to structure unstructured textbook pages into database records. Always put the exercise type as the first tag."
            }]
        }
    });

    eprintln!("[RUST ANALYZE] Sending request to Gemini API...");
    let response = client
        .post(format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}", api_key))
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[RUST ANALYZE] ERROR: Failed to send request: {}", e);
            format!("Failed to send request: {}", e)
        })?;

    eprintln!("[RUST ANALYZE] Response status: {}", response.status());

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        eprintln!("[RUST ANALYZE] ERROR: API request failed: {}", error_text);
        return Err(format!("API request failed: {}", error_text));
    }

    let response_json: serde_json::Value = response.json().await
        .map_err(|e| {
            eprintln!("[RUST ANALYZE] ERROR: Failed to parse response: {}", e);
            format!("Failed to parse response: {}", e)
        })?;

    eprintln!("[RUST ANALYZE] Got response JSON");

    // Extract text from Gemini response
    let text = response_json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or_else(|| {
            eprintln!("[RUST ANALYZE] ERROR: No text in response");
            "No text in response".to_string()
        })?;

    eprintln!("[RUST ANALYZE] Extracted text from response: {}", text);

    let gemini_response: GeminiExerciseResponse = serde_json::from_str(text)
        .map_err(|e| {
            eprintln!("[RUST ANALYZE] ERROR: Failed to parse exercises: {}", e);
            format!("Failed to parse exercises: {}", e)
        })?;

    eprintln!("[RUST ANALYZE] Parsed {} exercises", gemini_response.exercises.len());

    // Convert to PartialExercise
    let exercises: Vec<PartialExercise> = gemini_response.exercises.iter().map(|ex| {
        let mut tags = vec![ex.exercise_type.clone()];
        tags.extend(ex.tags.iter().cloned());
        // Remove duplicates
        tags.sort();
        tags.dedup();

        PartialExercise {
            id: Uuid::new_v4().to_string(),
            name: ex.name.clone(),
            tags,
            created_at: chrono::Utc::now().timestamp_millis(),
        }
    }).collect();

    eprintln!("[RUST ANALYZE] Returning {} exercises", exercises.len());
    Ok(exercises)
}

#[command]
fn delete_exercise<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    let db_path = get_db_path(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    // First get the image paths to delete files
    let mut stmt = conn
        .prepare("SELECT image_path, page_image_path FROM exercises WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    
    let paths: Option<(Option<String>, Option<String>)> = stmt
        .query_row(params![id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .ok();

    if let Some((img_path, _page_img_path)) = paths {
        if let Some(p) = img_path {
            let _ = fs::remove_file(p);
        }
    }

    conn.execute("DELETE FROM exercises WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
fn delete_course<R: Runtime>(app: AppHandle<R>, course: String) -> Result<(), String> {
    let db_path = get_db_path(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    // First get all image paths from exercises in this course to delete files
    let mut stmt = conn
        .prepare("SELECT image_path, page_image_path FROM exercises WHERE course = ?1")
        .map_err(|e| e.to_string())?;
    
    let mut rows = stmt.query(params![course]).map_err(|e| e.to_string())?;
    
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let img_path: Option<String> = row.get(0).ok();
        let _page_img_path: Option<String> = row.get(1).ok();
        
        if let Some(p) = img_path {
            let _ = fs::remove_file(p);
        }
    }

    // Delete all exercises for this course
    conn.execute("DELETE FROM exercises WHERE course = ?1", params![course])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
fn pdf_to_images(path: String) -> Result<Vec<String>, String> {
    eprintln!("Converting PDF to images: {}", path);
    
    // Load PDF to get page count
    let doc = Document::load(&path)
        .map_err(|e| format!("Failed to open PDF: {}", e))?;
    
    let num_pages = doc.get_pages().len();
    eprintln!("PDF has {} pages", num_pages);
    
    // Create temporary directory for converted images
    let temp_dir = std::env::temp_dir().join(format!("vaulty_pdf_{}", Uuid::new_v4()));
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;
    
    let mut image_data_urls = Vec::new();
    
    // Try pdftoppm first (from poppler-utils), then fall back to sips (macOS)
    let output = std::process::Command::new("pdftoppm")
        .args(&[
            "-png",
            "-r", "150", // 150 DPI for good quality
            &path,
            temp_dir.join("page").to_str().unwrap()
        ])
        .output();
    
    let success = if output.is_ok() && output.as_ref().unwrap().status.success() {
        eprintln!("Used pdftoppm for conversion");
        true
    } else {
        // Try sips (macOS built-in)
        eprintln!("pdftoppm not available, trying sips...");
        let output = std::process::Command::new("sips")
            .args(&[
                "-s", "format", "png",
                &path,
                "--out", temp_dir.to_str().unwrap()
            ])
            .output();
        
        output.is_ok() && output.unwrap().status.success()
    };
    
    if !success {
        // If both fail, create placeholders
        eprintln!("No PDF converter available, creating placeholders");
        for page_num in 0..num_pages {
            let img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_pixel(
                1224, 1584,
                Rgba([255, 255, 255, 255])
            );
            
            let mut bytes: Vec<u8> = Vec::new();
            DynamicImage::ImageRgba8(img)
                .write_to(&mut std::io::Cursor::new(&mut bytes), image::ImageFormat::Png)
                .map_err(|e| format!("Failed to encode: {}", e))?;
            
            let base64 = general_purpose::STANDARD.encode(&bytes);
            image_data_urls.push(format!("data:image/png;base64,{}", base64));
        }
        
        return Ok(image_data_urls);
    }
    
    // Read generated PNG files and convert to base64
    for page_num in 1..=num_pages {
        // pdftoppm uses 1-based indexing with padding
        let possible_names = vec![
            format!("page-{}.png", page_num),
            format!("page-{:02}.png", page_num),
            format!("page-{:03}.png", page_num),
            format!("{}.png", page_num),
        ];
        
        let mut found = false;
        for name in &possible_names {
            let img_path = temp_dir.join(name);
            if img_path.exists() {
                eprintln!("Reading page {} from {:?}", page_num, img_path);
                let img_bytes = fs::read(&img_path)
                    .map_err(|e| format!("Failed to read image: {}", e))?;
                
                let base64 = general_purpose::STANDARD.encode(&img_bytes);
                image_data_urls.push(format!("data:image/png;base64,{}", base64));
                found = true;
                break;
            }
        }
        
        if !found {
            eprintln!("Warning: Could not find image for page {}", page_num);
        }
    }
    
    // Clean up temp directory
    let _ = fs::remove_dir_all(&temp_dir);
    
    if image_data_urls.is_empty() {
        return Err("Failed to convert any PDF pages to images".to_string());
    }
    
    eprintln!("Successfully converted {} pages", image_data_urls.len());
    Ok(image_data_urls)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            init_db(&app.handle()).expect("failed to init db");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_image,
            get_all_exercises,
            save_exercise,
            delete_exercise,
            delete_course,
            analyze_page_image,
            pdf_to_images
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
