"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MUSIC_TRACK_OPTIONS, STUDIO_TEMPLATE_PRESETS } from "@/lib/constants";
import { renderVideoPreview } from "@/lib/client-render";
import type { Locale } from "@/lib/i18n";
import type { ProjectAsset, ProjectTemplateConfig } from "@/lib/types";

interface RenderPreviewPanelProps {
  projectId: string;
  projectName: string;
  assets: ProjectAsset[];
  templateConfig: ProjectTemplateConfig;
  locale: Locale;
}

export function RenderPreviewPanel({
  projectId,
  projectName,
  assets,
  templateConfig,
  locale,
}: RenderPreviewPanelProps) {
  const [isRendering, setIsRendering] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const templatePreset = STUDIO_TEMPLATE_PRESETS.find(
    (preset) => preset.key === templateConfig.templateKey,
  );
  const musicTrack = MUSIC_TRACK_OPTIONS.find((track) => track.key === templateConfig.musicKey);
  const playableAssets = useMemo(
    () => assets.filter((asset) => asset.generationStatus === "completed"),
    [assets],
  );
  const copy =
    locale === "en"
      ? {
          title: "Rendered preview",
          description:
            "The full video is rendered in your browser with the selected template and music. Review it before download.",
          backSetup: "Back to template setup",
          rerender: "Render again",
          rendering: "Rendering video...",
          downloading: "Download video",
          empty: "No completed clips available for preview.",
          failed: "Render failed.",
          template: "Template",
          music: "Music",
          clips: (count: number) => `${count} clips`,
        }
      : {
          title: "渲染預覽",
          description:
            "系統會用你選擇的模板與音樂，在瀏覽器內完成完整影片渲染。確認無誤後即可下載。",
          backSetup: "返回模板設定",
          rerender: "重新渲染",
          rendering: "影片渲染中...",
          downloading: "下載影片",
          empty: "沒有可預覽的已完成片段。",
          failed: "渲染失敗。",
          template: "模板",
          music: "音樂",
          clips: (count: number) => `${count} 段片段`,
        };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (playableAssets.length === 0 || !templatePreset) {
      return;
    }

    let cancelled = false;

    async function run() {
      const activeTemplate = templatePreset;
      if (!activeTemplate) {
        return;
      }

      setError(null);
      setIsRendering(true);

      try {
        const blob = await renderVideoPreview({
          assets: playableAssets,
          templatePreset: activeTemplate,
          musicFilePath: musicTrack?.filePath ?? null,
        });

        if (cancelled) {
          return;
        }

        setPreviewUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }

          return URL.createObjectURL(blob);
        });
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : copy.failed);
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    }

    run().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [copy.failed, musicTrack?.filePath, playableAssets, templatePreset]);

  function downloadVideo() {
    if (!previewUrl) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = previewUrl;
    anchor.download = `${projectName}-final-cut.mp4`;
    anchor.click();
  }

  async function rerender() {
    const activeTemplate = templatePreset;
    if (!activeTemplate || playableAssets.length === 0) {
      return;
    }

    setError(null);
    setIsRendering(true);

    try {
      const blob = await renderVideoPreview({
        assets: playableAssets,
        templatePreset: activeTemplate,
        musicFilePath: musicTrack?.filePath ?? null,
      });

      setPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return URL.createObjectURL(blob);
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.failed);
    } finally {
      setIsRendering(false);
    }
  }

  return (
    <section className="grid gap-6 border border-[var(--line)] p-6">
      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Preview</p>
        <h2 className="text-3xl tracking-tight">{copy.title}</h2>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">{copy.description}</p>
      </div>

      <div className="grid gap-2 text-sm text-[var(--muted)] md:grid-cols-3">
        <div>
          {copy.template}: <span className="text-[var(--text)]">{templateConfig.templateName}</span>
        </div>
        <div>
          {copy.music}:{" "}
          <span className="text-[var(--text)]">{musicTrack?.label ?? templateConfig.musicKey}</span>
        </div>
        <div>
          {copy.clips(playableAssets.length)}
        </div>
      </div>

      <div className="grid min-h-[420px] place-items-center border border-[var(--line)] bg-[var(--surface-soft)] p-4">
        {playableAssets.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{copy.empty}</p>
        ) : previewUrl ? (
          <video src={previewUrl} controls className="aspect-video w-full border border-[var(--line)] object-cover" />
        ) : (
          <div className="grid justify-items-center gap-3">
            <span className="h-8 w-8 animate-spin border border-[var(--line)] border-t-[var(--text)]" />
            <p className="text-sm text-[var(--muted)]">{copy.rendering}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/projects/${projectId}/style`}
          className="inline-flex h-12 items-center justify-center border border-[var(--line)] px-5 text-sm uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
        >
          {copy.backSetup}
        </Link>
        <button
          type="button"
          className="h-12 border border-[var(--line)] px-5 text-sm uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
          onClick={rerender}
          disabled={isRendering || playableAssets.length === 0}
        >
          {isRendering ? copy.rendering : copy.rerender}
        </button>
        <button
          type="button"
          className="h-12 border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]"
          onClick={downloadVideo}
          disabled={!previewUrl || isRendering}
        >
          {copy.downloading}
        </button>
      </div>

      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </section>
  );
}
