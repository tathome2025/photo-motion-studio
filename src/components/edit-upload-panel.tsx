"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  findInvalidJpegFiles,
  JPEG_ACCEPT,
  prepareJpegFileForUpload,
} from "@/lib/client-upload";
import type { Locale } from "@/lib/i18n";

interface EditUploadPanelProps {
  projectId: string;
  currentAssetCount: number;
  locale: Locale;
}

interface ApiResponse {
  error?: string;
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

export function EditUploadPanel({
  projectId,
  currentAssetCount,
  locale,
}: EditUploadPanelProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    currentFile: number;
    totalFiles: number;
    loadedBytes: number;
    totalBytes: number;
    speed: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const copy =
    locale === "en"
      ? {
          tooLarge: "A single JPG file is still above the deployment upload limit. Reduce the image size and try again.",
          uploadFailed: "Upload failed.",
          maxSelection: "You can select up to 100 photos per upload.",
          invalidTypePrefix: "Only JPG / JPEG files are accepted. Please check: ",
          maxProjectPhotos: (count: number) =>
            `This project can contain up to 100 photos. It currently has ${count}.`,
          uploaded: "New photos uploaded. Redirecting to the setup page.",
          sectionLabel: "Add photos",
          title: "Add more photos while editing",
          description:
            "Upload multiple photos in one go, up to 100 per project. Front-facing group photos and landscape images work best. Only JPG / JPEG files are accepted. Portrait photos are extended with a blurred background and normalized to 16:9. After upload, you will return to setup to assign actions for the new photos.",
          uploadButton: "Upload more photos",
          uploadingButton: "Uploading...",
          currentCount: (count: number) => `${count}/100 in project`,
          uploading: (current: number, total: number) => `Uploading ${current}/${total}`,
          uploadedAmount: (loaded: number, total: number) =>
            `Uploaded ${(loaded / 1024 / 1024).toFixed(2)} / ${(total / 1024 / 1024).toFixed(2)} MB`,
        }
      : {
          tooLarge: "單張 JPG 檔案仍超過部署平台上傳上限，請先縮小相片後再試。",
          uploadFailed: "上傳失敗。",
          maxSelection: "單次最多選擇 100 張相片。",
          invalidTypePrefix: "只接受 JPG / JPEG。請檢查：",
          maxProjectPhotos: (count: number) =>
            `此專案最多只可有 100 張相片，現有 ${count} 張。`,
          uploaded: "新增相片已上傳，正在切換到設定頁。",
          sectionLabel: "Add photos",
          title: "剪輯途中可再新增相片",
          description:
            "可一次選取多張相片批量上傳，單一專案最多 100 張。建議上傳面向鏡頭的合照及橫向相片；只接受 JPG / JPEG。直向相片會自動延展成模糊背景，統一整理成 16:9。新增完成後會回到設定頁，先為新相片選擇動作再提交。",
          uploadButton: "新增上傳相片",
          uploadingButton: "上傳中...",
          currentCount: (count: number) => `目前 ${count}/100 張`,
          uploading: (current: number, total: number) => `Uploading ${current}/${total}`,
          uploadedAmount: (loaded: number, total: number) =>
            `已上傳 ${(loaded / 1024 / 1024).toFixed(2)} / ${(total / 1024 / 1024).toFixed(2)} MB`,
        };

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    if (files.length > 100) {
      setError(copy.maxSelection);
      event.target.value = "";
      return;
    }

    const invalidFiles = findInvalidJpegFiles(files);

    if (invalidFiles.length > 0) {
      setError(`${copy.invalidTypePrefix}${invalidFiles.map((file) => file.name).join(", ")}`);
      event.target.value = "";
      return;
    }

    if (currentAssetCount + files.length > 100) {
      setError(copy.maxProjectPhotos(currentAssetCount));
      event.target.value = "";
      return;
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    let uploadedBytes = 0;

    setError(null);
    setStatusMessage(null);
    setIsUploading(true);
    setUploadProgress({
      currentFile: 0,
      totalFiles: files.length,
      loadedBytes: 0,
      totalBytes,
      speed: "0 KB/s",
    });

    try {
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
        setUploadProgress({
          currentFile: index + 1,
          totalFiles: files.length,
          loadedBytes: uploadedBytes,
          totalBytes,
          speed: "0 KB/s",
        });
      }

      setStatusMessage(copy.uploaded);
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.uploadFailed);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      event.target.value = "";
    }
  }

  return (
    <section className="grid gap-4 border border-[var(--line)] p-5">
      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {copy.sectionLabel}
        </p>
        <h2 className="text-2xl tracking-tight">{copy.title}</h2>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
          {copy.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex h-12 cursor-pointer items-center justify-center border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]">
          {isUploading ? copy.uploadingButton : copy.uploadButton}
          <input
            type="file"
            accept={JPEG_ACCEPT}
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={isUploading}
          />
        </label>
        <div className="text-sm text-[var(--muted)]">
          {copy.currentCount(currentAssetCount)}
        </div>
      </div>

      {uploadProgress ? (
        <div className="grid gap-3 border border-[var(--line)] bg-[var(--surface-soft)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            <span>
              {copy.uploading(uploadProgress.currentFile, uploadProgress.totalFiles)}
            </span>
            <span>{uploadProgress.speed}</span>
          </div>
          <div className="h-3 border border-[var(--line)] bg-transparent">
            <div
              className="h-full bg-[var(--text)] transition-[width] duration-300"
              style={{
                width: `${
                  uploadProgress.totalBytes === 0
                    ? 0
                    : (uploadProgress.loadedBytes / uploadProgress.totalBytes) * 100
                }%`,
              }}
            />
          </div>
          <div className="text-sm text-[var(--muted)]">
            {copy.uploadedAmount(uploadProgress.loadedBytes, uploadProgress.totalBytes)}
          </div>
        </div>
      ) : null}

      {statusMessage ? <p className="text-sm text-[#2e5a31]">{statusMessage}</p> : null}
      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </section>
  );
}
