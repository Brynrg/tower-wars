#!/usr/bin/env node
// build.mjs — stage this vanilla static game into dist/ for portal ingest.
//
// The portal's ingest + deploy workflow expect dist/index.html. This game has
// no bundler, so "building" = copying the static web files into dist/ (leaving
// out repo metadata). Asset URLs in index.html must stay relative so they
// resolve under /games/<slug>/.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const DIST = resolve(ROOT, "dist");

const EXCLUDE = new Set([
  "dist", "node_modules", ".git", ".github", ".claude",
  "package.json", "package-lock.json", "build.mjs",
  "game.manifest.json", "AGENTS.md", ".gitignore",
  "test", "tools", // dev-only: golden tests + the split codemod
]);

if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

for (const name of readdirSync(ROOT)) {
  if (EXCLUDE.has(name)) continue;
  if (name.endsWith(".md")) continue; // docs stay out of the deployed bundle
  cpSync(resolve(ROOT, name), resolve(DIST, name), { recursive: true });
}

if (!existsSync(resolve(DIST, "index.html"))) {
  console.error("✗ build: dist/index.html missing after staging");
  process.exit(1);
}
console.log("✓ staged static files → dist/");
