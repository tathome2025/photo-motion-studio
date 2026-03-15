export const JPEG_ACCEPT = ".jpg,.jpeg,image/jpeg";
export const SAFE_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;

const JPEG_MIME_TYPES = new Set(["image/jpeg", "image/jpg"]);
const JPEG_EXTENSIONS = [".jpg", ".jpeg"];
const QUALITY_STEPS = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5];
const MAX_DIMENSION = 2400;
const MIN_DIMENSION = 960;

function hasJpegExtension(fileName: string) {
  const lowerName = fileName.toLowerCase();
  return JPEG_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function toJpegFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, ".jpg");
}

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`${file.name}: 圖片無法讀取。`));
      element.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("圖片壓縮失敗。"));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

export function findInvalidJpegFiles(files: File[]) {
  return files.filter((file) => {
    const type = file.type.toLowerCase();
    return !JPEG_MIME_TYPES.has(type) && !hasJpegExtension(file.name);
  });
}

export async function prepareJpegFileForUpload(file: File) {
  const image = await loadImage(file);
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (Math.max(width, height) > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.max(Math.round(width * scale), 1);
    height = Math.max(Math.round(height * scale), 1);
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("瀏覽器未能初始化圖片處理。");
  }

  let fallbackBlob: Blob | null = null;

  for (let dimensionPass = 0; dimensionPass < 4; dimensionPass += 1) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, quality);
      fallbackBlob = blob;

      if (blob.size <= SAFE_UPLOAD_LIMIT_BYTES) {
        return new File([blob], toJpegFileName(file.name), {
          type: "image/jpeg",
          lastModified: file.lastModified,
        });
      }
    }

    if (Math.max(width, height) <= MIN_DIMENSION) {
      break;
    }

    width = Math.max(Math.round(width * 0.84), MIN_DIMENSION);
    height = Math.max(Math.round(height * 0.84), MIN_DIMENSION);
  }

  if (!fallbackBlob) {
    throw new Error(`${file.name}: 圖片壓縮失敗。`);
  }

  if (fallbackBlob.size > SAFE_UPLOAD_LIMIT_BYTES) {
    throw new Error(`${file.name}: 檔案過大，請先縮小後再上傳。`);
  }

  return new File([fallbackBlob], toJpegFileName(file.name), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}
