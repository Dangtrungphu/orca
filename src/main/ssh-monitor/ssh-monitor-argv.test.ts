import { describe, expect, it } from 'vitest'
import { buildSshMonitorArgs, buildSshMonitorTarget, parseSshMonitorMode } from './ssh-monitor-argv'

function userArgs(argv: string[]): string[] | undefined {
  return buildSshMonitorTarget(argv)?.connectArgs
}

describe('buildSshMonitorTarget', () => {
  it('opens a non-interactive, non-master channel to the same destination', () => {
    const target = buildSshMonitorTarget(['ssh', 'my-server'])!
    expect(target.destination).toBe('my-server')
    const mux = buildSshMonitorArgs(target, 'mux')
    expect(mux.slice(0, 6)).toEqual(['-T', '-q', '-o', 'BatchMode=yes', '-o', 'ControlMaster=no'])
    expect(mux).not.toContain('ControlPath=none')
    expect(mux.slice(-2)).toEqual(['my-server', 'sh -s'])
    // Why before the user's options: ssh keeps the first value, so multiplexing stays off.
    expect(buildSshMonitorArgs(target, 'direct').slice(-4)).toEqual([
      '-o',
      'ControlPath=none',
      'my-server',
      'sh -s'
    ])
  })

  it('keeps connection options, glued or separate, and drops the remote command', () => {
    expect(
      userArgs(['ssh', '-p', '2222', '-i~/.ssh/key', '-oUser=root', 'host', 'tail', '-f', 'log'])
    ).toEqual(['-p', '2222', '-i', '~/.ssh/key', '-o', 'User=root', 'host'])
  })

  it('drops tty, forwarding and background flags', () => {
    expect(
      userArgs(['ssh', '-tt', '-4A', '-L', '8080:localhost:80', '-fN', '-D1080', 'root@box'])
    ).toEqual(['-4', '-A', 'root@box'])
  })

  it('ignores control commands, stdio proxies and argv without a destination', () => {
    expect(buildSshMonitorTarget(['ssh', '-O', 'exit', 'my-server'])).toBeNull()
    expect(buildSshMonitorTarget(['ssh', '-W', 'db:5432', 'bastion'])).toBeNull()
    expect(buildSshMonitorTarget(['ssh', '-v'])).toBeNull()
    expect(buildSshMonitorTarget(['ssh', '-p'])).toBeNull()
  })
})

describe('parseSshMonitorMode', () => {
  const resolved = (persist: string, master = 'auto'): string =>
    `user root\ncontrolmaster ${master}\ncontrolpath /home/u/.ssh/cm-ab12\n${persist}`

  it('rides the master only when it persists past the user session', () => {
    expect(parseSshMonitorMode(resolved('controlpersist 600'))).toBe('mux')
    expect(parseSshMonitorMode(resolved('controlpersist no'))).toBe('direct')
    expect(parseSshMonitorMode(resolved('controlpersist 600', 'false'))).toBe('direct')
    expect(parseSshMonitorMode('controlmaster auto\ncontrolpersist 600')).toBe('direct')
  })
})
