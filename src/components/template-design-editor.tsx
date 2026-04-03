"use client";

import { useState } from "react";

import { FRAME_STYLE_OPTIONS, THEME_OPTIONS, TRANSITION_OPTIONS } from "@/lib/constants";
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

export function TemplateDesignEditor({ initialTemplates }: TemplateDesignEditorProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [savingKey, setSavingKey] = useState<StudioTemplateKey | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateTemplate(
    templateKey: StudioTemplateKey,
    field: keyof StudioTemplatePreset,
    value: string,
  ) {
    setTemplates((current) =>
      current.map((template) =>
        template.key === templateKey
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
    <section className="grid gap-3">
      {templates.map((template) => (
        <article key={template.key} className="grid gap-3 border border-[var(--line)] p-4">
          <div className="grid gap-2 md:grid-cols-2">
            <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Name
              <input
                className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
                value={template.label}
                onChange={(event) => updateTemplate(template.key, "label", event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Description
              <input
                className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
                value={template.description}
                onChange={(event) =>
                  updateTemplate(template.key, "description", event.target.value)
                }
              />
            </label>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Transition
              <select
                className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none"
                value={template.transitionKey}
                onChange={(event) =>
                  updateTemplate(template.key, "transitionKey", event.target.value)
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
                value={template.themeKey}
                onChange={(event) => updateTemplate(template.key, "themeKey", event.target.value)}
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
                value={template.frameStyleKey}
                onChange={(event) =>
                  updateTemplate(template.key, "frameStyleKey", event.target.value)
                }
              >
                {FRAME_STYLE_OPTIONS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="h-11 border border-[var(--text)] px-4 text-xs uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]"
              onClick={() => saveTemplate(template.key)}
              disabled={savingKey === template.key}
            >
              {savingKey === template.key ? "Saving..." : "Save"}
            </button>
          </div>
        </article>
      ))}

      {status ? <p className="text-sm text-[#2e5a31]">{status}</p> : null}
      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </section>
  );
}
