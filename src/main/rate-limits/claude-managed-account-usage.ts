import type { ProviderRateLimits } from '../../shared/rate-limit-types'
import {
  getClaudeProfileRouter,
  getClaudeWslProfileRouter
} from '../claude-accounts/claude-profile-installed-router'
import { toWindowsWslPath } from '../../shared/wsl-paths'
import type { ClaudeManagedAccountUsageOptions } from './claude-usage-fetch-options'
import { fetchActiveClaudeRateLimits } from './claude-active-usage-fetch'
import { claudeUsageUnavailable, makeClaudeUsageResult } from './claude-usage-result'
import { filterPathsToRunningWslDistrosAsync } from '../wsl-running-path-filter'

/** Usage reads the account's own folder; a host account's comes from its id, never a stored path. */
export type InactiveClaudeAccount = {
  id: string
  /** System default's own login, read while a saved account is selected in its runtime. */
  systemDefault?: boolean
  managedAuthRuntime?: 'host' | 'wsl'
  wslDistro?: string | null
  wslLinuxAuthPath?: string | null
}

export async function fetchInactiveClaudeAccountUsage(
  account: InactiveClaudeAccount,
  options: ClaudeManagedAccountUsageOptions = {}
): Promise<ProviderRateLimits> {
  if (account.managedAuthRuntime !== 'wsl') {
    const hostRouter = getClaudeProfileRouter()
    // Why the router: a covered account's usage is System default's, as its launches are.
    const authPreparation = account.systemDefault
      ? hostRouter?.systemDefaultUsagePreparation()
      : hostRouter?.accountUsagePreparation(account.id)
    return authPreparation
      ? fetchActiveClaudeRateLimits({ signal: options.signal, authPreparation })
      : signInAgain()
  }
  const distro = account.wslDistro
  const router = getClaudeWslProfileRouter()
  if (!distro || !router) {
    return signInAgain()
  }
  // Why: a stopped distro parks a UNC read for minutes, and the inactive loop is sequential.
  const guestRoot = toWindowsWslPath('/', distro)
  if (
    (await filterPathsToRunningWslDistrosAsync([guestRoot], { requireConfirmed: true })).length ===
    0
  ) {
    return claudeUsageUnavailable()
  }
  const timeout = AbortSignal.timeout(INACTIVE_WSL_READ_TIMEOUT_MS)
  const preparation = account.systemDefault
    ? router.systemDefaultUsagePreparation(distro)
    : router.accountUsagePreparation(distro, account.id)
  const read = preparation
    .then((authPreparation) =>
      fetchActiveClaudeRateLimits({ signal: options.signal, authPreparation })
    )
    .catch(() => claudeUsageUnavailable())
  return Promise.race([
    read,
    new Promise<ProviderRateLimits>((resolve) =>
      timeout.addEventListener('abort', () => resolve(claudeUsageUnavailable()), { once: true })
    )
  ])
}

function signInAgain(): ProviderRateLimits {
  return makeClaudeUsageResult('error', 'Sign in again to use this account.', {
    failureKind: 'missing-credentials',
    attemptedSources: []
  })
}

const INACTIVE_WSL_READ_TIMEOUT_MS = 10_000
