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
    <div className="inline-flex border border-[var(--line)] bg-[var(--surface)]">
      {(["zh", "en"] as const).map((item) => {
        const active = item === locale;

        return (
          <button
            key={item}
            type="button"
            className={`inline-flex h-10 min-w-16 items-center justify-center px-4 text-xs uppercase tracking-[0.2em] transition ${
              active
                ? "bg-[var(--text)] text-[var(--surface)]"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
            onClick={() => switchLocale(item)}
            aria-pressed={active}
          >
            {getLocaleLabel(item)}
          </button>
        );
      })}
    </div>
  );
}
