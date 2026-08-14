# AGENTS.md — Tower Wars

Vanilla-JS maze tower defense. No bundler: `index.html` loads native ES modules from `src/`
(37 modules; entry `src/main.js`). The old monolithic `game.js` is gone — it was split by
`tools/split-codemod.mjs` and deleted. Orientation doc: `COMPLETION_STATUS.md`.

## Gates — run both before pushing any UI or gameplay change

1. **`npm test`** — the golden suite (`test/golden-suite.mjs`, run against the real `src/`
   modules by `test/golden.modules.spec.mjs`). Pins damage math, economy, and wave plans
   with seeded RNG; these values were recorded from the pre-split monolith, so a diff here
   means a real behavior change.
2. **`npm run smoke`** — headless Chrome boot check (`scripts/smoke-boot.mjs`); fails on any
   console/page error during boot. CI (`.github/workflows/ci.yml`) runs both gates on push/PR.
3. **`REGRESSION_CHECKLIST.md`** — the manual QA pass for everything the automated gates can't
   see (rendering, input feel, camera, save/load, duel mode).

## Load-bearing facts

- **Canonical source is this repo.** The `Brynrg/speedrungames` umbrella carries a
  downstream drop of `dist/` — never edit the game there; fix here, `npm run build`, re-drop.
- **Save keys** (`src/constants.js`): `speedrungames:tower-wars:run_v2` and
  `speedrungames:tower-wars:highscores_v2`. Keep stable unless intentionally version-bumping.
  Clear the run key between manual test runs — autosave pollutes `localStorage`.
- **Keep `window.SPEEDRUN_HOME_URL` intact** — the umbrella injects it; Return Home depends on it.
- `src/dom.js` grabs DOM elements at import time — anything importing `src/` modules outside
  the browser must populate the DOM from `index.html` first (see `test/golden.modules.spec.mjs`).
- `build.mjs` deliberately excludes `AGENTS.md`, docs, `test/`, `tools/`, and `scripts/` from `dist/`.
