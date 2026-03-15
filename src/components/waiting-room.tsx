"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface WaitingRoomProps {
  projectId: string;
  initialTotal: number;
  initialCompleted: number;
}

export function WaitingRoom({
  projectId,
  initialTotal,
  initialCompleted,
}: WaitingRoomProps) {
  const router = useRouter();
  const [counts, setCounts] = useState({
    total: initialTotal,
    completed: initialCompleted,
  });
  const [error, setError] = useState<string | null>(null);
  const [readyTriggered, setReadyTriggered] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function poll() {
      const response = await fetch(`/api/projects/${projectId}/sync`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        if (!isCancelled) {
          setError(data.error ?? "同步失敗。");
        }
        return;
      }

      if (isCancelled) {
        return;
      }

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
            body: "所有動態相片已完成，可以開始剪輯。",
          });
        }

        setReadyTriggered(true);
        router.replace(`/projects/${projectId}/edit`);
        router.refresh();
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
    poll().catch((reason: unknown) => {
      if (!isCancelled) {
        setError(reason instanceof Error ? reason.message : "同步失敗。");
      }
    });

    return () => {
      isCancelled = true;
      window.clearInterval(interval);
    };
  }, [projectId, readyTriggered, router]);

  const progress = counts.total === 0 ? 0 : (counts.completed / counts.total) * 100;

  return (
    <div className="grid gap-6 border border-[var(--line)] p-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          Waiting room
        </p>
        <h2 className="text-3xl tracking-tight">正在等待所有動態相片完成</h2>
        <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
          系統會定時輪詢 Kling 任務狀態。你可以離開此頁建立其他專案，之後再回來繼續剪輯。
        </p>
      </div>

      <div className="grid gap-3">
        <div className="flex items-end justify-between">
          <div className="text-5xl tracking-[-0.06em]">
            {counts.completed}/{counts.total}
          </div>
          <div className="text-sm text-[var(--muted)]">completed</div>
        </div>
        <div className="h-3 border border-[var(--line)]">
          <div
            className="h-full bg-[var(--text)] transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center border border-[var(--line)] px-5 text-sm uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
        >
          返回專案首頁
        </Link>
        <button
          type="button"
          className="h-12 border border-[var(--text)] px-5 text-sm uppercase tracking-[0.2em] transition hover:bg-[var(--text)] hover:text-[var(--surface)]"
          onClick={() => router.refresh()}
        >
          立即檢查
        </button>
      </div>

      {error ? <p className="text-sm text-[#8d2f24]">{error}</p> : null}
    </div>
  );
}
