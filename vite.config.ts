import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'

// Captured in `configResolved` so the CSP plugin below can read them in `closeBundle`.
let apiBaseUrl: string | undefined
let outDir = 'dist'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    /**
     * Widens `connect-src` in the emitted `dist/_headers` to include the API origin.
     *
     * The Cloudflare Pages deploy talks to its API CROSS-ORIGIN — `VITE_API_BASE_URL` is
     * an absolute origin baked into the bundle at build time (see the notes in
     * .github/workflows/web-deploy.yml). A checked-in static header file cannot state the
     * value: it differs per environment and is only known here.
     *
     * public/_headers ships `connect-src 'self'` and this appends the origin, so a build
     * that skips this plugin emits a policy TIGHTER than intended, not looser: the first
     * API call fails visibly instead of a permissive `https:` silently allowing XHR to any
     * host. Only the origin is added, never the path — CSP source expressions match by
     * origin, and a trailing path would only narrow it misleadingly.
     *
     * A same-origin deploy (the docker path, where the base URL is the relative
     * `/api/v1`) needs no change and gets none.
     */
    {
      name: 'qnsc-csp-connect-src',
      apply: 'build',
      configResolved(config) {
        // Read through Vite's resolved env, not `process.env`: `.env`/`.env.production` files
        // are loaded by Vite and never reach the process environment, so a value set the way
        // local builds set it would otherwise be invisible here.
        apiBaseUrl = config.env.VITE_API_BASE_URL
        outDir = config.build.outDir
      },
      // `closeBundle`, not `writeBundle`. Vite copies publicDir into outDir AFTER the bundle
      // is written, so patching in writeBundle succeeded and was then overwritten by the
      // pristine public/_headers — the build looked clean and shipped an unpatched policy.
      async closeBundle() {
        let origin: string
        try {
          origin = new URL(String(apiBaseUrl ?? '')).origin
        } catch {
          return // relative base, or unset — nothing cross-origin to allow
        }
        const path = `${outDir}/_headers`
        const headers = await readFile(path, 'utf8')
        // Anchored to the header line, not to the bare literal. `_headers` explains this
        // rewrite in a comment that quotes `connect-src 'self'` verbatim, and an unanchored
        // replace hit that comment first — the build reported success and shipped a CSP with
        // the API origin spliced into prose.
        const cspLine = /^(\s*Content-Security-Policy:.*?connect-src 'self')/m
        if (!cspLine.test(headers)) {
          // Failing the build is the only safe answer: shipping unpatched leaves an app that
          // cannot reach its API, and that reads as a runtime bug rather than a build one.
          throw new Error(`_headers has no Content-Security-Policy line with "connect-src 'self'" to widen for ${origin}`)
        }
        await writeFile(path, headers.replace(cspLine, `$1 ${origin}`))
      },
    },
  ],
  test: {
    // A UTC runner cannot tell "parsed as UTC" from "parsed as local" -- the timezone
    // tests would pass either way. See tests/setup-timezone.ts.
    setupFiles: ['./tests/setup-timezone.ts'],
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      // Resolved from this module's own URL rather than `__dirname`. `__dirname` only
      // exists because Vite currently loads this config through a CJS-shimmed bundler;
      // it is absent under the native ESM loader that becomes the default in a future
      // major, which is what the startup warning was about. The URL form needs no shim
      // and, unlike `import.meta.dirname`, does not require Node >= 20.11 — the Docker
      // build runs on the floating `node:20-alpine` tag.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
