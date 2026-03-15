import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { deleteProject } from "@/lib/data";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    await deleteProject(projectId);

    revalidatePath("/");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "刪除專案失敗。",
      },
      { status: 400 },
    );
  }
}
