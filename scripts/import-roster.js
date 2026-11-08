#!/usr/bin/env node
/*
 * Load people into the database, and optionally email their personal links. Usually not needed:
 * the app adds people from data/roster.json by itself, and the IT Director sends invites from the dashboard.
 *
 *   node scripts/import-roster.js data/roster.json                        load or update everyone
 *   node scripts/import-roster.js data/roster.csv --invite                load, then invite everyone who hasn't answered
 *   node scripts/import-roster.js data/roster.json --invite --only amy-hart,bryce-kriner
 *
 * Where it writes:
 *   your PC's local data (default), or
 *   Firestore: STORE=firestore GOOGLE_CLOUD_PROJECT=<project-id> APP_URL=https://<site> node scripts/import-roster.js …
 *              (sign in first with "gcloud auth application-default login"; add FIRESTORE_DATABASE=<id> for
 *              a database other than (default))
 *
 * CSV columns: id,email,current,required,jobTitle,supervisorName,managerEmail,managerEmailStatus,gapRoles
 *   current and required: licence names separated by "|" (for example "Finance|Supply Chain Management")
 *   gapRoles: "Finance=Role A;Role B|Supply Chain Management=Role C"
 */
const fs = require("fs");
const path = require("path");
// Same settings files as the local server.
for (const f of [".env.local", ".env"]) {
  const file = path.join(__dirname, "..", f);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
process.env.APP_URL = process.env.APP_URL || "http://localhost:4280";
const { openStore } = require("../src/store");
const { invite } = require("../src/handler");

function parseCsv(text) {
  const rows = [];
  let row = [],
    cell = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...rest] = rows.filter(r => r.some(x => x.trim()));
  return rest.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || "").trim()])));
}
const slug = e =>
  String(e)
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

(async () => {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) {
    console.error(
      "Usage: node scripts/import-roster.js <roster.json|roster.csv> [--invite] [--only id1,id2]"
    );
    process.exit(1);
  }
  const text = fs.readFileSync(file, "utf8");
  const KEY = {
    Finance: "FIN",
    "Supply Chain Management": "SCM",
    Commerce: "COM",
    "Project Operations": "PO"
  };
  const gap = s =>
    Object.fromEntries(
      String(s || "")
        .split("|")
        .filter(Boolean)
        .map(p => {
          const [l, rs] = p.split("=");
          return [
            KEY[l.trim()] || l.trim(),
            (rs || "")
              .split(";")
              .map(x => x.trim())
              .filter(Boolean)
          ];
        })
    );
  let people = file.endsWith(".csv")
    ? parseCsv(text).map(r => ({
        ...r,
        current: (r.current || "").split("|").filter(Boolean),
        required: (r.required || "").split("|").filter(Boolean),
        gapRoles: gap(r.gapRoles)
      }))
    : JSON.parse(text);
  people = people.map((p, i) => ({ order: i + 1, ...p, id: p.id || slug(p.email) }));
  const onlyIx = flags.indexOf("--only"),
    only = onlyIx >= 0 ? flags[onlyIx + 1].split(",") : null;
  const { db, label } = openStore();
  for (const p of people) {
    const { id, ...doc } = p;
    const cur = await db.doc(`roster/${id}`).get();
    await db.doc(`roster/${id}`).set({ ...(cur.exists ? cur.data() : {}), ...doc });
  }
  console.log(`Roster: ${people.length} people loaded into ${label}.`);
  if (flags.includes("--invite")) {
    let n = 0;
    for (const p of people) {
      if (only && !only.includes(p.id)) continue;
      const r = await db.doc(`responses/${p.id}`).get();
      if (r.exists && r.data().answers) continue;
      await invite(db, p.id, p);
      n++;
    }
    console.log(
      `Invites: ${n} ${process.env.MAIL_MODE === "gmail" ? "sent by Gmail" : 'queued under "Emails waiting to send"'}.`
    );
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
