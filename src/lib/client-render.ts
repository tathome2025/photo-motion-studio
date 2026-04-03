"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

import { THEME_OPTIONS } from "@/lib/constants";
import type { ProjectAsset, StudioTemplatePreset } from "@/lib/types";

let ffmpegInstance: FFmpeg | null = null;

function toFfmpegColor(color: string) {
  return color.replace("#", "0x");
}

function getTransitionFilter(transition: ProjectAsset["transitionKey"]) {
  switch (transition) {
    case "wipeleft":
      return { filter: "wipeleft", duration: 0.55 };
    case "slideup":
      return { filter: "slideup", duration: 0.55 };
    case "cut":
      return { filter: "fade", duration: 0.05 };
    case "fade":
    default:
      return { filter: "fade", duration: 0.55 };
  }
}

function buildFrameFilters(frameStyle: ProjectAsset["frameStyleKey"], border: string) {
  if (frameStyle === "none") {
    return [];
  }

  if (frameStyle === "single") {
    return [`drawbox=x=28:y=28:w=iw-56:h=ih-56:color=${border}:t=4`];
  }

  if (frameStyle === "double") {
    return [
      `drawbox=x=20:y=20:w=iw-40:h=ih-40:color=${border}:t=3`,
      `drawbox=x=34:y=34:w=iw-68:h=ih-68:color=${border}:t=2`,
    ];
  }

  return [
    `drawbox=x=28:y=28:w=iw-56:h=ih-56:color=${border}:t=4`,
    `drawbox=x=46:y=46:w=iw-92:h=ih-92:color=${border}@0.75:t=2`,
  ];
}

function buildFilterGraph(assets: ProjectAsset[]) {
  const filters: string[] = [];

  assets.forEach((asset, index) => {
    const theme = THEME_OPTIONS.find((item) => item.key === asset.themeKey) ?? THEME_OPTIONS[0];
    const base = [
      `[${index}:v]fps=30,scale=1280:720:force_original_aspect_ratio=decrease`,
      `pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=${toFfmpegColor(theme.background)}`,
      "setsar=1",
      ...buildFrameFilters(asset.frameStyleKey, toFfmpegColor(theme.border)),
      `format=yuv420p,setpts=PTS-STARTPTS[v${index}]`,
    ];

    filters.push(base.join(","));
  });

  if (assets.length === 1) {
    return { filter: filters.join(";"), outputLabel: "v0" };
  }

  let currentLabel = "v0";
  let currentDuration = assets[0].durationSeconds;

  for (let index = 1; index < assets.length; index += 1) {
    const transition = getTransitionFilter(assets[index - 1].transitionKey);
    const nextLabel = `vx${index}`;
    const offset = Math.max(currentDuration - transition.duration, 0);

    filters.push(
      `[${currentLabel}][v${index}]xfade=transition=${transition.filter}:duration=${transition.duration}:offset=${offset}[${nextLabel}]`,
    );

    currentLabel = nextLabel;
    currentDuration =
      currentDuration + assets[index].durationSeconds - transition.duration;
  }

  return { filter: filters.join(";"), outputLabel: currentLabel };
}

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

export async function renderVideoPreview(input: {
  assets: ProjectAsset[];
  templatePreset: StudioTemplatePreset;
  musicFilePath?: string | null;
}) {
  const ffmpeg = await ensureFfmpegLoaded();
  const presetAssets = input.assets.map((asset) => ({
    ...asset,
    transitionKey: input.templatePreset.transitionKey,
    themeKey: input.templatePreset.themeKey,
    frameStyleKey: input.templatePreset.frameStyleKey,
  }));

  const args: string[] = ["-y"];

  for (let index = 0; index < presetAssets.length; index += 1) {
    const asset = presetAssets[index];

    if (asset.isStaticClip) {
      await ffmpeg.writeFile(`clip-${index}.jpg`, await fetchFile(asset.originalUrl));
      args.push(
        "-loop",
        "1",
        "-framerate",
        "30",
        "-t",
        String(asset.durationSeconds),
        "-i",
        `clip-${index}.jpg`,
      );
      continue;
    }

    if (!asset.generatedUrl) {
      throw new Error(`片段 ${asset.fileName} 未完成，請返回上一頁檢查。`);
    }

    await ffmpeg.writeFile(`clip-${index}.mp4`, await fetchFile(asset.generatedUrl));
    args.push("-i", `clip-${index}.mp4`);
  }

  let hasAudioTrack = false;

  if (input.musicFilePath) {
    try {
      const musicResponse = await fetch(input.musicFilePath, { cache: "no-store" });
      if (musicResponse.ok) {
        const musicBytes = new Uint8Array(await musicResponse.arrayBuffer());
        await ffmpeg.writeFile("music.mp3", musicBytes);
        args.push("-stream_loop", "-1", "-i", "music.mp3");
        hasAudioTrack = true;
      }
    } catch {
      hasAudioTrack = false;
    }
  }

  const filterGraph = buildFilterGraph(presetAssets);
  const outputArgs = [
    ...args,
    "-filter_complex",
    filterGraph.filter,
    "-map",
    `[${filterGraph.outputLabel}]`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
  ];

  if (hasAudioTrack) {
    outputArgs.push("-map", `${presetAssets.length}:a`, "-c:a", "aac", "-shortest");
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
