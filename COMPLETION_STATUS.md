# Completion Status

> Status doc for AI agents working on this repo. Updated 2026-05-19.

**Score:** 65 / 100 — Deepest gameplay in the portfolio, held back by monolithic source
**State:** Actively maintained (Bundle 3 fire/frost towers landed today)
**Stack:** Vanilla JS, no bundler. Serve via `python3 -m http.server` or via speedrungames.net `/games/tower-wars/` proxy.

## What works
- Maze TD with classic/maze/duel modes
- Bundle 2 economy: income ticks, sends, leak-income penalty
- Bundle 3 towers: Fire Mortar (burn + fire patch), Frost Obelisk (permafrost aura, ice lance)
- Save/load, branched upgrades, hero abilities, minimap, duel board
- `REGRESSION_CHECKLIST.md` — real manual QA gate covering startup, gameplay, maze placement, economy, save/load, camera, duel mode

## Known gaps
- **5,119-line monolithic `game.js`** — hard to navigate, impossible to unit-test math in isolation
- No CI — manual checklist is the only gate
- README contains **hardcoded `/Users/jonathangarnett/...` absolute paths** in the Guardrails section — won't resolve for other contributors or AI agents
- Does NOT consume `speedrungames-sdk` — has its own timer/save system, no leaderboard submission
- This repo is the canonical source, but `Brynrg/speedrungames/apps/web/public/games/tower-wars/game.js` is a manual drop of `game.js` that will drift

## Priority improvements
1. **Split `game.js` into ES modules** (`towers.js`, `enemies.js`, `economy.js`, `save.js`, `ui.js`) via `<script type="module">` — no bundler needed. Unlocks unit-testing.
2. **Fix README paths** — replace `/Users/jonathangarnett/...` with relative repo paths
3. **Migrate timer/storage to `speedrungames-sdk`** so the game can submit runs to the leaderboard
4. **Add headless-Chrome boot check in CI** that loads `index.html` and asserts no console errors

## Notes for AI agents
- This is the **canonical source for tower-wars game code**. The copy at `Brynrg/speedrungames/apps/web/public/games/tower-wars/game.js` is a downstream drop — do not edit there; fix here and re-drop.
- Use `REGRESSION_CHECKLIST.md` as the acceptance gate before any commit
- **Related repos**: `speedrungames` (umbrella that proxies this game)
