import { describe, expect, it } from 'vitest'
import { parseSshScanLines } from './ssh-monitor-scan'

describe('parseSshScanLines', () => {
  it('splits the NUL-mapped cmdline and keeps the newest ssh per pane', () => {
    const sessions = parseSshScanLines([
      'ssh\t300\ttab:a\tssh\x1fold-host\x1f',
      'ssh\t420\ttab:a\tssh\x1f-p\x1f22\x1fsrv96\x1fsleep\x1f15\x1f',
      'ssh\t510\ttab:b\tssh\x1f\x1f',
      'garbage',
      'tick'
    ])
    expect(sessions.get('tab:a')).toEqual({
      pid: 420,
      argv: ['ssh', '-p', '22', 'srv96', 'sleep', '15']
    })
    // An empty argument in the middle survives; only the trailing NUL is dropped.
    expect(sessions.get('tab:b')?.argv).toEqual(['ssh', ''])
    expect(sessions.size).toBe(2)
  })
})
