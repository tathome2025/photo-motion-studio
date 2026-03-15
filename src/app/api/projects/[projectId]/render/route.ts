import { NextResponse } from "next/server";

import { getProjectDetails } from "@/lib/data";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const project = await getProjectDetails(projectId);

    if (!project) {
      return NextResponse.json({ error: "找不到專案。" }, { status: 404 });
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
      },
      assets: project.assets,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "準備匯出資料失敗。",
      },
      { status: 400 },
    );
  }
}
