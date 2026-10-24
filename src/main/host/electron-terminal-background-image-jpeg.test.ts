import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createFromBuffer } = vi.hoisted(() => ({ createFromBuffer: vi.fn() }))
vi.mock('electron', () => ({ nativeImage: { createFromBuffer } }))

import { encodeTerminalBackgroundImageJpeg } from './electron-terminal-background-image-jpeg'

function fakeImage(width: number, height: number, jpeg = Buffer.from([1])) {
  const image = {
    isEmpty: () => width === 0,
    getSize: () => ({ width, height }),
    resize: vi.fn((size: { width: number; height: number }) =>
      fakeImage(size.width, size.height, jpeg)
    ),
    toJPEG: vi.fn(() => jpeg)
  }
  return image
}

describe('encodeTerminalBackgroundImageJpeg', () => {
  beforeEach(() => createFromBuffer.mockReset())

  it('scales the long edge down to the limit, keeping the aspect ratio', () => {
    const image = fakeImage(3097, 2065)
    createFromBuffer.mockReturnValue(image)

    expect(encodeTerminalBackgroundImageJpeg(new Uint8Array([9]), 2560, 88)).toEqual(
      Buffer.from([1])
    )
    expect(image.resize).toHaveBeenCalledWith({ width: 2560, height: 1707, quality: 'best' })
  })

  it('never upscales a small image and passes the quality through', () => {
    const image = fakeImage(1920, 1080)
    createFromBuffer.mockReturnValue(image)

    encodeTerminalBackgroundImageJpeg(new Uint8Array([9]), 2560, 88)
    expect(image.resize).not.toHaveBeenCalled()
    expect(image.toJPEG).toHaveBeenCalledWith(88)
  })

  it('answers null for bytes the decoder cannot read', () => {
    createFromBuffer.mockReturnValue(fakeImage(0, 0))
    expect(encodeTerminalBackgroundImageJpeg(new Uint8Array([9]), 2560, 88)).toBeNull()
  })

  it('answers null when the encoder produces no bytes', () => {
    createFromBuffer.mockReturnValue(fakeImage(800, 600, Buffer.alloc(0)))
    expect(encodeTerminalBackgroundImageJpeg(new Uint8Array([9]), 2560, 88)).toBeNull()
  })
})
