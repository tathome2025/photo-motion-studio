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
  { key: "smile", label: "微笑 Smile", prompt: "A natural warm smile, subtle head movement, eye contact, realistic motion." },
  { key: "greeting", label: "打招呼 Greeting", prompt: "Raise one hand and greet the camera with a calm, friendly wave and natural body motion." },
  { key: "laughing", label: "大笑 Laughing", prompt: "Burst into genuine laughter with lively shoulders, expressive face, and natural movement." },
  { key: "handshake", label: "握手 Handshake", prompt: "Reach forward for a friendly handshake gesture, confident body language, realistic motion." },
  { key: "hugging", label: "擁抱 Hugging", prompt: "Open both arms slightly as if inviting a hug, warm emotion, gentle cinematic movement." },
  { key: "brotherhood", label: "手足情誼 Brotherhood", prompt: "Show a strong brotherhood vibe with shoulder movement, pride, solidarity, and relaxed energy." },
  { key: "blow-a-kiss", label: "飛吻 Blow a kiss", prompt: "Blow a kiss toward camera, soft hand movement, affectionate expression, realistic motion." },
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
