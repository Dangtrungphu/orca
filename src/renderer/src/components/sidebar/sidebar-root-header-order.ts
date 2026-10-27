import {
  computeWorktreeSidebarHeaderDropPreview,
  type WorktreeSidebarHeaderDragRect,
  type WorktreeSidebarHeaderDropPreview
} from './worktree-sidebar-header-drop-preview'
import {
  getProjectHeaderDragBucketKey,
  measureProjectHeaderDragRects,
  UNGROUPED_PROJECT_HEADER_BUCKET
} from './project-header-drop'
import {
  getProjectGroupHeaderDragBucketKey,
  mapSidebarProjectGroupDropIndexToSiblingInsertIndex,
  measureProjectGroupHeaderDragRects,
  ROOT_PROJECT_GROUP_HEADER_BUCKET
} from './project-group-header-drop'
import type { GroupHeaderRow, Row } from '../../../../shared/sidebar-list/row-types'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'

// Root Project Groups and ungrouped projects share one manual rank space (group tabOrder,
// project projectGroupOrder), so their headers drag as a single list.

export type SidebarRootEntry = { kind: 'group'; id: string } | { kind: 'repo'; id: string }

export type SidebarRootHeaderRect = WorktreeSidebarHeaderDragRect & { key: string }

export type SidebarRootDrop = {
  draggedKey: string
  sidebarDropIndex: number
  rootEntryKeys: readonly string[]
}

export type SidebarRootDragSession = {
  draggedKey: string
  entryKeys: readonly string[]
  rects: SidebarRootHeaderRect[]
}

export type SidebarRootDragOptions = {
  entryKeys: readonly string[]
  onCommit: (drop: SidebarRootDrop) => void
}

export type SidebarRootOrderUpdate =
  | { kind: 'group'; groupId: string; tabOrder: number }
  | { kind: 'repo'; repo: Repo; order: number }

const SIDEBAR_ROOT_RANK_STEP = 1000

export function getSidebarRootRepoKey(repoId: string): string {
  return `repo:${repoId}`
}

export function getSidebarRootGroupKey(groupId: string): string {
  return `group:${groupId}`
}

export function parseSidebarRootEntryKey(key: string): SidebarRootEntry | null {
  if (key.startsWith('repo:')) {
    return { kind: 'repo', id: key.slice('repo:'.length) }
  }
  if (key.startsWith('group:')) {
    return { kind: 'group', id: key.slice('group:'.length) }
  }
  return null
}

function isConcreteProjectGroup(
  projectGroup: GroupHeaderRow['projectGroup']
): projectGroup is ProjectGroup {
  return typeof projectGroup?.id === 'string'
}

export function getSidebarRootEntryKeyForHeaderRow(
  row: GroupHeaderRow,
  projectGroupById: ReadonlyMap<string, ProjectGroup>
): string | null {
  if (row.repo) {
    return getProjectHeaderDragBucketKey(row.repo) === UNGROUPED_PROJECT_HEADER_BUCKET
      ? getSidebarRootRepoKey(row.repo.id)
      : null
  }
  if (!isConcreteProjectGroup(row.projectGroup)) {
    return null
  }
  return getProjectGroupHeaderDragBucketKey(row.projectGroup, projectGroupById) ===
    ROOT_PROJECT_GROUP_HEADER_BUCKET
    ? getSidebarRootGroupKey(row.projectGroup.id)
    : null
}

export function getSidebarOrderedRootEntryKeys(
  rows: readonly Row[],
  projectGroupById: ReadonlyMap<string, ProjectGroup>
): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (row.type !== 'header') {
      continue
    }
    const key = getSidebarRootEntryKeyForHeaderRow(row, projectGroupById)
    // Why: host twins of one project render separate headers but move as one entry.
    if (key && !seen.has(key)) {
      seen.add(key)
      keys.push(key)
    }
  }
  return keys
}

export function measureSidebarRootHeaderRects(
  container: HTMLElement,
  rootEntryKeys: readonly string[]
): SidebarRootHeaderRect[] {
  const indexByKey = new Map(rootEntryKeys.map((key, index) => [key, index]))
  const rects: SidebarRootHeaderRect[] = []
  const push = (key: string, rect: WorktreeSidebarHeaderDragRect): void => {
    const headerIndex = indexByKey.get(key)
    if (headerIndex !== undefined) {
      rects.push({ ...rect, key, headerIndex })
    }
  }
  for (const rect of measureProjectHeaderDragRects(container, UNGROUPED_PROJECT_HEADER_BUCKET)) {
    push(getSidebarRootRepoKey(rect.repoId), rect)
  }
  for (const rect of measureProjectGroupHeaderDragRects(
    container,
    ROOT_PROJECT_GROUP_HEADER_BUCKET
  )) {
    push(getSidebarRootGroupKey(rect.groupId), rect)
  }
  rects.sort((left, right) => left.top - right.top)
  return rects
}

/** Null unless the header sits at the root and has another root entry to move around. */
export function createSidebarRootDragSession(args: {
  container: HTMLElement
  draggedKey: string
  isRootHeader: boolean
  options: SidebarRootDragOptions | null | undefined
}): SidebarRootDragSession | null {
  const entryKeys = args.options?.entryKeys
  if (!args.isRootHeader || !entryKeys || entryKeys.length <= 1) {
    return null
  }
  return {
    draggedKey: args.draggedKey,
    entryKeys,
    rects: measureSidebarRootHeaderRects(args.container, entryKeys)
  }
}

export function refreshSidebarRootDragRects(
  container: HTMLElement,
  session: SidebarRootDragSession
): void {
  session.rects = measureSidebarRootHeaderRects(container, session.entryKeys)
}

export function computeSidebarRootDropPreview(
  pointerY: number,
  container: HTMLElement,
  session: SidebarRootDragSession
): WorktreeSidebarHeaderDropPreview | null {
  return computeWorktreeSidebarHeaderDropPreview({
    pointerY,
    containerTop: container.getBoundingClientRect().top,
    scrollTop: container.scrollTop,
    rects: session.rects,
    headerCount: session.entryKeys.length,
    getId: (rect) => rect.key,
    contentBottom: container.scrollHeight
  })
}

export function toSidebarRootDrop(
  session: SidebarRootDragSession,
  sidebarDropIndex: number
): SidebarRootDrop {
  return { draggedKey: session.draggedKey, sidebarDropIndex, rootEntryKeys: session.entryKeys }
}

export function getSidebarRootOrderUpdatesForDrop(args: {
  drop: SidebarRootDrop
  projectGroupById: ReadonlyMap<string, ProjectGroup>
  repoById: ReadonlyMap<string, Repo>
}): SidebarRootOrderUpdate[] {
  const { draggedKey, sidebarDropIndex, rootEntryKeys } = args.drop
  const sourceIndex = rootEntryKeys.indexOf(draggedKey)
  if (sourceIndex === -1) {
    return []
  }
  const siblingKeys = rootEntryKeys.filter((key) => key !== draggedKey)
  const siblingDropIndex = mapSidebarProjectGroupDropIndexToSiblingInsertIndex({
    sidebarDropIndex,
    sourceIndex,
    siblingCount: siblingKeys.length
  })
  if (siblingDropIndex === Math.min(sourceIndex, siblingKeys.length)) {
    return []
  }
  const orderedKeys = siblingKeys.slice()
  orderedKeys.splice(siblingDropIndex, 0, draggedKey)

  // Why renumber every entry: legacy group tabOrders (0, 1, …) and project ranks (index × 1000)
  // collide, so a midpoint between two neighbours is not always free.
  const updates: SidebarRootOrderUpdate[] = []
  for (const [index, key] of orderedKeys.entries()) {
    const entry = parseSidebarRootEntryKey(key)
    const rank = index * SIDEBAR_ROOT_RANK_STEP
    if (entry?.kind === 'group') {
      const group = args.projectGroupById.get(entry.id)
      if (group && group.tabOrder !== rank) {
        updates.push({ kind: 'group', groupId: entry.id, tabOrder: rank })
      }
    } else if (entry?.kind === 'repo') {
      const repo = args.repoById.get(entry.id)
      if (repo && repo.projectGroupOrder !== rank) {
        updates.push({ kind: 'repo', repo, order: rank })
      }
    }
  }
  return updates
}
