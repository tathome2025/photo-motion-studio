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
import { GripVertical, RefreshCcw, Trash2 } from "lucide-react";

import {
  FRAME_STYLE_OPTIONS,
  MAX_REGENERATION_COUNT,
  PROMPT_OPTIONS,
  THEME_OPTIONS,
  TRANSITION_OPTIONS,
} from "@/lib/constants";
import type { ProjectAsset, PromptKey, TimelineUpdateItem } from "@/lib/types";

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

function SortableTimelineClip({
  asset,
  isSelected,
  onSelect,
  checkedForRegeneration,
  onCheckedChange,
}: {
  asset: ProjectAsset;
  isSelected: boolean;
  onSelect: (assetId: string) => void;
  checkedForRegeneration: boolean;
  onCheckedChange: (assetId: string, checked: boolean) => void;
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
          <span>{asset.isStaticClip ? "static" : "video"}</span>
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

      <div className="flex items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
          <input
            type="checkbox"
            className="h-3.5 w-3.5"
            checked={checkedForRegeneration}
            onChange={(event) => onCheckedChange(asset.id, event.target.checked)}
            disabled={asset.regenerationCount >= MAX_REGENERATION_COUNT}
          />
          {asset.regenerationCount}/{MAX_REGENERATION_COUNT} re-gen
        </label>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center border border-[var(--line)]"
          {...attributes}
          {...listeners}
          aria-label={`排序 ${asset.fileName}`}
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
    throw new Error(rawText || `請求失敗 (${response.status})`);
  }
}

export function TimelineEditor({
  projectId,
  initialAssets,
}: TimelineEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [assets, setAssets] = useState(initialAssets);
  const [selectedAssetId, setSelectedAssetId] = useState(initialAssets[0]?.id ?? null);
  const [regeneratePlan, setRegeneratePlan] = useState<
    Record<
      string,
      {
        checked: boolean;
        promptKey: PromptKey;
        customPrompt: string;
      }
    >
  >(() =>
    Object.fromEntries(
      initialAssets.map((asset) => [
        asset.id,
        {
          checked: false,
          promptKey: asset.promptKey ?? "smile",
          customPrompt: asset.customPrompt ?? "",
        },
      ]),
    ),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ffmpegRef = useRef<FFmpeg | null>(null);

  useEffect(() => {
    if (!selectedAssetId && assets[0]) {
      setSelectedAssetId(assets[0].id);
      return;
    }

    if (selectedAssetId && !assets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(assets[0]?.id ?? null);
    }
  }, [assets, selectedAssetId]);

  const selectedAsset =
    assets.find((asset) => asset.id === selectedAssetId) ?? assets[0] ?? null;

  useEffect(() => {
    setRegeneratePlan((current) => {
      const next: typeof current = {};

      for (const asset of assets) {
        next[asset.id] = current[asset.id] ?? {
          checked: false,
          promptKey: asset.promptKey ?? "smile",
          customPrompt: asset.customPrompt ?? "",
        };
      }

      return next;
    });
  }, [assets]);

  const orderedIds = useMemo(() => assets.map((asset) => asset.id), [assets]);
  const checkedAssetIds = assets
    .filter((asset) => regeneratePlan[asset.id]?.checked)
    .map((asset) => asset.id);
  const selectedRegenerateSettings = selectedAsset
    ? regeneratePlan[selectedAsset.id] ?? {
        checked: false,
        promptKey: selectedAsset.promptKey ?? "smile",
        customPrompt: selectedAsset.customPrompt ?? "",
      }
    : null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = assets.findIndex((asset) => asset.id === active.id);
    const newIndex = assets.findIndex((asset) => asset.id === over.id);
    setAssets((current) => arrayMove(current, oldIndex, newIndex));
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

  function handleRegenerateSettingChange(
    assetId: string,
    updates: Partial<{
      checked: boolean;
      promptKey: PromptKey;
      customPrompt: string;
    }>,
  ) {
    setRegeneratePlan((current) => ({
      ...current,
      [assetId]: {
        checked: current[assetId]?.checked ?? false,
        promptKey: current[assetId]?.promptKey ?? "smile",
        customPrompt: current[assetId]?.customPrompt ?? "",
        ...updates,
      },
    }));
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

      const data = await parseApiResponse(response);

      if (!response.ok) {
        setError(data.error ?? "儲存時間線失敗。");
        return;
      }

      setStatusMessage("時間線已儲存。");
    });
  }

  async function deleteClip() {
    if (!selectedAsset) {
      return;
    }

    const confirmed = window.confirm("刪除此片段後不能還原，是否繼續？");

    if (!confirmed) {
      return;
    }

    setError(null);
    const response = await fetch(`/api/projects/${projectId}/assets/${selectedAsset.id}`, {
      method: "DELETE",
    });
    const data = await parseApiResponse(response);

    if (!response.ok) {
      setError(data.error ?? "刪除片段失敗。");
      return;
    }

    setAssets((current) => current.filter((asset) => asset.id !== selectedAsset.id));
    setStatusMessage("片段已刪除。");
  }

  async function regenerateSelected() {
    if (checkedAssetIds.length === 0) {
      setError("請先勾選要重新生成的片段。");
      return;
    }

    setError(null);
    setStatusMessage(null);

    const failures: string[] = [];
    let successCount = 0;

    for (const assetId of checkedAssetIds) {
      const settings = regeneratePlan[assetId];
      const asset = assets.find((item) => item.id === assetId);

      if (!settings || !asset) {
        continue;
      }

      if (settings.promptKey === "custom" && !settings.customPrompt.trim()) {
        failures.push(`${asset.fileName}: 選擇「其他動作」時請輸入 prompt。`);
        continue;
      }

      const response = await fetch(
        `/api/projects/${projectId}/assets/${assetId}/regenerate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            promptKey: settings.promptKey,
            customPrompt: settings.customPrompt,
          }),
        },
      );

      const data = await parseApiResponse(response);

      if (!response.ok) {
        failures.push(data.error ? `${asset.fileName}: ${data.error}` : `${asset.fileName}: 重新生成失敗。`);
        continue;
      }

      successCount += 1;
    }

    if (successCount === 0) {
      setError(failures[0] ?? "重新生成失敗。");
      return;
    }

    if (failures.length > 0) {
      setStatusMessage(`已提交 ${successCount} 個片段，另有 ${failures.length} 個未能提交。`);
    }

    window.location.href = `/projects/${projectId}/waiting`;
  }

  async function exportVideo() {
    setExporting(true);
    setError(null);
    setStatusMessage("準備影片匯出中...");

    try {
      const response = await fetch(`/api/projects/${projectId}/render`, {
        method: "POST",
      });
      const data = await parseApiResponse(response);

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
          throw new Error(`片段 ${asset.fileName} 尚未完成生成。`);
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
      setStatusMessage("影片已匯出並下載到電腦。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "匯出失敗。");
    } finally {
      setExporting(false);
    }
  }

  if (!selectedAsset) {
    return (
      <div className="grid min-h-80 place-items-center border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">
        目前沒有可剪輯片段。
      </div>
    );
  }

  const selectedTheme =
    THEME_OPTIONS.find((item) => item.key === selectedAsset.themeKey) ?? THEME_OPTIONS[0];

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 border border-[var(--line)] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Timeline
            </p>
            <h2 className="text-3xl tracking-tight">
              橫向時間線排序與大 preview 剪輯
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
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4 border border-[var(--line)] p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            <span>Preview</span>
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
              Selected clip
            </p>
            <h3 className="text-2xl tracking-tight">{selectedAsset.fileName}</h3>
            <p className="text-sm leading-6 text-[var(--muted)]">
              重新生成次數 {selectedAsset.regenerationCount}/{MAX_REGENERATION_COUNT}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Transition
              <select
                className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
                value={selectedAsset.transitionKey}
                onChange={(event) =>
                  handleSelectedFieldChange("transitionKey", event.target.value)
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
                value={selectedAsset.themeKey}
                onChange={(event) =>
                  handleSelectedFieldChange("themeKey", event.target.value)
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
                value={selectedAsset.frameStyleKey}
                onChange={(event) =>
                  handleSelectedFieldChange("frameStyleKey", event.target.value)
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

          <div className="grid gap-3 border border-[var(--line)] bg-[var(--surface-soft)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  Regenerate
                </p>
                <h4 className="text-lg tracking-tight">勾選後統一重新生成</h4>
              </div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                max {MAX_REGENERATION_COUNT}
              </div>
            </div>
            <p className="text-sm leading-6 text-[var(--muted)]">
              先在時間線勾選要重新生成的片段，再以目前選取片段設定動作。
              已勾選 {checkedAssetIds.length} 項。
            </p>
            <select
              className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm outline-none focus:border-[var(--text)]"
              value={selectedRegenerateSettings?.promptKey ?? "smile"}
              onChange={(event) =>
                handleRegenerateSettingChange(selectedAsset.id, {
                  promptKey: event.target.value as PromptKey,
                })
              }
              disabled={selectedAsset.regenerationCount >= MAX_REGENERATION_COUNT}
            >
              {PROMPT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            {selectedRegenerateSettings?.promptKey === "custom" ? (
              <textarea
                className="min-h-24 border border-[var(--line)] bg-transparent px-3 py-3 text-sm outline-none focus:border-[var(--text)]"
                placeholder="輸入自訂動作 prompt"
                value={selectedRegenerateSettings.customPrompt}
                onChange={(event) =>
                  handleRegenerateSettingChange(selectedAsset.id, {
                    customPrompt: event.target.value,
                  })
                }
                disabled={selectedAsset.regenerationCount >= MAX_REGENERATION_COUNT}
              />
            ) : null}
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 border border-[var(--text)] px-4 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:text-[var(--muted)]"
              onClick={regenerateSelected}
              disabled={
                selectedAsset.regenerationCount >= MAX_REGENERATION_COUNT ||
                checkedAssetIds.length === 0
              }
            >
              <RefreshCcw size={15} />
              {selectedAsset.regenerationCount >= MAX_REGENERATION_COUNT
                ? "已達上限，請刪除相片"
                : "重新生成所有已勾選項目"}
            </button>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 border border-[var(--line)] px-4 text-sm uppercase tracking-[0.2em] transition hover:border-[#8d2f24] hover:text-[#8d2f24]"
              onClick={deleteClip}
            >
              <Trash2 size={15} />
              刪除相片
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 border border-[var(--line)] p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Horizontal timeline
            </p>
            <h3 className="text-2xl tracking-tight">拖動縮圖重新排序</h3>
          </div>
          <div className="text-sm text-[var(--muted)]">
            {assets.length} clips / {checkedAssetIds.length} checked
          </div>
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
                    checkedForRegeneration={Boolean(regeneratePlan[asset.id]?.checked)}
                    onCheckedChange={(assetId, checked) =>
                      handleRegenerateSettingChange(assetId, { checked })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </section>

      {statusMessage ? <p className="text-sm text-[#2e5a31]">{statusMessage}</p> : null}
      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </div>
  );
}
