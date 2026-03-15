import crypto from "node:crypto";

import { GENERATED_BUCKET } from "@/lib/constants";
import { getPromptLabel, slugifyFileName } from "@/lib/utils";
import { assertSupabaseAdmin, getSupabaseAdmin } from "@/lib/supabase";
import type {
  AssetGenerationStatus,
  ProjectAsset,
  ProjectDetails,
  ProjectStatus,
  ProjectSummary,
  PromptKey,
  TimelineUpdateItem,
} from "@/lib/types";

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

type AssetRow = {
  id: string;
  project_id: string;
  file_name: string;
  original_url: string;
  generated_url: string | null;
  prompt_key: PromptKey | null;
  prompt_label: string | null;
  generation_status: AssetGenerationStatus;
  kling_task_id: string | null;
  timeline_order: number;
  transition_key: ProjectAsset["transitionKey"];
  theme_key: ProjectAsset["themeKey"];
  frame_style_key: ProjectAsset["frameStyleKey"];
  duration_seconds: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function mapAsset(row: AssetRow): ProjectAsset {
  return {
    id: row.id,
    projectId: row.project_id,
    fileName: row.file_name,
    originalUrl: row.original_url,
    generatedUrl: row.generated_url,
    promptKey: row.prompt_key,
    promptLabel: row.prompt_label,
    generationStatus: row.generation_status,
    klingTaskId: row.kling_task_id,
    timelineOrder: row.timeline_order,
    transitionKey: row.transition_key,
    themeKey: row.theme_key,
    frameStyleKey: row.frame_style_key,
    durationSeconds: row.duration_seconds ?? 5,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildSummary(project: ProjectRow, assets: ProjectAsset[]): ProjectSummary {
  const completedCount = assets.filter(
    (asset) => asset.generationStatus === "completed",
  ).length;

  return {
    id: project.id,
    name: project.name,
    status: project.status,
    assetCount: assets.length,
    completedCount,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const client = getSupabaseAdmin();

  if (!client) {
    return [];
  }

  const { data: projects, error } = await client
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const projectRows = (projects ?? []) as ProjectRow[];
  const projectIds = projectRows.map((project) => project.id);

  const assetsByProject = new Map<string, ProjectAsset[]>();

  if (projectIds.length > 0) {
    const { data: assets, error: assetsError } = await client
      .from("project_assets")
      .select("*")
      .in("project_id", projectIds)
      .order("timeline_order", { ascending: true });

    if (assetsError) {
      throw new Error(assetsError.message);
    }

    for (const asset of (assets ?? []) as AssetRow[]) {
      const mapped = mapAsset(asset);
      const current = assetsByProject.get(mapped.projectId) ?? [];
      current.push(mapped);
      assetsByProject.set(mapped.projectId, current);
    }
  }

  return projectRows.map((project) =>
    buildSummary(project, assetsByProject.get(project.id) ?? []),
  );
}

export async function getProjectDetails(
  projectId: string,
): Promise<ProjectDetails | null> {
  const client = getSupabaseAdmin();

  if (!client) {
    return null;
  }

  const { data: project, error } = await client
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!project) {
    return null;
  }

  const { data: assets, error: assetsError } = await client
    .from("project_assets")
    .select("*")
    .eq("project_id", projectId)
    .order("timeline_order", { ascending: true });

  if (assetsError) {
    throw new Error(assetsError.message);
  }

  const mappedAssets = ((assets ?? []) as AssetRow[]).map(mapAsset);
  return {
    ...buildSummary(project as ProjectRow, mappedAssets),
    assets: mappedAssets,
  };
}

export async function createProject(name: string) {
  const client = assertSupabaseAdmin();

  const { data, error } = await client
    .from("projects")
    .insert({
      name,
      status: "draft",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ProjectRow;
}

export async function insertUploadedAsset(input: {
  projectId: string;
  fileName: string;
  originalUrl: string;
}) {
  const client = assertSupabaseAdmin();

  const { count } = await client
    .from("project_assets")
    .select("*", { count: "exact", head: true })
    .eq("project_id", input.projectId);

  const { data, error } = await client
    .from("project_assets")
    .insert({
      project_id: input.projectId,
      file_name: input.fileName,
      original_url: input.originalUrl,
      generation_status: "uploaded",
      timeline_order: count ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await touchProject(input.projectId, "draft");
  return mapAsset(data as AssetRow);
}

export async function savePromptSelections(
  projectId: string,
  selections: Array<{ id: string; promptKey: PromptKey }>,
) {
  const client = assertSupabaseAdmin();

  for (const selection of selections) {
    const promptLabel = getPromptLabel(selection.promptKey);

    const { error } = await client
      .from("project_assets")
      .update({
        prompt_key: selection.promptKey,
        prompt_label: promptLabel,
      })
      .eq("project_id", projectId)
      .eq("id", selection.id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function markAssetQueued(input: {
  assetId: string;
  promptKey: PromptKey;
  klingTaskId: string;
}) {
  const client = assertSupabaseAdmin();

  const { error } = await client
    .from("project_assets")
    .update({
      prompt_key: input.promptKey,
      prompt_label: getPromptLabel(input.promptKey),
      kling_task_id: input.klingTaskId,
      generation_status: "queued",
      error_message: null,
    })
    .eq("id", input.assetId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markAssetProcessing(assetId: string) {
  const client = assertSupabaseAdmin();
  const { error } = await client
    .from("project_assets")
    .update({
      generation_status: "processing",
    })
    .eq("id", assetId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markAssetFailed(assetId: string, errorMessage: string) {
  const client = assertSupabaseAdmin();
  const { error } = await client
    .from("project_assets")
    .update({
      generation_status: "failed",
      error_message: errorMessage.slice(0, 500),
    })
    .eq("id", assetId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markProjectStatus(projectId: string, status: ProjectStatus) {
  await touchProject(projectId, status);
}

async function touchProject(projectId: string, status: ProjectStatus) {
  const client = assertSupabaseAdmin();
  const { error } = await client
    .from("projects")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getGeneratingAssets(projectId: string) {
  const client = assertSupabaseAdmin();

  const { data, error } = await client
    .from("project_assets")
    .select("*")
    .eq("project_id", projectId)
    .in("generation_status", ["queued", "processing"])
    .order("timeline_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AssetRow[]).map(mapAsset);
}

export async function getCompletedAssets(projectId: string) {
  const client = assertSupabaseAdmin();

  const { data, error } = await client
    .from("project_assets")
    .select("*")
    .eq("project_id", projectId)
    .eq("generation_status", "completed")
    .order("timeline_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AssetRow[]).map(mapAsset);
}

export async function persistGeneratedVideo(input: {
  projectId: string;
  assetId: string;
  sourceUrl: string;
  durationSeconds: number;
}) {
  const client = assertSupabaseAdmin();
  const response = await fetch(input.sourceUrl);

  if (!response.ok) {
    throw new Error(`下載 Kling 影片失敗: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const storagePath = `${input.projectId}/${input.assetId}-${crypto.randomUUID()}.mp4`;

  const { error: uploadError } = await client.storage
    .from(GENERATED_BUCKET)
    .upload(storagePath, arrayBuffer, {
      cacheControl: "3600",
      contentType: "video/mp4",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = client.storage.from(GENERATED_BUCKET).getPublicUrl(storagePath);

  const { error } = await client
    .from("project_assets")
    .update({
      generated_url: data.publicUrl,
      generation_status: "completed",
      duration_seconds: input.durationSeconds,
      error_message: null,
    })
    .eq("id", input.assetId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function refreshProjectStatus(projectId: string) {
  const project = await getProjectDetails(projectId);

  if (!project) {
    return null;
  }

  const completedCount = project.assets.filter(
    (asset) => asset.generationStatus === "completed",
  ).length;
  const hasPending = project.assets.some((asset) =>
    ["queued", "processing"].includes(asset.generationStatus),
  );

  const nextStatus: ProjectStatus =
    project.assets.length === 0
      ? "draft"
      : completedCount === project.assets.length
        ? "ready"
        : hasPending
          ? "generating"
          : project.status;

  if (nextStatus !== project.status) {
    await touchProject(projectId, nextStatus);
  }

  return getProjectDetails(projectId);
}

export async function saveTimeline(
  projectId: string,
  items: TimelineUpdateItem[],
) {
  const client = assertSupabaseAdmin();

  for (const item of items) {
    const { error } = await client
      .from("project_assets")
      .update({
        timeline_order: item.timelineOrder,
        transition_key: item.transitionKey,
        theme_key: item.themeKey,
        frame_style_key: item.frameStyleKey,
      })
      .eq("project_id", projectId)
      .eq("id", item.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  await touchProject(projectId, "ready");
}

export async function createRenderRequest(projectId: string) {
  const client = assertSupabaseAdmin();

  const { data, error } = await client
    .from("render_jobs")
    .insert({
      project_id: projectId,
      status: "prepared",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await touchProject(projectId, "rendering");
  return data;
}

export async function finishRenderRequest(input: {
  renderId: string;
  outputUrl: string;
  projectId: string;
}) {
  const client = assertSupabaseAdmin();

  const { error } = await client
    .from("render_jobs")
    .update({
      status: "completed",
      output_url: input.outputUrl,
    })
    .eq("id", input.renderId);

  if (error) {
    throw new Error(error.message);
  }

  await touchProject(input.projectId, "rendered");
}

export function buildOriginalStoragePath(projectId: string, fileName: string) {
  return `${projectId}/${crypto.randomUUID()}-${slugifyFileName(fileName)}`;
}
