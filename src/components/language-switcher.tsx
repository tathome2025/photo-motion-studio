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
    <div
      className="inline-flex items-center gap-3 text-sm uppercase tracking-[0.2em]"
      aria-label={`Current language: ${getLocaleLabel(locale)}`}
    >
      <button
        type="button"
        className={`transition ${
          locale === "en"
            ? "text-[var(--text)]"
            : "text-[var(--muted)] hover:text-[var(--text)]"
        }`}
        onClick={() => switchLocale("en")}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
      <span className="text-[var(--muted)]">/</span>
      <button
        type="button"
        className={`transition ${
          locale === "zh"
            ? "text-[var(--text)]"
            : "text-[var(--muted)] hover:text-[var(--text)]"
        }`}
        onClick={() => switchLocale("zh")}
        aria-pressed={locale === "zh"}
      >
        中文
      </button>
    </div>
  );
}
