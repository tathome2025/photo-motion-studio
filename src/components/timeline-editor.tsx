"use client";
/* eslint-disable @next/next/no-img-element */

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fetchFile } from "@ffmpeg/util";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { GripVertical, Trash2 } from "lucide-react";

import {
  MAX_REGENERATION_COUNT,
  THEME_OPTIONS,
} from "@/lib/constants";
import {
  getCanvaSlideshowTemplates,
  getFrameStyleOptions,
  getThemeOptions,
  getTransitionOptions,
  type Locale,
} from "@/lib/i18n";
import type {
  CanvaSlideshowTemplateKey,
  ProjectAsset,
  ProjectCanvaExport,
  TimelineUpdateItem,
} from "@/lib/types";

interface TimelineEditorProps {
  projectId: string;
  initialAssets: ProjectAsset[];
  initialCanvaExport: ProjectCanvaExport | null;
  locale: Locale;
}

function isImageUrl(url: string) {
  const normalized = url.toLowerCase();
  return normalized.includes(".jpg") || normalized.includes(".jpeg") || normalized.includes(".png");
}

function toFfmpegColor(color: string) {
  return color.replace("#", "0x");
}

function getTransitionFilter(transition: ProjectAsset["transitionKey"]) {
  switch (transition) {
    case "wipeleft":
      return { filter: "wipeleft", duration: 0.55 };
    case "slideup":
      return { filter: "slideup", duration: 0.55 };
    case "cut":
      return { filter: "fade", duration: 0.05 };
    case "fade":
    default:
      return { filter: "fade", duration: 0.55 };
  }
}

function buildFrameFilters(frameStyle: ProjectAsset["frameStyleKey"], border: string) {
  if (frameStyle === "none") {
    return [];
  }

  if (frameStyle === "single") {
    return [`drawbox=x=28:y=28:w=iw-56:h=ih-56:color=${border}:t=4`];
  }

  if (frameStyle === "double") {
    return [
      `drawbox=x=20:y=20:w=iw-40:h=ih-40:color=${border}:t=3`,
      `drawbox=x=34:y=34:w=iw-68:h=ih-68:color=${border}:t=2`,
    ];
  }

  return [
    `drawbox=x=28:y=28:w=iw-56:h=ih-56:color=${border}:t=4`,
    `drawbox=x=46:y=46:w=iw-92:h=ih-92:color=${border}@0.75:t=2`,
  ];
}

function buildFilterGraph(assets: ProjectAsset[]) {
  const filters: string[] = [];

  assets.forEach((asset, index) => {
    const theme = THEME_OPTIONS.find((item) => item.key === asset.themeKey) ?? THEME_OPTIONS[0];
    const base = [
      `[${index}:v]fps=30,scale=1280:720:force_original_aspect_ratio=decrease`,
      `pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=${toFfmpegColor(theme.background)}`,
      "setsar=1",
      ...buildFrameFilters(asset.frameStyleKey, toFfmpegColor(theme.border)),
      `format=yuv420p,setpts=PTS-STARTPTS[v${index}]`,
    ];

    filters.push(base.join(","));
  });

  if (assets.length === 1) {
    return { filter: filters.join(";"), outputLabel: "v0" };
  }

  let currentLabel = "v0";
  let currentDuration = assets[0].durationSeconds;

  for (let index = 1; index < assets.length; index += 1) {
    const transition = getTransitionFilter(assets[index - 1].transitionKey);
    const nextLabel = `vx${index}`;
    const offset = Math.max(currentDuration - transition.duration, 0);

    filters.push(
      `[${currentLabel}][v${index}]xfade=transition=${transition.filter}:duration=${transition.duration}:offset=${offset}[${nextLabel}]`,
    );

    currentLabel = nextLabel;
    currentDuration =
      currentDuration + assets[index].durationSeconds - transition.duration;
  }

  return { filter: filters.join(";"), outputLabel: currentLabel };
}

function SortableTimelineClip({
  asset,
  isSelected,
  onSelect,
  locale,
}: {
  asset: ProjectAsset;
  isSelected: boolean;
  onSelect: (assetId: string) => void;
  locale: Locale;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: asset.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`grid min-w-[170px] gap-3 border p-3 transition ${
        isSelected ? "border-[var(--text)] bg-[var(--surface)]" : "border-[var(--line)]"
      }`}
    >
      <button
        type="button"
        className="grid gap-3 text-left"
        onClick={() => onSelect(asset.id)}
      >
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
          <span>{asset.isStaticClip ? (locale === "en" ? "still" : "靜態") : "video"}</span>
          <span>{asset.fileName}</span>
        </div>
        <div className="grid aspect-square w-[140px] place-items-center overflow-hidden border border-[var(--line)] bg-black">
          {asset.isStaticClip ? (
            <img
              src={asset.originalUrl}
              alt={asset.fileName}
              className="h-full w-full object-contain"
            />
          ) : (
            <video
              src={asset.generatedUrl ?? undefined}
              className="h-full w-full object-contain"
              muted
            />
          )}
        </div>
      </button>

      <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
        <span>{asset.regenerationCount}/{MAX_REGENERATION_COUNT} re-gen</span>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center border border-[var(--line)]"
          {...attributes}
          {...listeners}
          aria-label={locale === "en" ? `Sort ${asset.fileName}` : `排序 ${asset.fileName}`}
        >
          <GripVertical size={14} />
        </button>
      </div>
    </article>
  );
}

async function parseApiResponse(response: Response) {
  const rawText = await response.text();

  try {
    return JSON.parse(rawText) as { error?: string; project?: { name: string }; assets?: ProjectAsset[] };
  } catch {
    throw new Error(rawText || `Request failed (${response.status})`);
  }
}

export function TimelineEditor({
  projectId,
  initialAssets,
  initialCanvaExport,
  locale,
}: TimelineEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const canvaTemplates = getCanvaSlideshowTemplates(locale);
  const transitionOptions = getTransitionOptions(locale);
  const themeOptions = getThemeOptions(locale);
  const frameStyleOptions = getFrameStyleOptions(locale);
  const [assets, setAssets] = useState(initialAssets);
  const [canvaExport, setCanvaExport] = useState<ProjectCanvaExport | null>(initialCanvaExport);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<CanvaSlideshowTemplateKey>(
    initialCanvaExport?.templateKey ?? canvaTemplates[0]?.key ?? "canva-clean",
  );
  const [canvaPreviewIndex, setCanvaPreviewIndex] = useState(0);
  const [selectedAssetId, setSelectedAssetId] = useState(initialAssets[0]?.id ?? null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [canvaWorking, setCanvaWorking] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const copy =
    locale === "en"
      ? {
          saved: "Timeline saved.",
          sortedSaved: "Order saved automatically.",
          saveFailed: "Failed to save timeline.",
          deleteConfirm: "This clip cannot be restored after deletion. Continue?",
          deleteFailed: "Failed to delete clip.",
          deleted: "Clip deleted.",
          preparingExport: "Preparing video export...",
          exportLoadFailed: "Failed to load export data.",
          clipNotReady: (name: string) => `Clip ${name} is not ready yet.`,
          exported: "Video exported and downloaded.",
          exportFailed: "Export failed.",
          noClips: "There are no clips available for editing yet.",
          title: "Horizontal timeline editing with large preview",
          backHome: "Back home",
          saving: "Saving...",
          saveTimeline: "Save timeline",
          exporting: "Exporting...",
          exportVideo: "Export video",
          preview: "Preview",
          selectedClip: "Selected clip",
          regenerationCount: (count: number) =>
            `Regeneration count ${count}/${MAX_REGENERATION_COUNT}`,
          transition: "Transition",
          theme: "Theme",
          frame: "Frame",
          regenerateTitle: "Go to the separate regenerate page",
          regenerateDescription:
            "Regeneration opens a separate page that shows all thumbnails at once, so you can select clips and assign actions one by one.",
          openRegenerate: "Open regenerate page",
          deletePhoto: "Delete photo",
          canvaSection: "Canva slideshow",
          canvaTitle: "Choose a free Canva slideshow template",
          canvaDescription:
            "After ordering your clips, apply one template. The app maps clips into the selected slideshow layout automatically and prepares an in-app preview.",
          applyTemplate: "Apply template",
          applyingTemplate: "Applying...",
          applyFailed: "Failed to apply Canva template.",
          previewReady: "Template applied. Preview is ready.",
          previewEmpty: "Apply a template first to preview.",
          previewTag: "Canva preview",
          mappedClips: (count: number) => `${count} clip(s) mapped`,
          openCanvaTemplates: "Open Canva free templates",
          redoCanva: "Redo",
          redoingCanva: "Redoing...",
          redoFailed: "Failed to redo Canva slideshow.",
          downloadFromCanva: "Download slideshow",
          selectTemplate: "Select template",
          horizontalTimeline: "Horizontal timeline",
          reorder: "Drag thumbnails to reorder",
          clips: (count: number) => `${count} clips`,
        }
      : {
          saved: "時間線已儲存。",
          sortedSaved: "排序已自動儲存。",
          saveFailed: "儲存時間線失敗。",
          deleteConfirm: "刪除此片段後不能還原，是否繼續？",
          deleteFailed: "刪除片段失敗。",
          deleted: "片段已刪除。",
          preparingExport: "準備影片匯出中...",
          exportLoadFailed: "載入匯出資料失敗。",
          clipNotReady: (name: string) => `片段 ${name} 尚未完成生成。`,
          exported: "影片已匯出並下載到電腦。",
          exportFailed: "匯出失敗。",
          noClips: "目前沒有可剪輯片段。",
          title: "橫向時間線排序與大 preview 剪輯",
          backHome: "返回首頁",
          saving: "儲存中...",
          saveTimeline: "儲存時間線",
          exporting: "輸出中...",
          exportVideo: "輸出影片",
          preview: "Preview",
          selectedClip: "Selected clip",
          regenerationCount: (count: number) =>
            `重新生成次數 ${count}/${MAX_REGENERATION_COUNT}`,
          transition: "Transition",
          theme: "Theme",
          frame: "Frame",
          regenerateTitle: "前往獨立頁面重新生成",
          regenerateDescription:
            "重新生成會打開獨立頁面，一次過顯示所有縮圖，再逐張勾選並設定生成動作。",
          openRegenerate: "打開重新生成頁面",
          deletePhoto: "刪除相片",
          canvaSection: "Canva slideshow",
          canvaTitle: "選擇 Canva 免費 Slideshow 範本",
          canvaDescription:
            "完成排位後可套用一個範本，系統會按你的時間線順序把動態影像自動放入 slideshow，並建立 app 內 preview。",
          applyTemplate: "套用範本",
          applyingTemplate: "套用中...",
          applyFailed: "套用 Canva 範本失敗。",
          previewReady: "範本已套用，可即時 preview。",
          previewEmpty: "先套用範本，之後會在此顯示 preview。",
          previewTag: "Canva preview",
          mappedClips: (count: number) => `已映射 ${count} 段片段`,
          openCanvaTemplates: "開啟 Canva 免費範本頁",
          redoCanva: "重做",
          redoingCanva: "重做中...",
          redoFailed: "重做 Canva slideshow 失敗。",
          downloadFromCanva: "下載 slideshow",
          selectTemplate: "選擇範本",
          horizontalTimeline: "Horizontal timeline",
          reorder: "拖動縮圖重新排序",
          clips: (count: number) => `${count} clips`,
        };

  useEffect(() => {
    if (!selectedAssetId && assets[0]) {
      setSelectedAssetId(assets[0].id);
      return;
    }

    if (selectedAssetId && !assets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(assets[0]?.id ?? null);
    }
  }, [assets, selectedAssetId]);

  useEffect(() => {
    if (!canvaExport) {
      setCanvaPreviewIndex(0);
      return;
    }

    if (canvaPreviewIndex >= canvaExport.clipUrls.length) {
      setCanvaPreviewIndex(0);
    }
  }, [canvaExport, canvaPreviewIndex]);

  const selectedAsset =
    assets.find((asset) => asset.id === selectedAssetId) ?? assets[0] ?? null;

  const orderedIds = useMemo(() => assets.map((asset) => asset.id), [assets]);

  function persistTimeline(nextAssets: ProjectAsset[], successMessage = copy.saved) {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      const payload: TimelineUpdateItem[] = nextAssets.map((asset, index) => ({
        id: asset.id,
        timelineOrder: index,
        transitionKey: asset.transitionKey,
        themeKey: asset.themeKey,
        frameStyleKey: asset.frameStyleKey,
      }));

      const response = await fetch(`/api/projects/${projectId}/timeline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: payload }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok) {
        setError(data.error ?? copy.saveFailed);
        return;
      }

      setStatusMessage(successMessage);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = assets.findIndex((asset) => asset.id === active.id);
    const newIndex = assets.findIndex((asset) => asset.id === over.id);
    const nextAssets = arrayMove(assets, oldIndex, newIndex);
    setAssets(nextAssets);
    setCanvaExport(null);
    persistTimeline(nextAssets, copy.sortedSaved);
  }

  function handleSelectedFieldChange(
    field: "transitionKey" | "themeKey" | "frameStyleKey",
    value: string,
  ) {
    if (!selectedAsset) {
      return;
    }

    setAssets((current) =>
      current.map((asset) =>
        asset.id === selectedAsset.id
          ? {
              ...asset,
              [field]: value,
            }
          : asset,
      ),
    );
  }

  function saveTimelineEdits() {
    persistTimeline(assets);
  }

  async function applyCanvaTemplate() {
    setError(null);
    setStatusMessage(null);
    setCanvaWorking(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/canva/compose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateKey: selectedTemplateKey,
          orderedAssetIds: assets.map((asset) => asset.id),
        }),
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        setError(data.error ?? copy.applyFailed);
        return;
      }

      setCanvaExport((data as { canvaExport?: ProjectCanvaExport }).canvaExport ?? null);
      setCanvaPreviewIndex(0);
      setStatusMessage(copy.previewReady);
    } finally {
      setCanvaWorking(false);
    }
  }

  async function resetCanvaTemplate() {
    setError(null);
    setStatusMessage(null);
    setCanvaWorking(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/canva/reset`, {
        method: "POST",
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        setError(data.error ?? copy.redoFailed);
        return;
      }

      setCanvaExport(null);
      setCanvaPreviewIndex(0);
    } finally {
      setCanvaWorking(false);
    }
  }

  async function deleteClip() {
    if (!selectedAsset) {
      return;
    }

    const confirmed = window.confirm(copy.deleteConfirm);

    if (!confirmed) {
      return;
    }

    setError(null);
    const response = await fetch(`/api/projects/${projectId}/assets/${selectedAsset.id}`, {
      method: "DELETE",
    });
    const data = await parseApiResponse(response);

    if (!response.ok) {
      setError(data.error ?? copy.deleteFailed);
      return;
    }

    setAssets((current) => current.filter((asset) => asset.id !== selectedAsset.id));
    setCanvaExport(null);
    setStatusMessage(copy.deleted);
  }

  async function exportVideo() {
    setExporting(true);
    setError(null);
    setStatusMessage(copy.preparingExport);

    try {
      const response = await fetch(`/api/projects/${projectId}/render`, {
        method: "POST",
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error ?? copy.exportLoadFailed);
      }

      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();
      }

      const ffmpeg = ffmpegRef.current;

      if (!ffmpeg.loaded) {
        await ffmpeg.load({
          coreURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js",
          wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm",
        });
      }

      const args: string[] = [];

      for (let index = 0; index < assets.length; index += 1) {
        const asset = assets[index];

        if (asset.isStaticClip) {
          await ffmpeg.writeFile(`clip-${index}.jpg`, await fetchFile(asset.originalUrl));
          args.push(
            "-loop",
            "1",
            "-framerate",
            "30",
            "-t",
            String(asset.durationSeconds),
            "-i",
            `clip-${index}.jpg`,
          );
          continue;
        }

        if (!asset.generatedUrl) {
          throw new Error(copy.clipNotReady(asset.fileName));
        }

        await ffmpeg.writeFile(`clip-${index}.mp4`, await fetchFile(asset.generatedUrl));
        args.push("-i", `clip-${index}.mp4`);
      }

      const filterGraph = buildFilterGraph(assets);

      await ffmpeg.exec([
        ...args,
        "-filter_complex",
        filterGraph.filter,
        "-map",
        `[${filterGraph.outputLabel}]`,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "output.mp4",
      ]);

      const output = await ffmpeg.readFile("output.mp4");
      const bytes =
        output instanceof Uint8Array ? output : new TextEncoder().encode(output);
      const normalized = new Uint8Array(bytes.byteLength);
      normalized.set(bytes);
      const blob = new Blob([normalized.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${data.project?.name ?? "motioncut"}-final-cut.mp4`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatusMessage(copy.exported);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.exportFailed);
    } finally {
      setExporting(false);
    }
  }

  if (!selectedAsset) {
    return (
      <div className="grid min-h-80 place-items-center border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">
        {copy.noClips}
      </div>
    );
  }

  const selectedTheme =
    THEME_OPTIONS.find((item) => item.key === selectedAsset.themeKey) ?? THEME_OPTIONS[0];
  const selectedCanvaTemplate =
    canvaTemplates.find((item) => item.key === selectedTemplateKey) ?? canvaTemplates[0];
  const canvaPreviewUrl =
    canvaExport?.clipUrls[canvaPreviewIndex] ??
    canvaExport?.clipUrls[0] ??
    null;

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 border border-[var(--line)] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Timeline
            </p>
            <h2 className="text-3xl tracking-tight">
              {copy.title}
            </h2>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center border border-[var(--line)] px-5 text-sm uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
            >
              {copy.backHome}
            </Link>
            <button
              type="button"
              className="h-12 border border-[var(--line)] px-5 text-sm uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
              onClick={saveTimelineEdits}
              disabled={isPending}
            >
              {isPending ? copy.saving : copy.saveTimeline}
            </button>
            <button
              type="button"
              className="h-12 border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]"
              onClick={exportVideo}
              disabled={exporting}
            >
              {exporting ? copy.exporting : copy.exportVideo}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4 border border-[var(--line)] p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            <span>{copy.preview}</span>
            <span>{selectedAsset.fileName}</span>
          </div>
          <div
            className="grid min-h-[420px] place-items-center border p-5"
            style={{
              borderColor: selectedTheme.border,
              backgroundColor: selectedTheme.background,
              color: selectedTheme.text,
            }}
          >
            {selectedAsset.isStaticClip ? (
              <img
                src={selectedAsset.originalUrl}
                alt={selectedAsset.fileName}
                className="aspect-video w-full border border-current object-cover"
              />
            ) : (
              <video
                src={selectedAsset.generatedUrl ?? undefined}
                className="aspect-video w-full border border-current object-cover"
                controls
              />
            )}
          </div>
        </div>

        <div className="grid gap-4 border border-[var(--line)] p-5">
          <div className="grid gap-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              {copy.selectedClip}
            </p>
            <h3 className="text-2xl tracking-tight">{selectedAsset.fileName}</h3>
            <p className="text-sm leading-6 text-[var(--muted)]">
              {copy.regenerationCount(selectedAsset.regenerationCount)}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              {copy.transition}
              <select
                className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
                value={selectedAsset.transitionKey}
                onChange={(event) =>
                  handleSelectedFieldChange("transitionKey", event.target.value)
                }
              >
                {transitionOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              {copy.theme}
              <select
                className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
                value={selectedAsset.themeKey}
                onChange={(event) =>
                  handleSelectedFieldChange("themeKey", event.target.value)
                }
              >
                {themeOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              {copy.frame}
              <select
                className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
                value={selectedAsset.frameStyleKey}
                onChange={(event) =>
                  handleSelectedFieldChange("frameStyleKey", event.target.value)
                }
              >
                {frameStyleOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 border border-[var(--line)] bg-[var(--surface-soft)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  Regenerate
                </p>
                <h4 className="text-lg tracking-tight">{copy.regenerateTitle}</h4>
              </div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                max {MAX_REGENERATION_COUNT}
              </div>
            </div>
            <p className="text-sm leading-6 text-[var(--muted)]">
              {copy.regenerateDescription}
            </p>
            <Link
              href={`/projects/${projectId}/regenerate`}
              className="inline-flex h-10 items-center justify-center border border-[var(--line)] px-4 text-xs uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
            >
              {copy.openRegenerate}
            </Link>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 border border-[var(--line)] px-4 text-sm uppercase tracking-[0.2em] transition hover:border-[#8d2f24] hover:text-[#8d2f24]"
              onClick={deleteClip}
            >
              <Trash2 size={15} />
              {copy.deletePhoto}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 border border-[var(--line)] p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              {copy.horizontalTimeline}
            </p>
            <h3 className="text-2xl tracking-tight">{copy.reorder}</h3>
          </div>
          <div className="text-sm text-[var(--muted)]">{copy.clips(assets.length)}</div>
        </div>

        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={orderedIds} strategy={horizontalListSortingStrategy}>
              <div className="flex min-w-max gap-4 pb-2">
                {assets.map((asset) => (
                  <SortableTimelineClip
                    key={asset.id}
                    asset={asset}
                    isSelected={asset.id === selectedAsset.id}
                    onSelect={setSelectedAssetId}
                    locale={locale}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </section>

      <section className="grid gap-5 border border-[var(--line)] p-5">
        <div className="grid gap-3">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            {copy.canvaSection}
          </p>
          <h3 className="text-2xl tracking-tight">{copy.canvaTitle}</h3>
          <p className="max-w-4xl text-sm leading-7 text-[var(--muted)]">
            {copy.canvaDescription}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-4">
            <div className="grid gap-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              <span>{copy.selectTemplate}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {canvaTemplates.map((template) => {
                const active = template.key === selectedTemplateKey;
                return (
                  <button
                    key={template.key}
                    type="button"
                    className={`grid gap-3 border p-4 text-left transition ${
                      active ? "border-[var(--text)] bg-[var(--surface-soft)]" : "border-[var(--line)]"
                    }`}
                    onClick={() => setSelectedTemplateKey(template.key)}
                  >
                    <div
                      className="h-24 border"
                      style={{
                        borderColor: template.accent,
                        backgroundColor: template.surface,
                      }}
                    />
                    <div className="grid gap-1">
                      <div className="text-sm tracking-tight">{template.name}</div>
                      <div className="text-xs leading-6 text-[var(--muted)]">{template.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="h-11 border border-[var(--text)] px-4 text-xs uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:text-[var(--muted)]"
                onClick={applyCanvaTemplate}
                disabled={canvaWorking || assets.length === 0}
              >
                {canvaWorking ? copy.applyingTemplate : copy.applyTemplate}
              </button>
              {selectedCanvaTemplate ? (
                <a
                  href={selectedCanvaTemplate.createUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center border border-[var(--line)] px-4 text-xs uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
                >
                  {copy.openCanvaTemplates}
                </a>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 border border-[var(--line)] p-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              <span>{copy.previewTag}</span>
              {canvaExport ? <span>{copy.mappedClips(canvaExport.slideCount)}</span> : null}
            </div>
            <div className="grid min-h-[220px] place-items-center border border-[var(--line)] bg-[var(--surface-soft)] p-3">
              {canvaPreviewUrl ? (
                isImageUrl(canvaPreviewUrl) ? (
                  <img
                    src={canvaPreviewUrl}
                    alt="Canva preview"
                    className="aspect-video w-full border border-[var(--line)] object-cover"
                  />
                ) : (
                  <video
                    key={canvaPreviewUrl}
                    src={canvaPreviewUrl}
                    className="aspect-video w-full border border-[var(--line)] object-cover"
                    controls
                  />
                )
              ) : (
                <p className="text-sm text-[var(--muted)]">{copy.previewEmpty}</p>
              )}
            </div>
            {canvaExport ? (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {canvaExport.clipUrls.map((url, index) => (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      className={`min-w-20 border p-1 transition ${
                        canvaPreviewIndex === index
                          ? "border-[var(--text)]"
                          : "border-[var(--line)]"
                      }`}
                      onClick={() => setCanvaPreviewIndex(index)}
                    >
                      {isImageUrl(url) ? (
                        <img src={url} alt={`Preview ${index + 1}`} className="h-12 w-full object-cover" />
                      ) : (
                        <video src={url} className="h-12 w-full object-cover" muted />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="h-10 border border-[var(--text)] px-4 text-xs uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]"
                    onClick={exportVideo}
                    disabled={exporting}
                  >
                    {exporting ? copy.exporting : copy.downloadFromCanva}
                  </button>
                <button
                  type="button"
                  className="h-10 border border-[var(--line)] px-4 text-xs uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
                  onClick={resetCanvaTemplate}
                  disabled={canvaWorking}
                >
                  {canvaWorking ? copy.redoingCanva : copy.redoCanva}
                </button>
              </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {statusMessage ? <p className="text-sm text-[#2e5a31]">{statusMessage}</p> : null}
      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </div>
  );
}
