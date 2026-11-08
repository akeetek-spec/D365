#!/usr/bin/env node
/*
 * Read Microsoft's "Finance and Operations Licensing Detailed Report" (CSV export) and write a roster file
 * for import-roster.js: everyone whose security roles need a licence they aren't assigned, with the roles causing it.
 *
 *   node scripts/import-licensing-report.js <report.csv> <roster-out.json> [--existing data/roster.json] [--env Production]
 *
 * Only rows from the chosen environment type are used (default Production). Existing job titles and ids are kept
 * by matching email (case-insensitive). People in the report who are fully licensed are left out.
 */
const fs = require("fs");
const FULL = ["Finance", "Supply Chain Management", "Commerce", "Project Operations"];
const KEY = {
  Finance: "FIN",
  "Supply Chain Management": "SCM",
  Commerce: "COM",
  "Project Operations": "PO"
};
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
  return rest.map(r =>
    Object.fromEntries(head.map((h, i) => [h.replace(/^\uFEFF/, "").trim(), (r[i] || "").trim()]))
  );
}
const slug = e =>
  String(e)
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const [src, out, ...flags] = process.argv.slice(2);
if (!src || !out) {
  console.error(
    "Usage: node scripts/import-licensing-report.js <report.csv> <roster-out.json> [--existing roster.json] [--env Production]"
  );
  process.exit(1);
}
const opt = k => {
  const i = flags.indexOf(k);
  return i >= 0 ? flags[i + 1] : null;
};
const env = opt("--env") || "Production";
const existing = opt("--existing") ? JSON.parse(fs.readFileSync(opt("--existing"), "utf8")) : [];
const byEmail = Object.fromEntries(existing.map(p => [p.email.toLowerCase(), p]));
const rows = parseCsv(fs.readFileSync(src, "utf8")).filter(r => r.EnvironmentType === env);
const users = {};
for (const r of rows) {
  const e = r.UserEmail.toLowerCase(),
    u = (users[e] = users[e] || { email: r.UserEmail, assigned: new Set(), req: {} });
  String(r["AssignedLicense(s)"] || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(a => u.assigned.add(a));
  if (FULL.includes(r.RequiredLicense))
    (u.req[r.RequiredLicense] = u.req[r.RequiredLicense] || new Set()).add(r.SecurityRole);
}
const refreshed = ((rows[0] && rows[0].RefreshedOn) || "").slice(0, 10);
const result = [];
for (const [e, u] of Object.entries(users)) {
  const gap = Object.entries(u.req).filter(([l]) => !u.assigned.has(l));
  if (!gap.length) continue;
  const prev = byEmail[e] || {};
  const current = [...u.assigned].map(a => (a === "Activity" ? "Operations - Activity" : a)).sort();
  result.push({
    ...prev,
    id: prev.id || slug(u.email),
    email: u.email,
    current,
    required: [
      ...new Set([...current.filter(c => FULL.includes(c)), ...gap.map(([l]) => l)])
    ].sort(),
    gapRoles: Object.fromEntries(gap.map(([l, rs]) => [KEY[l], [...rs].sort()])),
    reportRefreshed: refreshed,
    jobTitle: prev.jobTitle || ""
  });
}
result.sort((a, b) => (a.order || 999) - (b.order || 999) || a.email.localeCompare(b.email));
fs.writeFileSync(out, JSON.stringify(result, null, 1));
const known = result.filter(p => byEmail[p.email.toLowerCase()]).length;
console.log(
  `${result.length} under-licensed people written to ${out} (${known} already in the existing roster, ${result.length - known} new). Report refreshed ${refreshed}.`
);
console.log("Check new people (job titles, duplicate logins) before running import-roster.js.");
