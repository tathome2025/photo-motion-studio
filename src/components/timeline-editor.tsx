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
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { GripVertical, Trash2 } from "lucide-react";

import { MAX_REGENERATION_COUNT, THEME_OPTIONS } from "@/lib/constants";
import {
  getFrameStyleOptions,
  getThemeOptions,
  getTransitionOptions,
  type Locale,
} from "@/lib/i18n";
import type { ProjectAsset, TimelineUpdateItem } from "@/lib/types";

interface TimelineEditorProps {
  projectId: string;
  initialAssets: ProjectAsset[];
  locale: Locale;
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
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: asset.id,
  });

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
    return JSON.parse(rawText) as {
      error?: string;
    };
  } catch {
    throw new Error(rawText || `Request failed (${response.status})`);
  }
}

export function TimelineEditor({ projectId, initialAssets, locale }: TimelineEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const transitionOptions = getTransitionOptions(locale);
  const themeOptions = getThemeOptions(locale);
  const frameStyleOptions = getFrameStyleOptions(locale);
  const [assets, setAssets] = useState(initialAssets);
  const [selectedAssetId, setSelectedAssetId] = useState(initialAssets[0]?.id ?? null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const copy =
    locale === "en"
      ? {
          saved: "Timeline saved.",
          sortedSaved: "Order saved automatically.",
          saveFailed: "Failed to save timeline.",
          deleteConfirm: "This clip cannot be restored after deletion. Continue?",
          deleteFailed: "Failed to delete clip.",
          deleted: "Clip deleted.",
          noClips: "There are no clips available for editing yet.",
          title: "Horizontal timeline editing with large preview",
          backHome: "Back home",
          saving: "Saving...",
          saveTimeline: "Save timeline",
          nextStep: "Next: Template & Music",
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
          noClips: "目前沒有可剪輯片段。",
          title: "橫向時間線排序與大 preview 剪輯",
          backHome: "返回首頁",
          saving: "儲存中...",
          saveTimeline: "儲存時間線",
          nextStep: "下一步：選模板與音樂",
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
    setStatusMessage(copy.deleted);
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

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 border border-[var(--line)] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Timeline</p>
            <h2 className="text-3xl tracking-tight">{copy.title}</h2>
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
            <Link
              href={`/projects/${projectId}/style`}
              className="inline-flex h-12 items-center justify-center border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]"
            >
              {copy.nextStep}
            </Link>
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
                onChange={(event) => handleSelectedFieldChange("themeKey", event.target.value)}
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

          <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-2 border border-[var(--line)] px-4 text-sm uppercase tracking-[0.2em] transition hover:border-[#8d2f24] hover:text-[#8d2f24]"
            onClick={deleteClip}
          >
            <Trash2 size={15} />
            {copy.deletePhoto}
          </button>
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

      {statusMessage ? <p className="text-sm text-[#2e5a31]">{statusMessage}</p> : null}
      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </div>
  );
}
