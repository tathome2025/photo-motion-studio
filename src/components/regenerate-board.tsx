"use client";
/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { MAX_REGENERATION_COUNT } from "@/lib/constants";
import { getPromptOptions, type Locale } from "@/lib/i18n";
import type { ProjectAsset, PromptKey } from "@/lib/types";

interface RegenerateBoardProps {
  projectId: string;
  initialAssets: ProjectAsset[];
  locale: Locale;
}

interface ApiResponse {
  error?: string;
}

async function parseApiResponse(response: Response) {
  const rawText = await response.text();

  try {
    return JSON.parse(rawText) as ApiResponse;
  } catch {
    throw new Error(rawText || `Request failed (${response.status})`);
  }
}

export function RegenerateBoard({
  projectId,
  initialAssets,
  locale,
}: RegenerateBoardProps) {
  const router = useRouter();
  const promptOptions = getPromptOptions(locale);
  const [plans, setPlans] = useState<
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
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const copy =
    locale === "en"
      ? {
          selectFirst: "Select at least one photo to regenerate.",
          customPromptRequired: 'Please enter a prompt when "Custom action" is selected.',
          regenerateFailed: "Failed to regenerate.",
          partial: (successCount: number, failureCount: number) =>
            `${successCount} item(s) submitted. ${failureCount} item(s) could not be submitted.`,
          title: "Select and regenerate in one pass",
          description:
            "All thumbnails are listed together. Select the photos you want to regenerate, then choose an action for each one.",
          submitting: "Submitting...",
          submitSelected: (count: number) => `Regenerate selected (${count})`,
          regenerateLabel: "re-gen",
          limitReached: "Limit reached. Delete the photo and upload it again.",
          checkToRegenerate: "Select to regenerate",
          customPlaceholder: "Enter a custom action prompt",
        }
      : {
          selectFirst: "請先勾選要重新生成的相片。",
          customPromptRequired: "選擇「其他動作」時請輸入 prompt。",
          regenerateFailed: "重新生成失敗。",
          partial: (successCount: number, failureCount: number) =>
            `已提交 ${successCount} 項，另有 ${failureCount} 項未能提交。`,
          title: "一次過勾選並重新生成",
          description:
            "所有縮圖會一次列出。你可以按相片逐一勾選，並為每張相片獨立選擇生成動作。",
          submitting: "提交中...",
          submitSelected: (count: number) => `重新生成已勾選項目 (${count})`,
          regenerateLabel: "重新生成",
          limitReached: "已達上限，請刪除相片再重新上傳生成",
          checkToRegenerate: "勾選後重新生成",
          customPlaceholder: "輸入自訂動作 prompt",
        };

  const checkedAssetIds = useMemo(
    () =>
      initialAssets
        .filter((asset) => plans[asset.id]?.checked)
        .map((asset) => asset.id),
    [initialAssets, plans],
  );

  function updatePlan(
    assetId: string,
    updates: Partial<{ checked: boolean; promptKey: PromptKey; customPrompt: string }>,
  ) {
    setPlans((current) => ({
      ...current,
      [assetId]: {
        checked: current[assetId]?.checked ?? false,
        promptKey: current[assetId]?.promptKey ?? "smile",
        customPrompt: current[assetId]?.customPrompt ?? "",
        ...updates,
      },
    }));
  }

  function submitSelected() {
    if (checkedAssetIds.length === 0) {
      setError(copy.selectFirst);
      return;
    }

    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      const failures: string[] = [];
      let successCount = 0;

      for (const asset of initialAssets) {
        const plan = plans[asset.id];

        if (!plan?.checked) {
          continue;
        }

        if (plan.promptKey === "custom" && !plan.customPrompt.trim()) {
          failures.push(`${asset.fileName}: ${copy.customPromptRequired}`);
          continue;
        }

        const response = await fetch(
          `/api/projects/${projectId}/assets/${asset.id}/regenerate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              promptKey: plan.promptKey,
              customPrompt: plan.customPrompt,
            }),
          },
        );

        const data = await parseApiResponse(response);

        if (!response.ok) {
          failures.push(
            data.error
              ? `${asset.fileName}: ${data.error}`
              : `${asset.fileName}: ${copy.regenerateFailed}`,
          );
          continue;
        }

        successCount += 1;
      }

      if (successCount === 0) {
        setError(failures[0] ?? copy.regenerateFailed);
        return;
      }

      if (failures.length > 0) {
        setStatusMessage(copy.partial(successCount, failures.length));
      }

      router.push(`/projects/${projectId}/waiting`);
      router.refresh();
    });
  }

  return (
    <section className="grid gap-6 border border-[var(--line)] p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Regenerate
          </p>
          <h2 className="text-3xl tracking-tight">{copy.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            {copy.description}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center border border-[var(--line)] px-4 text-xs uppercase tracking-[0.2em] transition hover:border-[var(--text)] disabled:cursor-not-allowed disabled:text-[var(--muted)]"
          onClick={submitSelected}
          disabled={isPending || checkedAssetIds.length === 0}
        >
          {isPending ? copy.submitting : copy.submitSelected(checkedAssetIds.length)}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {initialAssets.map((asset, index) => {
          const plan = plans[asset.id];
          const isSelected = Boolean(plan?.checked);
          const limitReached = asset.regenerationCount >= MAX_REGENERATION_COUNT;

          return (
            <article
              key={asset.id}
              className="grid gap-4 border border-[var(--line)] p-4"
            >
              <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                <span>#{String(index + 1).padStart(2, "0")}</span>
                <span>
                  {asset.regenerationCount}/{MAX_REGENERATION_COUNT} {copy.regenerateLabel}
                </span>
              </div>

              <div className="grid aspect-video place-items-center overflow-hidden border border-[var(--line)] bg-black">
                <img
                  src={asset.originalUrl}
                  alt={asset.fileName}
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="grid gap-2">
                <div className="truncate text-sm">{asset.fileName}</div>
                <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={isSelected}
                    onChange={(event) =>
                      updatePlan(asset.id, { checked: event.target.checked })
                    }
                    disabled={limitReached}
                  />
                  {limitReached ? copy.limitReached : copy.checkToRegenerate}
                </label>
              </div>

              <select
                className="h-11 border border-[var(--line)] bg-transparent px-3 text-sm outline-none focus:border-[var(--text)] disabled:text-[var(--muted)]"
                value={plan?.promptKey ?? "smile"}
                onChange={(event) =>
                  updatePlan(asset.id, { promptKey: event.target.value as PromptKey })
                }
                disabled={!isSelected || limitReached}
              >
                {promptOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>

              {plan?.promptKey === "custom" ? (
                <textarea
                  className="min-h-24 border border-[var(--line)] bg-transparent px-3 py-3 text-sm outline-none focus:border-[var(--text)] disabled:text-[var(--muted)]"
                  placeholder={copy.customPlaceholder}
                  value={plan.customPrompt}
                  onChange={(event) =>
                    updatePlan(asset.id, { customPrompt: event.target.value })
                  }
                  disabled={!isSelected || limitReached}
                />
              ) : null}
            </article>
          );
        })}
      </div>

      {statusMessage ? <p className="text-sm text-[#2e5a31]">{statusMessage}</p> : null}
      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </section>
  );
}
