# Green Circle TD Regression Checklist

Run these checks before merging/pushing gameplay or UI changes.

## Startup + Baseline

1. Launch static server: `python3 -m http.server 8080`.
2. Open `http://localhost:8080`.
3. Confirm no console errors on load.
4. Confirm top controls render and are clickable (`Next Wave`, `Speed`, `Menu`).

## Core Gameplay

1. Place at least 3 tower types and confirm targeting/projectiles work.
2. Upgrade a tower and choose branch A/B.
3. Use tower active ability (`F`) and confirm cooldown behavior.
4. Start a wave and confirm wave clear/bonus flow still works.

## Maze Mode Legal Placement

1. Switch to Maze mode.
2. Attempt to place a blocking tower that closes the path.
3. Confirm placement is rejected with blocked-path feedback.
4. Open a valid route and confirm wave can start.

## Economy: Income + Sends + Leak Penalty

1. Between waves, queue at least 2 send types.
2. Confirm gold decreases and income increases as expected.
3. Clear queue and confirm refund + income rollback.
4. Start wave and confirm queued sends are consumed.
5. Let at least one creep leak and confirm lives drop and income is reduced.

## Save / Load

1. Save run between waves with queued sends.
2. Refresh the page.
3. Load run.
4. Confirm towers, wave state, income, send queue, mode, and speed restore correctly.

## Camera + Controls

1. Pan with arrow keys and drag.
2. Zoom with wheel on canvas only.
3. Confirm zoom cannot go beyond map bounds (no black void around map).
4. Confirm wheel scroll over non-canvas UI does normal page/panel scrolling.

## Duel Mode

1. Switch to Duel mode and verify both player rows/stats update.
2. Switch active player and build/send from each side.
3. Confirm sends target the opponent lane.

## Final Pass

1. No console errors during 2-3 waves of play.
2. Verify `RUN_SAVE_KEY`/`HIGH_SCORE_KEY` remain unchanged unless intentionally versioning.
3. Commit message clearly states scope of change.
