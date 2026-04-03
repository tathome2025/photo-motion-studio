import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getProjectTemplateConfig,
  saveProjectTemplateConfig,
} from "@/lib/data";

const payloadSchema = z.object({
  templateKey: z.enum([
    "clean-cut",
    "magazine",
    "spotlight",
    "cinematic",
    "ocean-drift",
    "night-pulse",
  ]),
  musicKey: z
    .enum([
      "track-01",
      "track-02",
      "track-03",
      "track-04",
      "track-05",
      "track-06",
      "track-07",
      "track-08",
      "track-09",
      "track-10",
    ])
    .optional(),
  applyToAllAssets: z.boolean().default(true),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const templateConfig = await getProjectTemplateConfig(projectId);

    return NextResponse.json({
      ok: true,
      templateConfig,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "讀取模板設定失敗。",
      },
      { status: 400 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const payload = payloadSchema.parse(await request.json());
    const result = await saveProjectTemplateConfig({
      projectId,
      templateKey: payload.templateKey,
      musicKey: payload.musicKey,
      applyToAllAssets: payload.applyToAllAssets,
    });

    revalidatePath("/");
    revalidatePath(`/projects/${projectId}/edit`);

    return NextResponse.json({
      ok: true,
      templateConfig: result.templateConfig,
      assets: result.assets,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "儲存模板設定失敗。",
      },
      { status: 400 },
    );
  }
}
