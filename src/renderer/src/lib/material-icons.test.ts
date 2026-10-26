import { describe, expect, it } from 'vitest'
import {
  getMaterialIconUrl,
  MATERIAL_ICON_ASSOCIATIONS,
  resolveMaterialFileIcon,
  resolveMaterialFolderIcon
} from './material-icons'

describe('resolveMaterialFileIcon', () => {
  it('prefers an exact file name match', () => {
    expect(resolveMaterialFileIcon('docs/README.md')).toBe('readme')
    expect(resolveMaterialFileIcon('package.json')).toBe('nodejs')
  })

  it('uses the longest dotted suffix before the plain extension, like VS Code', () => {
    expect(resolveMaterialFileIcon('src/grading-request.service.ts')).toBe('angular-service')
    expect(resolveMaterialFileIcon('types/global.d.ts')).toBe('typescript-def')
    expect(resolveMaterialFileIcon('src/mini-feature.const.ts')).toBe('typescript')
  })

  it('falls back to the default file icon for unknown types', () => {
    expect(resolveMaterialFileIcon('notes/thing.unknownext')).toBe('file')
    expect(resolveMaterialFileIcon('LICENSE-weird-suffix-xyz')).toBe('file')
  })

  it('handles Windows separators', () => {
    expect(resolveMaterialFileIcon('C:\\repo\\index.html')).toBe('html')
  })
})

describe('resolveMaterialFolderIcon', () => {
  it('picks the closed or open variant for known folder names', () => {
    expect(resolveMaterialFolderIcon('docs', false)).toBe('folder-docs')
    expect(resolveMaterialFolderIcon('docs', true)).toBe('folder-docs-open')
  })

  it('uses the last segment of a compressed node', () => {
    expect(resolveMaterialFolderIcon('src/modules', false)).toBe('folder-plugin')
  })

  it('falls back to the default folder icons', () => {
    expect(resolveMaterialFolderIcon('m_mini-feature-luyen-ngay', false)).toBe('folder')
    expect(resolveMaterialFolderIcon('m_mini-feature-luyen-ngay', true)).toBe('folder-open')
  })
})

describe('material icon assets', () => {
  it('ships an SVG for every icon the associations reference', () => {
    const referenced = new Set([
      MATERIAL_ICON_ASSOCIATIONS.file,
      MATERIAL_ICON_ASSOCIATIONS.folder,
      MATERIAL_ICON_ASSOCIATIONS.folderExpanded,
      ...Object.values(MATERIAL_ICON_ASSOCIATIONS.fileNames),
      ...Object.values(MATERIAL_ICON_ASSOCIATIONS.fileExtensions),
      ...Object.values(MATERIAL_ICON_ASSOCIATIONS.folderNames),
      ...Object.values(MATERIAL_ICON_ASSOCIATIONS.folderNamesExpanded)
    ])
    expect([...referenced].filter((icon) => !getMaterialIconUrl(icon))).toEqual([])
  })
})
