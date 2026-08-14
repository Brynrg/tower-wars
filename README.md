# Tower Wars (Maze TD)

[![CI](https://github.com/Brynrg/tower-wars/actions/workflows/ci.yml/badge.svg)](https://github.com/Brynrg/tower-wars/actions/workflows/ci.yml)

Standalone static browser tower defense inspired by Warcraft 3 Line Tower Wars / Green Circle TD.

## Run locally

```bash
cd tower-wars
python3 -m http.server 8080
```

Open http://localhost:8080

## Controls

- Build towers: `1 2 3 4 5 0 -`
- Upgrade selected tower: `U`
- Cast tower ability: `F`
- Pause: `P`
- Change speed: `T`
- Toggle auto wave: `A`
- Toggle mode: `M`
- Start wave: `Space`
- Pan map: `Arrow keys`, `Right-drag`, `Alt+drag`, mouse `Scroll`
- Zoom map: `Ctrl/Cmd + Mouse Wheel`

## Gameplay systems included

- Classic + Maze pathing modes
- Bundle 2 economy depth:
  - Income ticks
  - Send queue with refund/clear
  - Leak penalties reduce income
- Bundle 3 towers and mechanics:
  - Fire Mortar (burn, splash, incendiary patch)
  - Frost Obelisk (slow control, permafrost aura, ice-lance freeze window)

## Code layout

No bundler — `index.html` loads native ES modules directly via `<script type="module" src="./src/main.js">`. The former 5,119-line monolithic `game.js` was split into 36 modules under `src/` (one concern per file: `state.js`, `towers.js`, `enemies.js`, `waves.js`, `render.js`, `save.js`, …) by `tools/split-codemod.mjs`; the monolith itself is deleted. `npm run build` (`build.mjs`) just stages the static files into `dist/` for the portal.

## Guardrails

- Run the `REGRESSION_CHECKLIST.md` manual QA pass before pushing UI or gameplay updates.
- Run `npm test` — the golden suite (`test/golden-suite.mjs`, executed against the `src/` modules by `test/golden.modules.spec.mjs`) pins damage math, economy, and wave-plan behavior; `test/abilities.spec.mjs` guards the ability table.
- Run `npm run smoke` — headless Chrome boot check (`scripts/smoke-boot.mjs`): fails on any console/page error during boot. CI runs both on every push and PR.
- Startup guardrails in `src/guardrails.js` validate required DOM hooks and core speed/save assumptions at boot.

## Releasing

Push to `main`. CI (`ci.yml`: golden suite + headless boot smoke) and the auto-deploy
(`deploy.yml`) both run: deploy calls the portal's reusable `deploy-game.yml` workflow
(Brynrg/speedrungames), which builds `dist/` via `npm run build`, ingests it into the
portal, and updates the registry. Never hand-copy build output into the portal — this
repo is the canonical source; the umbrella carries only that generated drop.
