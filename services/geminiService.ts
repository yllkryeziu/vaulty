import { Exercise } from "../types";
import { invoke } from '@tauri-apps/api/tauri';

export const analyzePageImage = async (base64Image: string | null, imagePath: string | null, apiKey: string): Promise<Partial<Exercise>[]> => {
  if (!apiKey) throw new Error("API Key is missing");

  try {
    const results = await invoke<Partial<Exercise>[]>("analyze_page_image", {
      base64Image,
      imagePath,
      apiKey
    });

    return results;
  } catch (error) {
    console.error("Gemini Analysis Failed", error);
    throw error;
  }
};
