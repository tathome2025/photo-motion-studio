import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { deleteGeneratedOutput } from "@/lib/data";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string; assetId: string }> },
) {
  try {
    const { projectId, assetId } = await context.params;
    const project = await deleteGeneratedOutput(projectId, assetId);

    revalidatePath("/");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/edit`);

    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "刪除影片失敗。",
      },
      { status: 400 },
    );
  }
}
