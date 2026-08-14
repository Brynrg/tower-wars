# Improvement Plan

> Executable backlog for `Brynrg/tower-wars`. Work top-to-bottom.
>
> **Status sweep 2026-08-14** — plan executed. Done: 1, 2, 3, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20 (partial: aria-live shipped; focus trap + contrast audit still open).
> Superseded: 4 (game.manifest.json + the portal-ingest deploy pipeline replaced speedrungames.json discovery, which is for externally-hosted proxied games), 6 (bespoke speedrun clock + submitRun already deliver the leaderboard; an SDK storage migration would churn the stable save keys for no user-visible gain), 7 (deploy.yml auto-deploys via the portal's reusable workflow; rsync drops are banned).
> Deferred (P3, unstarted): 17, 18, 19, and the rest of 20. Per-task notes below.

## P0 — Blockers / safety

### Task 1: Split `game.js` into ES modules — ✅ DONE (pre-2026-08-14, via tools/split-codemod.mjs)
**Effort:** L
**Files:** `index.html`, new `src/*.js` modules, replace existing `game.js`.
**What:** Convert the 5,119-line single-file game into ES modules loaded via `<script type="module">`. No bundler. The goal is testability and navigability, not a build step.
**Why:** Today nothing about damage math, wave generation, or save serialization can be tested without booting the whole game. A monolithic file means every grep returns 30 hits and every edit risks an unrelated regression.

**Section boundaries (exact line ranges in current `game.js`):**

| New module | Source lines | Exports |
|---|---|---|
| `src/dom.js` | 1-86 | All `const xxxEl = document.getElementById(...)` refs, the `towerButtons` / `commandTabButtons` / `commandPanels` arrays, the `sendButtons` map. |
| `src/constants.js` | 88-130 | `CONTROL_TOOLTIPS`, `TILE`, `COLS`, `ROWS`, `WIDTH`, `HEIGHT`, `CAMERA_KEY_PAN_SPEED`, `RUN_SAVE_KEY`, `HIGH_SCORE_KEY`, `SPEED_LEVELS`, `HOME_URL`, `COMMAND_TABS`. |
| `src/guardrails.js` | 132-177 | `REQUIRED_DOM_REFS` array, `runStartupGuardrails()`. |
| `src/damage.js` | 179-199 | `DAMAGE_LABELS`, `ARMOR_LABELS`, `DAMAGE_TABLE`. |
| `src/paths.js` | 201-301 | `PATH_NODES`, `buildPathCells`, `PATH_CELLS`, `WAYPOINTS`, `PATH_SET`, `MAZE_START`, `MAZE_EXIT`, `DUEL_LANE_IDS`, `buildDuelPathNodes`, `DUEL_PATH_NODES`, `DUEL_PATH_CELLS`, `DUEL_PATH_SET`, `DUEL_WAYPOINTS`, `DUEL_SPAWNS`, `DUEL_EXITS`, `DIR4`. |
| `src/camera.js` | 302-325 | `getFitZoom`, `camera`, `keyState`, `panState`, plus the camera math helpers from later sections (`clampCamera` 2270-2289, `screenToWorld` 2290-2296, `applyCameraTransform` 2297-2302, `getScreenPos` 2303-2312, `resizeCanvasToViewport` 2313-2327). |
| `src/sends.js` | 326-369 + 1850-2139 | `SEND_OPTIONS`, `isSendLocked`, `getIncomePayout`, `buildRunnerSendUnits`...`buildMiniBossSendUnits`, `makeSendUnits`, `queueSend`, `clearSendQueue`, `consumeSendQueueForWave`, `updateSendUi`. |
| `src/towers.js` | 371-666 + 1138-1606 | `TOWER_DATA`, `class Tower`. |
| `src/state.js` | 668-795 | `game` singleton, entity arrays (`towers`, `enemies`, `projectiles`, `effects`, `areaEffects`, `buffZones`, `statusBanners`), `createPlayerState`, `getPlayerState`, `getActivePlayerState`, `getEnemyDefenderState`, `getEnemyLane`, `getLaneOwnerForCell`, `syncLegacyEconomyFromActive`, `syncActiveToLegacyIfDuel`, `audio`, `highScores`, `mazeDistances` (mutable refs — see below). |
| `src/enemies.js` | 797-1136 | `class Enemy`. |
| `src/projectiles.js` | 1608-1776 | `class Projectile`, `class Effect`, `class AreaEffect`. |
| `src/scores.js` | 1778-1801 + 3185-3226 | `loadHighScores`, `saveHighScores`, `renderHighScores`, `recordHighScore`. |
| `src/tooltip.js` | 1802-1837 | `defaultTooltip`, `setTooltip`, `setCommandTab`, `getButtonTooltip`. |
| `src/status.js` | 1838-1849 | `status(text)`. |
| `src/combat.js` | 2141-2247 | `getDamageMultiplier`, `dealDamageToEnemy`, `onEnemyKilled`, `spawnSplitChildren`. |
| `src/grid.js` | 2248-2269 | `worldFromCell`, `getCellAt`, `inBounds`, `clamp`. |
| `src/minimap.js` | 2328-2455 | `resizeMiniMapCanvas`, `drawMiniMapPolyline`, `drawMiniMap`, `handleMiniMapPointer`. |
| `src/picking.js` | 2456-2483 | `getTowerAtCell`, `getTowerAtPoint`, `getEnemyAtPoint`, `getEnemyProgress`. |
| `src/maze.js` | 2484-2547 + 3510-3550 | `isMazeReservedCell`, `getBlockedMazeCellSet`, `computeMazeDistanceMap`, `rebuildMazeDistances`, `getMazePreviewPoints`. |
| `src/build.js` | 2549-2596 + 2639-2770 | `getBuildBlockReason`, `canBuildOnCell`, `setSelectedType`, `tryBuildTower`, `tryUpgradeSelectedTower`, `chooseBranch`, `castSelectedAbility`. |
| `src/describe.js` | 2597-2638 | `describeEnemy`, `describeTower`. |
| `src/waves.js` | 2771-2940 | `randomRange`, `makeNormalUnit`, `makeAirUnit`, `makeSplitterUnit`, `makeBossUnit`, `buildWavePlan`, `buildDuelWavePlan`, `spawnEnemyFromQueue`. |
| `src/lifecycle.js` | 2941-3045 + 3399-3508 | `startWave`, `toggleAutoWave`, `setGameMode`, `setActivePlayer`, `resetRun`, `openMenu`, `closeMenu`, `restartRun`, `togglePause`, `cycleSpeed`. |
| `src/auras.js` | 3046-3113 | `updateBuffsAndAuras`. |
| `src/selection.js` | 3114-3184 | `updateSelectionPanel`. |
| `src/save.js` | 3228-3397 | `getRunSnapshot`, `saveRun`, `loadRun`. |
| `src/render.js` | 3552-4205 | `drawBoard`, `drawPolygon`, `getTowerAimAngle`, `drawTowerBasePad`, 7× `drawXxxTowerModel`, `drawTowerRankAndBranch`, `drawTower`, `drawEnemy`, `drawProjectile`, `drawAreaEffect`, `drawEffect`, `drawOverlay`, `updateStatusBanners`. |
| `src/loop.js` | 4216-4385 + 4758-4773 | `update(dt)`, `render()`, `tick(now)`. |
| `src/ui-sync.js` | 4387-4488 | `syncUi`. |
| `src/audio.js` | 4490-4596 | `initAudio`, `ensureAudioActive`, `playTone`, `playSfx`, `startMusicLoop`. |
| `src/input.js` | 4598-4756 | `handleBoardClick`, `handleCanvasMove`, `updateCameraFromKeys`, `handleCanvasMouseDown`, `handleCanvasMouseUp`, `handleCanvasWheel`. |
| `src/main.js` | 4775-5119 | `bindEvents`, `boot()`, and `boot()` invocation. |

**Steps:**
1. Create the `src/` directory. Copy the corresponding line ranges from `game.js` into each new file. Maintain exact code text — no rewrites in this PR.
2. Add `export` to every top-level `const`/`function`/`class`. Add `import { ... } from "./xxx.js"` at the top of each consumer module. Use file extensions in import paths (required by the browser without a bundler).
3. **Handle mutable shared state:** the original code has `let highScores = ...`, `let mazeDistances = ...`, `let previousTime = ...` that mutate from many sites. Put each in `src/state.js` as a `let` export wrapped in a getter/setter pair (`getHighScores()`, `setHighScores(v)`), OR export a mutable object whose properties get mutated (preferred — simpler diff).
4. **Resolve circular references** that emerge: `Tower.castAbility` calls `dealDamageToEnemy` (combat module), which calls `onEnemyKilled` which may call `spawnSplitChildren` (which calls `new Enemy(...)`). Break cycles by injecting dependencies at boot via a small "kernel" object, OR by routing through a `src/registry.js` module that holds references after `boot()` populates them.
5. Change `index.html:279` from `<script src="game.js"></script>` to `<script type="module" src="./src/main.js"></script>`.
6. Delete `game.js` (the monolithic original) only after all tests pass.
7. Run the full `REGRESSION_CHECKLIST.md` end-to-end before deleting `game.js`.

**Acceptance:**
- [ ] `python3 -m http.server 8080` serves the game with zero console errors.
- [ ] All 7 sections of `REGRESSION_CHECKLIST.md` pass on Chrome (the existing target).
- [ ] `localStorage` save key `green_circle_td_run_v2` is byte-compatible: a save made before the split loads cleanly after.
- [ ] `git ls-files src/` lists 25+ small files (none over 400 lines).
- [ ] No `eval`, no inline `<script>` in `index.html` other than the existing `window.SPEEDRUN_HOME_URL` hook.

### Task 2: Replace hardcoded absolute paths in README — ✅ DONE 2026-08-14
**Effort:** S
**Files:** `README.md`
**What:** Two absolute paths in the Guardrails section won't resolve for anyone but the original author.
**Why:** `README.md:42-43` referenced a stale absolute path to a long-gone temp checkout for `REGRESSION_CHECKLIST.md` and `game.js`. AI agents and other contributors land here and immediately hit a broken trail.
**Steps:**
1. Open `README.md`. Replace both absolute paths with repo-relative ones (`REGRESSION_CHECKLIST.md`, and the guardrails now live in `src/guardrails.js`).
2. Reword the surrounding sentences so the relative paths read naturally: "Run `REGRESSION_CHECKLIST.md` checks before pushing UI or gameplay updates." and "Startup guardrails in `game.js` validate required DOM hooks and core speed/save assumptions at boot."
3. While you're in there, mention that this is the canonical source and the umbrella has a downstream drop.

**Acceptance:**
- [ ] `grep -n /Users/ README.md` returns nothing.
- [ ] `README.md` builds correctly in any markdown previewer; the file links resolve in the GitHub UI.

## P1 — High-value

### Task 3: Add CI with headless boot check — ✅ DONE 2026-08-14 (ci.yml: npm test + scripts/smoke-boot.mjs; smoke verified to pass clean and fail on an injected syntax error)
**Effort:** M
**Files:** `.github/workflows/ci.yml` (new), `scripts/smoke-boot.mjs` (new), `package.json` (new — minimal).
**What:** GitHub Action that on PR + push-to-main: serves the static site, loads it in headless Chrome, asserts no console errors during boot + a 3-second idle window.
**Why:** Today `REGRESSION_CHECKLIST.md` is the only gate. It's manual, takes 10+ minutes, and skips runtime smoke. A headless boot catches the 80% case (missing DOM hook, throwing class constructor, broken module import) for free.
**Steps:**
1. Add a minimal `package.json`: `{ "name": "tower-wars", "private": true, "type": "module", "scripts": { "serve": "python3 -m http.server 8080", "smoke": "node scripts/smoke-boot.mjs" }, "devDependencies": { "puppeteer": "^23.0.0" } }`.
2. Add `node_modules/` to `.gitignore`.
3. Write `scripts/smoke-boot.mjs` that spawns `python3 -m http.server 8080`, waits for the port (poll `fetch` until 200), launches puppeteer, collects `pageerror` + console `error` entries, navigates to `http://localhost:8080`, waits 3000 ms, asserts the collected errors array is empty and `await page.$('#game')` resolves to a Canvas element, tears everything down.
4. Add `.github/workflows/ci.yml`: matrix on Node 22, install puppeteer, run smoke. Cache `~/.cache/puppeteer`.
5. Add a "CI" badge to `README.md`.

**Acceptance:**
- [ ] Push a syntax error to `game.js` (or any `src/*.js` after Task 1) — CI exits non-zero.
- [ ] Push a clean change — CI exits 0 in under 2 minutes.
- [ ] Badge on README reflects the actual state.

### Task 4: Add `speedrungames.json` manifest — ⛔ SUPERSEDED (that manifest is for externally-hosted games the portal proxies; this game deploys INTO the portal via game.manifest.json + deploy.yml, which also maintains the registry entry)
**Effort:** S
**Files:** `speedrungames.json` (new).
**What:** Drop a v1 manifest so the umbrella auto-discovers this game.
**Why:** Without the manifest, the umbrella maintains a manual entry (a separate edit, a separate risk of drift). With it, this game is one rsync away from being live.
**Steps:**
1. Create `speedrungames.json` with: `slug: "tower-wars"`, `title: "Tower Wars"`, `description: "Maze TD inspired by Warcraft 3 Line Tower Wars."`, `emoji: "🏰"`, `deployUrl: "https://<…>.netlify.app"` (confirm with umbrella owner what URL to use — likely the umbrella subdirectory `https://speedrungames.net/games/tower-wars/` if the umbrella drops the static files directly).
2. Verify the umbrella's `discover-games.mjs` picks up the manifest on next run.
3. Remove the manual entry from `apps/web/src/lib/games.data.json` in the umbrella (separate PR).

**Acceptance:**
- [ ] `cat speedrungames.json | jq` validates as JSON.
- [ ] Umbrella's discovery script lists `tower-wars` from manifest, not from manual entry.

### Task 5: Fix `onEnemyKilled` signature bug — ✅ DONE (kill credit + serialize + selection panel shipped earlier)
**Effort:** S
**Files:** `game.js` (pre-Task-1) OR `src/combat.js` (post-Task-1).
**What:** `dealDamageToEnemy` calls `onEnemyKilled(enemy, sourceTower)` but `onEnemyKilled(enemy)` has only one parameter. The tower is silently dropped.
**Why:** Future features ("kill credit on hover", "tower kill streak", "boss-killer bonus") will pretend to work and silently no-op. Found at `game.js:2185, 2192`.
**Steps:**
1. Update the signature to `function onEnemyKilled(enemy, sourceTower)`. Add a JSDoc note: `sourceTower may be null for area effects.`
2. Wire `sourceTower` into a new optional kill-attribution path: increment a `tower.kills` counter on the source tower if non-null.
3. Surface `kills` in `describeTower` and `updateSelectionPanel`.

**Acceptance:**
- [ ] Select a tower, kill an enemy with it; the Selection panel shows the kill count increase.
- [ ] Selecting via `localStorage` Save → reload restores `kills` (need to add to `Tower.serialize/fromSave`).

### Task 6: Migrate timer/storage to `speedrungames-sdk` — ⛔ SUPERSEDED (bespoke sim-time speedrun clock + submitRun landed in v1.3.0; migrating storage would break the stable save keys for no user-visible gain)
**Effort:** L
**Files:** `package.json` (new), `src/main.js` (post-Task-1), various.
**What:** Drop the bespoke save/highscore code and the wave-as-score model in favor of SDK's `SpeedrunTimer` + `createStorage(slug)` + `submitRun({slug, ms, splits})`.
**Why:** Tower-wars currently has no objective speedrun metric, so it can't appear on the leaderboard. Wave count is a survival metric, not a run time. Adopting the SDK aligns it with every other game on the umbrella.
**Steps:**
1. Define what "a run" means for tower-wars. Proposed: "reach wave 20 from wave 0 without losing". Time = ms from `startWave(1)` to end of wave 20.
2. Replace `RUN_SAVE_KEY` / `HIGH_SCORE_KEY` localStorage with `createStorage("tower-wars")`. Use the SDK's `maybeSavePB({ms, achievedAt, splits})`.
3. Wire wave-clear events as splits: `timer.split(\`wave \${n}\`)`.
4. Wire run-finish (wave 20 cleared) into `timer.finish() → submitRun({slug: "tower-wars", ms, splits})`.
5. Keep the existing "endless mode" as a separate, non-timed gameplay variant. The timer only runs in "speedrun mode".
6. Add a Speedrun / Endless mode picker to the existing Mode row.
**Acceptance:**
- [ ] In speedrun mode, finishing wave 20 surfaces a "New PB: 12:34.567" banner if applicable.
- [ ] The umbrella's `/leaderboards/tower-wars` shows a run after first completion.
- [ ] Endless mode still works exactly as today, with high scores intact.

### Task 7: Document and automate the umbrella drop — ⛔ SUPERSEDED (deploy.yml auto-deploys via the portal's reusable deploy-game.yml on push to main; documented in README §Releasing)
**Effort:** S
**Files:** `scripts/drop-to-umbrella.sh` (new), `README.md`.
**What:** A two-line script that rsyncs the canonical files to the umbrella's `apps/web/public/games/tower-wars/` directory in a sibling checkout.
**Why:** The umbrella has a manual copy of `game.js` that drifts. Today the drop happens by memory; codify it.
**Steps:**
1. Write `scripts/drop-to-umbrella.sh` accepting an env var or arg for the umbrella checkout path (default `../speedrungames`). Use `rsync -av --delete --exclude=.git --exclude=node_modules ./ "$UMBRELLA/apps/web/public/games/tower-wars/"`.
2. Document in `README.md` under a new "Releasing" section.
3. Optionally turn this into a GitHub Action that opens a PR against the umbrella on tag push.

**Acceptance:**
- [ ] `bash scripts/drop-to-umbrella.sh ../speedrungames` syncs all canonical files and only those.
- [ ] No untracked `.DS_Store`, `node_modules`, etc. land in the umbrella.

## P2 — Quality / polish

### Task 8: Extract abilities into a data-driven table — ✅ DONE 2026-08-14 (src/abilities.js ABILITIES map, bodies moved verbatim; test/abilities.spec.mjs guards coverage + cooldown contract)
**Effort:** M
**Files:** `src/abilities.js` (new, post-Task-1).
**What:** Today `Tower.castAbility` is a 175-line if-chain with 10 hardcoded ability implementations (`game.js:1398-1574`). Convert each ability into an entry in an `ABILITIES` map: `{volley: { cooldown, range: 'self', targets: 'top-N', count: 6, effect: ({tower, targets}) => ... }}`.
**Why:** New abilities require touching one switch deep inside a class. A data-driven table makes them composable and testable in isolation.
**Acceptance:**
- [ ] Every existing ability has the same behavior (run regression checklist).
- [ ] Adding a new ability requires adding one entry, not editing `castAbility`.

### Task 9: Unit tests for damage / wave math — ✅ DONE (vitest golden suite: test/golden-suite.mjs covers the damage table, immunity paths, economy, and wave plans)
**Effort:** M
**Files:** `test/damage.test.mjs`, `test/waves.test.mjs`, `package.json`.
**What:** Once the modules exist (Task 1), add tests with `node --test`. Cover the damage type × armor table, magic immunity, no-AA path, boss multiplier, leak penalty. Cover `buildWavePlan` for boss/air/splitter/assault selection.
**Why:** These pure functions are the core of game feel and regress easily.
**Acceptance:**
- [ ] `node --test test/` passes locally and in CI.
- [ ] Tests run in < 3 seconds.

### Task 10: Clear the music interval on game over — ✅ DONE 2026-08-14 (stopMusicLoop() on defeat; ensureAudioActive restarts it once a new run is underway)
**Effort:** S
**Files:** `src/audio.js` (post-Task-1) or `game.js:4577-4595` (pre-).
**What:** `startMusicLoop` sets `audio.musicTimer = setInterval(...)` and never calls `clearInterval`. The callback returns early if `game.gameOver`, but the interval keeps firing forever.
**Steps:** In `update()` or wherever game-over is detected, call `clearInterval(audio.musicTimer); audio.musicTimer = null;`. Reset on `restartRun()`.
**Acceptance:**
- [ ] After 10 game-over cycles, no interval leak (verify with Chrome DevTools Performance recording).

### Task 11: Remove duplicate `saveRun` calls — ✅ DONE 2026-08-14 (kept: 5s autosave, defeat, mode change, restart, explicit Save; removed: build/sell/sends/startWave/toggleAutoWave/wave-clear)
**Effort:** S
**Files:** `game.js` or split modules.
**What:** `saveRun(false)` is called from `tryBuildTower`, `tryUpgradeSelectedTower`, `chooseBranch`, `queueSend`, `clearSendQueue`, `startWave`, the wave-clear bonus block, and the autosave timer in `update()`. Pick one: action-triggered OR autosave-on-timer, not both.
**Why:** Per-action saves stall the main thread on `JSON.stringify(largeSnapshot) + localStorage.setItem` more often than necessary.
**Steps:** Remove the per-action `saveRun(false)` calls; keep only the 5-second autosave + on game-over + on explicit Save button.
**Acceptance:**
- [ ] Build 5 towers in quick succession; reload; the last tower (built ≤ 5s before reload) may not persist — acceptable trade-off.
- [ ] Chrome DevTools shows no `localStorage.setItem` calls in the build-tower flow.

### Task 12: Wire or remove `drawTowerRankAndBranch` — ✅ DONE (wired into drawTower during the Ink & Iron pass)
**Effort:** S
**Files:** `src/render.js` (post-Task-1) or `game.js:3946`.
**What:** Function is defined but `grep` shows no callers.
**Acceptance:** Either it's called from `drawTower` and visibly renders rank dots / branch letters, or it's deleted.

## P3 — Nice-to-haves

### Task 13: Mobile touch + pinch-zoom — ✅ DONE (src/touch.js, Phase 2c)
**Effort:** M
**What:** Today the canvas accepts mouse + wheel. Touch devices get tap-to-build (works) but no two-finger pan or pinch zoom. Add `touchstart/move/end` handlers that mirror the mouse + wheel behavior.

### Task 14: Tower upgrade tooltip on hover-while-selected — ✅ DONE 2026-08-14 (Tower.upgradePreview() + dataset.tip on the Upgrade button)
**Effort:** S
**What:** When a tower is selected and its Upgrade button is focused, show the next level's effective damage/range/rate in the tooltip box. Today the tooltip only shows the button's static description.

### Task 15: Wave preview (peek next wave's composition) — ✅ DONE (Quick Info "Next Wave" + wave-preview line in ui-sync.js)
**Effort:** M
**What:** Between waves, show the next wave's tag + creep count + special properties (boss / air / splitter / spellbreaker injection). Currently the player has to remember `buildWavePlan`'s schedule.

### Task 16: Vendor Google Fonts — ✅ DONE 2026-08-14 (assets/fonts/*.woff2 + styles.fonts.css; zero external requests verified)
**Effort:** S
**What:** `index.html:8-12` loads Cinzel + Rajdhani from `fonts.googleapis.com`. Vendor the WOFF2 files into `assets/fonts/` and reference them locally so the game works offline and isn't gated by a CDN.

### Task 17: Add SOX-style audit log of moves for replay analysis — ⏸ DEFERRED (L effort, speculative feature)
**Effort:** L
**What:** Record (timestamp, action, payload) for every player input + wave start. Persist alongside the save. Future feature: a "ghost mode" that replays your PB run on the side. Not urgent, but cheap to wire if done early.

### Task 18: Difficulty toggle (Easy / Normal / Hard) — ⏸ DEFERRED (balance-sensitive; would also fragment speedrun categories — needs an operator decision first)
**Effort:** M
**What:** Scale `buildWavePlan` HP/speed by 0.8 / 1.0 / 1.3. Useful for new players and for speedrun categories.

### Task 19: Replace `setInterval` music loop with an audio buffer — ⏸ DEFERRED (leak fixed by Task 10; buffer rewrite is polish)
**Effort:** M
**What:** WebAudio's `AudioBufferSourceNode` with a looping buffer is more robust than `setInterval` + oscillators. Lower CPU, glitch-free under heavy load.

### Task 20: Accessibility pass — 🟡 PARTIAL 2026-08-14 (aria-live="polite" on #waveStatus shipped; menu focus trap + contrast audit still open)
**Effort:** M
**What:** Add `aria-live="polite"` on `#waveStatus` so screen readers announce wave events. Trap focus in the menu modal. Verify color contrast on the dark theme meets WCAG AA.
