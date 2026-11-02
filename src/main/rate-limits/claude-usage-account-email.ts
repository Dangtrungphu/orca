import { posix } from 'node:path'
import {
  claudeStateFile,
  readClaudeFolderLoginAsync
} from '../claude-accounts/claude-account-folder'
import { getClaudeProfileRouter } from '../claude-accounts/claude-profile-installed-router'
import type { ClaudeRuntimeAuthPreparation } from '../claude-accounts/runtime-auth/runtime-auth-types'
import { toWindowsWslPath } from '../../shared/wsl-paths'

const EMAIL_READ_TIMEOUT_MS = 3_000

/** The email of the login usage is read for; undefined when its state file is unreadable. */
export async function readClaudeUsageAccountEmail(
  preparation: ClaudeRuntimeAuthPreparation | undefined
): Promise<string | undefined> {
  const stateFile = claudeUsageStateFile(preparation)
  if (!stateFile) {
    return undefined
  }
  // Why the timeout: a hung WSL share must not hold back the usage it labels.
  const login = await Promise.race([
    readClaudeFolderLoginAsync(stateFile).catch(() => null),
    new Promise<null>((resolve) => setTimeout(resolve, EMAIL_READ_TIMEOUT_MS, null).unref())
  ])
  return login?.email || undefined
}

function claudeUsageStateFile(
  preparation: ClaudeRuntimeAuthPreparation | undefined
): string | null {
  const ownFolder = Boolean(preparation?.envPatch.CLAUDE_CONFIG_DIR)
  if (preparation?.runtime === 'wsl') {
    const linuxDir = preparation.wslLinuxConfigDir
    if (!linuxDir || !preparation.wslDistro) {
      return null
    }
    // Why dirname: System default's state file sits beside ~/.claude, an account's inside its folder.
    const stateDir = ownFolder ? linuxDir : posix.dirname(linuxDir)
    return toWindowsWslPath(posix.join(stateDir, '.claude.json'), preparation.wslDistro)
  }
  if (ownFolder && preparation) {
    return claudeStateFile(preparation.configDir)
  }
  return claudeStateFile(getClaudeProfileRouter()?.userConfigDir())
}
