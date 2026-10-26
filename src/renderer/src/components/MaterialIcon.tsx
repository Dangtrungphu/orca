import { cn } from '@/lib/utils'
import { getMaterialFileIconUrl, getMaterialFolderIconUrl } from '@/lib/material-icons'

type MaterialFileIconProps = {
  filePath: string
  className?: string
}

/** Colored per-file-type icon matching VS Code's Material Icon Theme. */
export function MaterialFileIcon({
  filePath,
  className
}: MaterialFileIconProps): React.JSX.Element {
  return (
    <img
      src={getMaterialFileIconUrl(filePath)}
      alt=""
      aria-hidden
      draggable={false}
      className={cn('size-4 shrink-0 select-none', className)}
    />
  )
}

type MaterialFolderIconProps = {
  folderPath: string
  expanded: boolean
  className?: string
}

/** Colored per-folder-name icon (docs, src, components…) matching VS Code's Material Icon Theme. */
export function MaterialFolderIcon({
  folderPath,
  expanded,
  className
}: MaterialFolderIconProps): React.JSX.Element {
  return (
    <img
      src={getMaterialFolderIconUrl(folderPath, expanded)}
      alt=""
      aria-hidden
      draggable={false}
      className={cn('size-4 shrink-0 select-none', className)}
    />
  )
}
