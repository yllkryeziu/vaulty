use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Debug, Serialize, Deserialize)]
pub struct Exercise {
    pub name: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiResponse {
    #[serde(rename = "courseName")]
    pub course_name: String,
    pub exercises: Vec<Exercise>,
}

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<Content>,
    #[serde(rename = "generationConfig")]
    generation_config: GenerationConfig,
}

#[derive(Serialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Serialize)]
#[serde(untagged)]
enum Part {
    Text { text: String },
    InlineData { inline_data: InlineData },
}

#[derive(Serialize)]
struct InlineData {
    mime_type: String,
    data: String,
}

#[derive(Serialize)]
struct GenerationConfig {
    response_mime_type: String,
    response_schema: serde_json::Value,
}

pub async fn extract_exercises_from_images(
    api_key: &str,
    images: Vec<String>,
) -> Result<GeminiResponse, Box<dyn Error>> {
    // Define the schema for structured output
    let schema = serde_json::json!({
        "type": "object",
        "properties": {
            "courseName": {
                "type": "string",
                "description": "The name of the course or document title from the provided pages."
            },
            "exercises": {
                "type": "array",
                "description": "A list of all exercises found in the document.",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "The title or identifier of the exercise (e.g., 'Exercise 1.1', 'Problem 3', 'Question 5a')."
                        },
                        "tags": {
                            "type": "array",
                            "description": "A list of relevant tags. The VERY FIRST tag MUST be a classification of the exercise type from this list: 'regular exercise', 'homework', 'programming', or 'exam'. Follow this with 2-4 other relevant keywords based on the exercise content (e.g., 'calculus', 'derivatives').",
                            "items": {
                                "type": "string"
                            }
                        }
                    },
                    "required": ["name", "tags"]
                }
            }
        },
        "required": ["courseName", "exercises"]
    });

    let prompt = r#"
    Analyze the provided document pages. Identify the overall course or document name.
    Then, locate every distinct exercise, problem, or question.
    For each exercise, do the following:
    1. Extract its name/identifier.
    2. Classify the exercise type. It must be one of: 'regular exercise', 'homework', 'programming', or 'exam'. This classification MUST be the first tag.
    3. Generate 2-4 additional relevant tags based on the subject matter.
    Return all this information in the specified JSON format.
    "#;

    // Build parts array with images and text
    let mut parts: Vec<Part> = Vec::new();

    // Add all images
    for image in images {
        // Remove data URL prefix if present (data:image/jpeg;base64,)
        let base64_data = if image.contains("base64,") {
            image.split("base64,").nth(1).unwrap_or(&image)
        } else {
            &image
        };

        parts.push(Part::InlineData {
            inline_data: InlineData {
                mime_type: "image/jpeg".to_string(),
                data: base64_data.to_string(),
            },
        });
    }

    // Add text prompt
    parts.push(Part::Text {
        text: prompt.to_string(),
    });

    let request = GeminiRequest {
        contents: vec![Content { parts }],
        generation_config: GenerationConfig {
            response_mime_type: "application/json".to_string(),
            response_schema: schema,
        },
    };

    // Make API request to Gemini
    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}",
        api_key
    );

    let response = client
        .post(&url)
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        eprintln!("Gemini API error (status {}): {}", status, error_text);
        return Err(format!("Gemini API error (status {}): {}", status, error_text).into());
    }

    let response_json: serde_json::Value = response.json().await?;

    // Extract the text from response
    let text = response_json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or("Failed to extract text from Gemini response")?;

    // Parse the JSON response
    let gemini_response: GeminiResponse = serde_json::from_str(text)?;

    Ok(gemini_response)
}
