/**
 * The SPA's runtime configuration: `/config.json`, fetched once before the app bootstraps.
 *
 * The bundle is built ONCE and promoted by digest (DELIVERY-DESIGN-2026-11 §3.1), so nothing
 * environment-specific may be compiled into it. The deploying environment (gitops, per env) mounts a
 * `config.json` next to `dist/`; this module fetches it, validates it, and only then hands control to
 * the app. A missing or invalid config is an ERROR SCREEN (`startup-error.ts`), never a blank page:
 * the alternative is a white window and a console nobody reads.
 *
 * The dev server answers `/config.json` itself (`vite.config.ts`, `devConfigPlugin`), so `npm run dev`
 * needs no file and a build never contains one.
 */
import { z } from 'zod'

/** Where the config is served, and where a deployment mounts it. Same-origin, always. */
export const CONFIG_PATH = '/config.json'

/** What the API client uses when no config has been applied: the dev server's proxied default. */
export const DEFAULT_API_BASE_URL = '/api/v1'

/**
 * `''` (same origin) or a path on this origin (`/api/v1`). Absolute origins are deliberately
 * refused: the SPA and its API are served by one host through the tunnel, and a config naming
 * another origin can only be a mistake. The path is resolved against a dummy origin and must land
 * back on it: `//evil` (protocol-relative) and `/\evil` (a backslash is a slash to the URL parser)
 * both leave it.
 */
const SAME_ORIGIN = 'http://same-origin.invalid'

function isApiBaseUrl(value: string): boolean {
  if (value === '') return true
  if (!value.startsWith('/') || value.startsWith('//')) return false
  try {
    return new URL(value, SAME_ORIGIN).origin === SAME_ORIGIN
  } catch {
    return false
  }
}

/**
 * The whole contract. Strict in the ways that matter: an absolute `apiBaseUrl` is a misconfigured
 * deployment, and it fails at boot rather than at the first request.
 */
export const configSchema = z.object({
  apiBaseUrl: z
    .string()
    .refine(
      isApiBaseUrl,
      'must be "" (same origin) or a path on this origin starting with a single "/"',
    ),
})

export type RuntimeConfig = z.infer<typeof configSchema>

/** A config that could not be fetched or did not validate. The message is shown on the error screen. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The applied config. App modules import `getApiBaseUrl()` and read it when they run, not when they
 * are imported, so the value is in place before any request is made — `boot.ts` applies the config
 * before the app chunk is loaded.
 */
let current: RuntimeConfig = { apiBaseUrl: DEFAULT_API_BASE_URL }

/** Fills the applied config from a validated `/config.json`. Called once, by `loadConfig`. */
export function applyConfig(config: RuntimeConfig): void {
  current = config
}

/** The API origin prefix for every request this bundle makes. */
export function getApiBaseUrl(): string {
  return current.apiBaseUrl || DEFAULT_API_BASE_URL
}

/**
 * Fetches and validates `/config.json`, then applies it. Callers must not import app modules before
 * this resolves: they read the config at module load. `fetchImpl` is injectable for the unit tests;
 * the app always uses `fetch`.
 */
export async function loadConfig(fetchImpl: typeof fetch = fetch): Promise<RuntimeConfig> {
  let response: Response
  try {
    // `no-store`: the file is small and must never be a stale cached copy (the server also sends
    // `Cache-Control: no-cache`, but a proxy is not the only cache to consider).
    response = await fetchImpl(CONFIG_PATH, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
  } catch (error) {
    throw new ConfigError(`Could not fetch ${CONFIG_PATH}: ${describe(error)}`)
  }

  if (!response.ok) {
    throw new ConfigError(
      `${CONFIG_PATH} answered HTTP ${response.status}. The deployment must mount it next to the app.`,
    )
  }

  let raw: unknown
  try {
    raw = await response.json()
  } catch (error) {
    throw new ConfigError(`${CONFIG_PATH} is not valid JSON: ${describe(error)}`)
  }

  const parsed = configSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ConfigError(`${CONFIG_PATH} is invalid:\n${z.prettifyError(parsed.error)}`)
  }

  applyConfig(parsed.data)
  return parsed.data
}
