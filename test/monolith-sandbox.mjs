// Golden-test sandbox: evaluates the PURE sections of the monolithic game.js
// inside a node:vm context, so engine behavior can be pinned BEFORE the ES-module
// split — and the same assertions re-run against the real modules afterward.
//
// Only DOM-free ranges are loaded (the IMPROVEMENT_PLAN line table). `status`
// and `saveRun` are captured as no-ops; Math.random is seeded for determinism.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Line ranges (1-based, inclusive) lifted verbatim from game.js. */
const RANGES = [
  ["constants", 88, 130],
  ["damage", 179, 199],
  ["paths", 201, 301],
  ["sendsData", 326, 369],
  ["state", 668, 792], // stops before `let highScores = loadHighScores()`
  ["sendFns", 1850, 2096], // getIncomePayout .. consumeSendQueueForWave (no updateSendUi)
  ["dmgMult", 2141, 2148], // getDamageMultiplier only
  ["grid", 2248, 2269],
  ["maze", 2484, 2547],
  ["waves", 2771, 2932], // randomRange .. buildDuelWavePlan (no spawnEnemyFromQueue)
];

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

const PREAMBLE = `
const window = {}; // constants reads window.SPEEDRUN_HOME_URL at load
let highScores = [];
let mazeDistances = null;
const __statusLog = [];
function status(text) { __statusLog.push(String(text)); }
function saveRun() {}
function updateSendUi() {}
let __rng = __mulberry32(__SEED);
Math.random = () => __rng();
function __setSeed(s) { __rng = __mulberry32(s); }
`;

/**
 * Build a fresh monolith engine. Returns the vm context — every top-level
 * const/let/function/class from the loaded ranges is a property lookup away
 * (vm contexts expose classic-script function/var decls via the global object;
 * const/let live in the context's declarative record, so we export them
 * explicitly with a trailing collector script).
 */
export function makeMonolithEngine(seed = 1337) {
  const src = readFileSync(resolve(ROOT, "game.js"), "utf8").split("\n");
  const slice = (a, b) => src.slice(a - 1, b).join("\n");

  const names = [
    // constants
    "TILE", "COLS", "ROWS",
    // damage
    "DAMAGE_TABLE", "DAMAGE_LABELS", "ARMOR_LABELS",
    // paths
    "PATH_NODES", "PATH_CELLS", "WAYPOINTS", "PATH_SET", "MAZE_START", "MAZE_EXIT",
    "DUEL_LANE_IDS", "DUEL_PATH_CELLS", "DUEL_WAYPOINTS", "DUEL_SPAWNS", "DUEL_EXITS", "DIR4",
    // sends
    "SEND_OPTIONS", "isSendLocked", "getIncomePayout", "makeSendUnits",
    "queueSend", "clearSendQueue", "consumeSendQueueForWave",
    // state
    "game", "towers", "enemies", "createPlayerState", "getPlayerState",
    "getActivePlayerState", "syncLegacyEconomyFromActive", "syncActiveToLegacyIfDuel",
    // combat/grid/maze
    "getDamageMultiplier", "worldFromCell", "getCellAt", "inBounds", "clamp",
    "isMazeReservedCell", "getBlockedMazeCellSet", "computeMazeDistanceMap",
    // waves
    "randomRange", "makeNormalUnit", "makeAirUnit", "makeSplitterUnit", "makeBossUnit",
    "buildWavePlan", "buildDuelWavePlan",
    // harness
    "__statusLog", "__setSeed",
  ];

  const body = RANGES.map(([, a, b]) => slice(a, b)).join("\n\n");
  const collector = `__exports = { ${names.join(", ")} };`;

  const context = vm.createContext({ __mulberry32: mulberry32, __SEED: seed, __exports: null });
  vm.runInContext(`${PREAMBLE}\n${body}\n${collector}`, context, { filename: "monolith-sandbox.js" });
  return context.__exports;
}
