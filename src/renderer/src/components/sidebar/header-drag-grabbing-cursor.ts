import { useEffect } from 'react'

/** Shows the grabbing cursor and blocks text selection on the page while a header drag runs. */
export function useGrabbingCursorWhileDragging(isDragging: boolean): void {
  useEffect(() => {
    if (!isDragging) {
      return
    }
    const body = document.body
    const prevCursor = body.style.cursor
    const prevUserSelect = body.style.userSelect
    body.style.cursor = 'grabbing'
    body.style.userSelect = 'none'
    return () => {
      body.style.cursor = prevCursor
      body.style.userSelect = prevUserSelect
    }
  }, [isDragging])
}
