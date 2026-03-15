import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createProject } from "@/lib/data";

const payloadSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function POST(request: Request) {
  try {
    const payload = payloadSchema.parse(await request.json());
    const project = await createProject(payload.name);

    revalidatePath("/");

    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "建立專案失敗。",
      },
      { status: 400 },
    );
  }
}
