import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, Clock, Cpu, HardDrive, MemoryStick, Server, User } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager-types'
import type { SshMonitorStats } from '../../../../shared/ssh-monitor-types'
import { useSshMonitorPaneState } from './use-ssh-monitor-state'

const MAX_DISKS = 4

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 2)} ${units[unit]}`
}

function formatRate(bytesPerSecond: number | null): string {
  return bytesPerSecond === null ? '–' : `${formatBytes(bytesPerSecond)}/s`
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400)
  if (days >= 1) {
    return translate(
      'auto.components.terminal.pane.TerminalSshMonitorBar.3c1f0a9d42',
      '{{value0}} days',
      {
        value0: days
      }
    )
  }
  const hours = Math.floor(seconds / 3600)
  return hours >= 1 ? `${hours} h` : `${Math.floor(seconds / 60)} min`
}

function CpuSparkline({ history }: { history: number[] }): React.JSX.Element {
  const width = 40
  const height = 12
  const step = history.length > 1 ? width / (history.length - 1) : width
  const points = history
    .map(
      (value, index) =>
        `${(index * step).toFixed(1)},${(height - (value / 100) * height).toFixed(1)}`
    )
    .join(' ')
  return (
    <svg width={width} height={height} className="shrink-0 rounded-sm bg-muted" aria-hidden="true">
      {history.length > 1 ? (
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-chart-1"
        />
      ) : null}
    </svg>
  )
}

function Segment({
  icon,
  title,
  children
}: {
  icon: React.ReactNode
  title?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 border-r border-border/60 pr-2"
      title={title}
    >
      {icon}
      {children}
    </span>
  )
}

function LiveSegments({
  stats,
  destination
}: {
  stats: SshMonitorStats
  destination: string
}): React.JSX.Element {
  const iconClass = 'size-3 text-muted-foreground'
  return (
    <>
      <Segment icon={<Server className={iconClass} />} title={`ssh ${destination}`}>
        <span className="text-foreground">{stats.host || destination}</span>
      </Segment>
      <Segment icon={<Cpu className={iconClass} />}>
        <span className="w-8 text-right">
          {stats.cpuPercent === null ? '–' : `${Math.round(stats.cpuPercent)}%`}
        </span>
        <CpuSparkline history={stats.cpuHistory} />
      </Segment>
      <Segment icon={<MemoryStick className={iconClass} />}>
        {formatBytes(stats.memUsedBytes)} / {formatBytes(stats.memTotalBytes)}
      </Segment>
      <Segment icon={<ArrowUp className={iconClass} />}>
        {formatRate(stats.txBytesPerSecond)}
      </Segment>
      <Segment icon={<ArrowDown className={iconClass} />}>
        {formatRate(stats.rxBytesPerSecond)}
      </Segment>
      <Segment icon={<Clock className={iconClass} />}>{formatUptime(stats.uptimeSeconds)}</Segment>
      <Segment icon={<User className={iconClass} />}>{stats.user}</Segment>
      {stats.disks.slice(0, MAX_DISKS).map((disk) => (
        <Segment key={disk.mount} icon={<HardDrive className={iconClass} />}>
          <span className={disk.usePercent >= 90 ? 'text-destructive' : undefined}>
            {disk.mount}: {disk.usePercent}%
          </span>
        </Segment>
      ))}
    </>
  )
}

/** Fork: MobaXterm-style server monitor along the bottom of a pane whose shell runs `ssh`. */
export function TerminalSshMonitorBarPortal({
  pane,
  paneKey
}: {
  pane: ManagedPane
  paneKey: string
}): React.JSX.Element | null {
  const state = useSshMonitorPaneState(paneKey)
  if (!state) {
    return null
  }
  return createPortal(
    <div className="pane-ssh-monitor-bar flex items-center gap-2 overflow-hidden whitespace-nowrap border-t border-border bg-background/90 px-2 text-[11px] text-muted-foreground backdrop-blur-sm">
      {state.status === 'live' ? (
        <LiveSegments stats={state.stats} destination={state.destination} />
      ) : state.status === 'connecting' ? (
        <span>
          {translate(
            'auto.components.terminal.pane.TerminalSshMonitorBar.8e2b6c51f0',
            'Waiting for {{value0}}…',
            {
              value0: state.destination
            }
          )}
        </span>
      ) : (
        <span
          className="truncate"
          title={translate(
            'auto.components.terminal.pane.TerminalSshMonitorBar.b47d90e3a1',
            'Use an SSH key, or ControlMaster with ControlPersist in ~/.ssh/config, so the monitor can share the connection.'
          )}
        >
          {translate(
            'auto.components.terminal.pane.TerminalSshMonitorBar.5f61e2c8b7',
            'No server stats for {{value0}}: {{value1}}',
            {
              value0: state.destination,
              value1: state.reason
            }
          )}
        </span>
      )}
    </div>,
    pane.container,
    `ssh-monitor-${pane.id}`
  )
}
