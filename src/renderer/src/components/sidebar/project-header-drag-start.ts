import type { PointerEvent } from 'react'

import {
  getProjectHeaderDragBucketKey,
  measureProjectHeaderDragRects,
  type ProjectHeaderDragBucketKey,
  UNGROUPED_PROJECT_HEADER_BUCKET
} from './project-header-drop'
import {
  createSidebarRootDragSession,
  getSidebarRootRepoKey,
  type SidebarRootDragOptions
} from './sidebar-root-header-order'
import {
  isProjectHeaderDragHandleTarget,
  isRepoHeaderActionTarget,
  type ProjectHeaderDragSession
} from './project-header-drag-contract'
import type { Repo } from '../../../../shared/repo-types'

export function createProjectHeaderDragSession(args: {
  event: PointerEvent<HTMLElement>
  repo: Repo
  sidebarRepoHeaderIdsByBucket: ReadonlyMap<ProjectHeaderDragBucketKey, readonly string[]>
  sidebarRoot?: SidebarRootDragOptions | null
  getScrollContainer: () => HTMLElement | null
}): ProjectHeaderDragSession | null {
  if (args.event.button !== 0) {
    return null
  }
  if (!isProjectHeaderDragHandleTarget(args.event.target, args.event.currentTarget)) {
    return null
  }
  if (isRepoHeaderActionTarget(args.event.target, args.event.currentTarget)) {
    return null
  }
  const bucketKey = getProjectHeaderDragBucketKey(args.repo)
  const sidebarRepoHeaderIds = args.sidebarRepoHeaderIdsByBucket.get(bucketKey) ?? []
  const container = args.getScrollContainer()
  if (!container) {
    return null
  }
  const root = createSidebarRootDragSession({
    container,
    draggedKey: getSidebarRootRepoKey(args.repo.id),
    isRootHeader: bucketKey === UNGROUPED_PROJECT_HEADER_BUCKET,
    options: args.sidebarRoot
  })
  // Why: a single project in its bucket has nowhere to land, so skip arming
  // drag and let the header click toggle collapse instead.
  if (!root && sidebarRepoHeaderIds.length <= 1) {
    return null
  }
  const handleEl = args.event.currentTarget
  // Why: defer setPointerCapture until the drag threshold is crossed so a
  // header click still reaches the inner collapse handler on pointerup.
  return {
    repo: args.repo,
    bucketKey,
    sidebarRepoHeaderIds,
    pointerId: args.event.pointerId,
    headerRects: measureProjectHeaderDragRects(container, bucketKey),
    handleEl,
    startX: args.event.clientX,
    startY: args.event.clientY,
    latestPointerY: args.event.clientY,
    promoted: false,
    root
  }
}
