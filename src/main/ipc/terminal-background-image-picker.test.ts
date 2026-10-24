import { beforeEach, describe, expect, it, vi } from 'vitest'

const { showOpenDialogMock, statMock, readFileMock, encodeMock } = vi.hoisted(() => ({
  showOpenDialogMock: vi.fn(),
  statMock: vi.fn(),
  readFileMock: vi.fn(),
  encodeMock: vi.fn()
}))

vi.mock('electron', () => ({ dialog: { showOpenDialog: showOpenDialogMock } }))
vi.mock('node:fs/promises', () => ({ stat: statMock, readFile: readFileMock }))
vi.mock('../host/electron-terminal-background-image-jpeg', () => ({
  encodeTerminalBackgroundImageJpeg: encodeMock
}))

import { pickTerminalBackgroundImage } from './terminal-background-image-picker'
import {
  MAX_TERMINAL_BACKGROUND_IMAGE_SOURCE_BYTES,
  MAX_TERMINAL_BACKGROUND_IMAGE_UPLOAD_BYTES,
  TERMINAL_BACKGROUND_IMAGE_DOWNSCALE_JPEG_QUALITY,
  TERMINAL_BACKGROUND_IMAGE_DOWNSCALE_MAX_EDGE
} from '../../shared/terminal-background-image'

function pick(filePath: string, size: number): void {
  showOpenDialogMock.mockResolvedValue({ canceled: false, filePaths: [filePath] })
  statMock.mockResolvedValue({ size })
  readFileMock.mockResolvedValue(Buffer.alloc(size, 7))
}

describe('pickTerminalBackgroundImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('answers null when the dialog is cancelled', async () => {
    showOpenDialogMock.mockResolvedValue({ canceled: true, filePaths: [] })
    await expect(pickTerminalBackgroundImage()).resolves.toBeNull()
    expect(statMock).not.toHaveBeenCalled()
  })

  it('inlines an image under the cap unchanged, keeping its MIME type', async () => {
    pick('/pics/wall.webp', 3)
    await expect(pickTerminalBackgroundImage()).resolves.toEqual({
      dataUrl: `data:image/webp;base64,${Buffer.alloc(3, 7).toString('base64')}`,
      fileName: 'wall.webp'
    })
    expect(encodeMock).not.toHaveBeenCalled()
  })

  it('downscales an image over the cap to a JPEG instead of refusing it', async () => {
    pick('/pics/wall.png', MAX_TERMINAL_BACKGROUND_IMAGE_UPLOAD_BYTES + 1)
    encodeMock.mockReturnValue(Buffer.from([1, 2, 3]))

    await expect(pickTerminalBackgroundImage()).resolves.toEqual({
      dataUrl: `data:image/jpeg;base64,${Buffer.from([1, 2, 3]).toString('base64')}`,
      fileName: 'wall.png'
    })
    expect(encodeMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      TERMINAL_BACKGROUND_IMAGE_DOWNSCALE_MAX_EDGE,
      TERMINAL_BACKGROUND_IMAGE_DOWNSCALE_JPEG_QUALITY
    )
  })

  it('refuses an oversized image the decoder cannot read', async () => {
    pick('/pics/wall.gif', MAX_TERMINAL_BACKGROUND_IMAGE_UPLOAD_BYTES + 1)
    encodeMock.mockReturnValue(null)
    await expect(pickTerminalBackgroundImage()).rejects.toThrow('could not be downscaled')
  })

  it('refuses a source file over the hard limit without reading it', async () => {
    showOpenDialogMock.mockResolvedValue({ canceled: false, filePaths: ['/pics/huge.png'] })
    statMock.mockResolvedValue({ size: MAX_TERMINAL_BACKGROUND_IMAGE_SOURCE_BYTES + 1 })

    await expect(pickTerminalBackgroundImage()).rejects.toThrow('64MB or smaller')
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it('refuses an unsupported extension', async () => {
    showOpenDialogMock.mockResolvedValue({ canceled: false, filePaths: ['/pics/wall.bmp'] })
    await expect(pickTerminalBackgroundImage()).rejects.toThrow('PNG, JPEG, WebP, or GIF')
  })
})
