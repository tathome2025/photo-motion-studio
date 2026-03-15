import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ORIGINAL_BUCKET } from "@/lib/constants";
import {
  buildOriginalStoragePath,
  getProjectDetails,
  insertUploadedAsset,
} from "@/lib/data";
import { normalizeImageToLandscape } from "@/lib/image";
import { assertSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const currentProject = await getProjectDetails(projectId);
    const formData = await request.formData();
    const files = formData.getAll("files").filter((value) => value instanceof File) as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "未收到相片檔案。" }, { status: 400 });
    }

    if (files.length > 100) {
      return NextResponse.json({ error: "單次最多選擇 100 張相片。" }, { status: 400 });
    }

    const existingCount = currentProject?.assetCount ?? 0;

    if (existingCount + files.length > 100) {
      return NextResponse.json(
        { error: `此專案最多只可有 100 張相片，現有 ${existingCount} 張。` },
        { status: 400 },
      );
    }

    const supabase = assertSupabaseAdmin();

    for (const file of files) {
      const path = buildOriginalStoragePath(projectId, file.name.replace(/\.[^.]+$/, ".jpg"));
      const originalBytes = await file.arrayBuffer();
      const normalizedBytes = await normalizeImageToLandscape(originalBytes);

      const { error: uploadError } = await supabase.storage
        .from(ORIGINAL_BUCKET)
        .upload(path, normalizedBytes, {
          contentType: "image/jpeg",
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
