import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { MAX_REGENERATION_COUNT, PROMPT_OPTIONS } from "@/lib/constants";
import {
  getProjectDetails,
  markAssetFailed,
  markAssetQueued,
  markAssetStaticCompleted,
  markProjectStatus,
} from "@/lib/data";
import { createKlingImageToVideoTask } from "@/lib/kling";
import { buildGenerationPrompt } from "@/lib/prompt";

const payloadSchema = z.object({
  promptKey: z.enum([
    "smile",
    "greeting",
    "laughing",
    "handshake",
    "hugging",
    "blow-a-kiss",
    "custom",
    "static",
  ]),
  customPrompt: z.string().trim().max(280).optional().nullable(),
});

function getPromptText(promptKey: string, customPrompt?: string | null) {
  if (promptKey === "custom") {
    const prompt = customPrompt?.trim();

    if (!prompt) {
      throw new Error("請輸入自訂 prompt。");
    }

    return prompt;
  }

  const match = PROMPT_OPTIONS.find((option) => option.key === promptKey);

  if (!match) {
    throw new Error("找不到指定動作。");
  }

  return match.prompt;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; assetId: string }> },
) {
  try {
    const { projectId, assetId } = await context.params;
    const payload = payloadSchema.parse(await request.json());
    const project = await getProjectDetails(projectId);

    if (!project) {
      return NextResponse.json({ error: "找不到專案。" }, { status: 404 });
    }

    const asset = project.assets.find((item) => item.id === assetId);

    if (!asset) {
      return NextResponse.json({ error: "找不到片段。" }, { status: 404 });
    }

    if (asset.regenerationCount >= MAX_REGENERATION_COUNT) {
      return NextResponse.json(
        { error: "已達上限，請刪除相片再重新上傳生成。" },
        { status: 400 },
      );
    }

    await markProjectStatus(projectId, "generating");

    if (payload.promptKey === "static") {
      await markAssetStaticCompleted({
        projectId,
        assetId,
        promptKey: payload.promptKey,
        customPrompt: payload.customPrompt,
        isRegeneration: true,
      });
    } else {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
        const task = await createKlingImageToVideoTask({
          imageUrl: asset.originalUrl,
          prompt: buildGenerationPrompt(
            getPromptText(payload.promptKey, payload.customPrompt),
          ),
          callbackUrl: `${appUrl}/api/kling/callback?projectId=${projectId}&assetId=${assetId}`,
        });

        await markAssetQueued({
          assetId,
          promptKey: payload.promptKey,
          customPrompt: payload.customPrompt,
          klingTaskId: task.taskId,
          isRegeneration: true,
        });
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : "重新提交 Kling 任務失敗。";
        await markAssetFailed(assetId, message);
        throw new Error(message);
      }
    }

    revalidatePath("/");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/waiting`);
    revalidatePath(`/projects/${projectId}/edit`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "重新生成失敗。",
      },
      { status: 400 },
    );
  }
}
