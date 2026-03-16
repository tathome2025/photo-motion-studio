"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import type { Locale } from "@/lib/i18n";

interface DeleteProjectButtonProps {
  projectId: string;
  compact?: boolean;
  locale: Locale;
}

export function DeleteProjectButton({
  projectId,
  compact = false,
  locale,
}: DeleteProjectButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const copy =
    locale === "en"
      ? {
          confirm: "This project cannot be restored after deletion. Delete it now?",
          delete: "Delete project",
          deleting: "Deleting...",
          error: "Failed to delete project.",
        }
      : {
          confirm: "刪除後無法還原，是否確定刪除此專案？",
          delete: "刪除專案",
          deleting: "刪除中...",
          error: "刪除專案失敗。",
        };

  function handleDelete() {
    const confirmed = window.confirm(copy.confirm);

    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? copy.error);
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  if (compact) {
    return (
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center border border-[var(--line)] transition hover:border-[#8d2f24] hover:text-[#8d2f24]"
        onClick={handleDelete}
        disabled={isPending}
        aria-label={copy.delete}
        title={error ?? copy.delete}
      >
        <Trash2 size={15} />
      </button>
    );
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        className="inline-flex h-12 items-center justify-center border border-[var(--line)] px-5 text-sm uppercase tracking-[0.2em] transition hover:border-[#8d2f24] hover:text-[#8d2f24]"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? copy.deleting : copy.delete}
      </button>
      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </div>
  );
}
