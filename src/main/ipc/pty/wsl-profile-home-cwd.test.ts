import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getWslHomeAsync: vi.fn(),
  listWslDistrosAsync: vi.fn()
}))

vi.mock('../../wsl', () => ({
  getWslHomeAsync: mocks.getWslHomeAsync,
  listWslDistrosAsync: mocks.listWslDistrosAsync
}))
vi.mock('../../../shared/app-environment', () => ({
  getAppEnvironment: () => ({ getPath: () => 'C:\\Users\\dang' })
}))

import { resolveWslProfileHomeCwd } from './wsl-profile-home-cwd'

const hostPlatform = process.platform
const UBUNTU_HOME = '\\\\wsl.localhost\\Ubuntu-22.04\\home\\dang'
const WSL_UBUNTU = { shellOverride: 'wsl.exe', terminalWindowsWslDistro: 'Ubuntu-22.04' }

describe('resolveWslProfileHomeCwd', () => {
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
    mocks.getWslHomeAsync
      .mockReset()
      .mockImplementation(async (distro: string) =>
        distro === 'Ubuntu-22.04' ? UBUNTU_HOME : `\\\\wsl.localhost\\${distro}\\home\\dang`
      )
    mocks.listWslDistrosAsync.mockReset().mockResolvedValue(['Debian', 'Ubuntu-22.04'])
  })
  afterEach(() => {
    Object.defineProperty(process, 'platform', { configurable: true, value: hostPlatform })
  })

  it('starts a WSL shell opened at the Windows profile folder in the distro home', async () => {
    await expect(resolveWslProfileHomeCwd('C:\\Users\\dang', WSL_UBUNTU)).resolves.toBe(UBUNTU_HOME)
    await expect(resolveWslProfileHomeCwd('c:\\users\\DANG\\', WSL_UBUNTU)).resolves.toBe(
      UBUNTU_HOME
    )
  })

  it('uses the Windows default distro when none is saved', async () => {
    await expect(
      resolveWslProfileHomeCwd('C:\\Users\\dang', {
        shellOverride: 'wsl.exe',
        terminalWindowsWslDistro: null
      })
    ).resolves.toBe('\\\\wsl.localhost\\Debian\\home\\dang')
  })

  it('keeps any other folder, any other shell, and a distro that cannot report its home', async () => {
    await expect(resolveWslProfileHomeCwd('C:\\Users\\dang\\code', WSL_UBUNTU)).resolves.toBe(
      'C:\\Users\\dang\\code'
    )
    await expect(
      resolveWslProfileHomeCwd('C:\\Users\\dang', {
        shellOverride: 'git-bash',
        terminalWindowsWslDistro: 'Ubuntu-22.04'
      })
    ).resolves.toBe('C:\\Users\\dang')
    mocks.getWslHomeAsync.mockResolvedValue(null)
    await expect(resolveWslProfileHomeCwd('C:\\Users\\dang', WSL_UBUNTU)).resolves.toBe(
      'C:\\Users\\dang'
    )
  })

  it('does nothing off Windows', async () => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' })
    await expect(resolveWslProfileHomeCwd('C:\\Users\\dang', WSL_UBUNTU)).resolves.toBe(
      'C:\\Users\\dang'
    )
    expect(mocks.getWslHomeAsync).not.toHaveBeenCalled()
  })
})
