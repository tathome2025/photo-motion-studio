import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  getGeneratingAssets,
  markAssetFailed,
  markAssetProcessing,
  persistGeneratedVideo,
  refreshProjectStatus,
} from "@/lib/data";
import { queryKlingTask } from "@/lib/kling";

function normalizeTaskStatus(status: string) {
  const value = status.toLowerCase();

  if (
    value.includes("succeed") ||
    value.includes("completed") ||
    value.includes("done") ||
    value.includes("success")
  ) {
    return "completed";
  }

  if (value.includes("fail") || value.includes("error")) {
    return "failed";
  }

  return "processing";
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const generatingAssets = await getGeneratingAssets(projectId);

    for (const asset of generatingAssets) {
      if (!asset.klingTaskId) {
        await markAssetFailed(asset.id, "缺少 Kling task id。");
        continue;
      }

      const result = await queryKlingTask(asset.klingTaskId);
      const normalized = normalizeTaskStatus(result.status);

      if (normalized === "processing") {
        await markAssetProcessing(asset.id);
        continue;
      }

      if (normalized === "failed") {
        await markAssetFailed(asset.id, `Kling 任務失敗: ${result.status}`);
        continue;
      }

      if (!result.videoUrl) {
        await markAssetFailed(asset.id, "Kling 已完成，但回傳中找不到影片網址。");
        continue;
      }

      await persistGeneratedVideo({
        projectId,
        assetId: asset.id,
        sourceUrl: result.videoUrl,
        durationSeconds: Number(process.env.KLING_DURATION_SECONDS ?? 5),
      });
    }

    const project = await refreshProjectStatus(projectId);

    if (!project) {
      return NextResponse.json({ error: "找不到專案。" }, { status: 404 });
    }

    revalidatePath("/");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/waiting`);
    revalidatePath(`/projects/${projectId}/edit`);

    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "同步失敗。",
      },
      { status: 400 },
    );
  }
}
