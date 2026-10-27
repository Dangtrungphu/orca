import type { PointerEvent } from 'react'

import {
  getProjectGroupHeaderDragBucketKey,
  measureProjectGroupHeaderDragRects,
  ROOT_PROJECT_GROUP_HEADER_BUCKET,
  type ProjectGroupHeaderDragBucketKey
} from './project-group-header-drop'
import {
  createSidebarRootDragSession,
  getSidebarRootGroupKey,
  type SidebarRootDragOptions
} from './sidebar-root-header-order'
import {
  isProjectGroupHeaderActionTarget,
  isProjectGroupHeaderDragHandleTarget,
  type ProjectGroupHeaderDragSession
} from './project-group-header-drag-contract'
import type { ProjectGroup } from '../../../../shared/project-group-types'

export function createProjectGroupHeaderDragSession(args: {
  event: PointerEvent<HTMLElement>
  groupId: string
  projectGroupById: ReadonlyMap<string, ProjectGroup>
  sidebarProjectGroupHeaderIdsByBucket: ReadonlyMap<
    ProjectGroupHeaderDragBucketKey,
    readonly string[]
  >
  sidebarRoot?: SidebarRootDragOptions | null
  getScrollContainer: () => HTMLElement | null
}): ProjectGroupHeaderDragSession | null {
  if (args.event.button !== 0) {
    return null
  }
  if (!isProjectGroupHeaderDragHandleTarget(args.event.target, args.event.currentTarget)) {
    return null
  }
  if (isProjectGroupHeaderActionTarget(args.event.target, args.event.currentTarget)) {
    return null
  }
  const group = args.projectGroupById.get(args.groupId)
  if (!group) {
    return null
  }
  const bucketKey = getProjectGroupHeaderDragBucketKey(group, args.projectGroupById)
  const sidebarProjectGroupHeaderIds =
    args.sidebarProjectGroupHeaderIdsByBucket.get(bucketKey) ?? []
  const container = args.getScrollContainer()
  if (!container) {
    return null
  }
  const root = createSidebarRootDragSession({
    container,
    draggedKey: getSidebarRootGroupKey(args.groupId),
    isRootHeader: bucketKey === ROOT_PROJECT_GROUP_HEADER_BUCKET,
    options: args.sidebarRoot
  })
  // Why: a lone group in a parent bucket cannot move without reparenting.
  if (!root && sidebarProjectGroupHeaderIds.length <= 1) {
    return null
  }
  const handleEl = args.event.currentTarget
  // Why: defer pointer capture until the threshold so ordinary group header
  // clicks still toggle collapse through the row handler.
  return {
    groupId: args.groupId,
    bucketKey,
    sidebarProjectGroupHeaderIds,
    pointerId: args.event.pointerId,
    headerRects: measureProjectGroupHeaderDragRects(container, bucketKey),
    handleEl,
    startX: args.event.clientX,
    startY: args.event.clientY,
    latestPointerY: args.event.clientY,
    promoted: false,
    root
  }
}
