// Shared golden assertions — pinned against the MONOLITH (game.js) before the
// ES-module split, then re-run unchanged against the real src/ modules after.
// Values below were recorded from the live monolith (seed 1337 / 7).
//
// The suite owns its preconditions: every block sets the game/player fields it
// depends on, and wave tests reseed the RNG, so one engine instance can host
// the whole run in any order.
import { describe, it, expect, beforeEach } from "vitest";

export function runGoldenSuite(label, engine, reseed) {
  describe(`${label}: damage model`, () => {
    it("damage table spot values", () => {
      expect(engine.getDamageMultiplier("siege", "fortified")).toBe(1.5);
      expect(engine.getDamageMultiplier("magic", "heavy")).toBe(1.25);
      expect(engine.getDamageMultiplier("piercing", "light")).toBe(1.5);
      expect(engine.getDamageMultiplier("spell", "fortified")).toBe(1.1);
      expect(engine.getDamageMultiplier("piercing", "fortified")).toBe(0.35);
    });
    it("unknown damage/armor types fall back to 1", () => {
      expect(engine.getDamageMultiplier("pierce", "light")).toBe(1); // not a key ("piercing" is)
      expect(engine.getDamageMultiplier("siege", "nope")).toBe(1);
      expect(engine.getDamageMultiplier("spell", "hero")).toBe(1); // no hero armor class
    });
    it("table is complete over its own label space", () => {
      for (const d of Object.keys(engine.DAMAGE_TABLE)) {
        for (const a of Object.keys(engine.DAMAGE_TABLE[d])) {
          expect(typeof engine.DAMAGE_TABLE[d][a]).toBe("number");
        }
      }
    });
  });

  describe(`${label}: path geometry`, () => {
    it("classic path shape", () => {
      expect(engine.TILE).toBe(48);
      expect(engine.COLS).toBe(34);
      expect(engine.ROWS).toBe(20);
      expect(engine.PATH_CELLS.length).toBe(82);
      expect(engine.PATH_SET.size).toBe(82);
      expect(engine.WAYPOINTS.length).toBe(12);
      expect(engine.WAYPOINTS[0]).toEqual({ x: 24, y: 504 });
      expect(engine.WAYPOINTS.at(-1)).toEqual({ x: 1608, y: 504 });
    });
    it("maze endpoints + duel lanes", () => {
      expect(engine.MAZE_START).toEqual({ cx: 0, cy: 10 });
      expect(engine.MAZE_EXIT).toEqual({ cx: 33, cy: 10 });
      expect(engine.DUEL_LANE_IDS).toEqual([0, 1]);
    });
  });

  describe(`${label}: maze BFS`, () => {
    beforeEach(() => {
      engine.towers.length = 0;
    });
    it("empty board: exit reachable, start distance 33 (manhattan corridor)", () => {
      const r = engine.computeMazeDistanceMap(null);
      expect(r.reachable).toBe(true);
      expect(r.dist[engine.MAZE_EXIT.cy][engine.MAZE_EXIT.cx]).toBe(0);
      expect(r.dist[engine.MAZE_START.cy][engine.MAZE_START.cx]).toBe(33);
    });
    it("reserved endpoints cannot be blocked (block attempt on start is ignored)", () => {
      const r = engine.computeMazeDistanceMap({ cx: engine.MAZE_START.cx, cy: engine.MAZE_START.cy });
      expect(r.reachable).toBe(true);
    });
    it("a tower wall forces a detour (distance grows, still reachable)", () => {
      // wall across column 5, rows 0..18 — one gap at the bottom row
      for (let cy = 0; cy <= 18; cy++) {
        engine.towers.push({ x: 5 * engine.TILE + 1, y: cy * engine.TILE + 1 });
      }
      const r = engine.computeMazeDistanceMap(null);
      expect(r.reachable).toBe(true);
      expect(r.dist[engine.MAZE_START.cy][engine.MAZE_START.cx]).toBeGreaterThan(33);
    });
    it("a full wall makes the exit unreachable", () => {
      for (let cy = 0; cy <= 19; cy++) {
        engine.towers.push({ x: 5 * engine.TILE + 1, y: cy * engine.TILE + 1 });
      }
      const r = engine.computeMazeDistanceMap(null);
      expect(r.reachable).toBe(false);
      expect(r.dist[engine.MAZE_START.cy][engine.MAZE_START.cx]).toBe(-1);
    });
  });

  describe(`${label}: economy / sends`, () => {
    beforeEach(() => {
      // Suite owns preconditions: classic mode, fresh wallet, idle wave.
      engine.game.duelMode = false;
      engine.game.activePlayer = 0;
      engine.game.waveActive = false;
      engine.game.gameOver = false;
      engine.game.wave = 0;
      engine.game.gold = 230;
      engine.game.income = 2;
      engine.game.sendQueue = [];
      engine.__statusLog.length = 0;
    });

    it("classic mode: the active player IS the legacy game object", () => {
      expect(engine.getActivePlayerState()).toBe(engine.game);
    });

    it("income payout reads the active state's income", () => {
      expect(engine.getIncomePayout()).toBe(2);
      engine.game.income = 9;
      expect(engine.getIncomePayout()).toBe(9);
    });

    it("queueSend debits gold, grows income, records the entry", () => {
      engine.queueSend("runner");
      const opt = engine.SEND_OPTIONS.runner;
      expect(engine.game.gold).toBe(230 - opt.cost);
      expect(engine.game.income).toBe(2 + opt.incomeGain);
      expect(engine.game.sendQueue).toHaveLength(1);
      expect(engine.game.sendQueue[0]).toMatchObject({
        key: opt.id, cost: opt.cost, incomeGain: opt.incomeGain, wavePurchased: 0,
      });
    });

    it("queueSend refuses when gold is short (state untouched)", () => {
      engine.game.gold = 1;
      engine.queueSend("miniboss");
      expect(engine.game.gold).toBe(1);
      expect(engine.game.sendQueue).toHaveLength(0);
      expect(engine.__statusLog.at(-1)).toMatch(/Not enough gold/);
    });

    it("clearSendQueue refunds cost and removes income", () => {
      engine.queueSend("runner");
      engine.queueSend("armor");
      const goldAfterBuys = engine.game.gold;
      const incomeAfterBuys = engine.game.income;
      const spent = 230 - goldAfterBuys;
      engine.clearSendQueue();
      expect(engine.game.gold).toBe(goldAfterBuys + spent);
      expect(engine.game.income).toBe(2);
      expect(incomeAfterBuys).toBeGreaterThan(2);
      expect(engine.game.sendQueue).toHaveLength(0);
    });

    it("consumeSendQueueForWave empties the queue and stamps lanes", () => {
      reseed(42);
      engine.queueSend("runner");
      const res = engine.consumeSendQueueForWave(engine.game, 2, 1);
      expect(res.units).toHaveLength(6);
      expect(res.summary).toBe("Runner Pack x1");
      expect(res.units[0]).toMatchObject({ name: "Runner", lane: 1, targetPlayer: 1 });
      expect(engine.game.sendQueue).toHaveLength(0);
    });

    it("miniboss send pack (seed 7, wave 4) is byte-stable", () => {
      reseed(7);
      const units = engine.makeSendUnits("miniboss", 4);
      expect(units).toEqual([
        {
          name: "Mini Tyrant", armorType: "fortified", hp: 960, speed: 50.4,
          reward: 92, leakDamage: 3, radius: 19, color: "#764940", rim: "#f2c894",
          slowImmune: false,
        },
      ]);
    });
  });

  describe(`${label}: duel economy sync`, () => {
    beforeEach(() => {
      engine.game.duelMode = true;
      engine.game.players = [engine.createPlayerState(0), engine.createPlayerState(1)];
      engine.game.activePlayer = 0;
    });
    it("sync copies the seven economy fields and SHARES the sendQueue array", () => {
      const active = engine.getActivePlayerState();
      expect(active).not.toBe(engine.game);
      active.gold = 555; active.lives = 7; active.score = 99;
      active.income = 13; active.incomeTimer = 4.2; active.incomeInterval = 8;
      active.sendQueue.push({ key: "runner" });
      engine.syncLegacyEconomyFromActive();
      expect(engine.game.gold).toBe(555);
      expect(engine.game.lives).toBe(7);
      expect(engine.game.score).toBe(99);
      expect(engine.game.income).toBe(13);
      expect(engine.game.incomeTimer).toBe(4.2);
      expect(engine.game.incomeInterval).toBe(8);
      expect(engine.game.sendQueue).toBe(active.sendQueue); // reference, not copy
    });
    it("sync is a no-op outside duel mode", () => {
      engine.game.duelMode = false;
      engine.game.gold = 111;
      engine.syncLegacyEconomyFromActive();
      expect(engine.game.gold).toBe(111);
    });
    it("syncActiveToLegacyIfDuel delegates (same observable effect)", () => {
      const active = engine.getActivePlayerState();
      active.gold = 777;
      engine.syncActiveToLegacyIfDuel();
      expect(engine.game.gold).toBe(777);
    });
  });

  describe(`${label}: wave plans (seed 1337)`, () => {
    beforeEach(() => reseed(1337));
    it("wave 1 — assault", () => {
      const p = engine.buildWavePlan(1);
      expect(p.tag).toBe("Assault Wave");
      expect(+p.interval.toFixed(4)).toBe(0.806);
      expect(p.queue).toHaveLength(10);
      expect(p.queue[0]).toMatchObject({ name: "Footman", hp: 102, speed: 78, armorType: "medium" });
      expect(p.queue.at(-1)).toMatchObject({ name: "Footman", hp: 100 });
    });
    it("wave 5 — air", () => {
      const p = engine.buildWavePlan(5);
      expect(p.tag).toBe("Air Wave");
      expect(p.queue).toHaveLength(17);
      expect(p.queue[0]).toMatchObject({ name: "Wyvern", hp: 142, speed: 103, armorType: "light" });
    });
    it("wave 7 — splitter", () => {
      const p = engine.buildWavePlan(7);
      expect(p.tag).toBe("Splitter Wave");
      expect(p.queue).toHaveLength(17);
      expect(p.queue[0]).toMatchObject({ name: "Broodling", hp: 192, speed: 84.5 });
    });
    it("wave 9 — assault + spellbreaker capstone", () => {
      const p = engine.buildWavePlan(9);
      expect(p.queue).toHaveLength(27);
      expect(p.queue.at(-1)).toMatchObject({ name: "Spellbreaker", hp: 320, magicImmune: true });
    });
    it("wave 10 — boss", () => {
      const p = engine.buildWavePlan(10);
      expect(p.tag).toBe("Boss Wave");
      expect(p.interval).toBe(1.45);
      expect(p.queue).toHaveLength(1);
      expect(p.queue[0]).toMatchObject({ name: "War Chief", hp: 2700, speed: 54, armorType: "fortified" });
    });
    it("duel plan fans every unit out to both lanes", () => {
      const p = engine.buildDuelWavePlan(3);
      expect(p.tag).toBe("Assault Wave Duel");
      expect(p.queue).toHaveLength(28); // 14 base units × 2 lanes
      const lanes = new Set(p.queue.map((u) => u.lane));
      expect([...lanes].sort()).toEqual([0, 1]);
    });
  });
}
