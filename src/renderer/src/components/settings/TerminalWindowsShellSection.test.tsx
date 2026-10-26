// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TerminalWindowsShellSection } from './TerminalWindowsShellSection'

type SectionProps = React.ComponentProps<typeof TerminalWindowsShellSection>

function sectionProps(overrides: Partial<SectionProps> = {}): SectionProps {
  return {
    updateSettings: vi.fn(),
    windowsShell: 'git-bash',
    wslDistro: null,
    gitBashAvailable: true,
    wslAvailable: true,
    wslDistros: ['Debian', 'Ubuntu-22.04'],
    wslCapabilitiesLoading: false,
    ...overrides
  }
}

function clickShell(props: SectionProps, label: string): void {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<TerminalWindowsShellSection {...props} />)
  })
  // Why aria-label: the WSL icon is an SVG that spells "WSL" too, so text content doubles.
  const button = container.querySelector(`button[aria-label="${label}"]`)
  expect(button).toBeTruthy()
  act(() => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  act(() => {
    root.unmount()
  })
  container.remove()
}

describe('TerminalWindowsShellSection', () => {
  it('offers WSL as a default shell and saves it together with a distro', () => {
    const updateSettings = vi.fn()
    clickShell(sectionProps({ updateSettings }), 'WSL')
    expect(updateSettings).toHaveBeenCalledWith({
      terminalWindowsShell: 'wsl.exe',
      terminalWindowsWslDistro: 'Debian'
    })
  })

  it('keeps a saved distro when WSL is picked again', () => {
    const updateSettings = vi.fn()
    clickShell(sectionProps({ updateSettings, wslDistro: 'Ubuntu-22.04' }), 'WSL')
    expect(updateSettings).toHaveBeenCalledWith({
      terminalWindowsShell: 'wsl.exe',
      terminalWindowsWslDistro: 'Ubuntu-22.04'
    })
  })

  it('switches away from WSL without touching the distro', () => {
    const updateSettings = vi.fn()
    clickShell(
      sectionProps({ updateSettings, windowsShell: 'wsl.exe', wslDistro: 'Ubuntu-22.04' }),
      'PowerShell'
    )
    expect(updateSettings).toHaveBeenCalledWith({ terminalWindowsShell: 'powershell.exe' })
  })

  it('shows the distro picker only while WSL is the default shell', () => {
    const wslMarkup = renderToStaticMarkup(
      <TerminalWindowsShellSection
        {...sectionProps({ windowsShell: 'wsl.exe', wslDistro: 'Ubuntu-22.04' })}
      />
    )
    expect(wslMarkup).toContain('WSL Distribution')

    const gitBashMarkup = renderToStaticMarkup(<TerminalWindowsShellSection {...sectionProps()} />)
    expect(gitBashMarkup).not.toContain('WSL Distribution')
  })

  it('hides WSL on a machine without it', () => {
    const markup = renderToStaticMarkup(
      <TerminalWindowsShellSection {...sectionProps({ wslAvailable: false, wslDistros: [] })} />
    )
    expect(markup).not.toContain('WSL')
  })
})
