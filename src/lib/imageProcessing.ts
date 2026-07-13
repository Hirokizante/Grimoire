/**
 * Image processing utility — canvas-based resize and compression for images
 * uploaded by the user.
 *
 * The raw file from a phone or camera can easily be 5–10 MB. Storing that as
 * a base64 data URL (×1.33 overhead) in the Character JSON makes export files
 * huge, slows IndexedDB writes, and causes sluggish JSON.parse/stringify on
 * every autosave.
 *
 * Instead we draw the image onto an off-screen canvas at a capped max
 * dimension, then export via `canvas.toDataURL()` as JPEG at a configurable
 * quality. The result is typically 30–400 KB — trivially small for JSON
 * storage while visually sufficient for a web-app display context.
 */

export interface ProcessImageOptions {
  /** Maximum width or height in pixels. The image is scaled down
   * proportionally if either dimension exceeds this. */
  maxDim: number
  /** JPEG quality, 0–1. Higher = better quality, larger file. */
  quality: number
  /** Output MIME type. Defaults to `image/jpeg` for photos. */
  mimeType?: string
}

/**
 * Read a File as an HTMLImageElement, resolving when the image has decoded.
 * Rejects if the file is not a valid image or the browser fails to decode it.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to decode image'))
    }
    img.src = url
  })
}

/**
 * Process an uploaded image file: resize to fit within `maxDim` and compress
 * to JPEG at the given quality. Returns a base64 data URL string.
 *
 * If the image is already smaller than `maxDim`, it is drawn at its natural
 * size (no upscaling) and only the compression step applies.
 */
export async function processImage(
  file: File,
  opts: ProcessImageOptions,
): Promise<string> {
  const { maxDim, quality, mimeType = 'image/jpeg' } = opts
  const img = await loadImage(file)

  // Calculate scaled dimensions — never upscale.
  let { width, height } = img
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL(mimeType, quality)
}
