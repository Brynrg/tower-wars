// @vitest-environment happy-dom
//
// The SAME golden suite, now against the real src/ ES modules. The DOM must be
// populated from index.html BEFORE the modules load (dom.js grabs elements at
// import time), hence the dynamic imports inside the setup.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runGoldenSuite } from "./golden-suite.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Populate the document with the real markup so dom.js finds every element.
const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
document.body.innerHTML = (bodyMatch ? bodyMatch[1] : html)
  .replace(/<script[\s\S]*?<\/script>/gi, ""); // markup only — modules are imported below
window.SPEEDRUN_HOME_URL = "/";

const [constants, damage, paths, state, sends, combat, maze, waves] = await Promise.all([
  import("../src/constants.js"),
  import("../src/damage.js"),
  import("../src/paths.js"),
  import("../src/state.js"),
  import("../src/sends.js"),
  import("../src/combat.js"),
  import("../src/maze.js"),
  import("../src/waves.js"),
]);

const engine = {
  ...constants, ...damage, ...paths, ...state, ...sends, ...combat, ...maze, ...waves,
  // status() writes game.message — adapt it to the suite's tiny log surface.
  __statusLog: {
    at: () => state.game.message,
    set length(_v) { state.game.message = ""; },
  },
};

runGoldenSuite("modules", engine, (seed) => {
  const rng = mulberry32(seed);
  Math.random = () => rng();
});
