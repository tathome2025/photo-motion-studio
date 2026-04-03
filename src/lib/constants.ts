import type {
  FrameStyleOption,
  PromptOption,
  ThemeOption,
  TransitionOption,
} from "@/lib/types";

export const APP_NAME = "MotionCut Studio";

export const ORIGINAL_BUCKET = "project-originals";
export const GENERATED_BUCKET = "project-generated";
export const RENDER_BUCKET = "project-renders";

export const PROMPT_OPTIONS: PromptOption[] = [
  { key: "smile", label: "微笑 Smile", prompt: "向鏡頭微笑" },
  { key: "greeting", label: "打招呼 Greeting", prompt: "向鏡頭打招呼" },
  { key: "laughing", label: "大笑 Laughing", prompt: "向相片其他人大笑後再望向鏡頭" },
  { key: "handshake", label: "握手 Handshake", prompt: "與相片中其他人握手" },
  { key: "hugging", label: "擁抱 Hugging", prompt: "與相片中其他人擁抱" },
  { key: "blow-a-kiss", label: "飛吻 Blow a kiss", prompt: "相中人向鏡頭飛吻" },
  { key: "custom", label: "其他動作", prompt: "" },
  { key: "static", label: "不用生成動作", prompt: "" },
];

export const TRANSITION_OPTIONS: TransitionOption[] = [
  { key: "cut", label: "Cut" },
  { key: "fade", label: "Fade" },
  { key: "wipeleft", label: "Wipe Left" },
  { key: "slideup", label: "Slide Up" },
];

export const THEME_OPTIONS: ThemeOption[] = [
  { key: "editorial", label: "Editorial", background: "#f4f1eb", border: "#181818", text: "#181818" },
  { key: "mono", label: "Mono Grid", background: "#ededed", border: "#0f0f0f", text: "#0f0f0f" },
  { key: "warm", label: "Warm Archive", background: "#efe3d4", border: "#5c4332", text: "#2d2018" },
  { key: "blueprint", label: "Blueprint", background: "#dde6ef", border: "#18334d", text: "#18334d" },
];

export const FRAME_STYLE_OPTIONS: FrameStyleOption[] = [
  { key: "none", label: "None" },
  { key: "single", label: "Single" },
  { key: "double", label: "Double" },
  { key: "offset", label: "Offset" },
];

export const DEFAULT_THEME_KEY = "editorial";
export const DEFAULT_TRANSITION_KEY = "fade";
export const DEFAULT_FRAME_STYLE_KEY = "single";
export const DEFAULT_CLIP_DURATION = 5;
export const MAX_REGENERATION_COUNT = 3;
