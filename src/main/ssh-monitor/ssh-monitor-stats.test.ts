import { describe, expect, it } from 'vitest'
import { computeSshMonitorStats, parseSshMonitorBlock } from './ssh-monitor-stats'

function block(overrides: { uptime: string; cpu: string; eth0: [number, number] }): string[] {
  return [
    'host cloudvps8656.superdata.vn',
    'user root',
    `uptime ${overrides.uptime}`,
    `cpu  ${overrides.cpu}`,
    'MemTotal:       10979000 kB',
    'MemAvailable:    5935000 kB',
    '    lo: 900000 10 0 0 0 0 0 0 900000 10 0 0 0 0 0 0',
    `  eth0: ${overrides.eth0[0]} 10 0 0 0 0 0 0 ${overrides.eth0[1]} 10 0 0 0 0 0 0`,
    'docker0: 500000 10 0 0 0 0 0 0 500000 10 0 0 0 0 0 0',
    '@@df',
    '/dev/vda2         204560     7764    196796       4% /boot/efi',
    '/dev/vda3       52156396 36801136  15355260      71% /',
    '/dev/sdb1      100000000 10000000  90000000      10% /mnt/my data',
    '/dev/loop3         56960    56960         0     100% /snap/core/123'
  ]
}

describe('parseSshMonitorBlock', () => {
  it('reads host facts, counts only real NICs and lists disks with / first', () => {
    const snapshot = parseSshMonitorBlock(
      block({ uptime: '8035200.50', cpu: '100 0 50 800 50 0 0 0 0 0', eth0: [2000, 1000] })
    )
    expect(snapshot).toMatchObject({
      host: 'cloudvps8656.superdata.vn',
      user: 'root',
      uptimeSeconds: 8035200.5,
      cpuTotal: 1000,
      cpuIdle: 850,
      memTotalBytes: 10979000 * 1024,
      memAvailableBytes: 5935000 * 1024,
      rxBytes: 2000,
      txBytes: 1000
    })
    expect(snapshot?.disks).toEqual([
      { mount: '/', usePercent: 71 },
      { mount: '/boot/efi', usePercent: 4 },
      { mount: '/mnt/my data', usePercent: 10 }
    ])
  })

  it('falls back to free + buffers + cached on kernels without MemAvailable', () => {
    const lines = block({ uptime: '1', cpu: '1 0 0 1 0 0 0 0', eth0: [0, 0] }).filter(
      (line) => !line.startsWith('MemAvailable')
    )
    lines.splice(5, 0, 'MemFree: 1000 kB', 'Buffers: 200 kB', 'Cached: 300 kB')
    expect(parseSshMonitorBlock(lines)?.memAvailableBytes).toBe(1500 * 1024)
  })

  it('rejects a truncated block', () => {
    expect(parseSshMonitorBlock(['host a', 'user b'])).toBeNull()
  })
})

describe('computeSshMonitorStats', () => {
  const first = parseSshMonitorBlock(
    block({ uptime: '100', cpu: '100 0 50 800 50 0 0 0 0 0', eth0: [2000, 1000] })
  )!
  const second = parseSshMonitorBlock(
    block({ uptime: '102', cpu: '160 0 70 900 70 0 0 0 0 0', eth0: [6000, 2000] })
  )!

  it('has no rates on the first sample', () => {
    const stats = computeSshMonitorStats(undefined, first, [])
    expect(stats).toMatchObject({ cpuPercent: null, rxBytesPerSecond: null, cpuHistory: [] })
    expect(stats.memUsedBytes).toBe((10979000 - 5935000) * 1024)
  })

  it('derives CPU and network rates from the server uptime clock', () => {
    const stats = computeSshMonitorStats(first, second, [5])
    // 200 jiffies passed, 120 of them idle or iowait.
    expect(stats.cpuPercent).toBe(40)
    expect(stats.cpuHistory).toEqual([5, 40])
    expect(stats.rxBytesPerSecond).toBe(2000)
    expect(stats.txBytesPerSecond).toBe(500)
  })

  it('starts over when the counters went backwards', () => {
    expect(computeSshMonitorStats(second, first, [40]).cpuPercent).toBeNull()
  })
})
