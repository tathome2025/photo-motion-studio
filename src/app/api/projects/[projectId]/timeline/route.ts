import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { saveTimeline } from "@/lib/data";

const payloadSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      timelineOrder: z.number().int().min(0),
      transitionKey: z.enum(["cut", "fade", "wipeleft", "slideup"]),
      themeKey: z.enum(["editorial", "mono", "warm", "blueprint"]),
      frameStyleKey: z.enum(["none", "single", "double", "offset"]),
    }),
  ),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const payload = payloadSchema.parse(await request.json());

    await saveTimeline(projectId, payload.items);

    revalidatePath("/");
    revalidatePath(`/projects/${projectId}/edit`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "儲存時間線失敗。",
      },
      { status: 400 },
    );
  }
}
