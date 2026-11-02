import React from 'react'
import { useAppStore } from '../../store'
import type { ClaudeManagedAccount } from '../../../../shared/managed-account-types'
import type { ProviderRateLimits } from '../../../../shared/rate-limit-types'
import type { StatusBarUsageMode } from '../../../../shared/status-bar-usage-mode'
import type { UsagePercentageDisplay } from '../../../../shared/usage-percentage-display'
import { ProviderSegment } from './StatusBarProviderSegment'
import { claudeAccountLabel, getClaudeSiblingAccountUsage } from './claude-account-usage-chips'

const NO_SAVED_ACCOUNTS: readonly ClaudeManagedAccount[] = []

/** The Claude chip, followed by every other Claude login of the same runtime. */
export function ClaudeAccountsUsageSegment({
  p,
  compact,
  display,
  mode
}: {
  p: ProviderRateLimits
  compact: boolean
  display: UsagePercentageDisplay
  mode: StatusBarUsageMode
}): React.JSX.Element {
  const inactive = useAppStore((s) => s.rateLimits.inactiveClaudeAccounts)
  const target = useAppStore((s) => s.rateLimits.claudeTarget)
  const savedAccounts = useAppStore((s) => s.settings?.claudeManagedAccounts ?? NO_SAVED_ACCOUNTS)
  const siblings = getClaudeSiblingAccountUsage({ active: p, inactive, target, savedAccounts })

  if (siblings.length === 0) {
    return <ProviderSegment p={p} compact={compact} display={display} mode={mode} />
  }
  return (
    <span className="inline-flex items-center gap-2">
      <ProviderSegment
        p={p}
        compact={compact}
        display={display}
        mode={mode}
        accountLabel={claudeAccountLabel(p.usageMetadata?.accountEmail)}
      />
      {siblings.map((sibling) => (
        <React.Fragment key={sibling.key}>
          <span aria-hidden className="text-muted-foreground/60">
            │
          </span>
          <ProviderSegment
            p={sibling.limits}
            compact={compact}
            display={display}
            mode={mode}
            accountLabel={sibling.label}
            secondary
          />
        </React.Fragment>
      ))}
    </span>
  )
}
