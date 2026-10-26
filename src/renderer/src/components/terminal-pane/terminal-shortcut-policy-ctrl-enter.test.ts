import { describe, expect, it } from 'vitest'
import {
  resolveTerminalShortcutAction,
  type TerminalShortcutEvent
} from './terminal-shortcut-policy'

const CTRL_ENTER: TerminalShortcutEvent = {
  key: 'Enter',
  code: 'Enter',
  metaKey: false,
  ctrlKey: true,
  altKey: false,
  shiftKey: false,
  repeat: false
}

function resolveCtrlEnter(prefersLineFeed: boolean, kittyActive: boolean, localConpty: boolean) {
  return resolveTerminalShortcutAction(
    CTRL_ENTER,
    false,
    'false',
    0,
    true,
    undefined,
    () => localConpty,
    () => (kittyActive ? 1 : 0),
    undefined,
    undefined,
    () => true,
    'orca-first',
    () => false,
    undefined,
    () => prefersLineFeed
  )
}

describe('Ctrl+Enter line feed', () => {
  it('sends LF when the foreground agent reads it as a newline, whatever the pane negotiated', () => {
    for (const kittyActive of [false, true]) {
      for (const localConpty of [false, true]) {
        expect(resolveCtrlEnter(true, kittyActive, localConpty)).toEqual({
          type: 'sendInput',
          data: '\n'
        })
      }
    }
  })

  it('keeps the existing CSI-u and CR encodings for every other pane', () => {
    expect(resolveCtrlEnter(false, false, false)).toEqual({
      type: 'sendInput',
      data: '\x1b[13;5u'
    })
    expect(resolveCtrlEnter(false, false, true)).toEqual({ type: 'sendInput', data: '\r' })
    expect(resolveCtrlEnter(false, true, true)).toEqual({
      type: 'sendInput',
      data: '\x1b[13;5u'
    })
  })
})
