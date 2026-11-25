/**
 * Makes a payment screenshot smaller BEFORE it is uploaded, so storage and download
 * traffic stay low (a 3 MB phone screenshot becomes roughly 150-300 KB).
 *
 * - The longest side is limited to MAX_SIDE pixels (text stays easy to read).
 * - The result is a JPEG at JPEG_QUALITY.
 * - It NEVER blocks a booking: if anything goes wrong (unusual file, old browser,
 *   no canvas, result not smaller) the ORIGINAL file is returned unchanged.
 */

export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.8;
/** Files already this small are left exactly as they are (nothing to gain, no quality loss). */
export const SKIP_BELOW_BYTES = 250 * 1024;

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: File): Promise<Decoded> {
  // Preferred: createImageBitmap applies the photo's rotation (EXIF) for us.
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close?.() };
    } catch {
      // fall through to the <img> way
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image could not be read"));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });
}

export async function compressScreenshot(file: File): Promise<File> {
  try {
    if (typeof document === "undefined") return file;
    if (file.size <= SKIP_BELOW_BYTES) return file;

    const decoded = await decode(file);
    try {
      const { width, height } = decoded;
      if (!width || !height) return file;

      const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      // PNG screenshots can be see-through; JPEG has no transparency, so paint white first.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(decoded.source, 0, 0, w, h);

      const blob = await toBlob(canvas, "image/jpeg", JPEG_QUALITY);
      if (!blob || blob.size === 0 || blob.type !== "image/jpeg") return file;
      if (blob.size >= file.size) return file; // not smaller: keep the original

      const baseName = (file.name.replace(/\.[^.]+$/, "") || "payment").slice(0, 60);
      return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    } finally {
      decoded.release();
    }
  } catch {
    return file;
  }
}
