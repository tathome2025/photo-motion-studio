"use client";

import { useRouter } from "next/navigation";

import {
  getLocaleLabel,
  type Locale,
} from "@/lib/i18n";

interface LanguageSwitcherProps {
  locale: Locale;
}

export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const router = useRouter();
  const isChinese = locale === "zh";

  async function switchLocale(nextLocale: Locale) {
    await fetch("/api/locale", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ locale: nextLocale }),
    });

    router.refresh();
  }

  return (
    <button
      type="button"
      className="relative inline-flex h-12 w-40 items-center rounded-none border-[3px] border-[var(--text)] bg-[var(--surface)] px-4 text-sm uppercase tracking-[0.24em] transition hover:bg-[var(--surface-soft)]"
      onClick={() => switchLocale(isChinese ? "en" : "zh")}
      aria-pressed={isChinese}
      aria-label={`Switch language. Current: ${getLocaleLabel(locale)}`}
      title={`Current language: ${getLocaleLabel(locale)}`}
    >
      <span
        className={`absolute top-1/2 h-9 w-9 -translate-y-1/2 border-[3px] border-[var(--text)] bg-[var(--surface)] transition-all duration-200 ${
          isChinese ? "right-2" : "left-2"
        }`}
      />
      <span className="grid w-full grid-cols-2 items-center text-[var(--text)]">
        <span className={`text-center transition ${isChinese ? "opacity-45" : "opacity-100"}`}>
          EN
        </span>
        <span className={`text-center transition ${isChinese ? "opacity-100" : "opacity-45"}`}>
          中文
        </span>
      </span>
    </button>
  );
}
