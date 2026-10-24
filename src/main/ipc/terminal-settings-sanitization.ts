import type { GlobalSettings } from '../../shared/global-settings-types'
import { sanitizeTerminalBackgroundImageSettings } from '../../shared/terminal-background-image'
import { normalizeTerminalCustomThemes } from '../../shared/terminal-custom-themes'
import { normalizeTerminalLineHeight } from '../../shared/terminal-line-height-settings'
import { normalizeDesktopTerminalScrollbackRows } from '../../shared/terminal-scrollback-policy'

/** Terminal appearance fields as they may be stored: each present key is normalized, absent keys are left alone. */
export function sanitizeTerminalSettings(
  args: Partial<GlobalSettings>,
  sanitized: Partial<GlobalSettings>
): void {
  if ('terminalCustomThemes' in args) {
    sanitized.terminalCustomThemes = normalizeTerminalCustomThemes(args.terminalCustomThemes)
  }
  sanitizeTerminalBackgroundImageSettings(args, sanitized)
  if ('terminalScrollbackRows' in args) {
    sanitized.terminalScrollbackRows = normalizeDesktopTerminalScrollbackRows(
      args.terminalScrollbackRows
    )
  }
  if ('terminalLineHeight' in args) {
    sanitized.terminalLineHeight = normalizeTerminalLineHeight(args.terminalLineHeight)
  }
}
