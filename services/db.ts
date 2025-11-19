import { Exercise } from "../types";
import { convertFileSrc, invoke } from '@tauri-apps/api/tauri';

const EVENT_KEY = "vaulty-db-change";

const triggerUpdate = () => {
  window.dispatchEvent(new Event(EVENT_KEY));
};

// Helper to convert local paths to asset URLs
export const getImageUrl = (path: string | undefined) => {
  if (!path) return undefined;
  if (path.startsWith('data:')) return path; // Already base64
  if (path.startsWith('http')) return path; // Already web URL
  try {
    return convertFileSrc(path);
  } catch (e) {
    return path; // Fallback
  }
};

export const saveImage = async (base64Data: string): Promise<string> => {
  return await invoke("save_image", { base64Data });
};

export const saveExercises = async (exercises: Exercise[]): Promise<Exercise[]> => {
  for (const ex of exercises) {
    await invoke("save_exercise", { exercise: ex });
  }
  
  triggerUpdate();
  return await getExercises();
};

export const getExercises = async (): Promise<Exercise[]> => {
  return await invoke("get_all_exercises");
};

export const deleteExercise = async (id: string): Promise<Exercise[]> => {
  await invoke("delete_exercise", { id });
  triggerUpdate();
  return await getExercises();
};

export const deleteCourse = async (course: string): Promise<Exercise[]> => {
  await invoke("delete_course", { course });
  triggerUpdate();
  return await getExercises();
};

// Helper to get course names
export const getCourseNames = (exercises: Exercise[]): string[] => {
  const courses = new Set(exercises.map(ex => ex.course));
  return Array.from(courses).sort();
};

// Helper to organize exercises by course and week
export const organizeByCourse = (exercises: Exercise[]): Record<string, Record<number, Exercise[]>> => {
  const tree: Record<string, Record<number, Exercise[]>> = {};

  exercises.forEach(ex => {
    const course = ex.course || "Uncategorized";
    const week = ex.week || 1;

    if (!tree[course]) {
      tree[course] = {};
    }

    if (!tree[course][week]) {
      tree[course][week] = [];
    }

    tree[course][week].push(ex);
  });

  return tree;
};

export const getAllTags = (exercises: Exercise[]): string[] => {
  const tags = new Set<string>();
  exercises.forEach(ex => ex.tags.forEach(tag => tags.add(tag)));
  return Array.from(tags).sort();
};
