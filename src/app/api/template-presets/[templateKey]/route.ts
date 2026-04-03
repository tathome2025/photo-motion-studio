import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { updateStudioTemplatePreset } from "@/lib/data";

const paramsSchema = z.object({
  templateKey: z.enum([
    "clean-cut",
    "magazine",
    "spotlight",
    "cinematic",
    "ocean-drift",
    "night-pulse",
  ]),
});

const payloadSchema = z.object({
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
  backgroundVideoPath: z.string().min(1).max(240),
  transitionKey: z.enum(["cut", "fade", "wipeleft", "slideup"]),
  themeKey: z.enum(["editorial", "mono", "warm", "blueprint"]),
  frameStyleKey: z.enum(["none", "single", "double", "offset"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ templateKey: string }> },
) {
  try {
    const params = paramsSchema.parse(await context.params);
    const payload = payloadSchema.parse(await request.json());
    const template = await updateStudioTemplatePreset({
      templateKey: params.templateKey,
      label: payload.label,
      description: payload.description,
      backgroundVideoPath: payload.backgroundVideoPath,
      transitionKey: payload.transitionKey,
      themeKey: payload.themeKey,
      frameStyleKey: payload.frameStyleKey,
    });

    revalidatePath("/internal/template-design");

    return NextResponse.json({
      ok: true,
      template,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "更新模板失敗。",
      },
      { status: 400 },
    );
  }
}
