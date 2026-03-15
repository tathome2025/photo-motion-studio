"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ProjectStatusPollerProps {
  projectIds: string[];
  intervalMs?: number;
}

export function ProjectStatusPoller({
  projectIds,
  intervalMs = 12000,
}: ProjectStatusPollerProps) {
  const router = useRouter();

  useEffect(() => {
    if (projectIds.length === 0) {
      return;
    }

    let cancelled = false;

    async function syncProjects() {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }

      await Promise.allSettled(
        projectIds.map((projectId) =>
          fetch(`/api/projects/${projectId}/sync`, {
            method: "POST",
          }),
        ),
      );

      if (!cancelled) {
        router.refresh();
      }
    }

    const interval = window.setInterval(() => {
      syncProjects().catch(() => undefined);
    }, intervalMs);

    syncProjects().catch(() => undefined);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [intervalMs, projectIds, router]);

  return null;
}
