/**
 * Client-side image upload helper for the EnterPrize Historical Enhanced
 * port.
 *
 * The original used `@vercel/blob/client`'s `upload()` to hand the file
 * directly to Vercel Blob with a server-issued token. Vercel Blob is
 * not part of the museum's storage layer; instead, the museum stores
 * image bytes inline in the per-project `images` table as `bytea`,
 * which scales fine at the museum demo level because we compress
 * client-side to webp first (typical 30–80 KB per 1024px image).
 *
 * Flow:
 *   1. Draw the File into a hidden <canvas>, scaled to fit a max
 *      dimension (default 1024px).
 *   2. `canvas.toBlob('image/webp', 0.75)` to get a small webp Blob.
 *   3. POST as multipart/form-data to
 *      /api/v2/quirk-truck-enhanced/images.
 *   4. Return `{ id, url }` where `url` is the GET endpoint for
 *      serving the image back.
 */

export interface UploadedImage {
  id: string;
  url: string;
  /** Final compressed byte length. Useful for the "<note>kb uploaded" UX. */
  size: number;
  width: number;
  height: number;
}

const DEFAULT_MAX_DIM = 1024;
const DEFAULT_WEBP_QUALITY = 0.75;

/**
 * Load a File into an HTMLImageElement for canvas drawing. Resolves
 * once the image's naturalWidth/Height are populated.
 */
function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export async function compressToWebp(
  file: File,
  options: { maxDim?: number; quality?: number } = {},
): Promise<{ blob: Blob; width: number; height: number }> {
  const maxDim = options.maxDim ?? DEFAULT_MAX_DIM;
  const quality = options.quality ?? DEFAULT_WEBP_QUALITY;

  const img = await loadImageElement(file);
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context");
  ctx.drawImage(img, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob produced null"))),
      "image/webp",
      quality,
    );
  });

  return { blob, width, height };
}

/**
 * Compress + POST. Throws if the upload fails. Caller should append
 * the returned `url` (or `id`) to its formData with whatever field
 * name the server-side action expects (the original code used
 * "image-url" — we keep that contract).
 */
export async function uploadImage(file: File): Promise<UploadedImage> {
  const { blob, width, height } = await compressToWebp(file);

  const body = new FormData();
  body.append("file", blob, file.name.replace(/\.[^.]+$/, "") + ".webp");
  body.append("width", String(width));
  body.append("height", String(height));

  const res = await fetch("/api/v2/quirk-truck-enhanced/images", {
    method: "POST",
    body,
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    throw new Error(
      `Image upload failed (HTTP ${res.status})${detail ? `: ${detail}` : ""}`,
    );
  }
  const payload = (await res.json()) as { id: string };
  return {
    id: payload.id,
    url: `/api/v2/quirk-truck-enhanced/images/${payload.id}`,
    size: blob.size,
    width,
    height,
  };
}
