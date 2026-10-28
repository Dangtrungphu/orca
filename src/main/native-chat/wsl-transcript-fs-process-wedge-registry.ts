import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Why: a helper whose open a filter driver holds (antivirus scanning a huge
// transcript) survives SIGKILL on Windows; replacing it every deadline piled up
// one unkillable helper per retry until their scans saturated the 9P server.
// The registry is shared by main and every AI Vault service child via temp dir.
export const WSL_TRANSCRIPT_FS_MAX_WEDGED_HELPERS = 2
// A healthy helper exits within milliseconds of a kill or of losing its parent.
export const WSL_TRANSCRIPT_FS_WEDGE_GRACE_MS = 10_000
// Past this an entry's pid may have been recycled by an unrelated process.
export const WSL_TRANSCRIPT_FS_WEDGE_ENTRY_TTL_MS = 30 * 60_000
const REFUSAL_WARN_INTERVAL_MS = 60_000

type HelperEntry = {
  pid: number
  parentPid: number
  startedAt: number
  retiredAt?: number
}

/** The slice of a forked helper the registry needs. */
export type WslTranscriptFsHelperChild = {
  readonly pid?: number
  once(event: 'exit', listener: () => void): unknown
}

export type WslTranscriptFsWedgeRegistryOptions = {
  dir?: string
  enabled?: boolean
  now?: () => number
  isAlive?: (pid: number) => boolean
}

let lastRefusalWarnAt = Number.NEGATIVE_INFINITY

// libuv answers signal 0 from GetExitCodeProcess, which stays STILL_ACTIVE while a killed process waits on its I/O.
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error instanceof Error && 'code' in error && error.code === 'EPERM'
  }
}

function resolveOptions(
  options: WslTranscriptFsWedgeRegistryOptions
): Required<WslTranscriptFsWedgeRegistryOptions> {
  return {
    dir: options.dir ?? join(tmpdir(), 'orca-wsl-transcript-fs-helpers'),
    // Only Windows leaves a killed helper alive.
    enabled: options.enabled ?? process.platform === 'win32',
    now: options.now ?? Date.now,
    isAlive: options.isAlive ?? isProcessAlive
  }
}

function entryPath(dir: string, pid: number): string {
  return join(dir, `${pid}.json`)
}

// Write-then-rename so a reader in another process never sees a torn entry.
function writeEntry(dir: string, entry: HelperEntry): void {
  mkdirSync(dir, { recursive: true })
  const target = entryPath(dir, entry.pid)
  const temp = `${target}.${process.pid}.tmp`
  writeFileSync(temp, JSON.stringify(entry))
  renameSync(temp, target)
}

function isHelperEntry(value: unknown): value is HelperEntry {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const entry: Partial<Record<keyof HelperEntry, unknown>> = value
  return (
    Number.isSafeInteger(entry.pid) &&
    Number.isSafeInteger(entry.parentPid) &&
    typeof entry.startedAt === 'number' &&
    (entry.retiredAt === undefined || typeof entry.retiredAt === 'number')
  )
}

function readEntry(path: string): HelperEntry | null {
  try {
    const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return isHelperEntry(value) ? value : null
  } catch {
    return null
  }
}

function removeFile(path: string): void {
  try {
    unlinkSync(path)
  } catch {
    // Already removed by another process.
  }
}

// Bookkeeping is best-effort: a registry fault must never block a spawn.
export function recordWslTranscriptFsHelper(
  child: WslTranscriptFsHelperChild,
  options: WslTranscriptFsWedgeRegistryOptions = {}
): void {
  const { dir, enabled, now } = resolveOptions(options)
  const pid = child.pid
  if (!enabled || pid === undefined) {
    return
  }
  try {
    writeEntry(dir, { pid, parentPid: process.pid, startedAt: now() })
  } catch {
    return
  }
  child.once('exit', () => removeFile(entryPath(dir, pid)))
}

export function markWslTranscriptFsHelperRetired(
  child: WslTranscriptFsHelperChild,
  options: WslTranscriptFsWedgeRegistryOptions = {}
): void {
  const { dir, enabled, now } = resolveOptions(options)
  const pid = child.pid
  if (!enabled || pid === undefined) {
    return
  }
  try {
    const existing = readEntry(entryPath(dir, pid))
    writeEntry(dir, {
      pid,
      parentPid: existing?.parentPid ?? process.pid,
      startedAt: existing?.startedAt ?? now(),
      retiredAt: now()
    })
  } catch {
    return
  }
  // The owner stripped its listeners before the kill; re-arm cleanup.
  child.once('exit', () => removeFile(entryPath(dir, pid)))
}

export function countWedgedWslTranscriptFsHelpers(
  options: WslTranscriptFsWedgeRegistryOptions = {}
): number {
  const { dir, enabled, now, isAlive } = resolveOptions(options)
  if (!enabled) {
    return 0
  }
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return 0
  }
  const at = now()
  let wedged = 0
  for (const name of names) {
    const path = join(dir, name)
    if (!name.endsWith('.json')) {
      // A temp file whose writer died before the rename.
      try {
        if (at - statSync(path).mtimeMs > WSL_TRANSCRIPT_FS_WEDGE_ENTRY_TTL_MS) {
          removeFile(path)
        }
      } catch {
        // Already removed by another process.
      }
      continue
    }
    const entry = readEntry(path)
    if (!entry) {
      continue
    }
    if (at - entry.startedAt > WSL_TRANSCRIPT_FS_WEDGE_ENTRY_TTL_MS || !isAlive(entry.pid)) {
      removeFile(path)
      continue
    }
    const killedLongAgo =
      entry.retiredAt !== undefined && at - entry.retiredAt >= WSL_TRANSCRIPT_FS_WEDGE_GRACE_MS
    // The AI Vault service dies on its request deadline without killing its helpers.
    const orphaned =
      at - entry.startedAt >= WSL_TRANSCRIPT_FS_WEDGE_GRACE_MS && !isAlive(entry.parentPid)
    if (killedLongAgo || orphaned) {
      wedged += 1
    }
  }
  return wedged
}

// A fork past the bound would only wedge on the same stall and add another pending scan.
export function assertWslTranscriptFsHelperCapacity(
  options: WslTranscriptFsWedgeRegistryOptions = {}
): void {
  const wedged = countWedgedWslTranscriptFsHelpers(options)
  if (wedged < WSL_TRANSCRIPT_FS_MAX_WEDGED_HELPERS) {
    return
  }
  const at = resolveOptions(options).now()
  if (at - lastRefusalWarnAt >= REFUSAL_WARN_INTERVAL_MS) {
    lastRefusalWarnAt = at
    console.warn(
      `[wsl-transcript-fs] ${wedged} helpers are stuck in uncancelable WSL I/O; not starting another`
    )
  }
  throw new Error(`${wedged} filesystem helpers are stuck in uncancelable WSL I/O`)
}

export function resetWslTranscriptFsWedgeWarningForTests(): void {
  lastRefusalWarnAt = Number.NEGATIVE_INFINITY
}
