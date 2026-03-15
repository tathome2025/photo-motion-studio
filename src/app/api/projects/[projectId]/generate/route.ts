import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { PROMPT_OPTIONS } from "@/lib/constants";
import {
  getProjectDetails,
  markAssetFailed,
  markAssetQueued,
  markAssetStaticCompleted,
  markProjectStatus,
  savePromptSelections,
} from "@/lib/data";
import { createKlingImageToVideoTask } from "@/lib/kling";

const selectionSchema = z.object({
  id: z.string().uuid(),
  promptKey: z.enum([
    "smile",
    "greeting",
    "laughing",
    "handshake",
    "hugging",
    "brotherhood",
    "blow-a-kiss",
    "custom",
    "static",
  ]),
  customPrompt: z.string().trim().max(280).optional().nullable(),
});

const payloadSchema = z.object({
  selections: z.array(selectionSchema),
});

function getPromptText(selection: z.infer<typeof selectionSchema>) {
  if (selection.promptKey === "custom") {
    const prompt = selection.customPrompt?.trim();

    if (!prompt) {
      throw new Error("選擇「其他動作」時必須輸入 prompt。");
    }

    return prompt;
  }

  const match = PROMPT_OPTIONS.find((option) => option.key === selection.promptKey);

  if (!match) {
    throw new Error(`找不到 prompt: ${selection.promptKey}`);
  }

  return match.prompt;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const payload = payloadSchema.parse(await request.json());
    const project = await getProjectDetails(projectId);

    if (!project) {
      return NextResponse.json({ error: "找不到專案。" }, { status: 404 });
    }

    if (payload.selections.length !== project.assets.length) {
      return NextResponse.json(
        { error: "請為所有相片指派 prompt。" },
        { status: 400 },
      );
    }

    await savePromptSelections(projectId, payload.selections);
    await markProjectStatus(projectId, "generating");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    let queuedCount = 0;
    const failedMessages: string[] = [];

    for (const asset of project.assets) {
      const selection = payload.selections.find((item) => item.id === asset.id);

      if (!selection) {
        throw new Error(`缺少片段 ${asset.fileName} 的 prompt。`);
      }

      try {
        if (selection.promptKey === "static") {
          await markAssetStaticCompleted({
            projectId,
            assetId: asset.id,
            promptKey: selection.promptKey,
          });
          queuedCount += 1;
          continue;
        }

        const task = await createKlingImageToVideoTask({
          imageUrl: asset.originalUrl,
          prompt: getPromptText(selection),
          callbackUrl: `${appUrl}/api/kling/callback?projectId=${projectId}&assetId=${asset.id}`,
        });

        await markAssetQueued({
          assetId: asset.id,
          promptKey: selection.promptKey,
          customPrompt: selection.customPrompt,
          klingTaskId: task.taskId,
        });

        queuedCount += 1;
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : "提交 Kling 任務失敗。";

        await markAssetFailed(asset.id, message);
        failedMessages.push(`${asset.fileName}: ${message}`);
      }
    }

    if (queuedCount === 0) {
      throw new Error(
        `沒有任何相片成功提交到 Kling。${failedMessages[0] ?? "請檢查 API 設定。"}`,
      );
    }

    revalidatePath("/");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/waiting`);

    return NextResponse.json({ ok: true, queuedCount });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "提交生成工作失敗。",
      },
      { status: 400 },
    );
  }
}
