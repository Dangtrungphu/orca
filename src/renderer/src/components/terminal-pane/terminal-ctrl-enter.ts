import type { AgentType } from '../../../../shared/agent-status-types'
import { isTuiAgent, TUI_AGENT_CONFIG } from '../../../../shared/tui-agent-config'
import { resolveCommittedTitleAgentType } from '../../lib/pane-agent-evidence'
import type { PaneForegroundAgentEntry } from '@/store/slices/pane-foreground-agent'

// Why: Claude Code inserts a newline on LF (Ctrl+J) but not on CSI 13;5u, and LF is what
// Windows Terminal sends for Ctrl+Enter, so these agents get LF instead of a submit.
const CTRL_ENTER_LINE_FEED_AGENTS: ReadonlySet<string> = new Set(['claude', 'claude-agent-teams'])

type CtrlEnterPaneState = {
  paneForegroundAgentByPaneKey: Record<string, PaneForegroundAgentEntry | undefined>
  agentStatusByPaneKey?: Record<string, { agentType?: AgentType } | undefined>
}

/** The pane's Ctrl+Enter encoding, from trusted foreground evidence, a matching committed title, or
 *  (LF agents only) the pane's own hook row. */
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
  // Why: in WSL panes the host reads the foreground as wsl.exe and Claude's idle title is
  // "✳ <task>", which is not identity, so its SessionStart/Stop hook row is the only evidence left.
  // Hooks pick LF only, never CSI-u: a wrong LF acts like Enter, as it does in Windows Terminal.
  const hookAgent = agent ? undefined : state.agentStatusByPaneKey?.[paneKey]?.agentType
  if (
    hookAgent &&
    CTRL_ENTER_LINE_FEED_AGENTS.has(hookAgent) &&
    (foreground?.agent == null || foreground.agent === hookAgent)
  ) {
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
