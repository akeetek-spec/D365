#!/usr/bin/env node
/*
 * Copies the licence rules from frontend/ into src/shared/ so the browser and the server use the same rules:
 *   frontend/catalog.js, licence.js, levels.js  →  src/shared/
 * Runs before every deploy, npm start and npm test. Edit the originals in frontend/, not the copies.
 */
const fs = require("fs"),
  path = require("path");
const root = path.join(__dirname, "..");
fs.mkdirSync(path.join(root, "src", "shared"), { recursive: true });
for (const f of ["catalog.js", "licence.js", "levels.js"])
  fs.copyFileSync(path.join(root, "frontend", f), path.join(root, "src", "shared", f));
console.log("Synced licence rules into src/shared/.");
