import { NextResponse } from "next/server";

import { markAssetFailed, persistGeneratedVideo, refreshProjectStatus } from "@/lib/data";

function parseResultJson(input: unknown) {
  if (typeof input !== "string") {
    return null;
  }

  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractVideoUrl(payload: Record<string, unknown>) {
  const data = (payload.data as Record<string, unknown> | undefined) ?? {};
  const resultJson =
    parseResultJson(data.resultJson) ??
    parseResultJson(data.response) ??
    parseResultJson(payload.resultJson);
  const resultUrls =
    (data.resultUrls as unknown[] | undefined) ??
    (resultJson?.resultUrls as unknown[] | undefined) ??
    (resultJson?.videos as unknown[] | undefined);

  const firstResult = Array.isArray(resultUrls) ? resultUrls[0] : null;

  if (typeof firstResult === "string") {
    return firstResult;
  }

  if (firstResult && typeof firstResult === "object" && "url" in firstResult) {
    const candidate = (firstResult as { url?: string }).url;
    return typeof candidate === "string" ? candidate : null;
  }

  return (
    (payload.data as { task_result?: { videos?: Array<{ url?: string }> } } | undefined)
      ?.task_result?.videos?.[0]?.url ??
    (payload.data as { task_result?: { video_url?: string } } | undefined)?.task_result
      ?.video_url ??
    (data.videoUrl as string | undefined) ??
    (resultJson?.videoUrl as string | undefined) ??
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
        (payload.data as { state?: string } | undefined)?.state ??
        (payload.data as { task_status?: string; status?: string } | undefined)?.task_status ??
          (payload.data as { task_status?: string; status?: string } | undefined)?.status ??
          payload.state ??
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
