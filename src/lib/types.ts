export type ProjectStatus =
  | "draft"
  | "generating"
  | "ready"
  | "rendering"
  | "rendered";

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
}

export interface TimelineUpdateItem {
  id: string;
  timelineOrder: number;
  transitionKey: TransitionKey;
  themeKey: ThemeKey;
  frameStyleKey: FrameStyleKey;
}
