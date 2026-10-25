# Hive

The board game Hive, as an offline-first PWA. Deployed at
**https://a.aaanth.com/hive/**.

The app sits inside the `pwa/` shell: a service worker that precaches
everything and detects its own deploys, a theme that settles before the first
paint, and a build step that keys the cache to the bytes it is caching.
**[`pwa/README.md`](pwa/README.md)** explains the shell.
**[`pwa/AGENTS.md`](pwa/AGENTS.md)** lists the constraints that look like
details and are not — read it before changing anything under `pwa/`, `sw.ts`
or `tools/`.

## Run it

```sh
npm ci
npm run build          # compile, copy static files, inline the theme boot, generate the precache list
npm run serve          # build, then serve dist/ at /hive/ the way the deployed origin does
npm run check          # type-check all four programs, then verify vendor/ matches node_modules
npm test               # node:test units, then Puppeteer browser tests
npm run format:check   # Prettier
npm run vendor         # re-copy Preact out of node_modules into vendor/
npm run site           # assemble _site/ the way the deploy does
```

Service workers need `localhost` or HTTPS — `127.0.0.1` is fine, a `file://`
URL is not.

The browser tests need a full Chrome — `chrome-headless-shell` has no service
worker implementation. `npx puppeteer browsers install chrome` provides one;
`CHROME_PATH` points at another.

## Layout

```
index.html          the shell: PWA head, inline theme boot placeholder, the module entry
sw.ts               configuration + the generated block; imports the runtime
pwa/                the reusable shell — see pwa/README.md and pwa/AGENTS.md
hive/               the game engine: pure TypeScript, no DOM
hive/ai/            the computer opponent: search, evaluation, hashing; no DOM
ui/                 App.tsx, components/, hooks/ (Preact, classic JSX runtime), and
                    the pure modules they share: geometry, record, storage, selection, players
ui/ai/              the module worker the computer searches in, its client and message types
styles/             tokens.css + pieces.css (tile and bug colours) + base.css + app.css + opponent.css
vendor/             Preact 10 + hooks, as ES modules; hand-written .d.ts beside each
types/              ambient types: the JSX namespace, shell globals, the worker scope
fonts/ icons/       Caprasimo + Figtree (latin subset); the .svg are the .png sources
tests/              node:test units; tests/browser/ runs under Puppeteer
tools/              build.mjs, inline.mjs, copy-static.mjs, check-scripts.mjs,
                    vendor.mjs, serve.ts, build-site.sh
tsconfig*.json      the three build programs, plus tools/*.mjs's checkJs-only pass
_headers            cache headers and the CSP placeholder; paths carry the /hive prefix
sw-version.json     the last (BUILD, VERSION) pair build.mjs stamped; committed
wrangler.jsonc      Workers Static Assets config + route
```

`dist/` and `_site/` are build output, not checked in. `hive/` holds no DOM and
`ui/` holds no game rules.

## Deploying

Cloudflare Workers (Static Assets). The build command is
`bash tools/build-site.sh`; the deploy command is `npx wrangler deploy`. The
script nests the app under `_site/hive/`, puts `_headers` at the assets root,
and fails if any precached path is missing from the copy.

## Storage

| Key          | What                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| `hive.theme` | the theme choice, absent when it is "system"                              |
| `hive.prefs` | device preferences: the dismissed install hint                            |
| `hive.game`  | the current game: UHP GameString, cursor, ending, options, seats (`v: 2`) |

Icons: the PNGs are rasterised from `icons/icon.svg` and `icons/maskable.svg`
with `rsvg-convert -w <size> -h <size>` (180 apple-touch, 192, 512, maskable 512).

The theme has its own key because the inline boot script reads it before any
module has run.
