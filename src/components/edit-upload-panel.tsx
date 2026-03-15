"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface EditUploadPanelProps {
  projectId: string;
  currentAssetCount: number;
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

export function EditUploadPanel({
  projectId,
  currentAssetCount,
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

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    if (files.length > 100) {
      setError("單次最多選擇 100 張相片。");
      event.target.value = "";
      return;
    }

    if (currentAssetCount + files.length > 100) {
      setError(`此專案最多只可有 100 張相片，現有 ${currentAssetCount} 張。`);
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
        setUploadProgress({
          currentFile: index + 1,
          totalFiles: files.length,
          loadedBytes: uploadedBytes,
          totalBytes,
          speed: "0 KB/s",
        });
      }

      setStatusMessage("新增相片已上傳，正在切換到設定頁。");
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "上傳失敗。");
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
          Add photos
        </p>
        <h2 className="text-2xl tracking-tight">剪輯途中可再新增相片</h2>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
          可一次選取多張相片批量上傳，單一專案最多 100 張。建議上傳面向鏡頭的合照及橫向相片；
          直向相片會自動左右補黑，統一整理成 16:9。新增完成後會回到設定頁，先為新相片選擇動作再提交。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex h-12 cursor-pointer items-center justify-center border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]">
          {isUploading ? "上傳中..." : "新增上傳相片"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={isUploading}
          />
        </label>
        <div className="text-sm text-[var(--muted)]">
          目前 {currentAssetCount}/100 張
        </div>
      </div>

      {uploadProgress ? (
        <div className="grid gap-3 border border-[var(--line)] bg-[var(--surface-soft)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            <span>
              Uploading {uploadProgress.currentFile}/{uploadProgress.totalFiles}
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
            已上傳 {(uploadProgress.loadedBytes / 1024 / 1024).toFixed(2)} /{" "}
            {(uploadProgress.totalBytes / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
      ) : null}

      {statusMessage ? <p className="text-sm text-[#2e5a31]">{statusMessage}</p> : null}
      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </section>
  );
}
