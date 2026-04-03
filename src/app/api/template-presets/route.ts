import { NextResponse } from "next/server";

import { listStudioTemplatePresets } from "@/lib/data";

export async function GET() {
  try {
    const templates = await listStudioTemplatePresets();

    return NextResponse.json({
      ok: true,
      templates,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "讀取模板列表失敗。",
      },
      { status: 400 },
    );
  }
}
