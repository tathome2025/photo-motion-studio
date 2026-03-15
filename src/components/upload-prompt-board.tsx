"use client";
/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { PROMPT_OPTIONS } from "@/lib/constants";
import type { ProjectAsset, PromptKey } from "@/lib/types";

interface UploadPromptBoardProps {
  projectId: string;
  initialAssets: ProjectAsset[];
}

export function UploadPromptBoard({
  projectId,
  initialAssets,
}: UploadPromptBoardProps) {
  const router = useRouter();
  const [assets, setAssets] = useState(initialAssets);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasAssets = assets.length > 0;
  const allPromptSelected = useMemo(
    () => assets.length > 0 && assets.every((asset) => Boolean(asset.promptKey)),
    [assets],
  );

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();

      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch(`/api/projects/${projectId}/assets`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "上傳失敗。");
      }

      setAssets(data.assets);
      router.refresh();
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "上傳時發生未知錯誤。",
      );
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  function handlePromptChange(assetId: string, promptKey: PromptKey) {
    setAssets((current) =>
      current.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              promptKey,
              promptLabel:
                PROMPT_OPTIONS.find((option) => option.key === promptKey)?.label ??
                null,
            }
          : asset,
      ),
    );
  }

  function handleGenerate() {
    setGenerateError(null);

    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selections: assets.map((asset) => ({
            id: asset.id,
            promptKey: asset.promptKey,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setGenerateError(data.error ?? "提交生成工作失敗。");
        return;
      }

      router.push(`/projects/${projectId}/waiting`);
    });
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 border border-[var(--line)] p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Batch upload
            </p>
            <h2 className="text-2xl tracking-tight">加入最多約 100 張相片</h2>
          </div>
          <label className="inline-flex h-12 cursor-pointer items-center justify-center border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={isUploading}
            />
            {isUploading ? "上傳中..." : "選擇相片"}
          </label>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
          相片會先儲存到 Supabase Storage，頁面顯示的縮圖最大邊長會維持在 200px 內，方便快速檢查與批量指派動作 prompt。
        </p>
        {uploadError ? <p className="text-sm text-[#8d2f24]">{uploadError}</p> : null}
      </section>

      <section className="grid gap-4 border border-[var(--line)] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Prompt assignment
            </p>
            <h2 className="text-2xl tracking-tight">為每張相片指定動作</h2>
          </div>
          <button
            type="button"
            className="h-12 border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:text-[var(--muted)]"
            disabled={!allPromptSelected || isPending}
            onClick={handleGenerate}
          >
            {isPending ? "提交中..." : "開始生成動態影像"}
          </button>
        </div>

        {!hasAssets ? (
          <div className="grid min-h-64 place-items-center border border-dashed border-[var(--line)] text-center text-sm text-[var(--muted)]">
            先上傳相片，之後才可以指派 prompt。
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset, index) => (
              <article
                key={asset.id}
                className="grid gap-3 border border-[var(--line)] p-4"
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  <span>#{String(index + 1).padStart(2, "0")}</span>
                  <span>{asset.fileName}</span>
                </div>
                <div className="grid min-h-[220px] place-items-center border border-[var(--line)] bg-[var(--surface-soft)] p-4">
                  <img
                    src={asset.originalUrl}
                    alt={asset.fileName}
                    className="max-h-[200px] max-w-[200px] object-contain"
                  />
                </div>
                <select
                  className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm outline-none focus:border-[var(--text)]"
                  value={asset.promptKey ?? ""}
                  onChange={(event) =>
                    handlePromptChange(asset.id, event.target.value as PromptKey)
                  }
                >
                  <option value="">選擇動作 prompt</option>
                  {PROMPT_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </article>
            ))}
          </div>
        )}

        {generateError ? (
          <p className="text-sm text-[#8d2f24]">{generateError}</p>
        ) : null}
      </section>
    </div>
  );
}
