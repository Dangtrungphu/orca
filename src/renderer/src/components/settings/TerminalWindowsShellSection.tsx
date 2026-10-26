import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { WINDOWS_GIT_BASH_SHELL } from '../../../../shared/windows-terminal-shell'
import {
  SettingsRow,
  SettingsSegmentedControl,
  SettingsSubsectionHeader
} from './SettingsFormControls'
import { SearchableSetting } from './SearchableSetting'
import { translate } from '@/i18n/i18n'
import { ShellIcon } from '../tab-bar/shell-icons'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

type TerminalWindowsShellSectionProps = {
  updateSettings: (updates: Partial<GlobalSettings>) => void
  windowsShell: string
  wslDistro: string | null
  gitBashAvailable: boolean
  wslAvailable: boolean
  wslDistros: string[]
  wslCapabilitiesLoading: boolean
}

function windowsShellLabel(shell: string, label: string): React.JSX.Element {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <ShellIcon shell={shell} size={12} />
      <span>{label}</span>
    </span>
  )
}

export function TerminalWindowsShellSection({
  updateSettings,
  windowsShell,
  wslDistro,
  gitBashAvailable,
  wslAvailable,
  wslDistros,
  wslCapabilitiesLoading
}: TerminalWindowsShellSectionProps): React.JSX.Element {
  const showGitBashOption = gitBashAvailable || windowsShell === WINDOWS_GIT_BASH_SHELL
  // Fork: WSL is selectable again, always saved with a distro, so the floating workspace can open WSL.
  const showWslOption = wslAvailable || windowsShell === 'wsl.exe'
  const selectedWslDistro = wslDistro?.trim() || null
  const nextWslDistro = selectedWslDistro ?? wslDistros[0] ?? null
  const wslDistroOptions =
    selectedWslDistro && !wslDistros.includes(selectedWslDistro)
      ? [selectedWslDistro, ...wslDistros]
      : wslDistros
  const handleShellChange = (value: string): void => {
    if (value === 'wsl.exe') {
      updateSettings({ terminalWindowsShell: value, terminalWindowsWslDistro: nextWslDistro })
      return
    }
    updateSettings({ terminalWindowsShell: value })
  }

  return (
    <section key="windows-shell" className="space-y-3">
      <SettingsSubsectionHeader
        title={translate('auto.components.settings.TerminalPane.87e678a8af', 'Windows Shell')}
        description={translate(
          'auto.components.settings.TerminalPane.a55eee649f',
          'Default shell for new terminal panes on Windows.'
        )}
      />

      <div className="divide-y divide-border/40">
        <SearchableSetting
          className="@container"
          title={translate('auto.components.settings.TerminalPane.27e301f22c', 'Default Shell')}
          description={translate(
            'auto.components.settings.TerminalPane.bd68f3170d',
            'Choose the default shell for new terminal panes on Windows.'
          )}
          keywords={[
            'terminal',
            'windows',
            'shell',
            'powershell',
            'cmd',
            'command prompt',
            'git bash',
            'bash.exe',
            'wsl',
            'linux',
            'distro',
            'ubuntu',
            'default'
          ]}
        >
          <SettingsRow
            className="flex-col items-stretch @lg:flex-row @lg:items-center"
            label={translate('auto.components.settings.TerminalPane.27e301f22c', 'Default Shell')}
            description={translate(
              'auto.components.settings.TerminalPane.09bf02de9a',
              'Shell used when opening a new terminal pane. Takes effect for new terminals.'
            )}
            control={
              <SettingsSegmentedControl
                size="sm"
                equalWidth
                wrap
                ariaLabel={translate(
                  'auto.components.settings.TerminalPane.27e301f22c',
                  'Default Shell'
                )}
                value={windowsShell}
                onChange={handleShellChange}
                options={[
                  {
                    value: 'powershell.exe',
                    label: windowsShellLabel(
                      'powershell.exe',
                      translate('auto.components.settings.TerminalPane.eb7fc4d98a', 'PowerShell')
                    ),
                    ariaLabel: translate(
                      'auto.components.settings.TerminalPane.eb7fc4d98a',
                      'PowerShell'
                    )
                  },
                  {
                    value: 'cmd.exe',
                    label: windowsShellLabel(
                      'cmd.exe',
                      translate(
                        'auto.components.settings.TerminalPane.0f1b8669e6',
                        'Command Prompt'
                      )
                    ),
                    ariaLabel: translate(
                      'auto.components.settings.TerminalPane.0f1b8669e6',
                      'Command Prompt'
                    )
                  },
                  ...(showGitBashOption
                    ? [
                        {
                          value: WINDOWS_GIT_BASH_SHELL,
                          label: windowsShellLabel(
                            WINDOWS_GIT_BASH_SHELL,
                            translate(
                              'auto.components.settings.TerminalPane.f61ac77f16',
                              'Git Bash'
                            )
                          ),
                          ariaLabel: translate(
                            'auto.components.settings.TerminalPane.f61ac77f16',
                            'Git Bash'
                          ),
                          disabled: !gitBashAvailable
                        }
                      ]
                    : []),
                  ...(showWslOption
                    ? [
                        {
                          value: 'wsl.exe',
                          label: windowsShellLabel(
                            'wsl.exe',
                            translate('auto.components.settings.TerminalPane.b637dd57a7', 'WSL')
                          ),
                          ariaLabel: translate(
                            'auto.components.settings.TerminalPane.b637dd57a7',
                            'WSL'
                          ),
                          disabled: wslCapabilitiesLoading || !wslAvailable || !nextWslDistro
                        }
                      ]
                    : [])
                ]}
              />
            }
          />
          {windowsShell === 'wsl.exe' ? (
            <SettingsRow
              label={translate(
                'auto.components.settings.TerminalPane.5642702c73',
                'WSL Distribution'
              )}
              description={translate(
                'auto.components.settings.TerminalPane.ff3b3fdde3',
                'Distro for WSL terminals outside a project, such as the floating workspace. Projects keep their own runtime.'
              )}
              control={
                <Select
                  value={selectedWslDistro ?? ''}
                  onValueChange={(value) => updateSettings({ terminalWindowsWslDistro: value })}
                  disabled={wslCapabilitiesLoading || !wslAvailable}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-full min-w-52"
                    aria-label={translate(
                      'auto.components.settings.TerminalPane.5642702c73',
                      'WSL Distribution'
                    )}
                  >
                    <SelectValue
                      placeholder={translate(
                        'auto.components.settings.TerminalPane.ec029d3e3f',
                        'Select distro'
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {wslDistroOptions.map((distro) => (
                      <SelectItem key={distro} value={distro}>
                        {distro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
          ) : null}
        </SearchableSetting>
      </div>
    </section>
  )
}
