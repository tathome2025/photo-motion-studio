"use client";
/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { MAX_REGENERATION_COUNT } from "@/lib/constants";
import {
  findInvalidJpegFiles,
  JPEG_ACCEPT,
  prepareJpegFileForUpload,
} from "@/lib/client-upload";
import { getPromptOptions, type Locale } from "@/lib/i18n";
import type { ProjectAsset, PromptKey } from "@/lib/types";

interface UploadPromptBoardProps {
  projectId: string;
  initialAssets: ProjectAsset[];
  locale: Locale;
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

async function parseApiResponse(response: Response, tooLargeMessage: string) {
  const rawText = await response.text();

  try {
    return JSON.parse(rawText) as ApiResponse;
  } catch {
    if (response.status === 413 || rawText.startsWith("Request Entity Too Large")) {
      throw new Error(tooLargeMessage);
    }

    throw new Error(rawText || `Request failed (${response.status})`);
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
    xhr.onerror = () => reject(new Error("Upload failed."));
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
  locale,
}: UploadPromptBoardProps) {
  const router = useRouter();
  const promptOptions = getPromptOptions(locale);
  const [assets, setAssets] = useState(initialAssets);
  const [generationSelection, setGenerationSelection] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      initialAssets.map((asset) => [
        asset.id,
        asset.generationStatus !== "completed",
      ]),
    ),
  );
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
  const copy =
    locale === "en"
      ? {
          tooLarge: "A single JPG file is still above the deployment upload limit. Reduce the image size and try again.",
          uploadFailed: "Upload failed.",
          uploadUnknown: "Unknown upload error.",
          deleteFailed: "Failed to delete photo.",
          generateFailed: "Failed to submit generation jobs.",
          maxSelection: "You can select up to 100 photos per upload.",
          invalidTypePrefix: "Only JPG / JPEG files are accepted. Please check: ",
          maxProjectPhotos: (count: number) =>
            `This project can contain up to 100 photos. It currently has ${count}.`,
          uploadLabel: "Batch upload",
          uploadTitle: "Add up to about 100 photos",
          selectPhotos: "Select photos",
          uploadingButton: (current: number, total: number) =>
            `Uploading ${current}/${total}`,
          tips: [
            "You can upload multiple photos at once, up to 100 per project.",
            "Only JPG / JPEG files are accepted before upload.",
            "Front-facing group photos and landscape images usually produce the best results.",
            "Portrait photos are automatically extended with a blurred background and normalized to 16:9 for generation and editing.",
          ],
          uploadFiles: (current: number, total: number) => `${current}/${total} files`,
          uploadCompleted: (percent: number) => `${Math.round(percent)}% completed`,
          promptLabel: "Action setup",
          promptTitle: "Assign an action to each photo",
          promptDescription:
            "Newly added photos are included in this run automatically. Completed clips keep their current result unless you explicitly select them again.",
          startGenerating: "Start motion generation",
          submitting: "Submitting...",
          uploadFirst: "Upload photos first, then assign prompts.",
          deletePhoto: (name: string) => `Delete ${name}`,
          regenerateCheck: "Select to regenerate",
          newThisRun: "New photo will be generated in this run",
          promptPlaceholder: "Choose an action prompt",
          customPlaceholder: "Enter your custom action prompt",
          reGenLabel: "re-gen",
        }
      : {
          tooLarge: "單張 JPG 檔案仍超過部署平台上傳上限，請先縮小相片後再試。",
          uploadFailed: "上傳失敗。",
          uploadUnknown: "上傳時發生未知錯誤。",
          deleteFailed: "刪除相片失敗。",
          generateFailed: "提交生成工作失敗。",
          maxSelection: "單次最多選擇 100 張相片。",
          invalidTypePrefix: "只接受 JPG / JPEG。請檢查：",
          maxProjectPhotos: (count: number) =>
            `此專案最多只可有 100 張相片，現有 ${count} 張。`,
          uploadLabel: "Batch upload",
          uploadTitle: "加入最多約 100 張相片",
          selectPhotos: "選擇相片",
          uploadingButton: (current: number, total: number) =>
            `上傳中 ${current}/${total}`,
          tips: [
            "可一次選取多張相片批量上傳，單一專案最多 100 張。",
            "上傳前只接受 JPG / JPEG 格式。",
            "建議上傳面向鏡頭的合照以及橫向相片，生成效果最佳。",
            "直向相片會自動延展成模糊背景，統一成橫向 16:9 方便後續生成與剪輯。",
          ],
          uploadFiles: (current: number, total: number) => `${current}/${total} files`,
          uploadCompleted: (percent: number) => `${Math.round(percent)}% completed`,
          promptLabel: "Prompt assignment",
          promptTitle: "為每張相片指定動作",
          promptDescription:
            "新加入相片會自動納入本次生成。已完成片段會保留現有結果，只有勾選後才會重新生成。",
          startGenerating: "開始生成動態影像",
          submitting: "提交中...",
          uploadFirst: "先上傳相片，之後才可以指派 prompt。",
          deletePhoto: (name: string) => `刪除 ${name}`,
          regenerateCheck: "勾選後重新生成",
          newThisRun: "新加入相片將於本次生成",
          promptPlaceholder: "選擇動作 prompt",
          customPlaceholder: "輸入你想要的自訂動作 prompt",
          reGenLabel: "重新生成",
        };

  const hasAssets = assets.length > 0;
  const generationCount = assets.filter(
    (asset) => generationSelection[asset.id] ?? asset.generationStatus !== "completed",
  ).length;
  const allPromptSelected = useMemo(
    () =>
      generationCount > 0 &&
      assets.every((asset) => {
        const shouldGenerate =
          generationSelection[asset.id] ?? asset.generationStatus !== "completed";

        if (!shouldGenerate) {
          return true;
        }

        if (!asset.promptKey) {
          return false;
        }

        if (asset.promptKey === "custom") {
          return Boolean(asset.customPrompt?.trim());
        }

        return true;
      }),
    [assets, generationCount, generationSelection],
  );

  function isSelectedForGeneration(asset: ProjectAsset) {
    return generationSelection[asset.id] ?? asset.generationStatus !== "completed";
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    if (files.length > 100) {
      setUploadError(copy.maxSelection);
      event.target.value = "";
      return;
    }

    const invalidFiles = findInvalidJpegFiles(files);

    if (invalidFiles.length > 0) {
      setUploadError(`${copy.invalidTypePrefix}${invalidFiles.map((file) => file.name).join(", ")}`);
      event.target.value = "";
      return;
    }

    if (assets.length + files.length > 100) {
      setUploadError(copy.maxProjectPhotos(assets.length));
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

      for (const [index, originalFile] of files.entries()) {
        const preparedFile = await prepareJpegFileForUpload(originalFile);

        const response = await uploadFileWithProgress(
          `/api/projects/${projectId}/assets`,
          preparedFile,
          (loadedBytes, elapsedMs) => {
            const speed = elapsedMs <= 0 ? 0 : (loadedBytes / elapsedMs) * 1000;
            setUploadProgress({
              currentFile: index + 1,
              totalFiles: files.length,
              loadedBytes:
                uploadedBytes +
                (preparedFile.size === 0
                  ? originalFile.size
                  : (loadedBytes / preparedFile.size) * originalFile.size),
              totalBytes,
              speed: formatSpeed(speed),
            });
          },
        );

        const data = await parseApiResponse(response, copy.tooLarge);

        if (!response.ok) {
          throw new Error(
            data.error
              ? `${originalFile.name}: ${data.error}`
              : `${originalFile.name}: ${copy.uploadFailed}`,
          );
        }

        uploadedBytes += originalFile.size;
        latestAssets = data.assets ?? latestAssets;
        setAssets(latestAssets);
        setGenerationSelection((current) => {
          const next: Record<string, boolean> = {};

          for (const asset of latestAssets) {
            next[asset.id] = current[asset.id] ?? asset.generationStatus !== "completed";
          }

          return next;
        });
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
      setUploadError(error instanceof Error ? error.message : copy.uploadUnknown);
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
    const data = await parseApiResponse(response, copy.tooLarge);

    if (!response.ok) {
      setUploadError(data.error ?? copy.deleteFailed);
      return;
    }

    setAssets((current) => current.filter((asset) => asset.id !== assetId));
    setGenerationSelection((current) => {
      const next = { ...current };
      delete next[assetId];
      return next;
    });
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
                promptOptions.find((option) => option.key === promptKey)?.label ??
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

  function handleGenerationSelectionChange(assetId: string, checked: boolean) {
    setGenerationSelection((current) => ({
      ...current,
      [assetId]: checked,
    }));
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
            shouldGenerate: isSelectedForGeneration(asset),
          })),
        }),
      });

      const data = await parseApiResponse(response, copy.tooLarge);

      if (!response.ok) {
        setGenerateError(data.error ?? copy.generateFailed);
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
              {copy.uploadLabel}
            </p>
            <h2 className="text-2xl tracking-tight">{copy.uploadTitle}</h2>
          </div>
          <label className="inline-flex h-12 cursor-pointer items-center justify-center border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]">
            <input
              type="file"
              accept={JPEG_ACCEPT}
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={isUploading}
            />
            {isUploading
              ? copy.uploadingButton(uploadProgress?.currentFile ?? 0, uploadProgress?.totalFiles ?? 0)
              : copy.selectPhotos}
          </label>
        </div>

        <div className="grid gap-3 border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-sm leading-7 text-[var(--muted)]">
          {copy.tips.map((tip) => (
            <p key={tip}>{tip}</p>
          ))}
        </div>

        {uploadProgress ? (
          <div className="grid gap-3 border border-[var(--line)] p-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              <span>{copy.uploadFiles(uploadProgress.currentFile, uploadProgress.totalFiles)}</span>
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
              {copy.uploadCompleted(uploadPercent)}
            </div>
          </div>
        ) : null}

        {uploadError ? <p className="text-sm text-[#8d2f24]">{uploadError}</p> : null}
      </section>

      <section className="grid gap-4 border border-[var(--line)] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              {copy.promptLabel}
            </p>
            <h2 className="text-2xl tracking-tight">{copy.promptTitle}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              {copy.promptDescription}
            </p>
          </div>
          <button
            type="button"
            className="h-12 border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:text-[var(--muted)]"
            disabled={!allPromptSelected || isPending}
            onClick={handleGenerate}
          >
            {isPending ? copy.submitting : copy.startGenerating}
          </button>
        </div>

        {!hasAssets ? (
          <div className="grid min-h-64 place-items-center border border-dashed border-[var(--line)] text-center text-sm text-[var(--muted)]">
            {copy.uploadFirst}
          </div>
        ) : (
          <div className="grid gap-4">
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
                      aria-label={copy.deletePhoto(asset.fileName)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="grid aspect-video w-full place-items-center overflow-hidden border border-[var(--line)] bg-black p-0">
                    <img
                      src={asset.originalUrl}
                      alt={asset.fileName}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span className="truncate">{asset.fileName}</span>
                    <span>{asset.regenerationCount}/{MAX_REGENERATION_COUNT} {copy.reGenLabel}</span>
                  </div>
                  {asset.generationStatus === "completed" ? (
                    <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={isSelectedForGeneration(asset)}
                        onChange={(event) =>
                          handleGenerationSelectionChange(asset.id, event.target.checked)
                        }
                      />
                      {copy.regenerateCheck}
                    </label>
                  ) : (
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      {copy.newThisRun}
                    </div>
                  )}
                  <select
                    className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm outline-none focus:border-[var(--text)]"
                    value={asset.promptKey ?? ""}
                    onChange={(event) =>
                      handlePromptChange(asset.id, event.target.value as PromptKey)
                    }
                    disabled={asset.generationStatus === "completed" && !isSelectedForGeneration(asset)}
                  >
                    <option value="">{copy.promptPlaceholder}</option>
                    {promptOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {asset.promptKey === "custom" ? (
                    <textarea
                      className="min-h-24 border border-[var(--line)] bg-transparent px-3 py-3 text-sm outline-none focus:border-[var(--text)]"
                      placeholder={copy.customPlaceholder}
                      value={asset.customPrompt ?? ""}
                      onChange={(event) =>
                        handleCustomPromptChange(asset.id, event.target.value)
                      }
                      disabled={asset.generationStatus === "completed" && !isSelectedForGeneration(asset)}
                    />
                  ) : null}
                </article>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="h-12 border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:text-[var(--muted)]"
                disabled={!allPromptSelected || isPending}
                onClick={handleGenerate}
              >
                {isPending ? copy.submitting : copy.startGenerating}
              </button>
            </div>
          </div>
        )}

        {generateError ? (
          <p className="text-sm text-[#8d2f24]">{generateError}</p>
        ) : null}
      </section>
    </div>
  );
}
