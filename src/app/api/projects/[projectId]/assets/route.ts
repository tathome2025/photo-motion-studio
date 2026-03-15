import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ORIGINAL_BUCKET } from "@/lib/constants";
import {
  buildOriginalStoragePath,
  getProjectDetails,
  insertUploadedAsset,
} from "@/lib/data";
import { assertSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const formData = await request.formData();
    const files = formData.getAll("files").filter((value) => value instanceof File) as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "未收到相片檔案。" }, { status: 400 });
    }

    if (files.length > 100) {
      return NextResponse.json({ error: "單次最多上傳 100 張相片。" }, { status: 400 });
    }

    const supabase = assertSupabaseAdmin();

    for (const file of files) {
      const path = buildOriginalStoragePath(projectId, file.name);
      const bytes = await file.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(ORIGINAL_BUCKET)
        .upload(path, bytes, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data } = supabase.storage.from(ORIGINAL_BUCKET).getPublicUrl(path);

      await insertUploadedAsset({
        projectId,
        fileName: file.name,
        originalUrl: data.publicUrl,
      });
    }

    const project = await getProjectDetails(projectId);

    revalidatePath("/");
    revalidatePath(`/projects/${projectId}`);

    return NextResponse.json({
      assets: project?.assets ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "上傳失敗。",
      },
      { status: 400 },
    );
  }
}
