import { nativeImage, type NativeImage } from 'electron'

export type EncodedTerminalBackgroundImage = {
  bytes: Uint8Array
  mimeType: 'image/jpeg' | 'image/png'
}

/**
 * Decodes with Chromium's image stack and re-encodes to fit `maxBytes`, trying each edge limit in
 * order and never upscaling. Opaque images become JPEG; translucent ones stay PNG.
 */
export function encodeTerminalBackgroundImage(
  bytes: Uint8Array,
  options: { maxEdges: readonly number[]; jpegQuality: number; maxBytes: number }
): EncodedTerminalBackgroundImage | null {
  const image = nativeImage.createFromBuffer(Buffer.from(bytes))
  const { width, height } = image.getSize()
  if (image.isEmpty() || width <= 0 || height <= 0) {
    return null
  }
  // Why: JPEG has no alpha, so a pre-faded wallpaper would be flattened onto black and render
  // darker than in other terminals, which composite it over the theme background.
  const translucent = hasTranslucentPixels(image)
  for (const maxEdge of options.maxEdges) {
    const scale = Math.min(1, maxEdge / Math.max(width, height))
    const fitted =
      scale < 1
        ? image.resize({
            width: Math.max(1, Math.round(width * scale)),
            height: Math.max(1, Math.round(height * scale)),
            quality: 'best'
          })
        : image
    const encoded = translucent ? fitted.toPNG() : fitted.toJPEG(options.jpegQuality)
    if (encoded.byteLength > 0 && encoded.byteLength <= options.maxBytes) {
      return { bytes: encoded, mimeType: translucent ? 'image/png' : 'image/jpeg' }
    }
  }
  return null
}

// toBitmap() is 32-bit BGRA/RGBA; either way alpha is the fourth byte of each pixel.
function hasTranslucentPixels(image: NativeImage): boolean {
  const bitmap = image.toBitmap()
  for (let i = 3; i < bitmap.length; i += 4) {
    if (bitmap[i] !== 255) {
      return true
    }
  }
  return false
}
