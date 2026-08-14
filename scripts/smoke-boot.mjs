// Headless boot smoke (IMPROVEMENT_PLAN Task 3): serve the repo root, load the
// game in headless Chrome, fail on any page/console error during boot + a 3s
// idle window, and assert the #game canvas exists. Catches the 80% case —
// missing DOM hook, throwing constructor, broken module import.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8127;
const URL = `http://localhost:${PORT}/`;

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return true;
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

const failures = [];
let server = null;
let browser = null;

try {
  server = spawn("python3", ["-m", "http.server", String(PORT)], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "pipe"],
  });
  server.stderr.on("data", () => {}); // python logs requests to stderr; ignore

  if (!(await waitForServer(URL))) {
    throw new Error(`server did not answer on ${URL} within 15s`);
  }

  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.on("pageerror", (err) => failures.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      failures.push(`console.error: ${msg.text()}`);
    }
  });

  await page.goto(URL, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3000)); // idle window: rAF loop + guardrails run

  const tagName = await page.evaluate(() => document.querySelector("#game")?.tagName ?? null);
  if (tagName !== "CANVAS") {
    failures.push(`#game is ${tagName === null ? "missing" : `<${tagName}>`}, expected <canvas>`);
  }
} catch (err) {
  failures.push(String(err));
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }
  if (server) {
    server.kill("SIGTERM");
  }
}

if (failures.length > 0) {
  console.error("smoke-boot FAILED:");
  for (const f of failures) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
}
console.log("smoke-boot OK");
