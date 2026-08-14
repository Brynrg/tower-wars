// @vitest-environment happy-dom
//
// Guards the ABILITIES table (Task 8 refactor): every ability id declared on a
// TOWER_DATA branch must have an implementation, casting runs the table entry,
// and the cooldown contract is preserved.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Populate the document with the real markup so dom.js finds every element.
const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
document.body.innerHTML = (bodyMatch ? bodyMatch[1] : html)
  .replace(/<script[\s\S]*?<\/script>/gi, ""); // markup only — modules are imported below
window.SPEEDRUN_HOME_URL = "/";

const [{ ABILITIES }, { TOWER_DATA, Tower }, { enemies, buffZones, game }] = await Promise.all([
  import("../src/abilities.js"),
  import("../src/towers.js"),
  import("../src/state.js"),
]);

function declaredAbilityIds() {
  const ids = new Set();
  for (const data of Object.values(TOWER_DATA)) {
    for (const branch of Object.values(data.branches || {})) {
      if (branch.ability) {
        ids.add(branch.ability.id);
      }
    }
  }
  return ids;
}

describe("ability table coverage", () => {
  it("every TOWER_DATA branch ability has an implementation", () => {
    for (const id of declaredAbilityIds()) {
      expect(ABILITIES[id], `missing ABILITIES entry for "${id}"`).toBeTypeOf("function");
    }
  });

  it("no orphaned implementations without a declaring branch", () => {
    const declared = declaredAbilityIds();
    for (const id of Object.keys(ABILITIES)) {
      expect(declared.has(id), `ABILITIES["${id}"] has no TOWER_DATA branch`).toBe(true);
    }
  });
});

describe("castAbility contract", () => {
  beforeEach(() => {
    enemies.length = 0;
    buffZones.length = 0;
    game.duelMode = false;
  });

  it("rally cast pushes a buff zone and starts the cooldown", () => {
    const tower = new Tower("arrow", 100, 100);
    tower.level = 3;
    tower.chooseBranch("b"); // Captain -> rally
    expect(tower.ability.id).toBe("rally");

    expect(tower.castAbility()).toBe(true);
    expect(buffZones.length).toBe(1);
    expect(buffZones[0].name).toBe("Rally");
    expect(tower.abilityCooldown).toBe(tower.ability.cooldown);
  });

  it("cast while on cooldown is rejected", () => {
    const tower = new Tower("arrow", 100, 100);
    tower.level = 3;
    tower.chooseBranch("b");
    tower.castAbility();
    expect(tower.castAbility()).toBe(false);
    expect(buffZones.length).toBe(1);
  });
});
