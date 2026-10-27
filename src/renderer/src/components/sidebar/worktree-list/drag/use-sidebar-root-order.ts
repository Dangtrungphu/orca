import { useCallback, useMemo } from 'react'
import type { ProjectGroup } from '../../../../../../shared/project-group-types'
import type { Repo } from '../../../../../../shared/repo-types'
import type { HostSectionRow } from '../../../../../../shared/sidebar-list/host-section-rows'
import type { Row } from '../../../../../../shared/sidebar-list/row-types'
import type { RenderRow } from '../listing/render-row'
import { getSidebarRootSectionEndByKey } from '../../worktree-header-section-boundaries'
import {
  getSidebarOrderedRootEntryKeys,
  getSidebarRootEntryKeyForHeaderRow,
  getSidebarRootOrderUpdatesForDrop,
  parseSidebarRootEntryKey,
  type SidebarRootDragOptions,
  type SidebarRootDrop
} from '../../sidebar-root-header-order'

// Root Project Groups and ungrouped projects as one draggable list, plus the section ends their
// drop indicators need once the two kinds interleave.
export function useSidebarRootOrder(args: {
  enabled: boolean
  rows: HostSectionRow[]
  renderRows: readonly RenderRow[]
  firstHeaderIndex: number
  projectGroupById: ReadonlyMap<string, ProjectGroup>
  repoById: ReadonlyMap<string, Repo>
  beforeCommit: () => void
  onCommitGroupTabOrder: (groupId: string, tabOrder: number) => void
  onCommitProjectOrder: (project: Repo, projectGroupId: string | null, order: number) => void
}) {
  const {
    enabled,
    rows,
    renderRows,
    firstHeaderIndex,
    projectGroupById,
    repoById,
    beforeCommit,
    onCommitGroupTabOrder,
    onCommitProjectOrder
  } = args
  // Why no host sections: each host section orders its own root, so one shared list would cross them.
  const usesRootOrder = enabled && !rows.some((row) => row.type === 'host-header')
  const entryKeys = useMemo(
    () =>
      usesRootOrder
        ? getSidebarOrderedRootEntryKeys(
            rows.filter((row): row is Row => row.type !== 'host-header'),
            projectGroupById
          )
        : null,
    [projectGroupById, rows, usesRootOrder]
  )
  const onCommit = useCallback(
    (drop: SidebarRootDrop) => {
      const updates = getSidebarRootOrderUpdatesForDrop({ drop, projectGroupById, repoById })
      if (updates.length === 0) {
        return
      }
      beforeCommit()
      for (const update of updates) {
        if (update.kind === 'group') {
          onCommitGroupTabOrder(update.groupId, update.tabOrder)
        } else {
          onCommitProjectOrder(update.repo, null, update.order)
        }
      }
    },
    [beforeCommit, onCommitGroupTabOrder, onCommitProjectOrder, projectGroupById, repoById]
  )
  const sidebarRoot = useMemo<SidebarRootDragOptions | null>(
    () => (entryKeys ? { entryKeys, onCommit } : null),
    [entryKeys, onCommit]
  )
  const draggableEntryKeys = useMemo(
    () => (entryKeys && entryKeys.length > 1 ? new Set(entryKeys) : null),
    [entryKeys]
  )
  const sectionEndByKey = useMemo(
    () =>
      entryKeys
        ? getSidebarRootSectionEndByKey({
            rows: renderRows,
            firstHeaderIndex,
            rootEntryKeys: entryKeys,
            keyOfHeader: (row) => getSidebarRootEntryKeyForHeaderRow(row, projectGroupById)
          })
        : null,
    [entryKeys, firstHeaderIndex, projectGroupById, renderRows]
  )
  return { sidebarRoot, draggableEntryKeys, sectionEndByKey }
}

export function applySidebarRootSectionEnds(
  sectionEndById: Map<string, number>,
  rootSectionEndByKey: ReadonlyMap<string, number> | null,
  kind: 'group' | 'repo'
): Map<string, number> {
  for (const [key, sectionEnd] of rootSectionEndByKey ?? []) {
    const entry = parseSidebarRootEntryKey(key)
    if (entry?.kind === kind) {
      sectionEndById.set(entry.id, sectionEnd)
    }
  }
  return sectionEndById
}
