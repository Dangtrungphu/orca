import { describe, expect, it } from 'vitest'
import { getSidebarRootOrderUpdatesForDrop } from './sidebar-root-header-order'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'

const group: ProjectGroup = {
  id: 'servers',
  name: 'Servers',
  parentPath: null,
  parentGroupId: null,
  createdFrom: 'manual',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}
const webRepo: Repo = {
  id: 'web',
  path: '/web',
  displayName: 'web',
  badgeColor: '#000',
  addedAt: 0
}
const apiRepo: Repo = { ...webRepo, id: 'api', path: '/api', displayName: 'api' }

const lookups = {
  projectGroupById: new Map([[group.id, group]]),
  repoById: new Map([
    [webRepo.id, webRepo],
    [apiRepo.id, apiRepo]
  ])
}
const rootEntryKeys = ['group:servers', 'repo:web', 'repo:api']

describe('getSidebarRootOrderUpdatesForDrop', () => {
  it('renumbers groups and ungrouped projects into one rank space', () => {
    const updates = getSidebarRootOrderUpdatesForDrop({
      drop: { draggedKey: 'group:servers', sidebarDropIndex: 2, rootEntryKeys },
      ...lookups
    })

    expect(updates).toEqual([
      { kind: 'repo', repo: webRepo, order: 0 },
      { kind: 'group', groupId: 'servers', tabOrder: 1000 },
      { kind: 'repo', repo: apiRepo, order: 2000 }
    ])
  })

  it('ignores drops on either edge of the dragged header', () => {
    for (const sidebarDropIndex of [1, 2]) {
      expect(
        getSidebarRootOrderUpdatesForDrop({
          drop: { draggedKey: 'repo:web', sidebarDropIndex, rootEntryKeys },
          ...lookups
        })
      ).toEqual([])
    }
  })
})
