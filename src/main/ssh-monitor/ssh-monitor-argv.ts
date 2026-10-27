// OpenSSH 8.x/9.x: options that take a value, and flags the monitor must not inherit.
const OPTIONS_WITH_VALUE = new Set('BbcDEeFIiJLlmOoPpQRSWw'.split(''))
const DROPPED_FLAGS = new Set('fGMNnstVvXY'.split(''))
const DROPPED_OPTIONS = new Set('DLRw'.split(''))
// Why skip: `-O` drives an existing master and `-W` is a stdio proxy, neither is a shell session.
const UNMONITORED_OPTIONS = new Set('OW'.split(''))

/**
 * The monitor's channel never asks for input, never forwards anything and never becomes a master,
 * so it rides the user's ControlMaster socket when one exists and otherwise needs a key.
 * Why first: ssh keeps the first value it sees for each option.
 */
const MONITOR_OPTIONS = [
  '-T',
  '-q',
  '-o',
  'BatchMode=yes',
  '-o',
  'ControlMaster=no',
  '-o',
  'ConnectTimeout=10',
  '-o',
  'ServerAliveInterval=15',
  '-o',
  'ServerAliveCountMax=2',
  '-o',
  'ClearAllForwardings=yes',
  '-o',
  'ForwardAgent=no',
  '-o',
  'ForwardX11=no',
  '-o',
  'PermitLocalCommand=no',
  '-o',
  'RemoteCommand=none'
]

export type SshMonitorTarget = {
  /** What the user typed as the destination, shown until the server reports its hostname. */
  destination: string
  /** The user's connection options plus the destination, without any remote command. */
  connectArgs: string[]
}

/**
 * `mux` rides the user's ControlMaster socket and never logs in itself. `direct` makes one
 * key-only attempt with multiplexing off. Why off: a master without ControlPersist would keep
 * the user's own ssh open after `exit` for as long as the monitor channel lives.
 */
export type SshMonitorMode = 'mux' | 'direct'

/** Turns the argv of a user's `ssh` into the monitor's argv, or null when it is not a session. */
export function buildSshMonitorTarget(argv: readonly string[]): SshMonitorTarget | null {
  const kept: string[] = []
  let index = 1
  while (index < argv.length) {
    const arg = argv[index]
    if (arg === '--') {
      index += 1
      break
    }
    if (!arg.startsWith('-') || arg === '-') {
      break
    }
    // Why a cursor: flags combine (`-tt`, `-4A`) and a value can be glued on (`-p22`).
    let cursor = 1
    while (cursor < arg.length) {
      const letter = arg[cursor]
      if (OPTIONS_WITH_VALUE.has(letter)) {
        const glued = arg.slice(cursor + 1)
        const value = glued !== '' ? glued : argv[index + 1]
        if (value === undefined) {
          return null
        }
        if (glued === '') {
          index += 1
        }
        if (UNMONITORED_OPTIONS.has(letter)) {
          return null
        }
        if (!DROPPED_OPTIONS.has(letter)) {
          kept.push(`-${letter}`, value)
        }
        break
      }
      if (!DROPPED_FLAGS.has(letter)) {
        kept.push(`-${letter}`)
      }
      cursor += 1
    }
    index += 1
  }
  const destination = argv[index]
  if (!destination) {
    return null
  }
  // Why drop the rest: whatever follows the destination is the user's remote command.
  return { destination, connectArgs: [...kept, destination] }
}

/** Reads `ssh -G` output for the same connection. */
export function parseSshMonitorMode(resolvedConfig: string): SshMonitorMode {
  const values = new Map<string, string>()
  for (const line of resolvedConfig.split('\n')) {
    const [key, ...rest] = line.trim().split(' ')
    values.set(key.toLowerCase(), rest.join(' '))
  }
  const master = values.get('controlmaster')
  const path = values.get('controlpath')
  const persist = values.get('controlpersist')
  const multiplexed = master !== undefined && master !== 'false' && !!path && path !== 'none'
  return multiplexed && persist !== undefined && persist !== 'no' && persist !== '0'
    ? 'mux'
    : 'direct'
}

export function buildSshMonitorArgs(target: SshMonitorTarget, mode: SshMonitorMode): string[] {
  const modeOptions = mode === 'direct' ? ['-o', 'ControlPath=none'] : []
  return [...MONITOR_OPTIONS, ...modeOptions, ...target.connectArgs, 'sh -s']
}
