import type { ClaudeManagedAccount } from '../../../../shared/managed-account-types'
import type {
  InactiveAccountUsage,
  ProviderRateLimits,
  RateLimitRuntimeTarget
} from '../../../../shared/rate-limit-types'
import { parseClaudeSystemDefaultUsageId } from '../../../../shared/claude-system-default-usage-id'

export type ClaudeAccountUsageChip = {
  key: string
  label: string | null
  limits: ProviderRateLimits
}

type SavedAccount = Pick<ClaudeManagedAccount, 'id' | 'email' | 'managedAuthRuntime' | 'wslDistro'>

/** The part before @, enough to tell a person's accounts apart in the footer. */
export function claudeAccountLabel(email: string | null | undefined): string | null {
  const trimmed = email?.trim()
  if (!trimmed) {
    return null
  }
  const at = trimmed.indexOf('@')
  return at > 0 ? trimmed.slice(0, at) : trimmed
}

/** Other Claude logins of the footer's runtime, each with usage to show beside the active one. */
export function getClaudeSiblingAccountUsage(args: {
  active: ProviderRateLimits
  inactive: readonly InactiveAccountUsage[]
  target: RateLimitRuntimeTarget
  savedAccounts: readonly SavedAccount[]
}): ClaudeAccountUsageChip[] {
  const activeEmail = foldCase(args.active.usageMetadata?.accountEmail)
  const chips: ClaudeAccountUsageChip[] = []
  for (const entry of args.inactive) {
    const limits = entry.rateLimits
    // Why skip unavailable: System default without a Claude login has no usage to show.
    if (!limits || limits.status === 'unavailable') {
      continue
    }
    const saved = args.savedAccounts.find((account) => account.id === entry.accountId)
    const scope = parseClaudeSystemDefaultUsageId(entry.accountId) ?? savedScope(saved)
    if (!scope || !isSameTarget(scope, args.target)) {
      continue
    }
    const email = limits.usageMetadata?.accountEmail ?? saved?.email
    // Why: System default can hold the same login as the selected account.
    if (activeEmail && foldCase(email) === activeEmail) {
      continue
    }
    chips.push({ key: entry.accountId, label: claudeAccountLabel(email), limits })
  }
  return chips.sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''))
}

function savedScope(account: SavedAccount | undefined): RateLimitRuntimeTarget | null {
  if (!account) {
    return null
  }
  return account.managedAuthRuntime === 'wsl'
    ? { runtime: 'wsl', wslDistro: account.wslDistro ?? null }
    : { runtime: 'host', wslDistro: null }
}

function isSameTarget(a: RateLimitRuntimeTarget, b: RateLimitRuntimeTarget): boolean {
  if (a.runtime !== b.runtime) {
    return false
  }
  return a.runtime === 'host' || foldCase(a.wslDistro) === foldCase(b.wslDistro)
}

function foldCase(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}
