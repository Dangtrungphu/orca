// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resetPaneBackgroundImageUrlCacheForTest,
  resolvePaneBackgroundImageUrl
} from './pane-background-image-url'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const JPEG = 'data:image/jpeg;base64,/9j/4AAQ'

describe('resolvePaneBackgroundImageUrl', () => {
  let created: Blob[]

  beforeEach(() => {
    vi.restoreAllMocks()
    resetPaneBackgroundImageUrlCacheForTest()
    created = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      created.push(blob as Blob)
      return `blob:orca/${created.length}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('turns the data URL into a short object URL with the decoded bytes and MIME type', async () => {
    expect(resolvePaneBackgroundImageUrl(PNG)).toBe('blob:orca/1')
    expect(created[0].type).toBe('image/png')
    const bytes = new Uint8Array(await created[0].arrayBuffer())
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('reuses the object URL while the image is unchanged', () => {
    resolvePaneBackgroundImageUrl(PNG)
    expect(resolvePaneBackgroundImageUrl(PNG)).toBe('blob:orca/1')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('revokes the previous object URL when the image changes', () => {
    resolvePaneBackgroundImageUrl(PNG)

    expect(resolvePaneBackgroundImageUrl(JPEG)).toBe('blob:orca/2')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:orca/1')
    expect(created[1].type).toBe('image/jpeg')
  })
})
