import {
  FRAME_STYLE_OPTIONS,
  MUSIC_TRACK_OPTIONS,
  PROMPT_OPTIONS,
  STUDIO_TEMPLATE_PRESETS,
  THEME_OPTIONS,
  TRANSITION_OPTIONS,
} from "@/lib/constants";
import type {
  FrameStyleKey,
  MusicTrackKey,
  PromptKey,
  StudioTemplateKey,
  ThemeKey,
  TransitionKey,
} from "@/lib/types";

export type Locale = "zh" | "en";

export const LOCALE_COOKIE_NAME = "motioncut_locale";

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "zh" ? "zh" : "en";
}

export function getLocaleLabel(locale: Locale) {
  return locale === "en" ? "English" : "中文";
}

export function getProjectStatusLabel(status: string, locale: Locale) {
  const labels: Record<string, Record<Locale, string>> = {
    draft: { zh: "草稿", en: "Draft" },
    generating: { zh: "生成中", en: "Generating" },
    ready: { zh: "可剪輯", en: "Ready" },
    rendering: { zh: "匯出中", en: "Rendering" },
    rendered: { zh: "已匯出", en: "Rendered" },
  };

  return labels[status]?.[locale] ?? status;
}

export function getPromptOptions(locale: Locale) {
  const labels: Record<PromptKey, Record<Locale, string>> = {
    smile: { zh: "微笑 Smile", en: "Smile" },
    greeting: { zh: "打招呼 Greeting", en: "Greeting" },
    laughing: { zh: "大笑 Laughing", en: "Laughing" },
    handshake: { zh: "握手 Handshake", en: "Handshake" },
    hugging: { zh: "擁抱 Hugging", en: "Hugging" },
    "blow-a-kiss": { zh: "飛吻 Blow a kiss", en: "Blow a kiss" },
    custom: { zh: "其他動作", en: "Custom action" },
    static: { zh: "不用生成動作", en: "Use still photo only" },
  };

  return PROMPT_OPTIONS.map((option) => ({
    ...option,
    label: labels[option.key][locale],
  }));
}

export function getTransitionOptions(locale: Locale) {
  const labels: Record<TransitionKey, Record<Locale, string>> = {
    cut: { zh: "直接切換", en: "Cut" },
    fade: { zh: "淡入淡出", en: "Fade" },
    wipeleft: { zh: "向左擦除", en: "Wipe Left" },
    slideup: { zh: "向上滑入", en: "Slide Up" },
  };

  return TRANSITION_OPTIONS.map((option) => ({
    ...option,
    label: labels[option.key][locale],
  }));
}

export function getThemeOptions(locale: Locale) {
  const labels: Record<ThemeKey, Record<Locale, string>> = {
    editorial: { zh: "編輯白", en: "Editorial" },
    mono: { zh: "單色網格", en: "Mono Grid" },
    warm: { zh: "暖色檔案", en: "Warm Archive" },
    blueprint: { zh: "藍圖", en: "Blueprint" },
  };

  return THEME_OPTIONS.map((option) => ({
    ...option,
    label: labels[option.key][locale],
  }));
}

export function getFrameStyleOptions(locale: Locale) {
  const labels: Record<FrameStyleKey, Record<Locale, string>> = {
    none: { zh: "無邊框", en: "None" },
    single: { zh: "單層", en: "Single" },
    double: { zh: "雙層", en: "Double" },
    offset: { zh: "錯位", en: "Offset" },
  };

  return FRAME_STYLE_OPTIONS.map((option) => ({
    ...option,
    label: labels[option.key][locale],
  }));
}

export function getStudioTemplateOptions(locale: Locale) {
  const labels: Record<
    StudioTemplateKey,
    { label: Record<Locale, string>; description: Record<Locale, string> }
  > = {
    "clean-cut": {
      label: { zh: "極光流動", en: "Aurora Flow" },
      description: {
        zh: "柔和極光背景，突出主體影片內容。",
        en: "Soft aurora background with centered storytelling.",
      },
    },
    magazine: {
      label: { zh: "攝影棚光影", en: "Studio Light" },
      description: {
        zh: "明亮光影紋理，風格專業乾淨。",
        en: "Bright studio light texture for modern edits.",
      },
    },
    spotlight: {
      label: { zh: "暖色顆粒", en: "Warm Grain" },
      description: {
        zh: "暖色膠片顆粒感，偏情感回憶風格。",
        en: "Warm film-grain style for emotional edits.",
      },
    },
    cinematic: {
      label: { zh: "幾何動感", en: "Neo Grid" },
      description: {
        zh: "幾何線條動態背景，節奏更鮮明。",
        en: "Structured geometric motion background.",
      },
    },
    "ocean-drift": {
      label: { zh: "海洋漂流", en: "Ocean Drift" },
      description: {
        zh: "清爽冷色流動背景，節奏平穩。",
        en: "Cool ocean flow background for calm pacing.",
      },
    },
    "night-pulse": {
      label: { zh: "夜幕脈衝", en: "Night Pulse" },
      description: {
        zh: "夜景脈衝背景，對比感更強。",
        en: "Dark ambient pulse background with strong contrast.",
      },
    },
  };

  return STUDIO_TEMPLATE_PRESETS.map((template) => ({
    ...template,
    label: labels[template.key].label[locale],
    description: labels[template.key].description[locale],
  }));
}

export function getMusicTrackOptions(locale: Locale) {
  const labels: Record<MusicTrackKey, Record<Locale, string>> = {
    "track-01": { zh: "音樂 01", en: "Track 01" },
    "track-02": { zh: "音樂 02", en: "Track 02" },
    "track-03": { zh: "音樂 03", en: "Track 03" },
    "track-04": { zh: "音樂 04", en: "Track 04" },
    "track-05": { zh: "音樂 05", en: "Track 05" },
    "track-06": { zh: "音樂 06", en: "Track 06" },
    "track-07": { zh: "音樂 07", en: "Track 07" },
    "track-08": { zh: "音樂 08", en: "Track 08" },
    "track-09": { zh: "音樂 09", en: "Track 09" },
    "track-10": { zh: "音樂 10", en: "Track 10" },
  };

  return MUSIC_TRACK_OPTIONS.map((track) => ({
    ...track,
    label: labels[track.key][locale],
  }));
}

export function getDateTimeLocale(locale: Locale) {
  return locale === "en" ? "en-US" : "zh-HK";
}
