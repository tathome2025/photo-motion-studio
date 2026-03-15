import { DEFAULT_CLIP_DURATION } from "@/lib/constants";

interface CreateKlingTaskInput {
  imageUrl: string;
  prompt: string;
  callbackUrl?: string;
}

type KiePayload = Record<string, unknown> & {
  code?: number;
  msg?: string;
  data?: Record<string, unknown>;
};

function getKieApiKey() {
  const apiKey = process.env.KIE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("KIE AI API env 未設定。請先提供 KIE_API_KEY。");
  }

  return apiKey;
}

function getBaseUrl() {
  return process.env.KIE_API_BASE_URL ?? "https://api.kie.ai/api/v1";
}

function getModelName() {
  const configured = process.env.KIE_MODEL_NAME?.trim();

  if (!configured) {
    return "kling-2.6/image-to-video";
  }

  const normalized = configured.toLowerCase();

  if (
    normalized === "kling-video-v3" ||
    normalized === "kling-video-3" ||
    normalized === "kling3" ||
    normalized === "kling-3"
  ) {
    return "kling-3.0/video";
  }

  if (
    normalized === "kling-2.6" ||
    normalized === "kling2.6" ||
    normalized === "kling 2.6" ||
    normalized === "kling-2.6/image-to-video"
  ) {
    return "kling-2.6/image-to-video";
  }

  return configured;
}

function getSoundEnabled() {
  const configured = process.env.KIE_ENABLE_SOUND?.trim().toLowerCase();

  if (!configured) {
    return false;
  }

  return configured === "1" || configured === "true" || configured === "yes";
}

function getCreatePath() {
  return process.env.KIE_CREATE_TASK_PATH ?? "/jobs/createTask";
}

function getQueryPath(taskId: string) {
  const template = process.env.KIE_QUERY_TASK_TEMPLATE ?? "/jobs/recordInfo?taskId={taskId}";
  return template.replace("{taskId}", encodeURIComponent(taskId));
}

async function kieFetch(path: string, init: RequestInit) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getKieApiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const rawText = await response.text();
  let parsedData: unknown = null;

  try {
    parsedData = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsedData = rawText || null;
  }

  if (!response.ok) {
    throw new Error(
      `KIE AI API 錯誤 ${response.status}: ${
        typeof parsedData === "string"
          ? parsedData
          : JSON.stringify(parsedData ?? {})
      }`,
    );
  }

  return parsedData;
}

function parseResultJson(input: unknown) {
  if (typeof input !== "string") {
    return null;
  }

  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractVideoUrl(payload: KiePayload) {
  const data = payload.data ?? {};
  const resultJson =
    parseResultJson(data.resultJson) ??
    parseResultJson(data.response) ??
    parseResultJson(payload.resultJson);

  const resultUrls =
    (data.resultUrls as unknown[]) ??
    (resultJson?.resultUrls as unknown[]) ??
    (resultJson?.videos as unknown[]) ??
    null;

  const directUrl =
    (Array.isArray(resultUrls) ? resultUrls[0] : null) ??
    (data.videoUrl as string | undefined) ??
    (resultJson?.videoUrl as string | undefined) ??
    (resultJson?.url as string | undefined) ??
    null;

  if (typeof directUrl === "string") {
    return directUrl;
  }

  if (directUrl && typeof directUrl === "object" && "url" in directUrl) {
    const candidate = (directUrl as { url?: string }).url;
    return typeof candidate === "string" ? candidate : null;
  }

  return null;
}

export async function createKlingImageToVideoTask({
  imageUrl,
  prompt,
  callbackUrl,
}: CreateKlingTaskInput) {
  const duration = Number(process.env.KLING_DURATION_SECONDS ?? DEFAULT_CLIP_DURATION);
  const model = getModelName();
  const input: Record<string, unknown> = {
    prompt,
    image_urls: [imageUrl],
    duration: String(duration),
    sound: getSoundEnabled(),
  };

  if (model === "kling-3.0/video") {
    input.aspect_ratio = "16:9";
    input.mode = process.env.KIE_KLING_MODE?.trim() || "std";
    input.multi_shots = false;
  }

  const payload: Record<string, unknown> = {
    model,
    callBackUrl:
      callbackUrl && !callbackUrl.includes("localhost") ? callbackUrl : undefined,
    input,
  };

  const data = (await kieFetch(getCreatePath(), {
    method: "POST",
    body: JSON.stringify(payload),
  })) as KiePayload;

  const taskId =
    data.data?.taskId ??
    data.data?.task_id ??
    data.taskId ??
    data.task_id;

  if (!taskId) {
    throw new Error(`KIE AI 回傳中找不到 task id: ${JSON.stringify(data)}`);
  }

  return {
    taskId: String(taskId),
    raw: data,
  };
}

export async function queryKlingTask(taskId: string) {
  const data = (await kieFetch(getQueryPath(taskId), {
    method: "GET",
  })) as KiePayload;

  const status =
    data.data?.state ??
    data.data?.status ??
    data.state ??
    data.status ??
    "unknown";

  return {
    status: String(status),
    videoUrl: extractVideoUrl(data),
    raw: data,
  };
}
