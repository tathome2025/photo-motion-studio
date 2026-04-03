"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

import type { ProjectAsset } from "@/lib/types";

const CONTENT_WIDTH = 1344;
const CONTENT_HEIGHT = 756;
const BACKGROUND_WIDTH = 1920;
const BACKGROUND_HEIGHT = 1080;
const CLIP_DURATION_SECONDS = 2.5;
const FADE_SECONDS = 0.6;

let ffmpegInstance: FFmpeg | null = null;

async function ensureFfmpegLoaded() {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }

  if (!ffmpegInstance.loaded) {
    await ffmpegInstance.load({
      coreURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js",
      wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm",
    });
  }

  return ffmpegInstance;
}

function buildClipFilter(index: number, isStaticClip: boolean) {
  const source = isStaticClip
    ? `[${index}:v]`
    : `[${index}:v]`;

  return `${source}fps=30,scale=${CONTENT_WIDTH}:${CONTENT_HEIGHT}:force_original_aspect_ratio=increase,crop=${CONTENT_WIDTH}:${CONTENT_HEIGHT},trim=duration=${CLIP_DURATION_SECONDS},setpts=PTS-STARTPTS[v${index}]`;
}

function buildConcatFilter(totalClips: number) {
  const labels = Array.from({ length: totalClips }, (_, index) => `[v${index}]`).join("");
  return `${labels}concat=n=${totalClips}:v=1:a=0[content]`;
}

export async function renderVideoPreview(input: {
  assets: ProjectAsset[];
  backgroundVideoPath: string;
  musicFilePath?: string | null;
}) {
  const ffmpeg = await ensureFfmpegLoaded();
  const args: string[] = ["-y"];
  const playableAssets = input.assets.filter((asset) => asset.generationStatus === "completed");

  if (playableAssets.length === 0) {
    throw new Error("沒有可輸出的影片片段。");
  }

  for (let index = 0; index < playableAssets.length; index += 1) {
    const asset = playableAssets[index];

    if (asset.isStaticClip) {
      await ffmpeg.writeFile(`clip-${index}.jpg`, await fetchFile(asset.originalUrl));
      args.push(
        "-loop",
        "1",
        "-t",
        String(CLIP_DURATION_SECONDS),
        "-i",
        `clip-${index}.jpg`,
      );
      continue;
    }

    if (!asset.generatedUrl) {
      throw new Error(`片段 ${asset.fileName} 未完成，請返回上一頁檢查。`);
    }

    await ffmpeg.writeFile(`clip-${index}.mp4`, await fetchFile(asset.generatedUrl));
    args.push("-stream_loop", "-1", "-i", `clip-${index}.mp4`);
  }

  await ffmpeg.writeFile("background.mp4", await fetchFile(input.backgroundVideoPath));
  args.push("-stream_loop", "-1", "-i", "background.mp4");
  const backgroundInputIndex = playableAssets.length;

  let hasAudioTrack = false;
  let audioInputIndex = -1;

  if (input.musicFilePath) {
    try {
      const musicResponse = await fetch(input.musicFilePath, { cache: "no-store" });
      if (musicResponse.ok) {
        const musicBytes = new Uint8Array(await musicResponse.arrayBuffer());
        await ffmpeg.writeFile("music.mp3", musicBytes);
        args.push("-stream_loop", "-1", "-i", "music.mp3");
        hasAudioTrack = true;
        audioInputIndex = playableAssets.length + 1;
      }
    } catch {
      hasAudioTrack = false;
    }
  }

  const totalDuration = playableAssets.length * CLIP_DURATION_SECONDS;
  const fadeOutStart = Math.max(totalDuration - FADE_SECONDS, 0);
  const clipFilters = playableAssets.map((asset, index) =>
    buildClipFilter(index, asset.isStaticClip),
  );
  const concatFilter = buildConcatFilter(playableAssets.length);
  const backgroundFilter = `[${backgroundInputIndex}:v]fps=30,scale=${BACKGROUND_WIDTH}:${BACKGROUND_HEIGHT}:force_original_aspect_ratio=increase,crop=${BACKGROUND_WIDTH}:${BACKGROUND_HEIGHT},trim=duration=${totalDuration},setpts=PTS-STARTPTS[bg]`;
  const composeFilter = `[bg][content]overlay=(W-w)/2:(H-h)/2:shortest=1,fade=t=in:st=0:d=${FADE_SECONDS},fade=t=out:st=${fadeOutStart}:d=${FADE_SECONDS}[finalv]`;
  const filterComplex = [...clipFilters, concatFilter, backgroundFilter, composeFilter].join(";");

  const outputArgs = [
    ...args,
    "-filter_complex",
    filterComplex,
    "-map",
    "[finalv]",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
  ];

  if (hasAudioTrack && audioInputIndex >= 0) {
    outputArgs.push(
      "-map",
      `${audioInputIndex}:a`,
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
    );
  } else {
    outputArgs.push("-an");
  }

  outputArgs.push("preview-output.mp4");
  await ffmpeg.exec(outputArgs);

  const output = await ffmpeg.readFile("preview-output.mp4");
  const bytes =
    output instanceof Uint8Array ? output : new TextEncoder().encode(output);
  const normalized = new Uint8Array(bytes.byteLength);
  normalized.set(bytes);
  return new Blob([normalized.buffer], { type: "video/mp4" });
}
