import { isTuiAgent, TUI_AGENT_CONFIG } from '../../../../shared/tui-agent-config'
import { resolveCommittedTitleAgentType } from '../../lib/pane-agent-evidence'
import type { PaneForegroundAgentEntry } from '@/store/slices/pane-foreground-agent'

// Why: Claude Code inserts a newline on LF (Ctrl+J) but not on CSI 13;5u, and LF is what
// Windows Terminal sends for Ctrl+Enter, so these agents get LF instead of a submit.
const CTRL_ENTER_LINE_FEED_AGENTS: ReadonlySet<string> = new Set(['claude', 'claude-agent-teams'])

type CtrlEnterPaneState = {
  paneForegroundAgentByPaneKey: Record<string, PaneForegroundAgentEntry | undefined>
}

/** The pane's Ctrl+Enter encoding, from trusted foreground evidence or a matching committed title. */
function resolveCtrlEnterEncodingForPane(
  state: CtrlEnterPaneState,
  paneKey: string,
  terminalTitle?: string
): 'csi-u' | 'line-feed' | undefined {
  const foreground = state.paneForegroundAgentByPaneKey[paneKey]
  if (foreground?.shellForeground === true || foreground?.routingRevoked === true) {
    return undefined
  }
  const titleAgent = terminalTitle ? resolveCommittedTitleAgentType(terminalTitle) : null
  const agent =
    foreground?.routingTrusted === true
      ? foreground.agent
      : foreground?.agent != null && foreground.agent !== titleAgent
        ? null
        : titleAgent
  if (agent && CTRL_ENTER_LINE_FEED_AGENTS.has(agent)) {
    return 'line-feed'
  }
  return isTuiAgent(agent) ? TUI_AGENT_CONFIG[agent].ctrlEnterEncoding : undefined
}

/** Resolves pane-scoped authority for query-only CSI-u consumers such as Droid and Grok. */
export function hasCtrlEnterCsiUAuthorityForPane(
  state: CtrlEnterPaneState,
  paneKey: string,
  terminalTitle?: string
): boolean {
  return resolveCtrlEnterEncodingForPane(state, paneKey, terminalTitle) === 'csi-u'
}

/** Whether the pane's foreground agent (Claude Code) wants Ctrl+Enter as LF, the newline chord. */
export function prefersCtrlEnterLineFeedForPane(
  state: CtrlEnterPaneState,
  paneKey: string,
  terminalTitle?: string
): boolean {
  return resolveCtrlEnterEncodingForPane(state, paneKey, terminalTitle) === 'line-feed'
}
