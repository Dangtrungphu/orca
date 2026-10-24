import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createFromBuffer } = vi.hoisted(() => ({ createFromBuffer: vi.fn() }))
vi.mock('electron', () => ({ nativeImage: { createFromBuffer } }))

import { encodeTerminalBackgroundImage } from './electron-terminal-background-image-encode'

const OPTIONS = { maxEdges: [2560, 1920], jpegQuality: 88, maxBytes: 10 }

type FakeEncoders = { jpeg?: Buffer; png?: (width: number) => Buffer }

function fakeImage(width: number, height: number, alpha: number, encoders: FakeEncoders = {}) {
  const pixels = Buffer.alloc(Math.max(1, width * height) * 4, 200)
  for (let i = 3; i < pixels.length; i += 4) {
    pixels[i] = alpha
  }
  const image = {
    isEmpty: () => width === 0,
    getSize: () => ({ width, height }),
    toBitmap: () => pixels,
    resize: vi.fn((size: { width: number; height: number }) =>
      fakeImage(size.width, size.height, alpha, encoders)
    ),
    toJPEG: vi.fn(() => encoders.jpeg ?? Buffer.from([1])),
    toPNG: vi.fn(() => encoders.png?.(width) ?? Buffer.from([2]))
  }
  return image
}

describe('encodeTerminalBackgroundImage', () => {
  beforeEach(() => createFromBuffer.mockReset())

  it('encodes an opaque image as JPEG, scaling the long edge down and keeping the aspect ratio', () => {
    const image = fakeImage(3097, 2065, 255)
    createFromBuffer.mockReturnValue(image)

    expect(encodeTerminalBackgroundImage(new Uint8Array([9]), OPTIONS)).toEqual({
      bytes: Buffer.from([1]),
      mimeType: 'image/jpeg'
    })
    expect(image.resize).toHaveBeenCalledWith({ width: 2560, height: 1707, quality: 'best' })
  })

  it('keeps a translucent image as PNG so it is not flattened onto black', () => {
    const image = fakeImage(3097, 2065, 153)
    createFromBuffer.mockReturnValue(image)

    expect(encodeTerminalBackgroundImage(new Uint8Array([9]), OPTIONS)).toEqual({
      bytes: Buffer.from([2]),
      mimeType: 'image/png'
    })
    expect(image.toJPEG).not.toHaveBeenCalled()
  })

  it('falls back to the next edge limit when the encoding is still over the byte cap', () => {
    const png = (width: number) => (width > 1920 ? Buffer.alloc(11) : Buffer.alloc(5))
    const image = fakeImage(3097, 2065, 153, { png })
    createFromBuffer.mockReturnValue(image)

    expect(encodeTerminalBackgroundImage(new Uint8Array([9]), OPTIONS)).toEqual({
      bytes: Buffer.alloc(5),
      mimeType: 'image/png'
    })
    expect(image.resize).toHaveBeenLastCalledWith({ width: 1920, height: 1280, quality: 'best' })
  })

  it('never upscales a small image', () => {
    const image = fakeImage(1280, 720, 255)
    createFromBuffer.mockReturnValue(image)

    encodeTerminalBackgroundImage(new Uint8Array([9]), OPTIONS)
    expect(image.resize).not.toHaveBeenCalled()
    expect(image.toJPEG).toHaveBeenCalledWith(88)
  })

  it('answers null when no edge limit fits the byte cap', () => {
    createFromBuffer.mockReturnValue(fakeImage(3097, 2065, 255, { jpeg: Buffer.alloc(11) }))
    expect(encodeTerminalBackgroundImage(new Uint8Array([9]), OPTIONS)).toBeNull()
  })

  it('answers null for bytes the decoder cannot read', () => {
    createFromBuffer.mockReturnValue(fakeImage(0, 0, 255))
    expect(encodeTerminalBackgroundImage(new Uint8Array([9]), OPTIONS)).toBeNull()
  })
})
