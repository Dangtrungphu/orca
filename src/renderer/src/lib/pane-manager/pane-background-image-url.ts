// Why an object URL: Blink silently drops a CSS custom property value of ~2MB or more, so publishing a
// large wallpaper as an inline data URL keeps showing the previous image (or none) with no error.
// The object URL keeps the property tiny; one entry is cached because every pane root shows the
// same global image and appearance is re-applied on every settings change.
let current: { dataUrl: string; objectUrl: string } | null = null

export function resolvePaneBackgroundImageUrl(dataUrl: string): string {
  if (current?.dataUrl === dataUrl) {
    return current.objectUrl
  }
  const objectUrl = URL.createObjectURL(dataUrlToBlob(dataUrl))
  if (current) {
    URL.revokeObjectURL(current.objectUrl)
  }
  current = { dataUrl, objectUrl }
  return objectUrl
}

// Settings only ever hold base64 raster data URLs (normalizeTerminalBackgroundImage enforces it).
function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  const mimeType = dataUrl.slice('data:'.length, comma).split(';')[0]
  const binary = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

export function resetPaneBackgroundImageUrlCacheForTest(): void {
  current = null
}
