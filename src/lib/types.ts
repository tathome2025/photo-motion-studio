export type ProjectStatus =
  | "draft"
  | "generating"
  | "ready"
  | "rendering"
  | "rendered";

export type CanvaExportStatus =
  | "idle"
  | "processing"
  | "completed"
  | "failed";

export type AssetGenerationStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type PromptKey =
  | "smile"
  | "greeting"
  | "laughing"
  | "handshake"
  | "hugging"
  | "blow-a-kiss"
  | "custom"
  | "static";

export type TransitionKey = "cut" | "fade" | "wipeleft" | "slideup";

export type ThemeKey = "editorial" | "mono" | "warm" | "blueprint";

export type FrameStyleKey = "none" | "single" | "double" | "offset";

export type CanvaSlideshowTemplateKey =
  | "canva-clean"
  | "canva-editorial"
  | "canva-vibrant";

export interface PromptOption {
  key: PromptKey;
  label: string;
  prompt: string;
}

export interface TransitionOption {
  key: TransitionKey;
  label: string;
}

export interface ThemeOption {
  key: ThemeKey;
  label: string;
  background: string;
  border: string;
  text: string;
}

export interface FrameStyleOption {
  key: FrameStyleKey;
  label: string;
}

export interface CanvaSlideshowTemplate {
  key: CanvaSlideshowTemplateKey;
  name: string;
  description: string;
  accent: string;
  surface: string;
  createUrl: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  assetCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAsset {
  id: string;
  projectId: string;
  fileName: string;
  originalUrl: string;
  generatedUrl: string | null;
  promptKey: PromptKey | null;
  promptLabel: string | null;
  customPrompt: string | null;
  generationStatus: AssetGenerationStatus;
  klingTaskId: string | null;
  regenerationCount: number;
  isStaticClip: boolean;
  timelineOrder: number;
  transitionKey: TransitionKey;
  themeKey: ThemeKey;
  frameStyleKey: FrameStyleKey;
  durationSeconds: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetails extends ProjectSummary {
  assets: ProjectAsset[];
  canvaExport: ProjectCanvaExport | null;
}

export interface ProjectCanvaExport {
  id: string;
  projectId: string;
  templateKey: CanvaSlideshowTemplateKey;
  templateName: string;
  status: CanvaExportStatus;
  slideCount: number;
  clipUrls: string[];
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineUpdateItem {
  id: string;
  timelineOrder: number;
  transitionKey: TransitionKey;
  themeKey: ThemeKey;
  frameStyleKey: FrameStyleKey;
}
