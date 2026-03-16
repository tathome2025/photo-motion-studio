"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Locale } from "@/lib/i18n";

interface CreateProjectFormProps {
  compact?: boolean;
  locale: Locale;
}

export function CreateProjectForm({
  compact = false,
  locale,
}: CreateProjectFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const copy =
    locale === "en"
      ? {
          label: "New Project Name",
          placeholder: "Example: Family Portrait Cut",
          creating: "Creating...",
          create: "Create project",
          error: "Failed to create project.",
        }
      : {
          label: "New Project Name",
          placeholder: "例如：Family Portrait Cut",
          creating: "建立中...",
          create: "新增專案",
          error: "建立專案失敗。",
        };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? copy.error);
        return;
      }

      router.push(`/projects/${data.project.id}`);
      router.refresh();
    });
  }

  return (
    <form
      className={compact ? "grid gap-2" : "grid gap-2 border border-[var(--line)] p-5"}
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {copy.label}
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            required
            className="h-12 border border-[var(--line)] bg-transparent px-4 text-sm outline-none transition focus:border-[var(--text)]"
            placeholder={copy.placeholder}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center border border-[var(--line)] px-4 text-xs uppercase tracking-[0.2em] transition hover:border-[var(--text)] disabled:cursor-not-allowed disabled:text-[var(--muted)]"
            disabled={isPending}
          >
            {isPending ? copy.creating : copy.create}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </form>
  );
}
