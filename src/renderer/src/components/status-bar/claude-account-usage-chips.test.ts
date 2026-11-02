import { describe, expect, it } from 'vitest'
import type { InactiveAccountUsage, ProviderRateLimits } from '../../../../shared/rate-limit-types'
import { getClaudeSiblingAccountUsage } from './claude-account-usage-chips'

function usage(accountEmail?: string, status: ProviderRateLimits['status'] = 'ok') {
  return {
    provider: 'claude',
    session: null,
    weekly: { usedPercent: 40, windowMinutes: 10080, resetsAt: null, resetDescription: null },
    updatedAt: 1,
    error: null,
    status,
    usageMetadata: accountEmail ? { accountEmail } : undefined
  } satisfies ProviderRateLimits
}

function entry(accountId: string, rateLimits: ProviderRateLimits | null): InactiveAccountUsage {
  return { accountId, rateLimits, updatedAt: 1, isFetching: false }
}

const wsl = { runtime: 'wsl', wslDistro: 'Ubuntu-22.04' } as const
const saved = [
  { id: 'gmail', email: 'dang@gmail.com', managedAuthRuntime: 'wsl', wslDistro: 'Ubuntu-22.04' },
  { id: 'host-acc', email: 'host@x.com', managedAuthRuntime: 'host' }
] as const

describe('getClaudeSiblingAccountUsage', () => {
  it('keeps accounts of the footer runtime, labelled by the part before @', () => {
    const chips = getClaudeSiblingAccountUsage({
      active: usage('work@eduzaa.com'),
      inactive: [
        entry('gmail', usage()),
        entry('host-acc', usage()),
        entry('system-default:wsl:ubuntu-22.04', usage('other@eduzaa.com'))
      ],
      target: wsl,
      savedAccounts: saved
    })
    expect(chips.map((chip) => chip.label)).toEqual(['dang', 'other'])
  })

  it('drops System default when it holds the active login or no Claude login', () => {
    const chips = getClaudeSiblingAccountUsage({
      active: usage('dang@gmail.com'),
      inactive: [
        entry('system-default:wsl:Ubuntu-22.04', usage('DANG@gmail.com')),
        entry('system-default:host', usage(undefined, 'unavailable'))
      ],
      target: wsl,
      savedAccounts: saved
    })
    expect(chips).toEqual([])
  })
})
