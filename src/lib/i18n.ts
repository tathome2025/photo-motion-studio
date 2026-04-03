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
      label: { zh: "清晰直剪", en: "Clean Cut" },
      description: {
        zh: "最簡約的線條風格，直接切換畫面。",
        en: "Minimal line styling with direct cuts.",
      },
    },
    magazine: {
      label: { zh: "雜誌版面", en: "Magazine Grid" },
      description: {
        zh: "編輯感版面，使用淡入淡出與單層邊框。",
        en: "Editorial layout with fades and single frames.",
      },
    },
    spotlight: {
      label: { zh: "焦點舞台", en: "Spotlight" },
      description: {
        zh: "暖色重點風格，轉場節奏更明顯。",
        en: "Warm spotlight style with stronger transitions.",
      },
    },
    cinematic: {
      label: { zh: "電影感動態", en: "Cinematic Motion" },
      description: {
        zh: "藍圖色調配上更有戲劇感的滑入轉場。",
        en: "Blueprint tone with dramatic slide transitions.",
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
