import { clsx, type ClassValue } from "clsx";

import { PROMPT_OPTIONS } from "@/lib/constants";
import { getDateTimeLocale, type Locale } from "@/lib/i18n";
import type { PromptKey } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(input: string, locale: Locale = "zh") {
  return new Intl.DateTimeFormat(getDateTimeLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(input));
}

export function getPromptLabel(promptKey: PromptKey | null) {
  if (!promptKey) {
    return null;
  }

  return PROMPT_OPTIONS.find((option) => option.key === promptKey)?.label ?? null;
}

export function slugifyFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isProjectReady(total: number, completed: number) {
  return total > 0 && total === completed;
}
