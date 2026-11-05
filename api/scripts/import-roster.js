#!/usr/bin/env node
/*
 * Load people into the Roster table, and optionally email their personal links.
 *
 *   node scripts/import-roster.js ../data/roster.json            load or update everyone
 *   node scripts/import-roster.js ../data/roster.csv --invite    load, then email links to everyone who hasn't answered
 *   node scripts/import-roster.js ../data/roster.json --invite --only amy-hart,bryce-kriner
 *
 * Needs STORAGE_CONNECTION, APP_URL and the mail settings (see local.settings.sample.json) in the environment.
 * CSV columns: id,email,current,required,jobTitle,supervisorName,managerEmail,managerEmailStatus
 *   (current and required: licence names separated by "|", for example "Finance|Supply Chain Management")
 */
const fs = require("fs");
const { tableStore } = require("../src/lib/store");
const { invite } = require("../src/lib/handler");

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
  let people = file.endsWith(".csv")
    ? parseCsv(text).map(r => ({
        ...r,
        current: (r.current || "").split("|").filter(Boolean),
        required: (r.required || "").split("|").filter(Boolean)
      }))
    : JSON.parse(text);
  people = people.map((p, i) => ({ order: i + 1, ...p, id: p.id || slug(p.email) }));
  const onlyIx = flags.indexOf("--only"),
    only = onlyIx >= 0 ? flags[onlyIx + 1].split(",") : null;
  const db = tableStore();
  for (const p of people) {
    const { id, ...doc } = p;
    const cur = await db.doc(`roster/${id}`).get();
    await db.doc(`roster/${id}`).set({ ...(cur.exists ? cur.data() : {}), ...doc });
  }
  console.log(`Roster: ${people.length} people loaded.`);
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
      `Invites: ${n} queued${["graph", "gmail"].includes(process.env.MAIL_MODE) ? ` and sent (${process.env.MAIL_MODE})` : " in the outbox (MAIL_MODE=outbox)"}.`
    );
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
