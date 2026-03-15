import sharp from "sharp";

const LANDSCAPE_WIDTH = 1920;
const LANDSCAPE_HEIGHT = 1080;

export async function normalizeImageToLandscape(input: ArrayBuffer) {
  const source = sharp(Buffer.from(input)).rotate();

  const background = await source
    .clone()
    .resize(LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT, {
      fit: "cover",
      withoutEnlargement: false,
    })
    .blur(36)
    .modulate({
      brightness: 0.82,
      saturation: 1.05,
    })
    .toBuffer();

  const foreground = await source
    .clone()
    .resize(LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  return sharp(background)
    .composite([{ input: foreground }])
    .jpeg({
      quality: 92,
      chromaSubsampling: "4:4:4",
    })
    .toBuffer();
}
