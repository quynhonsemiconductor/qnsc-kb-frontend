/**
 * The SPA's entry point.
 *
 * It loads NO app code itself: `boot.ts` fetches `/config.json`, validates it and applies it first,
 * and only then does this file `import('./bootstrap')`. Keep the static imports here to plain
 * modules — an early import of `App` would evaluate the module graph (the router, the API client)
 * before the config exists.
 */
import { boot } from './boot'
// The stylesheet is static so the build links it in index.html: the first paint (and the config error
// screen) then has the app's colours instead of waiting for the app chunk.
import './index.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('The SPA entry is missing #root in index.html')
}

void boot({ root, loadApp: () => import('./bootstrap') })
