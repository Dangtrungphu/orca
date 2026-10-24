import { nativeImage } from 'electron'

/** Decodes with Chromium's image stack and re-encodes as a JPEG fitting `maxEdge`, never upscaling. */
export function encodeTerminalBackgroundImageJpeg(
  bytes: Uint8Array,
  maxEdge: number,
  quality: number
): Uint8Array | null {
  const image = nativeImage.createFromBuffer(Buffer.from(bytes))
  const { width, height } = image.getSize()
  if (image.isEmpty() || width <= 0 || height <= 0) {
    return null
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const fitted =
    scale < 1
      ? image.resize({
          width: Math.max(1, Math.round(width * scale)),
          height: Math.max(1, Math.round(height * scale)),
          quality: 'best'
        })
      : image
  const jpeg = fitted.toJPEG(quality)
  return jpeg.byteLength > 0 ? jpeg : null
}
