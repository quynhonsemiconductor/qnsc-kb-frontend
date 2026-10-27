/**
 * Which build is on screen. The frontend half is baked in by vite.config.ts at build time
 * (`define`), the backend half comes from GET /system/version. They deploy independently, so
 * both are shown: "the new button is missing" is either a frontend that has not rolled out
 * or a backend that has not, and only the pair tells which.
 */

export interface BuildInfo {
  version: string
  /** Full commit hash, or '' when the build could not tell (a build outside git and CI). */
  commit: string
  /** ISO time the bundle was built (frontend) or the server process started (backend). */
  at: string
  environment?: string
}

export const FRONTEND_REPO = 'quynhonsemiconductor/qnsc-kb-frontend'
export const BACKEND_REPO = 'quynhonsemiconductor/qnsc-kb-backend'

export const frontendBuild: BuildInfo = {
  version: __APP_VERSION__,
  commit: __APP_COMMIT__,
  at: __APP_BUILT_AT__,
}

export function shortCommit(commit: string | null | undefined): string {
  return /^[0-9a-f]{7,40}$/i.test(commit ?? '') ? (commit as string).slice(0, 7).toLowerCase() : ''
}

/** `0.1.1 · abc1234`, or `0.1.1` when the commit is unknown. */
export function describeBuild(build: Pick<BuildInfo, 'version' | 'commit'> | null): string {
  if (!build) return ''
  const short = shortCommit(build.commit)
  return short ? `${build.version} · ${short}` : build.version
}

/** Link to the commit on GitHub; null when there is no commit to point at. */
export function commitUrl(repo: string, commit: string | null | undefined): string | null {
  const short = shortCommit(commit)
  return short ? `https://github.com/${repo}/commit/${short}` : null
}

/** What gets pasted into a bug report or a chat: both halves on one line each. */
export function buildReport(frontend: BuildInfo, backend: BuildInfo | null): string {
  const line = (label: string, build: BuildInfo | null) =>
    `${label}: ${build ? describeBuild(build) || build.version : 'unavailable'}`
  const environment = backend?.environment ? ` (${backend.environment})` : ''
  return [line('Frontend', frontend), `${line('Backend', backend)}${environment}`].join('\n')
}
