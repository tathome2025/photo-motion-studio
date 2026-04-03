import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { resetProjectCanvaSlideshow } from "@/lib/data";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    await resetProjectCanvaSlideshow(projectId);

    revalidatePath("/");
    revalidatePath(`/projects/${projectId}/edit`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "重做 Canva slideshow 失敗。",
      },
      { status: 400 },
    );
  }
}
