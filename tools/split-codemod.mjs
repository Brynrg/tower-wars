#!/usr/bin/env node
// One-shot codemod: split game.js into src/*.js ES modules per IMPROVEMENT_PLAN
// Task 1's line table (3 boundary corrections: dom→87, constants→131,
// render→4214 for the orphaned updateStatusBanners).
//
// Mechanics: exact text copies; `export` prepended to top-level declarations;
// imports generated from a cross-module symbol table (word-boundary usage scan).
// Shared mutable `let`s (highScores, mazeDistances) move to their WRITER modules
// — ES live bindings give readers the current value with zero call-site rewrites.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SRC = readFileSync("game.js", "utf8").split("\n");

const MODULES = [
  ["dom", [[1, 87]]],
  ["constants", [[88, 131]]],
  ["guardrails", [[132, 177]]],
  ["damage", [[179, 199]]],
  ["paths", [[201, 301]]],
  ["camera", [[302, 325], [2270, 2327]]],
  ["sends", [[326, 369], [1850, 2139]]],
  ["towers", [[371, 666], [1138, 1606]]],
  ["state", [[668, 795]]],
  ["enemies", [[797, 1136]]],
  ["projectiles", [[1608, 1776]]],
  ["scores", [[1778, 1801], [3185, 3226]]],
  ["tooltip", [[1802, 1837]]],
  ["status", [[1838, 1849]]],
  ["combat", [[2141, 2247]]],
  ["grid", [[2248, 2269]]],
  ["minimap", [[2328, 2455]]],
  ["picking", [[2456, 2483]]],
  ["maze", [[2484, 2547], [3510, 3550]]],
  ["build", [[2549, 2596], [2639, 2770]]],
  ["describe", [[2597, 2638]]],
  ["waves", [[2771, 2940]]],
  ["lifecycle", [[2941, 3045], [3399, 3508]]],
  ["auras", [[3046, 3113]]],
  ["selection", [[3114, 3184]]],
  ["save", [[3228, 3397]]],
  ["render", [[3552, 4214]]],
  ["loop", [[4216, 4385], [4758, 4773]]],
  ["ui-sync", [[4387, 4488]]],
  ["audio", [[4490, 4596]]],
  ["input", [[4598, 4756]]],
  ["main", [[4775, 5119]]],
];

// Writer-module ownership for the shared mutable lets (live-binding pattern).
// These source lines are REMOVED from state's range and re-homed.
const MOVED_LINES = new Map([
  [793, "scores"], // let highScores = loadHighScores();
  [794, "maze"],   // let mazeDistances = null;
]);

const DECL_RE = /^(?:export )?(const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/;

// 1. Collect each module's text (exact lines, minus moved ones) + moved-in lines.
const moduleText = new Map();
for (const [name, ranges] of MODULES) {
  const lines = [];
  for (const [a, b] of ranges) {
    for (let i = a; i <= b; i++) {
      if (MOVED_LINES.has(i) && MOVED_LINES.get(i) !== name) continue;
      lines.push(SRC[i - 1]);
    }
  }
  moduleText.set(name, lines);
}
for (const [lineNo, target] of MOVED_LINES) {
  moduleText.get(target).unshift(SRC[lineNo - 1]);
}

// 2. Export pass + symbol table.
const symbolOwner = new Map(); // name -> module
const moduleSymbols = new Map(); // module -> Set(names)
for (const [name] of MODULES) {
  const out = [];
  const owned = new Set();
  for (const line of moduleText.get(name)) {
    const m = line.match(DECL_RE);
    if (m && !line.startsWith("export ")) {
      const sym = m[2];
      owned.add(sym);
      if (symbolOwner.has(sym)) {
        throw new Error(`duplicate top-level symbol ${sym} in ${name} and ${symbolOwner.get(sym)}`);
      }
      symbolOwner.set(sym, name);
      out.push("export " + line);
    } else {
      out.push(line);
    }
  }
  moduleText.set(name, out);
  moduleSymbols.set(name, owned);
}

// Blank out string/comment CONTENT for the usage scan (template-literal
// ${interpolations} are real code and stay). Without this, tooltip prose like
// "press N to startWave" manufactures imports — and import cycles.
function scannable(code) {
  let out = "";
  let i = 0;
  const n = code.length;
  // mode stack handles templates nested in ${ } in templates
  const stack = [];
  let mode = "code";
  while (i < n) {
    const c = code[i];
    const two = code.slice(i, i + 2);
    if (mode === "code") {
      if (two === "//") { while (i < n && code[i] !== "\n") { out += " "; i++; } continue; }
      if (two === "/*") { while (i < n && code.slice(i, i + 2) !== "*/") { out += code[i] === "\n" ? "\n" : " "; i++; } out += "  "; i += 2; continue; }
      if (c === "'" || c === '"') { mode = c; out += " "; i++; continue; }
      if (c === "`") { mode = "tpl"; out += " "; i++; continue; }
      if (c === "}" && stack.length) { mode = stack.pop(); out += " "; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === "'" || mode === '"') {
      if (c === "\\") { out += "  "; i += 2; continue; }
      if (c === mode) { mode = "code"; out += " "; i++; continue; }
      out += c === "\n" ? "\n" : " "; i++; continue;
    }
    // template literal
    if (c === "\\") { out += "  "; i += 2; continue; }
    if (two === "${") { stack.push("tpl"); mode = "code"; out += "  "; i += 2; continue; }
    if (c === "`") { mode = "code"; out += " "; i++; continue; }
    out += c === "\n" ? "\n" : " "; i++;
  }
  return out;
}

// 3. Import generation: for each module, any foreign symbol used by word
// boundary gets imported from its owner (scan ignores strings/comments).
for (const [name] of MODULES) {
  const body = moduleText.get(name).join("\n");
  const scanBody = scannable(body);
  const own = moduleSymbols.get(name);
  const needs = new Map(); // ownerModule -> Set(symbols)
  for (const [sym, owner] of symbolOwner) {
    if (owner === name || own.has(sym)) continue;
    // (?<!\.)  — not a member access (obj.sym)
    // (?!\s*:) — not an object-literal key (sym: value); shorthand {sym} still matches
    if (new RegExp(`(?<![.\\w$])${sym}(?![\\w$])(?!\\s*:)`).test(scanBody)) {
      if (!needs.has(owner)) needs.set(owner, new Set());
      needs.get(owner).add(sym);
    }
  }
  const imports = [...needs.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([owner, syms]) => `import { ${[...syms].sort().join(", ")} } from "./${owner}.js";`);
  const header = imports.length ? imports.join("\n") + "\n\n" : "";
  moduleText.set(name, (header + body).split("\n"));
}

// 4. Emit.
mkdirSync("src", { recursive: true });
let total = 0;
for (const [name] of MODULES) {
  const text = moduleText.get(name).join("\n").replace(/\n{3,}$/g, "\n") + "\n";
  writeFileSync(`src/${name}.js`, text);
  total += text.split("\n").length;
  console.log(`src/${name}.js  (${text.split("\n").length} lines)`);
}
console.log(`\n${MODULES.length} modules, ${total} lines total (monolith: ${SRC.length})`);
console.log(`symbols exported: ${symbolOwner.size}`);
