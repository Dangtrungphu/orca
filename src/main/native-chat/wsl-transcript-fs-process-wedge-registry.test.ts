import { EventEmitter } from 'node:events'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertWslTranscriptFsHelperCapacity,
  countWedgedWslTranscriptFsHelpers,
  markWslTranscriptFsHelperRetired,
  recordWslTranscriptFsHelper,
  resetWslTranscriptFsWedgeWarningForTests,
  WSL_TRANSCRIPT_FS_MAX_WEDGED_HELPERS,
  WSL_TRANSCRIPT_FS_WEDGE_ENTRY_TTL_MS,
  WSL_TRANSCRIPT_FS_WEDGE_GRACE_MS,
  type WslTranscriptFsWedgeRegistryOptions
} from './wsl-transcript-fs-process-wedge-registry'

describe('WSL transcript fs wedged-helper registry', () => {
  let dir: string
  let clock: number
  let alive: Set<number>
  let options: WslTranscriptFsWedgeRegistryOptions

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'orca-wedge-registry-'))
    clock = 1_000_000
    alive = new Set([process.pid])
    options = { dir, enabled: true, now: () => clock, isAlive: (pid) => alive.has(pid) }
    resetWslTranscriptFsWedgeWarningForTests()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function spawnHelper(pid: number): EventEmitter & { pid: number } {
    alive.add(pid)
    const child = Object.assign(new EventEmitter(), { pid })
    recordWslTranscriptFsHelper(child, options)
    return child
  }

  it('counts a killed helper only once it outlives the grace period', () => {
    const healthy = spawnHelper(101)
    const killed = spawnHelper(102)
    markWslTranscriptFsHelperRetired(killed, options)
    clock += WSL_TRANSCRIPT_FS_WEDGE_GRACE_MS - 1
    expect(countWedgedWslTranscriptFsHelpers(options)).toBe(0)
    clock += 1
    expect(countWedgedWslTranscriptFsHelpers(options)).toBe(1)
    healthy.emit('exit')
    killed.emit('exit')
    expect(readdirSync(dir)).toEqual([])
  })

  it('counts a live helper whose parent died without killing it', () => {
    const parentPid = 999_001
    alive.add(parentPid).add(103)
    writeFileSync(join(dir, '103.json'), JSON.stringify({ pid: 103, parentPid, startedAt: clock }))
    clock += WSL_TRANSCRIPT_FS_WEDGE_GRACE_MS
    expect(countWedgedWslTranscriptFsHelpers(options)).toBe(0)
    alive.delete(parentPid)
    expect(countWedgedWslTranscriptFsHelpers(options)).toBe(1)
  })

  it('forgets an entry whose pid is gone or may have been recycled', () => {
    markWslTranscriptFsHelperRetired(spawnHelper(104), options)
    markWslTranscriptFsHelperRetired(spawnHelper(105), options)
    alive.delete(104)
    clock += WSL_TRANSCRIPT_FS_WEDGE_ENTRY_TTL_MS + 1
    expect(countWedgedWslTranscriptFsHelpers(options)).toBe(0)
    expect(readdirSync(dir)).toEqual([])
  })

  it('refuses a new helper at the bound and allows one again after an exit', () => {
    const helpers = Array.from({ length: WSL_TRANSCRIPT_FS_MAX_WEDGED_HELPERS }, (_, index) =>
      spawnHelper(200 + index)
    )
    for (const helper of helpers) {
      markWslTranscriptFsHelperRetired(helper, options)
    }
    clock += WSL_TRANSCRIPT_FS_WEDGE_GRACE_MS
    expect(() => assertWslTranscriptFsHelperCapacity(options)).toThrow(/stuck/)
    helpers[0].emit('exit')
    expect(() => assertWslTranscriptFsHelperCapacity(options)).not.toThrow()
  })
})
