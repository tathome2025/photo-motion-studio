import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { composeProjectCanvaSlideshow } from "@/lib/data";

const payloadSchema = z.object({
  templateUrl: z.string().min(1),
  templateName: z.string().max(120).optional(),
  orderedAssetIds: z.array(z.string().uuid()).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const payload = payloadSchema.parse(await request.json());
    const canvaExport = await composeProjectCanvaSlideshow({
      projectId,
      templateUrl: payload.templateUrl,
      templateName: payload.templateName,
      orderedAssetIds: payload.orderedAssetIds,
    });

    revalidatePath("/");
    revalidatePath(`/projects/${projectId}/edit`);

    return NextResponse.json({
      ok: true,
      canvaExport,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "套用 Canva 範本失敗。",
      },
      { status: 400 },
    );
  }
}
