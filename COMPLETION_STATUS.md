# Completion Status

> Status doc for AI agents. Updated 2026-05-19.

**Score:** 64 / 100
**State:** Actively maintained — deepest gameplay in the portfolio, held back by a 5,119-line monolithic source file, hardcoded absolute paths in README, and zero CI.
**Last commit:** 2026-05-19 (`96e71ce` "Add COMPLETION_STATUS.md for AI agents") — Bundle 3 (Fire Mortar + Frost Obelisk) landed in `bde5656`, Bundle 2 economy in `fa9d9b8`.
**Stack:** Vanilla JS (no bundler, no modules), HTML5 Canvas 2D, WebAudio API. 7 tracked files: `index.html` (12 KB), `styles.css` (12 KB), `game.js` (138 KB / 5,119 lines), `README.md`, `REGRESSION_CHECKLIST.md`, `COMPLETION_STATUS.md`, `.gitignore`. Local serving via `python3 -m http.server 8080`. No package.json, no dependencies, no build step.

## Architecture
- **Single-script architecture:** `index.html` loads `styles.css` and `game.js` directly. Everything in `game.js` runs in global scope on parse — no module system, no IIFE, no entry function until `boot()` is called at line 5119.
- **`game.js` major sections (line-numbered for splitting):**
  - **DOM refs + constants** (lines 1-157): grabs ~60 DOM elements by ID at top of file; defines tile grid (`TILE=48`, `COLS=34`, `ROWS=20`), save keys (`green_circle_td_run_v2`, `green_circle_td_highscores_v2`), `SPEED_LEVELS`, `HOME_URL`, `REQUIRED_DOM_REFS`.
  - **Startup guardrails** (lines 159-177): `runStartupGuardrails()` validates DOM hooks exist + speed levels include 5x + save keys end in `_v2`. Throws on missing hooks.
  - **Damage/armor tables** (lines 179-199): `DAMAGE_LABELS`, `ARMOR_LABELS`, `DAMAGE_TABLE` (4 damage types × 5 armor types multiplier matrix).
  - **Path / waypoint geometry** (lines 201-300): `PATH_NODES` (classic), `buildPathCells`, `PATH_CELLS`, `WAYPOINTS`, `PATH_SET`, `MAZE_START`/`MAZE_EXIT`, duel-mode paths (`DUEL_PATH_NODES`, `DUEL_PATH_CELLS`, etc.), `DIR4` for BFS.
  - **Camera + input state** (lines 302-324): `camera` (x/y/zoom, min/max), `keyState`, `panState`, `getFitZoom()`.
  - **Send option catalog** (lines 326-369): `SEND_OPTIONS` for the 6 send-creep types (Runner, Armor, Air, Breaker, Splitter, Mini-Boss).
  - **Tower data catalog** (lines 371-666): `TOWER_DATA` for all 7 towers (Arrow, Frost, Cannon, Arcane, Venom, Fire Mortar, Frost Obelisk) — each with cost/damage/range/fireRate/projectile speed + two branches A/B with mods, ability or aura.
  - **Game state singleton + entity arrays** (lines 668-795): `game` object (mode, gold, lives, wave, score, speedIndex, autoWave, income, sendQueue, etc.), entity pools `towers/enemies/projectiles/effects/areaEffects/buffZones/statusBanners`, `createPlayerState`, duel-aware helpers (`getPlayerState`, `getActivePlayerState`, `getEnemyDefenderState`, `getEnemyLane`, `getLaneOwnerForCell`, `syncLegacyEconomyFromActive`, `syncActiveToLegacyIfDuel`), `audio` singleton.
  - **`class Enemy`** (lines 797-1136): constructor, `inferRouteMode`, `serialize`/`fromSave`, `applySlow`, `applyBurn`, `getGridCell`, `chooseNextMazeTarget`, `updateClassicOrAir`, `updateMazeGround`, `update(dt)`.
  - **`class Tower`** (lines 1138-1606): constructor, `fromSave`/`serialize`, computed getters (`data`, `branchData`, `branchCost`, `upgradeCost`, `damageType`, `canHitAir`, `slowFactor`, `slowDuration`, `splashRadius`, `burnDps`, `burnDuration`, `effectiveDamage`, `effectiveRange`, `effectiveFireRate`, `ability`), `hasAura`/`canChooseBranch`/`canUpgrade`/`canCastAbility`, `upgrade`, `chooseBranch`, `applyTempBuff`, `canTarget`, `acquireTarget`, `fire`, `castAbility` (9 abilities inlined in a giant if-chain: volley/rally/shatter/blizzard/barrage/skyfire/arcane_nova/time_lock/acid_rain/venom_spike — bundle 3 obelisk uses passive freeze-on-hit window instead), `update`.
  - **`class Projectile`** (lines 1608-1718): impact, explode (incl. fire-patch `AreaEffect` spawn), update.
  - **`class Effect`** (lines 1720-1737): short-lived visual (explosion/text/hit/kill/ring).
  - **`class AreaEffect`** (lines 1739-1776): persistent damage/slow field (blizzard, acid rain, fire patch).
  - **High score persistence** (lines 1778-1801): `loadHighScores`, `saveHighScores`.
  - **Tooltip + command-tab UI helpers** (lines 1802-1837): `defaultTooltip`, `setTooltip`, `setCommandTab`, `getButtonTooltip`, `status`.
  - **Economy + sends** (lines 1850-2139): `isSendLocked`, `getIncomePayout`, six `build*SendUnits(wave)` per send type, `makeSendUnits`, `queueSend`, `clearSendQueue`, `consumeSendQueueForWave` (lane-aware for duel), `updateSendUi`.
  - **Damage resolution** (lines 2141-2246): `getDamageMultiplier`, `dealDamageToEnemy` (handles magic-immune, no-AA, armor type, resist-floor, boss multiplier), `onEnemyKilled` (gold/score, splitter spawn, boss bounty), `spawnSplitChildren`.
  - **Grid/world/camera math** (lines 2248-2354): `worldFromCell`, `getCellAt`, `inBounds`, `clamp`, `clampCamera`, `screenToWorld`, `applyCameraTransform`, `getScreenPos`, `resizeCanvasToViewport`, `resizeMiniMapCanvas`.
  - **Minimap** (lines 2345-2455): `drawMiniMapPolyline`, `drawMiniMap` (renders board outline, paths, towers, enemies, camera frame), `handleMiniMapPointer` (click to center camera).
  - **Picking + maze pathfinding** (lines 2456-2596): `getTowerAtCell`, `getTowerAtPoint`, `getEnemyAtPoint`, `getEnemyProgress`, `isMazeReservedCell`, `getBlockedMazeCellSet`, `computeMazeDistanceMap` (BFS from exit), `rebuildMazeDistances`, `getBuildBlockReason` (returns `"road"|"occupied"|"enemy_lane"|"reserved"|"blocked_maze"|null`), `canBuildOnCell`, `setSelectedType`.
  - **Selection / build actions** (lines 2597-2769): `describeEnemy`, `describeTower`, `tryBuildTower`, `tryUpgradeSelectedTower`, `chooseBranch`, `castSelectedAbility`.
  - **Wave generation + spawn** (lines 2771-2940): `randomRange`, `makeNormalUnit`, `makeAirUnit`, `makeSplitterUnit`, `makeBossUnit`, `buildWavePlan(wave)` (boss every 10, air every 5, splitter every 7, otherwise assault + occasional spellbreaker), `buildDuelWavePlan`, `spawnEnemyFromQueue`.
  - **Wave + mode lifecycle** (lines 2941-3045): `startWave` (consumes send queue per-lane in duel, sets spawn timer), `toggleAutoWave`, `setGameMode` (resets run + rebuilds maze), `setActivePlayer`.
  - **Aura / buff resolution** (lines 3046-3112): `updateBuffsAndAuras` — resets per-frame, applies temp buff zones, tower auras (damage/rate/grantAir), slow auras (permafrost). Owner-aware in duel.
  - **Selection panel UI** (lines 3114-3184): `updateSelectionPanel` — wires stats panel buttons (Upgrade, Ability, Branch A/B) to selected tower with duel-owner checks.
  - **High scores + save/load** (lines 3185-3397): `renderHighScores`, `recordHighScore`, `getRunSnapshot`, `saveRun`, `loadRun` (validates `parsed.game` + `parsed.towers` + `parsed.enemies`, restores entity pools, players, camera, maze).
  - **Reset / menu** (lines 3399-3508): `resetRun`, `openMenu`, `closeMenu`, `restartRun`, `togglePause`, `cycleSpeed`.
  - **Rendering** (lines 3510-4205): `getMazePreviewPoints` (greedy path trace from start), `drawBoard` (grass, grid, paths, spawn/exit dots, hover cell), `drawPolygon`, `getTowerAimAngle`, `drawTowerBasePad`, 7× `drawXxxTowerModel` (arrow/frost/cannon/arcane/venom/mortar/obelisk), `drawTowerRankAndBranch`, `drawTower` (range ring for selected, owner ring in duel), `drawEnemy` (HP bar, slow/burn glows, leak warning), `drawProjectile`, `drawAreaEffect`, `drawEffect`, `drawOverlay` (status banners, Paused overlay, Defeat overlay).
  - **Main loop** (lines 4207-4385): `updateStatusBanners`, `update(dt)` (camera, income ticks, wave spawn, entity updates, leak handling, autosave every 5s), `render` (shake, camera, draw order: board → towers → enemies → projectiles → areaEffects → effects → overlay).
  - **UI sync** (lines 4387-4488): `syncUi` — every frame writes 25+ DOM elements (HUD stats, mode buttons, duel board, etc.), calls `updateSelectionPanel`, `updateSendUi`, `drawMiniMap`.
  - **Audio** (lines 4490-4596): `initAudio`, `ensureAudioActive`, `playTone`, `playSfx(kind)` with per-kind throttling, `startMusicLoop` (8-note ostinato on a setInterval).
  - **Input handlers** (lines 4598-4756): `handleBoardClick` (select tower or build), `handleCanvasMove` (hover/pan), `updateCameraFromKeys`, `handleCanvasMouseDown/Up` (alt/middle/right-drag pan), `handleCanvasWheel` (zoom on canvas only, shift-wheel pans horizontally).
  - **rAF tick + event bindings + boot** (lines 4758-5119): `tick(now)` (clamps dt, fixed substep), `bindEvents` (mouse/wheel, all buttons, all hotkeys 1-5/0/-/U/F/P/T/A/M/Tab/Space, key up/down), `boot()` (resize, guardrails, bind, load save, start rAF).

## What works (verified by reading code)
- **3 game modes** — classic, maze (BFS-pathed creeps with build-time blocked-route check), duel (two lanes with `getLaneOwnerForCell` and per-player state) — `game.js:3010-3032`, `2549-2583`.
- **7 tower types with branched upgrades** — Arrow/Frost/Cannon/Arcane/Venom/Fire Mortar/Frost Obelisk; each branches A/B at level 3 with mods + ability or aura — `game.js:371-666`.
- **9 active abilities** — Volley, Rally, Shatter, Blizzard, Barrage, Skyfire, Arcane Nova, Time Lock, Acid Rain, Venom Spike. Each implemented inline in `Tower.castAbility` — `game.js:1398-1574`.
- **Burn + slow + freeze + permafrost aura** — burn DPS ticks every 0.25s (Mortar), permafrost reduces speed in radius (Obelisk Branch A), Ice Lance applies hard freeze on a cooldown (Obelisk Branch B) — `game.js:1098-1136, 1366-1394, 3100-3111`.
- **Damage type vs armor matrix** — 4×5 multiplier table with magic-immune / no-AA / resist-floor handling — `game.js:194-199, 2141-2190`.
- **Income economy** — per-player income ticks every `incomeInterval` (10s), payout = `floor(income)`, send queue purchases boost income, leaks reduce income — `game.js:4216-4243, 4307-4316, 2001-2036`.
- **Send queue with refund** — 6 send types, `queueSend` adds to queue + spends gold + raises income, `clearSendQueue` refunds both, `consumeSendQueueForWave` injects creeps at wave start — `game.js:2001-2095`.
- **5 wave archetypes** — Boss (every 10), Air (every 5), Splitter (every 7), Assault (default) with occasional Spellbreaker injection (wave ≥ 9 and wave % 3 == 0), duel doubles the queue per lane — `game.js:2865-2931`.
- **Save / load / autosave** — versioned keys (`_v2`), full snapshot of game state + towers + enemies + areaEffects + buffZones + duel players, validates on load, autosaves every 5s in `update()`, also on every meaningful action — `game.js:3228-3397, 4344-4348`.
- **Hi-score list (top 12)** — sorted by score then wave, persisted to `green_circle_td_highscores_v2` — `game.js:3203-3226, 1778-1801`.
- **Camera** — pan via arrow keys / middle-drag / right-drag / alt-drag / shift-wheel (horizontal); zoom via ctrl/cmd+wheel (only when wheel target is canvas — so panel scrolling still works); zoom clamped between fit-to-screen and 5× — `game.js:306-312, 4679-4756`.
- **Minimap** — 220×170 canvas that shows board, paths (classic/maze preview/duel), towers (color by owner), enemies, camera viewport rectangle. Click-to-center camera — `game.js:2345-2455`.
- **WebAudio engine + 8-note loop** — `initAudio` on first interaction, throttled `playSfx`, fade-out envelope per tone, music loop runs on `setInterval` and skips while paused — `game.js:4490-4596`.
- **Menu overlay** — Resume / Restart / Return Home (via `window.SPEEDRUN_HOME_URL`). Clicking the backdrop resumes. ESC and P close menu — `game.js:3460-3503, 4921-4945, 4972-4980`.
- **Startup guardrails** — `runStartupGuardrails()` throws if any required DOM hook is missing, errors with structured `[Guardrail]` prefix — `game.js:159-177, 5102`.
- **REGRESSION_CHECKLIST.md** — 7-section manual QA gate covering startup, gameplay, maze placement, economy, save/load, camera, duel mode — `REGRESSION_CHECKLIST.md:1-58`.
- **Window-scoped home URL hook** — `window.SPEEDRUN_HOME_URL` lets the umbrella inject the home URL via inline `<script>` in `index.html:277` — `game.js:130, 4934-4938`.
- **Responsive layout** — `styles.css` has 3 breakpoints (1720px, 1320px, 920px) that re-grid the panels and stat strip — `styles.css:668-750`.

## Known gaps
- **5,119-line monolithic `game.js`.** No modules, no test surface, no way to isolate damage math from rendering. Single largest file in the portfolio. See `IMPROVEMENT_PLAN.md` Task 1 for a section-by-section split spec.
- **README contains hardcoded `/Users/jonathangarnett/Documents/New project/tower-wars-tmp/repo/...` paths.** `README.md:42-43` — these don't resolve for any other developer or AI agent. Must be relative.
- **No CI of any kind.** No GitHub Actions workflow, no smoke test, no headless boot check. The regression checklist is the only gate, and it's manual.
- **No `package.json` / no devDependencies.** Means no `npm install && npm test` story, no linter, no formatter. Style drift inside the 5K-line file is already visible (mixed quoting, mixed function/declaration styles).
- **Does NOT consume `speedrungames-sdk`.** Has its own timer (none — uses wave number for scoring), its own storage (`green_circle_td_run_v2`), its own HUD. As a result it cannot submit to the leaderboard via `submitRun({slug, ms, splits})`. Joining the SDK would unlock the leaderboard.
- **No `speedrungames.json` manifest.** Umbrella `discover-games.mjs` cannot auto-discover this game; it presumably has a manual entry in the umbrella's `games.data.json`. Adding the manifest is one file and removes the umbrella commit.
- **Drift risk: umbrella has a manual copy.** `Brynrg/speedrungames/apps/web/public/games/tower-wars/game.js` is dropped from this repo and will diverge any time someone edits in the wrong place. Two options: (a) make the umbrella's copy a git submodule, (b) document a release-drop script in this repo.
- **Music loop uses `setInterval` and never clears it.** `audio.musicTimer` is set once in `startMusicLoop` and never `clearInterval`-ed — `game.js:4577-4595`. Combined with `if (game.gameOver) return;` inside the callback, it leaks the interval even after game over. Minor, but it's there.
- **`saveRun(false)` is called on every meaningful action AND every 5s on a timer.** Save-per-build-or-upgrade-or-send is fine, but the autosave timer in `update()` is duplicative. Either remove the autosave or remove the action-triggered saves.
- **`onEnemyKilled` discards the `sourceTower` parameter.** Signature is `function onEnemyKilled(enemy)` — `game.js:2192` — but the call site `dealDamageToEnemy → onEnemyKilled(enemy, sourceTower)` at line 2185 passes a tower. The tower argument is silently dropped, so any future "kill credit" feature is broken before it starts.
- **`drawTowerRankAndBranch` is declared at 3946 but appears unused.** Grep for its name shows the function definition only. Either wire it into `drawTower` or remove it.
- **DOM-by-`getElementById` at top of file fails silently for missing IDs (returns null).** The guardrail catches missing ones in `REQUIRED_DOM_REFS` but not all 60+ refs are listed there (e.g. `goldEl`, `livesEl`, `selTypeEl`, etc.). A typo in `index.html` produces a runtime `null.textContent` somewhere far away.
- **No focus management / keyboard accessibility on the modal overlay.** ESC closes it, but Tab inside the modal doesn't trap focus, and the modal's `role="dialog" aria-modal="true"` is correct but unverified.
- **`speed === 1x` shows speed text as `1x`, not "Normal".** Cosmetic. `SPEED_LEVELS = [1, 2, 3, 4, 5]` works fine but no explicit "Normal" label.
- **No mobile touch handling beyond the canvas click.** Two-finger pan/pinch zoom aren't implemented; on touch devices the right-drag-pan idiom doesn't exist.

## Hot paths
- `game.js:797-1136` — `class Enemy` (HP, slow/burn state, maze + classic pathing). Modify here to change enemy behavior.
- `game.js:1138-1606` — `class Tower` (effective stats getters + 10 inline ability implementations). Modify here to change tower behavior or add abilities.
- `game.js:371-666` — `TOWER_DATA` catalog. Adding a tower = adding an entry here + adding a `drawXxxTowerModel` function + a hotkey in `bindEvents` + a button in `index.html`.
- `game.js:2865-2931` — `buildWavePlan(wave)` / `buildDuelWavePlan`. Modify here to change wave difficulty or pacing.
- `game.js:4216-4349` — `update(dt)`. The frame loop's logic order matters; do not reorder lightly.
- `game.js:3228-3397` — `getRunSnapshot` + `saveRun` + `loadRun`. Bump `RUN_SAVE_KEY` if shape changes incompatibly.
- `game.js:2549-2588` — `getBuildBlockReason` is the single source of truth for "can I build here?" across all three modes.
- `index.html:276-278` — `window.SPEEDRUN_HOME_URL` injection point used by `game.js:130` and the Return Home button.
- `REGRESSION_CHECKLIST.md` — manual QA gate. Run before any UI/gameplay commit.

## Notes for AI agents
- **Canonical:** this repo *is* the source. `Brynrg/speedrungames/apps/web/public/games/tower-wars/game.js` is a downstream drop — never edit there; fix here and re-drop.
- **Related repos:**
  - `Brynrg/speedrungames` (umbrella that proxies/drops this game)
  - `Brynrg/speedrungames-game-template` (Vite template for new games)
  - `Brynrg/speedrungames-sdk` (runtime; tower-wars does not consume it yet)
- **Always:** keep save keys (`green_circle_td_run_v2`, `green_circle_td_highscores_v2`) stable unless you intentionally version-bump — old runs will silently fail to load.
- **Always:** keep `window.SPEEDRUN_HOME_URL` hook intact so the umbrella's "Return Home" button works.
- **Do not:** add external CDN dependencies without a fallback. The repo is self-contained except for Google Fonts (Cinzel + Rajdhani) — and even those should arguably be vendored.
- **Do not:** edit the umbrella's drop of `game.js` directly. Drift will be lossy.
- **Before any UI/gameplay change:** open `REGRESSION_CHECKLIST.md` and do all 7 sections. The autosave will pollute your `localStorage` while testing — clear `green_circle_td_run_v2` between runs.
- **When splitting `game.js`:** see `IMPROVEMENT_PLAN.md` Task 1 for exact line-range section boundaries.
