import {
  FRAME_STYLE_OPTIONS,
  PROMPT_OPTIONS,
  THEME_OPTIONS,
  TRANSITION_OPTIONS,
} from "@/lib/constants";
import type {
  FrameStyleKey,
  PromptKey,
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

export function getDateTimeLocale(locale: Locale) {
  return locale === "en" ? "en-US" : "zh-HK";
}
