export interface BoundingBox {
  y: number;
  height: number;
}

export interface Exercise {
  id: string;
  name: string;
  tags: string[];
  course: string; // Course name from the PDF page
  week: number; // Week number from the PDF page
  content?: string; // Text content if extracted
  imageUri?: string; // Base64 cropped image
  pageImageUri?: string; // Full page context
  boundingBox?: BoundingBox;
  createdAt: number;
}

export interface AppSettings {
  apiKey: string;
}
