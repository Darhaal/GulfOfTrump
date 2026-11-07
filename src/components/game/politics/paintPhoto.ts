import { PARTY_IMAGE_CHARS } from "@/engine/partyEmblems";
import { paintPixels } from "@/lib/oilPaint";

/** The painting's canvas: four by five like the portraits, painted at twice the size it is kept at. */
const KEPT = { w: 160, h: 200 };
const PAINTED = { w: KEPT.w * 2, h: KEPT.h * 2 };

/**
 * A picture file painted in oil (lib/oilPaint.ts) and kept as a small data
 * URL: cut to the frame (a little above the middle, where a face is), painted
 * at twice the size and brought down. Null when the browser cannot read it.
 */
export async function paintPhoto(file: File): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const big = document.createElement("canvas");
  big.width = PAINTED.w;
  big.height = PAINTED.h;
  const ctx = big.getContext("2d");
  if (!ctx) return null;
  const scale = Math.max(PAINTED.w / bitmap.width, PAINTED.h / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (PAINTED.w - w) / 2, (PAINTED.h - h) * 0.3, w, h);
  bitmap.close();
  const data = ctx.getImageData(0, 0, PAINTED.w, PAINTED.h);
  paintPixels(data.data, PAINTED.w, PAINTED.h, 3);
  ctx.putImageData(data, 0, 0);
  const small = document.createElement("canvas");
  small.width = KEPT.w;
  small.height = KEPT.h;
  const sctx = small.getContext("2d");
  if (!sctx) return null;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(big, 0, 0, KEPT.w, KEPT.h);
  // WebP where the browser writes it, JPEG elsewhere; smaller until it fits the save.
  for (const quality of [0.82, 0.7, 0.55]) {
    let url = small.toDataURL("image/webp", quality);
    if (!url.startsWith("data:image/webp")) url = small.toDataURL("image/jpeg", quality);
    if (url.length <= PARTY_IMAGE_CHARS) return url;
  }
  return null;
}
