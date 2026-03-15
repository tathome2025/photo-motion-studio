import sharp from "sharp";

const LANDSCAPE_WIDTH = 1920;
const LANDSCAPE_HEIGHT = 1080;

export async function normalizeImageToLandscape(input: ArrayBuffer) {
  return sharp(Buffer.from(input))
    .rotate()
    .resize(LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 1 },
      withoutEnlargement: false,
    })
    .jpeg({
      quality: 92,
      chromaSubsampling: "4:4:4",
    })
    .toBuffer();
}
