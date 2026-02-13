
export interface DetectedObject {
  label: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
}

export interface GroundingLink {
  uri: string;
  title: string;
}

export interface AnalysisResult {
  description?: string;
  points?: string[]; // For the 1, 2, 3 bullet points
  detectedObjects?: DetectedObject[];
  groundingLinks?: GroundingLink[];
}

export interface EditResult {
  imageData?: string; // Base64
  textResponse?: string;
}

export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  ANALYZING = 'ANALYZING',
  VIEWING = 'VIEWING',
  EDITING = 'EDITING',
  ERROR = 'ERROR'
}

export enum CaptureMode {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO'
}

export interface ImageFile {
  id: string; // Unique ID for history
  preview: string; // Base64 for display
  raw: string; // Base64 for API (no header)
  mimeType: string;
  timestamp: number;
  type: 'image' | 'video';
  analysis?: AnalysisResult;
  generalChat?: { role: 'user' | 'model', text: string }[];
}

export type HistoryItem = ImageFile;