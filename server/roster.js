#!/usr/bin/env node
/*
 * Load people into the local store, and optionally queue their personal links (local version of
 * api/scripts/import-roster.js).
 *
 *   npm run roster                                  load data/roster.json
 *   npm run roster -- data/roster.csv               load a CSV instead
 *   npm run invite                                  load, then queue links for everyone who hasn't answered
 *   npm run invite -- --only amy-hart,bryce-kriner  only these people
 *
 * Links appear on the dashboard under "Emails waiting to send" and are printed here.
 */
require("./config");
const fs = require("fs");
const { openStore } = require("./store");
const { invite } = require("../api/src/lib/handler");

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

function readPeople(file) {
  const text = fs.readFileSync(file, "utf8");
  const people = file.endsWith(".csv")
    ? parseCsv(text).map(r => ({
        ...r,
        current: (r.current || "").split("|").filter(Boolean),
        required: (r.required || "").split("|").filter(Boolean)
      }))
    : JSON.parse(text);
  return people.map((p, i) => ({ order: i + 1, ...p, id: p.id || slug(p.email) }));
}

async function loadRoster(db, file) {
  const people = readPeople(file);
  for (const p of people) {
    const { id, ...doc } = p;
    const cur = await db.doc(`roster/${id}`).get();
    await db.doc(`roster/${id}`).set({ ...(cur.exists ? cur.data() : {}), ...doc });
  }
  return people;
}

// Adds people from the roster files who aren't in the store yet. People already there are left
// exactly as they are (so changes made on the dashboard, like a new approver, are kept).
async function addMissing(db, files) {
  const added = [];
  for (const file of files) {
    for (const p of readPeople(file)) {
      const { id, ...doc } = p;
      if ((await db.doc(`roster/${id}`).get()).exists) continue;
      await db.doc(`roster/${id}`).set(doc);
      added.push(p.email);
    }
  }
  return added;
}
const rosterFiles = () => String(process.env.ROSTER_FILE).split(",").filter(Boolean);

async function main() {
  const args = process.argv.slice(2);
  const files = args[0] && !args[0].startsWith("--") ? [args[0]] : rosterFiles();
  const onlyIx = args.indexOf("--only"),
    only = onlyIx >= 0 ? String(args[onlyIx + 1] || "").split(",") : null;
  const { db, label } = openStore();
  let people = [];
  for (const file of files) {
    const loaded = await loadRoster(db, file);
    console.log(`Roster: ${loaded.length} people loaded from ${file} into ${label}.`);
    people = people.concat(loaded);
  }
  if (!args.includes("--invite")) return;
  let n = 0;
  for (const p of people) {
    if (only && !only.includes(p.id)) continue;
    const r = await db.doc(`responses/${p.id}`).get();
    if (r.exists && r.data().answers) continue;
    const id = await invite(db, p.id, p);
    n++;
    const mail = (await db.doc(`outbox/${id}`).get()).data();
    const link = (mail.body.match(/https?:\/\/\S+#t=[A-Za-z0-9_-]+/) || [""])[0];
    console.log(`  ${p.email.padEnd(40)} ${link}`);
  }
  console.log(
    `Invites: ${n} queued${["graph", "gmail"].includes(process.env.MAIL_MODE) ? ` and sent (${process.env.MAIL_MODE})` : ' (see "Emails waiting to send" on the dashboard)'}.`
  );
}

if (require.main === module)
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
module.exports = { loadRoster, addMissing, rosterFiles };
