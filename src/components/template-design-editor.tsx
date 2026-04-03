"use client";

import { useMemo, useState } from "react";

import {
  FRAME_STYLE_OPTIONS,
  THEME_OPTIONS,
  TRANSITION_OPTIONS,
} from "@/lib/constants";
import type { StudioTemplatePreset, StudioTemplateKey } from "@/lib/types";

interface TemplateDesignEditorProps {
  initialTemplates: StudioTemplatePreset[];
}

function defaultTemplateMap(templates: StudioTemplatePreset[]) {
  const map = new Map<StudioTemplateKey, StudioTemplatePreset>();

  for (const item of templates) {
    map.set(item.key, item);
  }

  return map;
}

function getTransitionLabel(key: StudioTemplatePreset["transitionKey"]) {
  return TRANSITION_OPTIONS.find((item) => item.key === key)?.label ?? key;
}

function FrameOverlay({
  frameStyleKey,
  color,
}: {
  frameStyleKey: StudioTemplatePreset["frameStyleKey"];
  color: string;
}) {
  if (frameStyleKey === "none") {
    return null;
  }

  if (frameStyleKey === "single") {
    return (
      <div
        className="pointer-events-none absolute inset-[22px] border-2"
        style={{ borderColor: color }}
      />
    );
  }

  if (frameStyleKey === "double") {
    return (
      <>
        <div
          className="pointer-events-none absolute inset-[16px] border"
          style={{ borderColor: color }}
        />
        <div
          className="pointer-events-none absolute inset-[30px] border"
          style={{ borderColor: color }}
        />
      </>
    );
  }

  return (
    <>
      <div
        className="pointer-events-none absolute inset-[22px] border-2"
        style={{ borderColor: color }}
      />
      <div
        className="pointer-events-none absolute bottom-[42px] left-[42px] right-[10px] top-[54px] border"
        style={{ borderColor: `${color}B3` }}
      />
    </>
  );
}

function MiniThemeCard({ template }: { template: StudioTemplatePreset }) {
  const theme = THEME_OPTIONS.find((item) => item.key === template.themeKey) ?? THEME_OPTIONS[0];

  return (
    <div className="grid gap-2 border border-[var(--line)] p-2">
      <div
        className="h-12 border"
        style={{
          borderColor: theme.border,
          backgroundColor: theme.background,
        }}
      />
      <div className="grid grid-cols-3 gap-2">
        <span className="h-2 border" style={{ borderColor: theme.border, backgroundColor: theme.background }} />
        <span className="h-2 border" style={{ borderColor: theme.border, backgroundColor: theme.border }} />
        <span className="h-2 border" style={{ borderColor: theme.border, backgroundColor: theme.text }} />
      </div>
    </div>
  );
}

export function TemplateDesignEditor({ initialTemplates }: TemplateDesignEditorProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedKey, setSelectedKey] = useState<StudioTemplateKey>(initialTemplates[0].key);
  const [savingKey, setSavingKey] = useState<StudioTemplateKey | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTemplate =
    templates.find((item) => item.key === selectedKey) ?? templates[0];
  const activeTheme =
    THEME_OPTIONS.find((item) => item.key === activeTemplate.themeKey) ?? THEME_OPTIONS[0];

  const timelineBlocks = useMemo(
    () => [
      { id: "scene-1", label: "Scene 01", width: "32%" },
      { id: "scene-2", label: "Scene 02", width: "28%" },
      { id: "scene-3", label: "Scene 03", width: "40%" },
    ],
    [],
  );

  function updateActiveTemplate<K extends keyof StudioTemplatePreset>(
    field: K,
    value: StudioTemplatePreset[K],
  ) {
    setTemplates((current) =>
      current.map((template) =>
        template.key === activeTemplate.key
          ? {
              ...template,
              [field]: value,
            }
          : template,
      ),
    );
  }

  async function saveTemplate(templateKey: StudioTemplateKey) {
    const template = templates.find((item) => item.key === templateKey);

    if (!template) {
      return;
    }

    setSavingKey(templateKey);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch(`/api/template-presets/${templateKey}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label: template.label,
          description: template.description,
          transitionKey: template.transitionKey,
          themeKey: template.themeKey,
          frameStyleKey: template.frameStyleKey,
        }),
      });

      const raw = await response.text();
      const payload = raw ? (JSON.parse(raw) as { error?: string }) : {};

      if (!response.ok) {
        throw new Error(payload.error ?? "更新模板失敗。");
      }

      setStatus(`已儲存 ${template.label}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新模板失敗。");
      setTemplates((current) => {
        const originals = defaultTemplateMap(initialTemplates);
        return current.map((item) => originals.get(item.key) ?? item);
      });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="grid content-start gap-3 border border-[var(--line)] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Templates
          </p>
          {templates.map((template) => (
            <button
              key={template.key}
              type="button"
              className={`grid gap-2 border p-2 text-left transition ${
                template.key === activeTemplate.key
                  ? "border-[var(--text)] bg-[var(--surface-soft)]"
                  : "border-[var(--line)] hover:border-[var(--text)]"
              }`}
              onClick={() => setSelectedKey(template.key)}
            >
              <p className="text-xs uppercase tracking-[0.14em]">{template.label}</p>
              <MiniThemeCard template={template} />
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                {template.transitionKey} · {template.frameStyleKey}
              </p>
            </button>
          ))}
        </aside>

        <div className="grid gap-3 border border-[var(--line)] p-4">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div className="grid gap-1">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Live stage
              </p>
              <h2 className="text-xl tracking-tight">{activeTemplate.label}</h2>
            </div>
            <button
              type="button"
              className="h-10 border border-[var(--text)] px-4 text-xs uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]"
              onClick={() => saveTemplate(activeTemplate.key)}
              disabled={savingKey === activeTemplate.key}
            >
              {savingKey === activeTemplate.key ? "Saving..." : "Save"}
            </button>
          </div>

          <div
            className="relative aspect-video overflow-hidden border"
            style={{
              borderColor: activeTheme.border,
              background: `linear-gradient(135deg, ${activeTheme.background} 0%, #ffffff 100%)`,
            }}
          >
            <div className="absolute inset-0 grid grid-cols-[1.3fr_0.8fr] gap-3 p-5">
              <div className="grid grid-rows-[1fr_auto] gap-3 border p-3" style={{ borderColor: activeTheme.border }}>
                <div
                  className="border"
                  style={{
                    borderColor: activeTheme.border,
                    background:
                      "linear-gradient(145deg, rgba(0,0,0,0.06) 0%, rgba(255,255,255,0.22) 100%)",
                  }}
                />
                <div className="grid gap-1">
                  <span
                    className="h-2 border"
                    style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.border }}
                  />
                  <span className="h-2 border" style={{ borderColor: activeTheme.border }} />
                </div>
              </div>
              <div className="grid gap-3">
                <div className="border p-2" style={{ borderColor: activeTheme.border }}>
                  <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: activeTheme.text }}>
                    {getTransitionLabel(activeTemplate.transitionKey)}
                  </span>
                </div>
                <div className="border p-2" style={{ borderColor: activeTheme.border }}>
                  <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: activeTheme.text }}>
                    {activeTheme.label}
                  </span>
                </div>
              </div>
            </div>
            <FrameOverlay frameStyleKey={activeTemplate.frameStyleKey} color={activeTheme.border} />
          </div>

          <div className="grid gap-2 border border-[var(--line)] p-3">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
              <span>Timeline Preview</span>
              <span>{getTransitionLabel(activeTemplate.transitionKey)}</span>
            </div>
            <div className="flex items-center gap-2">
              {timelineBlocks.map((block, index) => (
                <div key={block.id} className="flex items-center gap-2" style={{ width: block.width }}>
                  <div
                    className="grid h-10 w-full place-items-center border text-[10px] uppercase tracking-[0.12em]"
                    style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.background }}
                  >
                    {block.label}
                  </div>
                  {index < timelineBlocks.length - 1 ? (
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                      {activeTemplate.transitionKey}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="grid content-start gap-3 border border-[var(--line)] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Inspector</p>

          <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Template name
            <input
              className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
              value={activeTemplate.label}
              onChange={(event) => updateActiveTemplate("label", event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Description
            <textarea
              className="min-h-24 border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none"
              value={activeTemplate.description}
              onChange={(event) => updateActiveTemplate("description", event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Transition
            <select
              className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
              value={activeTemplate.transitionKey}
              onChange={(event) =>
                updateActiveTemplate(
                  "transitionKey",
                  event.target.value as StudioTemplatePreset["transitionKey"],
                )
              }
            >
              {TRANSITION_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Theme
            <select
              className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
              value={activeTemplate.themeKey}
              onChange={(event) =>
                updateActiveTemplate(
                  "themeKey",
                  event.target.value as StudioTemplatePreset["themeKey"],
                )
              }
            >
              {THEME_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Frame
            <select
              className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
              value={activeTemplate.frameStyleKey}
              onChange={(event) =>
                updateActiveTemplate(
                  "frameStyleKey",
                  event.target.value as StudioTemplatePreset["frameStyleKey"],
                )
              }
            >
              {FRAME_STYLE_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </aside>
      </div>

      {status ? <p className="text-sm text-[#2e5a31]">{status}</p> : null}
      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </section>
  );
}
