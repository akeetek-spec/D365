#!/usr/bin/env node
// Copies the licence model the browser uses into the API, so both always agree. Run after editing web/*.js.
const fs = require("fs"),
  path = require("path");
const web = path.join(__dirname, "..", "..", "web"),
  dest = path.join(__dirname, "..", "src", "lib", "shared");
for (const f of ["catalog.js", "licence.js", "keep-roles.js"]) {
  fs.copyFileSync(path.join(web, f), path.join(dest, f));
  console.log("copied", f);
}
