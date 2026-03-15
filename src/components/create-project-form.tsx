"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface CreateProjectFormProps {
  compact?: boolean;
}

export function CreateProjectForm({ compact = false }: CreateProjectFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
        setError(data.error ?? "建立專案失敗。");
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
      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center self-start border border-[var(--line)] px-4 text-xs uppercase tracking-[0.2em] transition hover:border-[var(--text)] disabled:cursor-not-allowed disabled:text-[var(--muted)]"
        disabled={isPending}
      >
        {isPending ? "建立中..." : "新增專案"}
      </button>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          New Project Name
        </label>
        <input
          required
          className="h-12 border border-[var(--line)] bg-transparent px-4 text-sm outline-none transition focus:border-[var(--text)]"
          placeholder="例如：Family Portrait Cut"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </form>
  );
}
