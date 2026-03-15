"use client";

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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fetchFile } from "@ffmpeg/util";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { GripVertical } from "lucide-react";

import {
  FRAME_STYLE_OPTIONS,
  THEME_OPTIONS,
  TRANSITION_OPTIONS,
} from "@/lib/constants";
import type { ProjectAsset, TimelineUpdateItem } from "@/lib/types";

interface TimelineEditorProps {
  projectId: string;
  initialAssets: ProjectAsset[];
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

function SortableClip({
  asset,
  onSelectChange,
}: {
  asset: ProjectAsset;
  onSelectChange: (
    assetId: string,
    field: "transitionKey" | "themeKey" | "frameStyleKey",
    value: string,
  ) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: asset.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const theme = THEME_OPTIONS.find((option) => option.key === asset.themeKey) ?? THEME_OPTIONS[0];

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="grid gap-4 border border-[var(--line)] bg-[var(--surface)] p-4"
      data-dragging={isDragging}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Clip
          </p>
          <h3 className="max-w-[18rem] text-lg tracking-tight">{asset.fileName}</h3>
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center border border-[var(--line)]"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
      </div>

      <div
        className="grid min-h-56 place-items-center border p-4"
        style={{
          borderColor: theme.border,
          backgroundColor: theme.background,
          color: theme.text,
        }}
      >
        <video
          src={asset.generatedUrl ?? undefined}
          className="aspect-video w-full border border-current object-cover"
          controls
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Transition
          <select
            className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
            value={asset.transitionKey}
            onChange={(event) =>
              onSelectChange(asset.id, "transitionKey", event.target.value)
            }
          >
            {TRANSITION_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Theme
          <select
            className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
            value={asset.themeKey}
            onChange={(event) =>
              onSelectChange(asset.id, "themeKey", event.target.value)
            }
          >
            {THEME_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Frame
          <select
            className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
            value={asset.frameStyleKey}
            onChange={(event) =>
              onSelectChange(asset.id, "frameStyleKey", event.target.value)
            }
          >
            {FRAME_STYLE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}

export function TimelineEditor({
  projectId,
  initialAssets,
}: TimelineEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [assets, setAssets] = useState(initialAssets);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const orderedIds = useMemo(() => assets.map((asset) => asset.id), [assets]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = assets.findIndex((asset) => asset.id === active.id);
    const newIndex = assets.findIndex((asset) => asset.id === over.id);
    setAssets((current) => arrayMove(current, oldIndex, newIndex));
  }

  function handleSelectChange(
    assetId: string,
    field: "transitionKey" | "themeKey" | "frameStyleKey",
    value: string,
  ) {
    setAssets((current) =>
      current.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              [field]: value,
            }
          : asset,
      ),
    );
  }

  function saveTimelineEdits() {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      const payload: TimelineUpdateItem[] = assets.map((asset, index) => ({
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

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "儲存時間線失敗。");
        return;
      }

      setStatusMessage("時間線已儲存。");
    });
  }

  async function exportVideo() {
    setExporting(true);
    setError(null);
    setStatusMessage("準備影片匯出中...");

    try {
      const response = await fetch(`/api/projects/${projectId}/render`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "載入匯出資料失敗。");
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

      for (let index = 0; index < assets.length; index += 1) {
        const asset = assets[index];
        if (!asset.generatedUrl) {
          throw new Error(`片段 ${asset.fileName} 尚未完成生成。`);
        }

        await ffmpeg.writeFile(`clip-${index}.mp4`, await fetchFile(asset.generatedUrl));
      }

      const filterGraph = buildFilterGraph(assets);
      const args = assets.flatMap((_, index) => ["-i", `clip-${index}.mp4`]);

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
      anchor.download = `${data.project.name}-final-cut.mp4`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatusMessage("影片已匯出並下載到電腦。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "匯出失敗。");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 border border-[var(--line)] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Timeline
            </p>
            <h2 className="text-3xl tracking-tight">
              拖放排序、調整過場、套用邊框與主題
            </h2>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center border border-[var(--line)] px-5 text-sm uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
            >
              返回首頁
            </Link>
            <button
              type="button"
              className="h-12 border border-[var(--line)] px-5 text-sm uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
              onClick={saveTimelineEdits}
              disabled={isPending}
            >
              {isPending ? "儲存中..." : "儲存時間線"}
            </button>
            <button
              type="button"
              className="h-12 border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]"
              onClick={exportVideo}
              disabled={exporting}
            >
              {exporting ? "輸出中..." : "輸出影片"}
            </button>
          </div>
        </div>

        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          這個版本採用瀏覽器內 ffmpeg.wasm 匯出，會依你設定的排序、過場、主題與邊框合成單一 MP4，適合直接在 Vercel 前端部署。
        </p>
      </section>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <div className="grid gap-4">
            {assets.map((asset) => (
              <SortableClip
                key={asset.id}
                asset={asset}
                onSelectChange={handleSelectChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {statusMessage ? <p className="text-sm text-[#2e5a31]">{statusMessage}</p> : null}
      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </div>
  );
}
