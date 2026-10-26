var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
// Captured in `configResolved` so the CSP plugin below can read them in `closeBundle`.
var apiBaseUrl;
var outDir = 'dist';
// The dev server's own settings come from `.env` too. Vite puts `.env` into `import.meta.env` only for VITE_-prefixed
// keys, and these must stay unprefixed (a VITE_ value ships in the browser bundle), so they are read here, with the
// process environment winning as usual.
var dotenv = __assign(__assign({}, loadEnv('', process.cwd(), '')), process.env);
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
            configResolved: function (config) {
                // Read through Vite's resolved env, not `process.env`: `.env`/`.env.production` files
                // are loaded by Vite and never reach the process environment, so a value set the way
                // local builds set it would otherwise be invisible here.
                apiBaseUrl = config.env.VITE_API_BASE_URL;
                outDir = config.build.outDir;
            },
            // `closeBundle`, not `writeBundle`. Vite copies publicDir into outDir AFTER the bundle
            // is written, so patching in writeBundle succeeded and was then overwritten by the
            // pristine public/_headers — the build looked clean and shipped an unpatched policy.
            closeBundle: function () {
                return __awaiter(this, void 0, void 0, function () {
                    var origin, path, headers, cspLine;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                try {
                                    origin = new URL(String(apiBaseUrl !== null && apiBaseUrl !== void 0 ? apiBaseUrl : '')).origin;
                                }
                                catch (_b) {
                                    return [2 /*return*/]; // relative base, or unset — nothing cross-origin to allow
                                }
                                path = "".concat(outDir, "/_headers");
                                return [4 /*yield*/, readFile(path, 'utf8')
                                    // Anchored to the header line, not to the bare literal. `_headers` explains this
                                    // rewrite in a comment that quotes `connect-src 'self'` verbatim, and an unanchored
                                    // replace hit that comment first — the build reported success and shipped a CSP with
                                    // the API origin spliced into prose.
                                ];
                            case 1:
                                headers = _a.sent();
                                cspLine = /^(\s*Content-Security-Policy:.*?connect-src 'self')/m;
                                if (!cspLine.test(headers)) {
                                    // Failing the build is the only safe answer: shipping unpatched leaves an app that
                                    // cannot reach its API, and that reads as a runtime bug rather than a build one.
                                    throw new Error("_headers has no Content-Security-Policy line with \"connect-src 'self'\" to widen for ".concat(origin));
                                }
                                return [4 /*yield*/, writeFile(path, headers.replace(cspLine, "$1 ".concat(origin)))];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                });
            },
        },
    ],
    test: {
        // A UTC runner cannot tell "parsed as UTC" from "parsed as local" -- the timezone
        // tests would pass either way. See tests/setup-timezone.ts.
        setupFiles: ['./tests/setup-timezone.ts'],
    },
    server: {
        // Pinned, and a taken port fails the start instead of moving: the backend's CORS_ORIGINS are set for this origin
        // are set for this origin. A second copy of the stack sets FRONTEND_DEV_PORT (see README "Run a second copy").
        port: Number(dotenv.FRONTEND_DEV_PORT) || 5173,
        // Vite binds localhost (IPv6 ::1 on macOS), so 127.0.0.1 is refused. A second copy sets FRONTEND_DEV_HOST=127.0.0.1
        // to serve on the origin it opens; the default stays localhost.
        host: dotenv.FRONTEND_DEV_HOST || 'localhost',
        strictPort: true,
        proxy: {
            '/api': {
                target: dotenv.VITE_DEV_API_TARGET || 'http://localhost:8000',
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
});
