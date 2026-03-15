import crypto from "node:crypto";

import { DEFAULT_CLIP_DURATION } from "@/lib/constants";

interface CreateKlingTaskInput {
  imageUrl: string;
  prompt: string;
  callbackUrl?: string;
}

type KlingPayload = Record<string, unknown> & {
  data?: Record<string, unknown> & {
    task_result?: Record<string, unknown> & {
      videos?: Array<Record<string, unknown>>;
    };
  };
};

function shouldSendMode(modelName: string) {
  const normalized = modelName.toLowerCase();

  if (normalized.startsWith("kling-v2") && !normalized.startsWith("kling-v2-1")) {
    return false;
  }

  return true;
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signKlingToken() {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error("Kling API env 未設定。請先提供 KLING_ACCESS_KEY 與 KLING_SECRET_KEY。");
  }

  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: accessKey,
    exp: now + 30 * 60,
    nbf: now - 5,
  };

  const headerEncoded = base64Url(JSON.stringify(header));
  const payloadEncoded = base64Url(JSON.stringify(payload));
  const content = `${headerEncoded}.${payloadEncoded}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(content)
    .digest();

  return `${content}.${base64Url(signature)}`;
}

function getBaseUrl() {
  return process.env.KLING_API_BASE_URL ?? "https://api-singapore.klingai.com";
}

function getCreatePath() {
  return process.env.KLING_IMAGE_TO_VIDEO_PATH ?? "/v1/videos/image2video";
}

function getQueryPath(taskId: string) {
  if (process.env.KLING_QUERY_TASK_TEMPLATE) {
    return process.env.KLING_QUERY_TASK_TEMPLATE.replace("{taskId}", taskId);
  }

  return `${getCreatePath()}/${taskId}`;
}

async function klingFetch(path: string, init: RequestInit) {
  const token = signKlingToken();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
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
      `Kling API 錯誤 ${response.status}: ${
        typeof parsedData === "string"
          ? parsedData
          : JSON.stringify(parsedData ?? {})
      }`,
    );
  }

  return parsedData;
}

export async function createKlingImageToVideoTask({
  imageUrl,
  prompt,
  callbackUrl,
}: CreateKlingTaskInput) {
  const duration = Number(process.env.KLING_DURATION_SECONDS ?? DEFAULT_CLIP_DURATION);
  const modelName = process.env.KLING_MODEL_NAME ?? "kling-v1-6";
  const configuredMode = process.env.KLING_MODE;

  const payload: Record<string, unknown> = {
    image: imageUrl,
    prompt,
    model_name: modelName,
    duration,
  };

  if (callbackUrl && !callbackUrl.includes("localhost")) {
    payload.callback_url = callbackUrl;
  }

  if (configuredMode) {
    payload.mode = configuredMode;
  } else if (shouldSendMode(modelName)) {
    payload.mode = "std";
  }

  const data = await klingFetch(getCreatePath(), {
    method: "POST",
    body: JSON.stringify(payload),
  }) as KlingPayload;

  const taskId =
    data?.data?.task_id ??
    data?.data?.id ??
    data?.task_id ??
    data?.id;

  if (!taskId) {
    throw new Error(`Kling API 回傳中找不到 task id: ${JSON.stringify(data)}`);
  }

  return {
    taskId: String(taskId),
    raw: data,
  };
}

export async function queryKlingTask(taskId: string) {
  const data = await klingFetch(getQueryPath(taskId), {
    method: "GET",
  }) as KlingPayload;

  const status =
    data?.data?.task_status ??
    data?.data?.status ??
    data?.task_status ??
    data?.status;

  const videoUrl =
    data?.data?.task_result?.videos?.[0]?.url ??
    data?.data?.task_result?.video_url ??
    data?.data?.video_url ??
    data?.video_url ??
    null;

  return {
    status: String(status ?? "unknown"),
    videoUrl: videoUrl ? String(videoUrl) : null,
    raw: data,
  };
}
