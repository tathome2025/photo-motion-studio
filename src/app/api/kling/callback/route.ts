import { NextResponse } from "next/server";

import { markAssetFailed, persistGeneratedVideo, refreshProjectStatus } from "@/lib/data";

function extractVideoUrl(payload: Record<string, unknown>) {
  return (
    (payload.data as { task_result?: { videos?: Array<{ url?: string }> } } | undefined)
      ?.task_result?.videos?.[0]?.url ??
    (payload.data as { task_result?: { video_url?: string } } | undefined)?.task_result
      ?.video_url ??
    null
  );
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    const assetId = url.searchParams.get("assetId");
    const payload = (await request.json()) as Record<string, unknown>;

    if (!projectId || !assetId) {
      return NextResponse.json({ ok: true });
    }

    const status =
      String(
        (payload.data as { task_status?: string; status?: string } | undefined)?.task_status ??
          (payload.data as { task_status?: string; status?: string } | undefined)?.status ??
          payload.task_status ??
          payload.status ??
          "",
      ).toLowerCase();

    if (status.includes("fail") || status.includes("error")) {
      await markAssetFailed(assetId, "Kling callback 回報任務失敗。");
      await refreshProjectStatus(projectId);
      return NextResponse.json({ ok: true });
    }

    const videoUrl = extractVideoUrl(payload);

    if (videoUrl) {
      await persistGeneratedVideo({
        projectId,
        assetId,
        sourceUrl: videoUrl,
        durationSeconds: Number(process.env.KLING_DURATION_SECONDS ?? 5),
      });
      await refreshProjectStatus(projectId);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
