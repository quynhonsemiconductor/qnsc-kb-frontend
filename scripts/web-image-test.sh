#!/usr/bin/env bash
# =============================================================================
# Container test for the web image (Dockerfile + Caddyfile).
#
# Builds the image from the repo root, runs it the way the chart runs it (read-only root filesystem,
# a writable /tmp, config.json mounted at /srv/config.json, an arbitrary non-root uid, port 8080),
# and exercises the contract.
#
#   contract      /healthz 200; doc root /srv; the process runs as the image's non-root uid;
#                 nothing outside /tmp is writable
#   caching       / and SPA routes no-cache; an existing /assets/* and /fonts/* immutable; a MISSING
#                 asset 404 with no Cache-Control promise
#   headers       public/_headers' policy on every response; no Server fingerprint
#   config        /config.json is served no-cache, exactly as the deployment mounts it
#   bypasses      an encoded path separator is refused, never routed
#
# A PASS must fail on broken input: every assertion is a real HTTP response from the image.
#
# Usage:
#   scripts/web-image-test.sh
#
# Containers use this process's PID in their names and are removed on exit; nothing here touches the
# owner's stacks or the default compose project.
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }

image="kb-web:test-$$"
web="kb-web-test-$$"
tmpdir="$(mktemp -d)"
base=""

cleanup() {
  docker rm -f "$web" >/dev/null 2>&1 || true
  docker image rm -f "$image" >/dev/null 2>&1 || true
  rm -rf "$tmpdir"
}
trap cleanup EXIT

pass=0
failed=0
ok() { pass=$((pass + 1)); printf '  ok    %s\n' "$1"; }
bad() { failed=$((failed + 1)); printf '  FAIL  %s: %s\n' "$1" "$2"; }

headers() { curl -sS --max-time 10 --path-as-is -D - -o /dev/null "$@"; }
status() { curl -sS --max-time 10 --path-as-is -o /dev/null -w '%{http_code}' "$@"; }
body() { curl -sS --max-time 10 --path-as-is "$@"; }
header_of() {
  local h=$1
  shift
  headers "$@" | tr -d '\r' | grep -i "^$h:" | head -1 | sed 's/^[^:]*:[[:space:]]*//'
}

expect_status() {
  local what=$1 want=$2
  shift 2
  local got
  got="$(status "$@")"
  if [ "$got" = "$want" ]; then ok "$what ($want)"; else bad "$what" "expected $want, got $got"; fi
}

expect_header() {
  local what=$1 header=$2 want=$3
  shift 3
  local got
  got="$(header_of "$header" "$@")"
  if [ "$got" = "$want" ]; then ok "$what ($header: $want)"; else bad "$what" "expected '$header: $want', got '$got'"; fi
}

expect_no_header() {
  local what=$1 header=$2
  shift 2
  if headers "$@" | tr -d '\r' | grep -qi "^${header}:"; then
    bad "$what" "expected no $header header"
  else
    ok "$what (no $header)"
  fi
}

expect_header_contains() {
  local what=$1 header=$2 want=$3
  shift 3
  local got
  got="$(header_of "$header" "$@")"
  case "$got" in
    *"$want"*) ok "$what ($header contains '$want')" ;;
    *) bad "$what" "expected '$header' to contain '$want', got '$got'" ;;
  esac
}

expect_body_contains() {
  local what=$1 want=$2
  shift 2
  local got
  got="$(body "$@")"
  case "$got" in
    *"$want"*) ok "$what (body contains '$want')" ;;
    *) bad "$what" "expected body to contain '$want', got '$(printf '%s' "$got" | head -c 200)'" ;;
  esac
}

expect_exec() {
  local what=$1 want=$2
  shift 2
  local got
  if docker exec "$web" "$@" >/dev/null 2>&1; then got=true; else got=false; fi
  if [ "$got" = "$want" ]; then ok "$what"; else bad "$what" "expected $want, got $got"; fi
}

# -----------------------------------------------------------------------------
# Build and run exactly as the chart does.
# -----------------------------------------------------------------------------
echo "Building $image"
docker build --target web -t "$image" . >"$tmpdir/build.log" 2>&1 || {
  tail -40 "$tmpdir/build.log"
  echo "build failed" >&2
  exit 1
}

cat > "$tmpdir/config.json" <<'JSON'
{"apiBaseUrl":"/api/v1"}
JSON

docker run -d --name "$web" \
  --read-only \
  --tmpfs /tmp \
  -p 127.0.0.1::8080 \
  -v "$tmpdir/config.json:/srv/config.json:ro" \
  "$image" >/dev/null

mapped="$(docker port "$web" 8080/tcp | head -1)"
port="${mapped##*:}"
base="http://127.0.0.1:$port"

for _ in $(seq 1 40); do
  if curl -fsS --max-time 2 "$base/healthz" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

# -----------------------------------------------------------------------------
# Contract
# -----------------------------------------------------------------------------
expect_status "/healthz answers" 200 "$base/healthz"
expect_body_contains "/healthz says ok" "ok" "$base/healthz"
if [ "$(docker exec "$web" id -u)" = "0" ]; then
  bad "runs as a non-root user" "uid 0"
else
  ok "runs as a non-root user (uid $(docker exec "$web" id -u))"
fi
expect_exec "/tmp is writable" true touch /tmp/writable
expect_exec "the doc root is read-only" false touch /srv/writable-test

# -----------------------------------------------------------------------------
# Static files, caching and fallback
# -----------------------------------------------------------------------------
expect_status "/ serves the app" 200 "$base/"
expect_body_contains "/ contains the app entry" 'id="root"' "$base/"
expect_header "/ is no-cache" "Cache-Control" "no-cache" "$base/"
expect_status "an unknown SPA route falls back to index" 200 "$base/articles/does-not-exist"
expect_body_contains "the fallback is index.html" 'id="root"' "$base/articles/does-not-exist"
expect_header "the SPA fallback is no-cache" "Cache-Control" "no-cache" "$base/articles/does-not-exist"

body "$base/" >"$tmpdir/index.html"
asset="$(grep -o '/assets/[A-Za-z0-9._-]*\.js' "$tmpdir/index.html" | head -1 || true)"
if [ -n "$asset" ]; then
  ok "index.html references a hashed asset ($asset)"
  expect_status "a hashed asset is served" 200 "$base$asset"
  expect_header "a hashed asset is immutable" "Cache-Control" "public, max-age=31536000, immutable" "$base$asset"
else
  bad "index.html references a hashed asset" "no /assets/*.js found"
fi

expect_status "a missing asset is 404" 404 "$base/assets/does-not-exist.js"
expect_no_header "a 404 asset promises no cache lifetime" "Cache-Control" "$base/assets/does-not-exist.js"

expect_status "the self-hosted font CSS is served" 200 "$base/fonts/fonts.css"
expect_header "font CSS is not immutable (its name carries no hash)" "Cache-Control" "no-cache" "$base/fonts/fonts.css"
expect_status "a hashed font is served" 200 "$base/fonts/dm-sans-rP2Hp2ywxg089UriCZ2IHSeH.woff2"
expect_header "a hashed font is immutable" "Cache-Control" "public, max-age=31536000, immutable" "$base/fonts/dm-sans-rP2Hp2ywxg089UriCZ2IHSeH.woff2"
expect_header_contains "the brand mark is served as SVG" "Content-Type" "image/svg+xml" "$base/brand-mark.svg"
expect_header "unhashed files revalidate" "Cache-Control" "no-cache" "$base/brand-mark.svg"

# -----------------------------------------------------------------------------
# Runtime config: served from the mounted file, never cached
# -----------------------------------------------------------------------------
expect_status "/config.json is served" 200 "$base/config.json"
expect_header "/config.json is no-cache" "Cache-Control" "no-cache" "$base/config.json"
expect_header_contains "/config.json is JSON" "Content-Type" "application/json" "$base/config.json"
expect_body_contains "/config.json carries the mounted value" '"apiBaseUrl":"/api/v1"' "$base/config.json"

# -----------------------------------------------------------------------------
# Security headers (public/_headers) and no fingerprint
# -----------------------------------------------------------------------------
expect_header "nosniff" "X-Content-Type-Options" "nosniff" "$base/"
expect_header "frame protection" "X-Frame-Options" "DENY" "$base/"
expect_header "referrer policy" "Referrer-Policy" "no-referrer" "$base/"
expect_header "permissions policy" "Permissions-Policy" "camera=(), microphone=(), geolocation=()" "$base/"
expect_header "HSTS" "Strict-Transport-Security" "max-age=31536000; includeSubDomains" "$base/"
expect_header_contains "CSP present" "Content-Security-Policy" "frame-ancestors 'none'" "$base/"
expect_header_contains "CSP keeps scripts same-origin" "Content-Security-Policy" "script-src 'self'" "$base/"
expect_no_header "no Server fingerprint" "Server" "$base/"

# -----------------------------------------------------------------------------
# Path traversal through an encoded separator
# -----------------------------------------------------------------------------
expect_status "an encoded separator is refused" 404 "$base/assets%2F..%2Findex.html"
expect_status "an encoded backslash is refused" 404 "$base/assets%5C..%5Cindex.html"
expect_status "a query string may carry an encoded separator" 200 "$base/?q=a%2Fb"

printf '\n%d passed, %d failed\n' "$pass" "$failed"
[ "$failed" -eq 0 ]
