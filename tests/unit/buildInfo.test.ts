import { describe, expect, it } from 'vitest'
import {
  BACKEND_REPO,
  FRONTEND_REPO,
  buildReport,
  commitUrl,
  describeBuild,
  frontendBuild,
  shortCommit,
} from '../../src/lib/buildInfo'

const SHA = '0123456789abcdef0123456789abcdef01234567'

describe('build info', () => {
  it('shortens only a real commit hash', () => {
    expect(shortCommit(SHA)).toBe('0123456')
    expect(shortCommit(SHA.toUpperCase())).toBe('0123456')
    expect(shortCommit('abc1234')).toBe('abc1234')
    expect(shortCommit('')).toBe('')
    expect(shortCommit(null)).toBe('')
    expect(shortCommit('main')).toBe('')
    expect(shortCommit('abc12')).toBe('')
  })

  it('describes a build as version and commit, or version alone when the commit is unknown', () => {
    expect(describeBuild({ version: '0.1.1', commit: SHA })).toBe('0.1.1 · 0123456')
    expect(describeBuild({ version: '0.1.1', commit: '' })).toBe('0.1.1')
    expect(describeBuild(null)).toBe('')
  })

  it('links a commit to its repo, and to nothing when there is no commit', () => {
    expect(commitUrl(FRONTEND_REPO, SHA)).toBe(`https://github.com/${FRONTEND_REPO}/commit/0123456`)
    expect(commitUrl(BACKEND_REPO, 'abc1234')).toBe(`https://github.com/${BACKEND_REPO}/commit/abc1234`)
    expect(commitUrl(BACKEND_REPO, '')).toBeNull()
    expect(commitUrl(BACKEND_REPO, 'not-a-sha')).toBeNull()
  })

  it('reports both halves on separate lines, and says so when the server is unreachable', () => {
    const front = { version: '0.1.1', commit: SHA, at: '2026-10-27T01:00:00Z' }
    const back = { version: '0.1.1', commit: 'abc1234def', at: '2026-10-27T01:05:00Z', environment: 'develop' }
    expect(buildReport(front, back)).toBe('Frontend: 0.1.1 · 0123456\nBackend: 0.1.1 · abc1234 (develop)')
    expect(buildReport(front, null)).toBe('Frontend: 0.1.1 · 0123456\nBackend: unavailable')
  })

  it('has the values vite injected at build time', () => {
    expect(frontendBuild.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(Number.isNaN(Date.parse(frontendBuild.at))).toBe(false)
    expect(frontendBuild.commit === '' || shortCommit(frontendBuild.commit) !== '').toBe(true)
  })
})
