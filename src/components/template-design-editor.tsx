"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

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

function TransitionStagePreview({
  template,
  theme,
}: {
  template: StudioTemplatePreset;
  theme: (typeof THEME_OPTIONS)[number];
}) {
  const [phase, setPhase] = useState(false);

  useEffect(() => {
    let timerA = 0;
    let timerB = 0;

    function play() {
      setPhase(false);
      timerA = window.setTimeout(() => setPhase(true), 120);
    }

    play();
    timerB = window.setInterval(play, 2400);

    return () => {
      window.clearTimeout(timerA);
      window.clearInterval(timerB);
    };
  }, [template.transitionKey, template.themeKey, template.frameStyleKey]);

  const firstStyle: CSSProperties = {
    transition: "opacity 800ms ease",
    opacity: template.transitionKey === "cut" ? (phase ? 0 : 1) : 1,
  };

  const secondStyle: CSSProperties = {
    transition: "opacity 900ms ease, transform 900ms ease, clip-path 900ms ease",
    opacity: phase ? 1 : 0,
    transform: "translateY(0%)",
    clipPath: "inset(0 0 0 0)",
  };

  if (template.transitionKey === "cut") {
    secondStyle.transition = "none";
    secondStyle.opacity = phase ? 1 : 0;
  } else if (template.transitionKey === "fade") {
    secondStyle.opacity = phase ? 1 : 0;
  } else if (template.transitionKey === "wipeleft") {
    secondStyle.opacity = 1;
    secondStyle.clipPath = phase ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)";
  } else if (template.transitionKey === "slideup") {
    secondStyle.opacity = 1;
    secondStyle.transform = phase ? "translateY(0%)" : "translateY(100%)";
  }

  return (
    <div className="relative h-full w-full overflow-hidden border" style={{ borderColor: theme.border }}>
      <div className="absolute inset-0 p-5" style={firstStyle}>
        <div
          className="grid h-full grid-rows-[1fr_auto] gap-3 border p-3"
          style={{ borderColor: theme.border }}
        >
          <div
            className="border"
            style={{
              borderColor: theme.border,
              background:
                "linear-gradient(130deg, rgba(0,0,0,0.08) 0%, rgba(255,255,255,0.28) 100%)",
            }}
          />
          <div className="grid gap-1">
            <span className="h-2 border" style={{ borderColor: theme.border, backgroundColor: theme.border }} />
            <span className="h-2 border" style={{ borderColor: theme.border }} />
          </div>
        </div>
      </div>

      <div className="absolute inset-0 p-5" style={secondStyle}>
        <div
          className="grid h-full grid-cols-[0.75fr_1.25fr] gap-3 border p-3"
          style={{ borderColor: theme.border }}
        >
          <div
            className="border"
            style={{
              borderColor: theme.border,
              background:
                "linear-gradient(130deg, rgba(255,255,255,0.28) 0%, rgba(0,0,0,0.14) 100%)",
            }}
          />
          <div className="grid gap-2">
            <span
              className="h-2 border"
              style={{ borderColor: theme.border, backgroundColor: theme.background }}
            />
            <span
              className="h-2 border"
              style={{ borderColor: theme.border, backgroundColor: theme.border }}
            />
            <span className="h-2 border" style={{ borderColor: theme.border }} />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-3 top-3 border px-2 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: theme.border, color: theme.text, backgroundColor: `${theme.background}E6` }}>
        {getTransitionLabel(template.transitionKey)}
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 border px-2 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: theme.border, color: theme.text, backgroundColor: `${theme.background}E6` }}>
        Theme + Frame Preview
      </div>
      <FrameOverlay frameStyleKey={template.frameStyleKey} color={theme.border} />
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
            <TransitionStagePreview template={activeTemplate} theme={activeTheme} />
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
