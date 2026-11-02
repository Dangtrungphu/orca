import type { RateLimitRuntimeTarget } from './rate-limit-types'

const PREFIX = 'system-default:'

/** Inactive-usage id for System default while a saved account is selected in that runtime. */
export function claudeSystemDefaultUsageId(target: RateLimitRuntimeTarget): string {
  return target.runtime === 'wsl' && target.wslDistro
    ? `${PREFIX}wsl:${target.wslDistro}`
    : `${PREFIX}host`
}

export function parseClaudeSystemDefaultUsageId(id: string): RateLimitRuntimeTarget | null {
  if (!id.startsWith(PREFIX)) {
    return null
  }
  const rest = id.slice(PREFIX.length)
  if (rest === 'host') {
    return { runtime: 'host', wslDistro: null }
  }
  return rest.startsWith('wsl:') && rest.length > 4
    ? { runtime: 'wsl', wslDistro: rest.slice(4) }
    : null
}
