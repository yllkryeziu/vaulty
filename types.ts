export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
}

export interface Exercise {
  id: string; // Unique ID for React state management
  name: string;
  tags: string[];
  boundingBox: BoundingBox | null;
  image?: string | null; // Base64 encoded cropped image
}

export interface ExtractedData {
  courseName: string;
  week?: number;
}

export interface GeminiResponse {
    courseName: string;
    exercises: Omit<Exercise, 'id' | 'boundingBox' | 'image'>[];
}

// Types for the local database
export interface ExportedExercise {
  id?: number; // Database ID for deletion
  name: string;
  tags: string[];
  image?: string | null;
}

export interface WeekData {
  exercises: ExportedExercise[];
}

export interface CourseData {
  weeks: {
    [weekKey: string]: WeekData; // e.g., "week1", "week2"
  };
}

export interface DatabaseState {
  courses: {
    [courseName: string]: CourseData;
  };
}
