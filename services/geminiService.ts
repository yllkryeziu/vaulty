import { invoke } from '@tauri-apps/api/core';
import type { GeminiResponse } from '../types';

export async function extractExercisesFromImages(images: string[]): Promise<GeminiResponse> {
  try {
    // Call the Tauri backend command to extract exercises using Gemini
    const response = await invoke<GeminiResponse>('extract_exercises_with_ai', { images });

    // Basic validation
    if (!response.courseName || !Array.isArray(response.exercises)) {
      throw new Error("Invalid JSON structure received from Gemini.");
    }

    return response;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      if (error.message.includes('API key not configured')) {
        throw new Error("API key not configured. Please set your Gemini API key in Settings.");
      }
      if (error.message.includes('JSON')) {
        throw new Error("Failed to parse response from AI. The AI may have returned an invalid format.");
      }
      throw error;
    }
    throw new Error("Failed to extract exercises from the document.");
  }
}
