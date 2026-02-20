# Tower Wars (Maze TD)

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

No build step or bundler required (`index.html`, `styles.css`, `game.js`).
