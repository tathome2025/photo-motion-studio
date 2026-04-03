"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DEFAULT_MUSIC_TRACK_KEY } from "@/lib/constants";
import { getMusicTrackOptions, type Locale } from "@/lib/i18n";
import type {
  MusicTrackKey,
  ProjectTemplateConfig,
  StudioTemplateKey,
  StudioTemplatePreset,
} from "@/lib/types";

interface TemplateMusicSelectorProps {
  projectId: string;
  assetCount: number;
  templateOptions: StudioTemplatePreset[];
  initialTemplateConfig: ProjectTemplateConfig | null;
  locale: Locale;
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

export function TemplateMusicSelector({
  projectId,
  assetCount,
  templateOptions,
  initialTemplateConfig,
  locale,
}: TemplateMusicSelectorProps) {
  const router = useRouter();
  const musicOptions = getMusicTrackOptions(locale);
  const [selectedTemplate, setSelectedTemplate] = useState<StudioTemplateKey>(
    initialTemplateConfig?.templateKey ?? templateOptions[0].key,
  );
  const [selectedMusic, setSelectedMusic] = useState<MusicTrackKey>(
    initialTemplateConfig?.musicKey ?? DEFAULT_MUSIC_TRACK_KEY,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy =
    locale === "en"
      ? {
          title: "Choose template and music",
          description:
            "After ordering clips, select one of the 4 preset templates and one background track. The next step will render a full preview video.",
          backToEdit: "Back to timeline",
          applyAndContinue: "Render preview",
          applying: "Preparing...",
          templateLabel: "Template",
          musicLabel: "Music",
          clipCount: (count: number) => `${count} clips in timeline`,
          failed: "Failed to save template and music.",
        }
      : {
          title: "選擇模板與音樂",
          description:
            "完成排位後，請在 4 個預設模板中選 1 個，再選 1 首背景音樂。下一步會渲染完整預覽影片。",
          backToEdit: "返回時間線",
          applyAndContinue: "前往渲染預覽",
          applying: "準備中...",
          templateLabel: "模板",
          musicLabel: "音樂",
          clipCount: (count: number) => `時間線共 ${count} 段片段`,
          failed: "儲存模板與音樂失敗。",
        };

  async function handleContinue() {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/template-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateKey: selectedTemplate,
          musicKey: selectedMusic,
          applyToAllAssets: true,
        }),
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        setError(data.error ?? copy.failed);
        return;
      }

      router.push(`/projects/${projectId}/preview`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.failed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6 border border-[var(--line)] p-6">
      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Render setup</p>
        <h2 className="text-3xl tracking-tight">{copy.title}</h2>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">{copy.description}</p>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          {copy.clipCount(assetCount)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="grid gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            {copy.templateLabel}
          </p>
          <div className="grid gap-3">
            {templateOptions.map((template) => (
              <button
                key={template.key}
                type="button"
                className={`grid gap-1 border px-4 py-3 text-left transition ${
                  selectedTemplate === template.key
                    ? "border-[var(--text)] bg-[var(--surface-soft)]"
                    : "border-[var(--line)] hover:border-[var(--text)]"
                }`}
                onClick={() => setSelectedTemplate(template.key)}
              >
                <span className="text-sm uppercase tracking-[0.18em]">{template.label}</span>
                <span className="text-sm text-[var(--muted)]">{template.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            {copy.musicLabel}
            <select
              className="h-12 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
              value={selectedMusic}
              onChange={(event) => setSelectedMusic(event.target.value as MusicTrackKey)}
            >
              {musicOptions.map((music) => (
                <option key={music.key} value={music.key}>
                  {music.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-[var(--muted)]">
            {locale === "en"
              ? "Put 10 MP3 files under /public/music with names track-01.mp3 ... track-10.mp3."
              : "請把 10 首 MP3 放在 /public/music，檔名為 track-01.mp3 至 track-10.mp3。"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/projects/${projectId}/edit`}
          className="inline-flex h-12 items-center justify-center border border-[var(--line)] px-5 text-sm uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
        >
          {copy.backToEdit}
        </Link>
        <button
          type="button"
          className="h-12 border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]"
          onClick={handleContinue}
          disabled={isSubmitting}
        >
          {isSubmitting ? copy.applying : copy.applyAndContinue}
        </button>
      </div>

      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </section>
  );
}
