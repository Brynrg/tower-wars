# Completion Status

> Status doc for AI agents. Updated 2026-08-14 (originally 2026-05-19; the monolith described then is gone).

**State:** Actively maintained — deepest gameplay in the portfolio. The 5,119-line monolithic `game.js` was split into 36 ES modules under `src/` (2026, via `tools/split-codemod.mjs`) and then deleted; the stale absolute paths in README are fixed; a vitest golden suite pins core behavior.
**Recent commits:** `d9af0b1` v1.4.0 per-tower targeting priorities · `98d74f9` "Ink & Iron" visual identity overhaul · `ed8432c` Phase 4 speedrun clock + leaderboard submit (v1.3.0) · `9b65a1b` readability/juice pass · `6d2026b` touch input + mobile layout.
**Stack:** Vanilla JS ES modules (no bundler — `index.html` loads `src/main.js` natively), HTML5 Canvas 2D, WebAudio API. `package.json` with vitest + happy-dom devDependencies; `npm test` runs the golden suite; `npm run build` (`build.mjs`) stages static files into `dist/` for portal ingest. `game.manifest.json` (v1.4.0) makes the game auto-discoverable by the umbrella. Local serving: `python3 -m http.server 8080`.

## Architecture — `src/` module map (36 modules, ~6,400 lines total)

Entry: `index.html` → `<script type="module" src="./src/main.js">`. `main.js` runs `boot()`: resize, `runStartupGuardrails()`, `bindEvents()`, load save, start rAF. The split preserved the monolith's behavior byte-for-byte where possible (exact text copies; shared mutable `let`s re-homed to their writer modules and read via ES live bindings) — see `tools/split-codemod.mjs` for the mechanics and the original line-range table.

| Module | Owns |
|---|---|
| `main.js` | `bindEvents()` (all buttons + hotkeys), `boot()` |
| `dom.js` | ~60 `getElementById` refs, grabbed at import time |
| `constants.js` | tile grid (`TILE`/`COLS`/`ROWS`), `SPEED_LEVELS`, `HOME_URL`, save keys (`speedrungames:tower-wars:run_v2` / `:highscores_v2`, with one-time migration from the legacy `green_circle_td_*_v2` keys) |
| `guardrails.js` | `REQUIRED_DOM_REFS` + `runStartupGuardrails()` (throws `[Guardrail]` on missing hooks / bad speed/save assumptions) |
| `damage.js` | damage/armor labels + 4×5 multiplier `DAMAGE_TABLE` |
| `paths.js` | classic + duel waypoint geometry, `PATH_CELLS`, maze start/exit |
| `camera.js` | camera state, pan/zoom math, `screenToWorld`, viewport resize |
| `state.js` | the `game` singleton (incl. `runMs` speedrun clock), entity pools, per-player duel state, `audio` singleton |
| `towers.js` | `TOWER_DATA` catalog (7 towers, A/B branches) + `class Tower` (stats getters, abilities, targeting) |
| `enemies.js` | `class Enemy` (slow/burn, classic/air/maze movement) |
| `projectiles.js` | `Projectile`, `Effect`, `AreaEffect` |
| `sends.js` | `SEND_OPTIONS`, send-queue economy (queue/refund/consume), income |
| `waves.js` | wave archetypes + `buildWavePlan` / `buildDuelWavePlan`, spawning |
| `combat.js` | `getDamageMultiplier`, `dealDamageToEnemy`, `onEnemyKilled`, splitter children |
| `grid.js` | cell/world conversions, bounds, clamp |
| `maze.js` | BFS distance map, maze preview trace |
| `build.js` | `getBuildBlockReason` (single source of truth for "can I build here?"), build/upgrade/branch/sell/ability actions, targeting-priority cycling |
| `picking.js` | tower/enemy hit-testing |
| `describe.js`, `tooltip.js`, `status.js` | entity descriptions, tooltip + command-tab helpers, status banners |
| `selection.js`, `ui-sync.js` | selection panel wiring; per-frame `syncUi` DOM writes |
| `auras.js` | per-frame buff/aura resolution (damage/rate/grantAir/permafrost) |
| `lifecycle.js` | `startWave`, mode switching, pause/speed/menu/reset |
| `save.js`, `scores.js` | versioned run snapshot save/load/autosave; top-12 high scores |
| `loop.js` | `update(dt)` + `render()` + `tick()` (fixed substep), speedrun-clock accrual, wave-20 `submitRun` |
| `leaderboard.js` | fire-and-forget `submitRun(ms)` → portal `POST /api/runs` |
| `render.js` | (largest module, ~1,066 lines) board, tower models, enemies, overlays |
| `palette.js`, `halftone.js` | "Ink & Iron" spot-color system; pre-rendered halftone shading tiles |
| `input.js`, `touch.js` | mouse/wheel/keyboard handlers; mobile touch + pinch input |
| `minimap.js` | minimap render + click-to-center |
| `audio.js` | WebAudio SFX + music loop |

## Test surface

- `test/golden-suite.mjs` — shared golden assertions (damage model, economy, wave plans; seeded RNG). Originally pinned against the live monolith, then re-run unchanged against the modules to prove the split.
- `test/golden.modules.spec.mjs` — runs that suite against the real `src/` modules under happy-dom (populates the DOM from `index.html` before importing, since `dom.js` grabs elements at import time).
- `REGRESSION_CHECKLIST.md` — the manual QA gate for anything the golden suite can't see (rendering, input feel, camera, duel flow).

## What works (behavior carried over from the monolith, plus post-split phases)

- 3 game modes — classic, maze (BFS-pathed with build-time blocked-route check), duel (two lanes, per-player state).
- 7 tower types with A/B branch upgrades; 9+ active abilities; burn/slow/freeze/permafrost status stack.
- Per-tower targeting priorities (First / Last / Strong / Weak) — v1.4.0.
- Damage-type × armor matrix with magic-immune / no-AA / resist-floor handling.
- Income economy with send queue (6 send types, refund, per-lane consumption in duel) and leak penalties.
- Save / load / autosave with versioned keys and legacy-key migration (`constants.js`).
- Speedrun clock (sim-time, first wave start → wave-20 clear) with leaderboard submit (`loop.js` → `leaderboard.js`).
- Camera pan/zoom, minimap with click-to-center, touch + mobile layout (`supportsMobile: true` in the manifest).
- WebAudio SFX + music loop; startup guardrails; menu/defeat overlays whose Return Home buttons use the `window.SPEEDRUN_HOME_URL` hook the umbrella injects via `index.html`.

## Known gaps

- **No CI.** `npm test` exists but nothing runs it on push; no headless boot smoke check. The regression checklist is still manual. (`IMPROVEMENT_PLAN.md` Task 3.)
- **Umbrella drift risk remains.** `Brynrg/speedrungames/apps/web/public/games/tower-wars/` is a downstream drop of `dist/`; edits there diverge silently. Fix here, rebuild, re-drop.
- **Golden suite covers logic only.** Rendering, input, and audio modules have no automated coverage — that's what `REGRESSION_CHECKLIST.md` is for.
- **No linter/formatter** despite `package.json` now existing.

## Notes for AI agents

- **Canonical:** this repo *is* the source. Never edit the umbrella's copy.
- **Gates before any UI/gameplay change:** `npm test` (golden suite) + the full `REGRESSION_CHECKLIST.md`. See `AGENTS.md`.
- **Save keys:** `speedrungames:tower-wars:run_v2` / `speedrungames:tower-wars:highscores_v2` (`src/constants.js`) — keep stable unless intentionally version-bumping; a one-time migration from the legacy `green_circle_td_*_v2` keys runs at module init.
- **Keep `window.SPEEDRUN_HOME_URL` intact** — the umbrella injects it and the Return Home buttons depend on it.
- **`dom.js` grabs elements at import time** — any test or tool that imports `src/` modules must populate the DOM from `index.html` first (see `test/golden.modules.spec.mjs`).
- **Do not** add external CDN dependencies without a fallback; the repo is self-contained except Google Fonts.
- Autosave pollutes `localStorage` while testing — clear `speedrungames:tower-wars:run_v2` between manual runs.
- `IMPROVEMENT_PLAN.md` Tasks 1 (module split) and 2 (README path fix) are **done**; its line-number references to `game.js` are historical.
