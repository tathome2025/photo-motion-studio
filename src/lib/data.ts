import crypto from "node:crypto";

import {
  DEFAULT_MUSIC_TRACK_KEY,
  DEFAULT_CLIP_DURATION,
  GENERATED_BUCKET,
  MAX_REGENERATION_COUNT,
  MUSIC_TRACK_OPTIONS,
  STUDIO_TEMPLATE_PRESETS,
} from "@/lib/constants";
import { getPromptLabel, slugifyFileName } from "@/lib/utils";
import { assertSupabaseAdmin, getSupabaseAdmin } from "@/lib/supabase";
import type {
  AssetGenerationStatus,
  ProjectAsset,
  ProjectCanvaExport,
  ProjectDetails,
  ProjectStatus,
  ProjectSummary,
  ProjectTemplateConfig,
  MusicTrackKey,
  PromptKey,
  StudioTemplateKey,
  TimelineUpdateItem,
  CanvaExportStatus,
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
  custom_prompt: string | null;
  generation_status: AssetGenerationStatus;
  kling_task_id: string | null;
  regeneration_count: number | null;
  is_static_clip: boolean | null;
  timeline_order: number;
  transition_key: ProjectAsset["transitionKey"];
  theme_key: ProjectAsset["themeKey"];
  frame_style_key: ProjectAsset["frameStyleKey"];
  duration_seconds: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectCanvaExportRow = {
  id: string;
  project_id: string;
  template_key: string;
  template_name: string;
  template_url: string;
  status: CanvaExportStatus;
  slide_count: number;
  clip_urls: unknown;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectTemplateConfigRow = {
  id: string;
  project_id: string;
  template_key: StudioTemplateKey;
  template_name: string;
  music_key: MusicTrackKey | null;
  default_transition_key: ProjectTemplateConfig["defaultTransitionKey"];
  default_theme_key: ProjectTemplateConfig["defaultThemeKey"];
  default_frame_style_key: ProjectTemplateConfig["defaultFrameStyleKey"];
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
    customPrompt: row.custom_prompt,
    generationStatus: row.generation_status,
    klingTaskId: row.kling_task_id,
    regenerationCount: row.regeneration_count ?? 0,
    isStaticClip: Boolean(row.is_static_clip),
    timelineOrder: row.timeline_order,
    transitionKey: row.transition_key,
    themeKey: row.theme_key,
    frameStyleKey: row.frame_style_key,
    durationSeconds: row.duration_seconds ?? DEFAULT_CLIP_DURATION,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCanvaExport(row: ProjectCanvaExportRow): ProjectCanvaExport {
  return {
    id: row.id,
    projectId: row.project_id,
    templateKey: row.template_key,
    templateName: row.template_name,
    templateUrl: row.template_url ?? "",
    status: row.status,
    slideCount: row.slide_count,
    clipUrls: Array.isArray(row.clip_urls)
      ? row.clip_urls.filter((item): item is string => typeof item === "string")
      : [],
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTemplateConfig(row: ProjectTemplateConfigRow): ProjectTemplateConfig {
  return {
    id: row.id,
    projectId: row.project_id,
    templateKey: row.template_key,
    templateName: row.template_name,
    musicKey: row.music_key ?? DEFAULT_MUSIC_TRACK_KEY,
    defaultTransitionKey: row.default_transition_key,
    defaultThemeKey: row.default_theme_key,
    defaultFrameStyleKey: row.default_frame_style_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseCanvaTemplateUrl(input: string) {
  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Canva template URL 格式不正確。");
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("Canva template URL 必須是 http 或 https。");
  }

  const host = parsed.hostname.toLowerCase();
  const isCanvaHost =
    host === "canva.com" ||
    host.endsWith(".canva.com") ||
    host === "canva.cn" ||
    host.endsWith(".canva.cn") ||
    host === "canva.link" ||
    host.endsWith(".canva.link");

  if (!isCanvaHost) {
    throw new Error("請貼上 Canva 的 template 連結。");
  }

  const designMatch = parsed.pathname.match(/\/design\/([A-Za-z0-9_-]+)/);

  if (designMatch) {
    return {
      templateKey: designMatch[1],
      templateUrl: parsed.toString(),
    };
  }

  const templateSlugMatch = parsed.pathname.match(/\/templates\/([^/?#]+)/);

  if (templateSlugMatch) {
    return {
      templateKey: templateSlugMatch[1],
      templateUrl: parsed.toString(),
    };
  }

  return {
    templateKey: `external-${crypto.randomUUID()}`,
    templateUrl: parsed.toString(),
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

function toStoragePath(publicUrl: string) {
  try {
    const url = new URL(publicUrl);
    const marker = "/storage/v1/object/public/";
    const index = url.pathname.indexOf(marker);

    if (index === -1) {
      return null;
    }

    const remainder = url.pathname.slice(index + marker.length);
    const slashIndex = remainder.indexOf("/");

    if (slashIndex === -1) {
      return null;
    }

    return {
      bucket: remainder.slice(0, slashIndex),
      path: remainder.slice(slashIndex + 1),
    };
  } catch {
    return null;
  }
}

async function deleteStorageObject(publicUrl: string | null) {
  if (!publicUrl) {
    return;
  }

  const parsed = toStoragePath(publicUrl);

  if (!parsed) {
    return;
  }

  const client = assertSupabaseAdmin();
  await client.storage.from(parsed.bucket).remove([parsed.path]);
}

async function listAssetsForProject(projectId: string) {
  const client = assertSupabaseAdmin();
  const { data, error } = await client
    .from("project_assets")
    .select("*")
    .eq("project_id", projectId)
    .order("timeline_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AssetRow[]).map(mapAsset);
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

  const mappedAssets = await listAssetsForProject(projectId);
  const canvaExport = await getProjectCanvaExport(projectId);
  const templateConfig = await getProjectTemplateConfig(projectId);

  return {
    ...buildSummary(project as ProjectRow, mappedAssets),
    assets: mappedAssets,
    canvaExport,
    templateConfig,
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

export async function deleteProject(projectId: string) {
  const client = assertSupabaseAdmin();
  const assets = await listAssetsForProject(projectId);

  for (const asset of assets) {
    await deleteStorageObject(asset.generatedUrl);
    await deleteStorageObject(asset.originalUrl);
  }

  const { error } = await client.from("projects").delete().eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }
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
      regeneration_count: 0,
      is_static_clip: false,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await touchProject(input.projectId, "draft");
  return mapAsset(data as AssetRow);
}

export async function deleteAsset(projectId: string, assetId: string) {
  const client = assertSupabaseAdmin();
  const { data, error } = await client
    .from("project_assets")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", assetId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const asset = mapAsset(data as AssetRow);
  await deleteStorageObject(asset.generatedUrl);
  await deleteStorageObject(asset.originalUrl);

  const { error: deleteError } = await client
    .from("project_assets")
    .delete()
    .eq("id", assetId)
    .eq("project_id", projectId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  await resequenceAssets(projectId);
  return refreshProjectStatus(projectId);
}

export async function deleteGeneratedOutput(projectId: string, assetId: string) {
  const client = assertSupabaseAdmin();
  const { data, error } = await client
    .from("project_assets")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", assetId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const asset = mapAsset(data as AssetRow);
  await deleteStorageObject(asset.generatedUrl);

  const { error: updateError } = await client
    .from("project_assets")
    .update({
      generated_url: null,
      kling_task_id: null,
      generation_status: "uploaded",
      is_static_clip: false,
      error_message: null,
    })
    .eq("project_id", projectId)
    .eq("id", assetId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return refreshProjectStatus(projectId);
}

export async function savePromptSelections(
  projectId: string,
  selections: Array<{ id: string; promptKey: PromptKey; customPrompt?: string | null }>,
) {
  const client = assertSupabaseAdmin();

  for (const selection of selections) {
    const promptLabel = getPromptLabel(selection.promptKey);
    const customPrompt =
      selection.promptKey === "custom"
        ? selection.customPrompt?.trim() ?? null
        : null;

    const { error } = await client
      .from("project_assets")
      .update({
        prompt_key: selection.promptKey,
        prompt_label: promptLabel,
        custom_prompt: customPrompt,
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
  customPrompt?: string | null;
  isRegeneration?: boolean;
}) {
  const client = assertSupabaseAdmin();
  const { data: existingAsset, error: existingError } = await client
    .from("project_assets")
    .select("generated_url, regeneration_count")
    .eq("id", input.assetId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingAsset?.generated_url) {
    await deleteStorageObject(existingAsset.generated_url);
  }

  const updates: Record<string, unknown> = {
    prompt_key: input.promptKey,
    prompt_label: getPromptLabel(input.promptKey),
    custom_prompt: input.promptKey === "custom" ? input.customPrompt?.trim() ?? null : null,
    kling_task_id: input.klingTaskId,
    generated_url: null,
    generation_status: "queued",
    is_static_clip: false,
    error_message: null,
  };

  if (input.isRegeneration) {
    const regenerationCount = Number(existingAsset?.regeneration_count ?? 0);

    if (regenerationCount >= MAX_REGENERATION_COUNT) {
      throw new Error("已達上限，請刪除相片再重新上傳生成。");
    }

    updates.regeneration_count = regenerationCount + 1;
  }

  const { error } = await client
    .from("project_assets")
    .update(updates)
    .eq("id", input.assetId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markAssetStaticCompleted(input: {
  projectId: string;
  assetId: string;
  promptKey: PromptKey;
  customPrompt?: string | null;
  isRegeneration?: boolean;
}) {
  const client = assertSupabaseAdmin();
  const { data: existingAsset, error: existingError } = await client
    .from("project_assets")
    .select("generated_url, regeneration_count")
    .eq("id", input.assetId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingAsset?.generated_url) {
    await deleteStorageObject(existingAsset.generated_url);
  }

  const updates: Record<string, unknown> = {
    prompt_key: input.promptKey,
    prompt_label: getPromptLabel(input.promptKey),
    custom_prompt: input.promptKey === "custom" ? input.customPrompt?.trim() ?? null : null,
    generated_url: null,
    kling_task_id: null,
    generation_status: "completed",
    is_static_clip: true,
    error_message: null,
    duration_seconds: DEFAULT_CLIP_DURATION,
  };

  if (input.isRegeneration) {
    const regenerationCount = Number(existingAsset?.regeneration_count ?? 0);

    if (regenerationCount >= MAX_REGENERATION_COUNT) {
      throw new Error("已達上限，請刪除相片再重新上傳生成。");
    }

    updates.regeneration_count = regenerationCount + 1;
  }

  const { error } = await client
    .from("project_assets")
    .update(updates)
    .eq("project_id", input.projectId)
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

export async function persistGeneratedVideo(input: {
  projectId: string;
  assetId: string;
  sourceUrl: string;
  durationSeconds: number;
}) {
  const client = assertSupabaseAdmin();
  const existing = await getAssetById(input.projectId, input.assetId);
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

  if (existing?.generatedUrl) {
    await deleteStorageObject(existing.generatedUrl);
  }

  const { data } = client.storage.from(GENERATED_BUCKET).getPublicUrl(storagePath);

  const { error } = await client
    .from("project_assets")
    .update({
      generated_url: data.publicUrl,
      generation_status: "completed",
      is_static_clip: false,
      duration_seconds: input.durationSeconds,
      error_message: null,
    })
    .eq("project_id", input.projectId)
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
          : "draft";

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

function resolveTemplatePreset(templateKey: StudioTemplateKey) {
  const preset = STUDIO_TEMPLATE_PRESETS.find((item) => item.key === templateKey);

  if (!preset) {
    throw new Error("找不到指定模板。");
  }

  return preset;
}

function resolveMusicTrack(musicKey: MusicTrackKey) {
  const track = MUSIC_TRACK_OPTIONS.find((item) => item.key === musicKey);

  if (!track) {
    throw new Error("找不到指定音樂。");
  }

  return track;
}

export async function getProjectTemplateConfig(projectId: string) {
  const client = assertSupabaseAdmin();
  const { data, error } = await client
    .from("project_template_configs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes("project_template_configs") ||
      error.message.includes("music_key")
    ) {
      return null;
    }

    throw new Error(error.message);
  }

  return data ? mapTemplateConfig(data as ProjectTemplateConfigRow) : null;
}

export async function saveProjectTemplateConfig(input: {
  projectId: string;
  templateKey: StudioTemplateKey;
  musicKey?: MusicTrackKey;
  applyToAllAssets: boolean;
}) {
  const preset = resolveTemplatePreset(input.templateKey);
  const musicTrack = resolveMusicTrack(
    (input.musicKey ?? DEFAULT_MUSIC_TRACK_KEY) as MusicTrackKey,
  );
  const client = assertSupabaseAdmin();

  const { data, error } = await client
    .from("project_template_configs")
    .upsert(
      {
        project_id: input.projectId,
        template_key: preset.key,
        template_name: preset.label,
        music_key: musicTrack.key,
        default_transition_key: preset.transitionKey,
        default_theme_key: preset.themeKey,
        default_frame_style_key: preset.frameStyleKey,
      },
      { onConflict: "project_id" },
    )
    .select("*")
    .single();

  if (error) {
    if (
      error.message.includes("project_template_configs") ||
      error.message.includes("music_key")
    ) {
      throw new Error("尚未建立模板設定資料表。請先執行最新 supabase/schema.sql。");
    }

    throw new Error(error.message);
  }

  if (input.applyToAllAssets) {
    const { error: updateError } = await client
      .from("project_assets")
      .update({
        transition_key: preset.transitionKey,
        theme_key: preset.themeKey,
        frame_style_key: preset.frameStyleKey,
      })
      .eq("project_id", input.projectId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    await touchProject(input.projectId, "ready");
  }

  return {
    templateConfig: mapTemplateConfig(data as ProjectTemplateConfigRow),
    assets: input.applyToAllAssets ? await listAssetsForProject(input.projectId) : null,
  };
}

export async function getProjectCanvaExport(projectId: string) {
  const client = assertSupabaseAdmin();
  const { data, error } = await client
    .from("project_canva_exports")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    if (error.message.includes("project_canva_exports")) {
      return null;
    }

    throw new Error(error.message);
  }

  return data ? mapCanvaExport(data as ProjectCanvaExportRow) : null;
}

export async function composeProjectCanvaSlideshow(input: {
  projectId: string;
  templateUrl: string;
  templateName?: string | null;
  orderedAssetIds?: string[];
}) {
  const parsedTemplate = parseCanvaTemplateUrl(input.templateUrl);

  const project = await getProjectDetails(input.projectId);

  if (!project) {
    throw new Error("找不到專案。");
  }

  const completedAssets = project.assets.filter(
    (asset) => asset.generationStatus === "completed",
  );

  if (completedAssets.length === 0) {
    throw new Error("未有可套用範本的動態影像。");
  }

  let orderedAssets = completedAssets;

  if (input.orderedAssetIds && input.orderedAssetIds.length > 0) {
    const orderMap = new Map(input.orderedAssetIds.map((id, index) => [id, index]));
    orderedAssets = [...completedAssets].sort((left, right) => {
      const leftOrder = orderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = orderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });
  }

  const clipUrls = orderedAssets
    .map((asset) => (asset.isStaticClip ? asset.originalUrl : asset.generatedUrl))
    .filter((url): url is string => Boolean(url));

  if (clipUrls.length === 0) {
    throw new Error("已完成片段缺少可預覽網址，請重新同步後再試。");
  }

  const client = assertSupabaseAdmin();
  const templateName = input.templateName?.trim() || "Canva Slideshow Template";
  const { data, error } = await client
    .from("project_canva_exports")
    .upsert(
      {
        project_id: input.projectId,
        template_key: parsedTemplate.templateKey,
        template_name: templateName,
        template_url: parsedTemplate.templateUrl,
        status: "completed",
        slide_count: clipUrls.length,
        clip_urls: clipUrls,
        error_message: null,
      },
      { onConflict: "project_id" },
    )
    .select("*")
    .single();

  if (error) {
    if (
      error.message.includes("project_canva_exports") ||
      error.message.includes("template_url")
    ) {
      throw new Error("尚未建立 Canva 匯出資料表。請先執行最新 supabase/schema.sql。");
    }

    throw new Error(error.message);
  }

  return mapCanvaExport(data as ProjectCanvaExportRow);
}

export async function resetProjectCanvaSlideshow(projectId: string) {
  const client = assertSupabaseAdmin();
  const { error } = await client
    .from("project_canva_exports")
    .delete()
    .eq("project_id", projectId);

  if (error) {
    if (error.message.includes("project_canva_exports")) {
      throw new Error("尚未建立 Canva 匯出資料表。請先執行最新 supabase/schema.sql。");
    }

    throw new Error(error.message);
  }
}

export function buildOriginalStoragePath(projectId: string, fileName: string) {
  return `${projectId}/${crypto.randomUUID()}-${slugifyFileName(fileName)}`;
}

export function canRegenerate(asset: Pick<ProjectAsset, "regenerationCount">) {
  return asset.regenerationCount < MAX_REGENERATION_COUNT;
}

async function getAssetById(projectId: string, assetId: string) {
  const client = assertSupabaseAdmin();
  const { data, error } = await client
    .from("project_assets")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", assetId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapAsset(data as AssetRow) : null;
}

async function resequenceAssets(projectId: string) {
  const client = assertSupabaseAdmin();
  const assets = await listAssetsForProject(projectId);

  for (const [index, asset] of assets.entries()) {
    const { error } = await client
      .from("project_assets")
      .update({ timeline_order: index })
      .eq("project_id", projectId)
      .eq("id", asset.id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
