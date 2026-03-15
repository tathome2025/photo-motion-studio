"use client";
/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { MAX_REGENERATION_COUNT, PROMPT_OPTIONS } from "@/lib/constants";
import type { ProjectAsset, PromptKey } from "@/lib/types";

interface UploadPromptBoardProps {
  projectId: string;
  initialAssets: ProjectAsset[];
}

interface ApiResponse {
  error?: string;
  assets?: ProjectAsset[];
  project?: {
    id: string;
  };
}

function formatSpeed(bytesPerSecond: number) {
  if (bytesPerSecond <= 0) {
    return "0 KB/s";
  }

  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s`;
  }

  return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
}

async function parseApiResponse(response: Response) {
  const rawText = await response.text();

  try {
    return JSON.parse(rawText) as ApiResponse;
  } catch {
    if (response.status === 413 || rawText.startsWith("Request Entity Too Large")) {
      throw new Error("單次 request 太大。系統會逐張上傳，請重新選擇相片後再試。");
    }

    throw new Error(rawText || `請求失敗 (${response.status})`);
  }
}

function uploadFileWithProgress(
  url: string,
  file: File,
  onProgress: (loadedBytes: number, elapsedMs: number) => void,
) {
  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    const startedAt = performance.now();
    formData.append("files", file);

    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress(event.loaded, performance.now() - startedAt);
    };
    xhr.onerror = () => reject(new Error("上傳失敗。"));
    xhr.onload = () => {
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: {
            "Content-Type": xhr.getResponseHeader("Content-Type") ?? "application/json",
          },
        }),
      );
    };
    xhr.send(formData);
  });
}

export function UploadPromptBoard({
  projectId,
  initialAssets,
}: UploadPromptBoardProps) {
  const router = useRouter();
  const [assets, setAssets] = useState(initialAssets);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    currentFile: number;
    totalFiles: number;
    loadedBytes: number;
    totalBytes: number;
    speed: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasAssets = assets.length > 0;
  const allPromptSelected = useMemo(
    () =>
      assets.length > 0 &&
      assets.every((asset) => {
        if (!asset.promptKey) {
          return false;
        }

        if (asset.promptKey === "custom") {
          return Boolean(asset.customPrompt?.trim());
        }

        return true;
      }),
    [assets],
  );

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    if (files.length > 100) {
      setUploadError("單次最多選擇 100 張相片。");
      event.target.value = "";
      return;
    }

    if (assets.length + files.length > 100) {
      setUploadError(`此專案最多只可有 100 張相片，現有 ${assets.length} 張。`);
      event.target.value = "";
      return;
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    let uploadedBytes = 0;

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress({
      currentFile: 0,
      totalFiles: files.length,
      loadedBytes: 0,
      totalBytes,
      speed: "0 KB/s",
    });

    try {
      let latestAssets = assets;

      for (const [index, file] of files.entries()) {
        const response = await uploadFileWithProgress(
          `/api/projects/${projectId}/assets`,
          file,
          (loadedBytes, elapsedMs) => {
            const speed = elapsedMs <= 0 ? 0 : (loadedBytes / elapsedMs) * 1000;
            setUploadProgress({
              currentFile: index + 1,
              totalFiles: files.length,
              loadedBytes: uploadedBytes + loadedBytes,
              totalBytes,
              speed: formatSpeed(speed),
            });
          },
        );

        const data = await parseApiResponse(response);

        if (!response.ok) {
          throw new Error(
            data.error ? `${file.name}: ${data.error}` : `${file.name}: 上傳失敗。`,
          );
        }

        uploadedBytes += file.size;
        latestAssets = data.assets ?? latestAssets;
        setAssets(latestAssets);
        setUploadProgress({
          currentFile: index + 1,
          totalFiles: files.length,
          loadedBytes: uploadedBytes,
          totalBytes,
          speed: "0 KB/s",
        });
      }

      router.refresh();
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "上傳時發生未知錯誤。",
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      event.target.value = "";
    }
  }

  async function handleDeleteAsset(assetId: string) {
    setUploadError(null);

    const response = await fetch(`/api/projects/${projectId}/assets/${assetId}`, {
      method: "DELETE",
    });
    const data = await parseApiResponse(response);

    if (!response.ok) {
      setUploadError(data.error ?? "刪除相片失敗。");
      return;
    }

    setAssets((current) => current.filter((asset) => asset.id !== assetId));
    router.refresh();
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
              customPrompt: promptKey === "custom" ? asset.customPrompt : null,
              isStaticClip: promptKey === "static",
            }
          : asset,
      ),
    );
  }

  function handleCustomPromptChange(assetId: string, customPrompt: string) {
    setAssets((current) =>
      current.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              customPrompt,
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
            customPrompt: asset.customPrompt,
          })),
        }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok) {
        setGenerateError(data.error ?? "提交生成工作失敗。");
        return;
      }

      router.push(`/projects/${projectId}/waiting`);
    });
  }

  const uploadPercent = uploadProgress
    ? Math.min((uploadProgress.loadedBytes / Math.max(uploadProgress.totalBytes, 1)) * 100, 100)
    : 0;

  return (
    <div className="grid gap-8">
      <section className="grid gap-5 border border-[var(--line)] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
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
            {isUploading
              ? `上傳中 ${uploadProgress?.currentFile ?? 0}/${uploadProgress?.totalFiles ?? 0}`
              : "選擇相片"}
          </label>
        </div>

        <div className="grid gap-3 border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-sm leading-7 text-[var(--muted)]">
          <p>可一次選取多張相片批量上傳，單一專案最多 100 張。</p>
          <p>建議上傳面向鏡頭的合照以及橫向相片，生成效果最佳。</p>
          <p>直向相片會自動在左右兩邊填充黑色，統一成橫向 16:9 方便後續生成與剪輯。</p>
        </div>

        {uploadProgress ? (
          <div className="grid gap-3 border border-[var(--line)] p-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              <span>{uploadProgress.currentFile}/{uploadProgress.totalFiles} files</span>
              <span>{uploadProgress.speed}</span>
            </div>
            <div className="relative h-3 overflow-hidden border border-[var(--line)] bg-[var(--surface)]">
              <div className="absolute inset-0 progress-scan opacity-70" />
              <div
                className="h-full bg-[var(--text)] transition-[width] duration-300"
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
            <div className="text-sm text-[var(--muted)]">
              {Math.round(uploadPercent)}% completed
            </div>
          </div>
        ) : null}

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
                <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  <span>#{String(index + 1).padStart(2, "0")}</span>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center border border-[var(--line)] transition hover:border-[#8d2f24] hover:text-[#8d2f24]"
                    onClick={() => handleDeleteAsset(asset.id)}
                    aria-label={`刪除 ${asset.fileName}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="grid min-h-[220px] place-items-center border border-[var(--line)] bg-black p-0">
                  <img
                    src={asset.originalUrl}
                    alt={asset.fileName}
                    className="aspect-video max-h-[200px] max-w-[200px] object-contain"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                  <span className="truncate">{asset.fileName}</span>
                  <span>{asset.regenerationCount}/{MAX_REGENERATION_COUNT} re-gen</span>
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
                {asset.promptKey === "custom" ? (
                  <textarea
                    className="min-h-24 border border-[var(--line)] bg-transparent px-3 py-3 text-sm outline-none focus:border-[var(--text)]"
                    placeholder="輸入你想要的自訂動作 prompt"
                    value={asset.customPrompt ?? ""}
                    onChange={(event) =>
                      handleCustomPromptChange(asset.id, event.target.value)
                    }
                  />
                ) : null}
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
