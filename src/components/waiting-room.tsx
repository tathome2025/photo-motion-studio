"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getDateTimeLocale, type Locale } from "@/lib/i18n";

interface WaitingRoomProps {
  projectId: string;
  initialTotal: number;
  initialCompleted: number;
  locale: Locale;
}

export function WaitingRoom({
  projectId,
  initialTotal,
  initialCompleted,
  locale,
}: WaitingRoomProps) {
  const router = useRouter();
  const [counts, setCounts] = useState({
    total: initialTotal,
    completed: initialCompleted,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readyTriggered, setReadyTriggered] = useState(false);
  const copy =
    locale === "en"
      ? {
          syncError: "Failed to sync.",
          title: "Waiting for all motion clips to finish",
          description:
            "Motion clips are in the processing queue. Progress is checked automatically. You can leave this page, open other projects, and return later to continue editing.",
          checking: "checking",
          standby: "standby",
          lastCheck: "last check",
          completed: "completed",
          remaining: "remaining",
          queue: "Processing queue",
          queueTitle: "Clips in progress",
          autoUpdating: "auto-updating",
          done: "done",
          processing: "processing",
          back: "Back to projects",
          checkNow: "Check now",
          notificationBody: "All motion clips are ready. You can start editing now.",
        }
      : {
          syncError: "同步失敗。",
          title: "正在等待所有動態相片完成",
          description:
            "動態影像已進入處理佇列，系統會自動檢查最新進度。你可以離開此頁建立其他專案，之後再回來繼續剪輯。",
          checking: "檢查中",
          standby: "待命中",
          lastCheck: "上次檢查",
          completed: "已完成",
          remaining: "待完成",
          queue: "處理佇列",
          queueTitle: "片段處理中",
          autoUpdating: "自動更新中...",
          done: "完成",
          processing: "處理中",
          back: "返回專案首頁",
          checkNow: "立即檢查",
          notificationBody: "所有動態相片已完成，可以開始剪輯。",
        };

  useEffect(() => {
    let isCancelled = false;

    async function poll() {
      if (!isCancelled) {
        setIsSyncing(true);
      }

      try {
        const response = await fetch(`/api/projects/${projectId}/sync`, {
          method: "POST",
        });

        const data = await response.json();

        if (!response.ok) {
          if (!isCancelled) {
            setError(data.error ?? copy.syncError);
          }
          return;
        }

        if (isCancelled) {
          return;
        }

        setError(null);
        setLastCheckedAt(
          new Intl.DateTimeFormat(getDateTimeLocale(locale), {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date()),
        );
        setCounts({
          total: data.project.assetCount,
          completed: data.project.completedCount,
        });

        if (
          data.project.assetCount > 0 &&
          data.project.assetCount === data.project.completedCount
        ) {
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted" &&
            !readyTriggered
          ) {
            new Notification("MotionCut Studio", {
              body: copy.notificationBody,
            });
          }

          setReadyTriggered(true);
          router.replace(`/projects/${projectId}/edit`);
          router.refresh();
        }
      } catch (reason) {
        if (!isCancelled) {
          setError(reason instanceof Error ? reason.message : copy.syncError);
        }
      } finally {
        if (!isCancelled) {
          setIsSyncing(false);
        }
      }
    }

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => undefined);
    }

    const interval = window.setInterval(poll, 12000);
    poll().catch(() => undefined);

    return () => {
      isCancelled = true;
      window.clearInterval(interval);
    };
  }, [copy.notificationBody, copy.syncError, locale, projectId, readyTriggered, router]);

  const progress = counts.total === 0 ? 0 : (counts.completed / counts.total) * 100;
  const remaining = Math.max(counts.total - counts.completed, 0);
  const previewCards = Math.max(Math.min(counts.total || 3, 6), 3);

  return (
    <div className="grid gap-6 border border-[var(--line)] p-6">
      <div className="grid gap-6 border border-[var(--line)] bg-[var(--surface-soft)] p-5 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Waiting room
          </p>
          <h2 className="text-3xl tracking-tight">{copy.title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {copy.description}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            <span className="inline-flex items-center gap-2 border border-[var(--line)] px-3 py-2">
              <span
                className={`h-2.5 w-2.5 border border-[var(--text)] ${
                  isSyncing ? "animate-status-pulse bg-[var(--text)]" : "bg-transparent"
                }`}
              />
              {isSyncing ? copy.checking : copy.standby}
            </span>
            {lastCheckedAt ? <span>{copy.lastCheck} {lastCheckedAt}</span> : null}
          </div>
        </div>

        <div className="grid place-items-center">
          <div className="processing-rig grid h-48 w-full max-w-[420px] place-items-center border border-[var(--line-strong)] bg-[var(--surface)]">
            <div className="processing-rig__stage relative grid h-28 w-28 place-items-center">
              <div className="processing-rig__ring absolute inset-0 border border-[var(--line-strong)]" />
              <div className="processing-rig__ring processing-rig__ring--delay absolute inset-3 border border-[var(--line)]" />
              <div className="processing-rig__core absolute h-8 w-8 border border-[var(--line-strong)] bg-[var(--text)]" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="flex items-end justify-between">
          <div className="text-5xl tracking-[-0.06em]">
            {counts.completed}/{counts.total}
          </div>
          <div className="text-right text-sm text-[var(--muted)]">
            <div>{copy.completed}</div>
            <div>{remaining} {copy.remaining}</div>
          </div>
        </div>
        <div className="relative h-3 overflow-hidden border border-[var(--line)] bg-[var(--surface)]">
          <div className="absolute inset-0 progress-scan opacity-80" />
          <div
            className="h-full bg-[var(--text)] transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              {copy.queue}
            </p>
            <h3 className="text-xl tracking-tight">{copy.queueTitle}</h3>
          </div>
          <div className="text-sm text-[var(--muted)]">{copy.autoUpdating}</div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: previewCards }).map((_, index) => (
            <article
              key={index}
              className="grid gap-3 border border-[var(--line)] p-4"
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                <span>Clip {String(index + 1).padStart(2, "0")}</span>
                <span>{index < counts.completed ? copy.done : copy.processing}</span>
              </div>
              <div className="relative min-h-40 overflow-hidden border border-[var(--line)] bg-[var(--surface-soft)]">
                <div className="absolute inset-0 queue-card-scan" />
                <div className="absolute inset-x-4 top-4 h-4 border border-[var(--line)] bg-[var(--surface)]" />
                <div className="absolute inset-x-4 top-12 h-20 border border-[var(--line)] bg-[var(--surface)]" />
                <div className="absolute bottom-4 left-4 h-3 w-20 border border-[var(--line)] bg-[var(--surface)]" />
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center border border-[var(--line)] px-5 text-sm uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
        >
          {copy.back}
        </Link>
        <button
          type="button"
          className="h-12 border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]"
          onClick={() => router.refresh()}
        >
          {copy.checkNow}
        </button>
      </div>

      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </div>
  );
}
