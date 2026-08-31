/* Applies the stored theme before the first paint, so the app never flashes the wrong
   background while the React bundle is still being fetched.

   This lives in its own file rather than inline in index.html so `script-src 'self'`
   covers it. The inline alternative needs either 'unsafe-inline' — which would undo the
   protection the whole policy is for — or a sha256 hash repeated in the three places this
   app declares a CSP (nginx.conf, public/_headers, the backend's docker/Caddyfile), where
   the first edit that forgets one of them silently blocks the script.

   It stays a plain parser-blocking <script> placed above the stylesheet in <head>: an
   external classic script still executes before <body> is parsed, and paint cannot happen
   before there is a body. `defer` or `type="module"` would move it after parsing and
   reintroduce the flash. Above the stylesheet because a pending stylesheet blocks script
   execution, which would otherwise pin the theme decision behind a font download. */
(function () {
  try {
    var preference = localStorage.getItem('qnsc-theme') || 'system';
    var isDark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (_) { document.documentElement.dataset.theme = 'light'; }
})();
