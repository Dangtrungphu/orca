import { dialog } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import {
  MAX_TERMINAL_BACKGROUND_IMAGE_SOURCE_BYTES,
  MAX_TERMINAL_BACKGROUND_IMAGE_UPLOAD_BYTES,
  TERMINAL_BACKGROUND_IMAGE_DOWNSCALE_JPEG_QUALITY,
  TERMINAL_BACKGROUND_IMAGE_DOWNSCALE_MAX_EDGE,
  TERMINAL_BACKGROUND_IMAGE_MIME_TYPES
} from '../../shared/terminal-background-image'
import { encodeTerminalBackgroundImageJpeg } from '../host/electron-terminal-background-image-jpeg'

/** Native dialog → inline data URL; a pick over the inline cap is downscaled to a JPEG rather than refused. */
export async function pickTerminalBackgroundImage(): Promise<{
  dataUrl: string
  fileName: string
} | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Background images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const filePath = result.filePaths[0]
  const mimeType = TERMINAL_BACKGROUND_IMAGE_MIME_TYPES[extname(filePath).toLowerCase()]
  if (!mimeType) {
    throw new Error('Terminal background images must be PNG, JPEG, WebP, or GIF files.')
  }

  const stats = await stat(filePath)
  if (stats.size > MAX_TERMINAL_BACKGROUND_IMAGE_SOURCE_BYTES) {
    throw new Error('Terminal background image must be 64MB or smaller.')
  }

  const buffer = await readFile(filePath)
  if (buffer.byteLength <= MAX_TERMINAL_BACKGROUND_IMAGE_UPLOAD_BYTES) {
    return {
      dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
      fileName: basename(filePath)
    }
  }

  const jpeg = encodeTerminalBackgroundImageJpeg(
    buffer,
    TERMINAL_BACKGROUND_IMAGE_DOWNSCALE_MAX_EDGE,
    TERMINAL_BACKGROUND_IMAGE_DOWNSCALE_JPEG_QUALITY
  )
  if (!jpeg || jpeg.byteLength > MAX_TERMINAL_BACKGROUND_IMAGE_UPLOAD_BYTES) {
    throw new Error('Terminal background image is too large and could not be downscaled.')
  }
  return {
    dataUrl: `data:image/jpeg;base64,${Buffer.from(jpeg).toString('base64')}`,
    fileName: basename(filePath)
  }
}
