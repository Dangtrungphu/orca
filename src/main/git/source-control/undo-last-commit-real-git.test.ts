import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { invalidateGitReadCaches } from './git-read-cache-invalidation'
import { undoLastCommit } from './undo-last-commit'

function git(dir: string, args: string[]): string {
  return execFileSync('git', args, { cwd: dir, stdio: 'pipe' }).toString().trim()
}

describe('undoLastCommit (real git)', () => {
  let repo: string

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'orca-undo-commit-'))
    git(repo, ['init', '--quiet'])
    git(repo, ['config', 'user.email', 'test@example.com'])
    git(repo, ['config', 'user.name', 'Test User'])
    invalidateGitReadCaches()
  })

  afterEach(async () => {
    invalidateGitReadCaches()
    await rm(repo, { recursive: true, force: true })
  })

  async function commit(file: string, content: string, message: string): Promise<string> {
    await writeFile(path.join(repo, file), content)
    git(repo, ['add', file])
    git(repo, ['commit', '--quiet', '-m', message])
    return git(repo, ['rev-parse', 'HEAD'])
  }

  it('moves the branch to the parent and keeps the commit staged', async () => {
    const first = await commit('a.txt', 'one\n', 'first')
    const second = await commit('b.txt', 'two\n', 'second')

    await undoLastCommit(repo, second)

    expect(git(repo, ['rev-parse', 'HEAD'])).toBe(first)
    expect(git(repo, ['diff', '--cached', '--name-only'])).toBe('b.txt')
    expect(git(repo, ['status', '--porcelain'])).toBe('A  b.txt')
  })

  it('refuses when HEAD is no longer the commit the user picked', async () => {
    await commit('a.txt', 'one\n', 'first')
    const second = await commit('b.txt', 'two\n', 'second')
    const third = await commit('c.txt', 'three\n', 'third')

    await expect(undoLastCommit(repo, second)).rejects.toThrow('branch moved')
    expect(git(repo, ['rev-parse', 'HEAD'])).toBe(third)
  })

  it('turns a root commit back into staged changes on an unborn branch', async () => {
    const root = await commit('a.txt', 'one\n', 'root')

    await undoLastCommit(repo, root)

    expect(() => git(repo, ['rev-parse', '--verify', '--quiet', 'HEAD'])).toThrow()
    expect(git(repo, ['status', '--porcelain'])).toBe('A  a.txt')
  })

  it('rejects anything that is not a full commit id', async () => {
    await commit('a.txt', 'one\n', 'first')
    await expect(undoLastCommit(repo, 'HEAD')).rejects.toThrow('full id')
  })
})
