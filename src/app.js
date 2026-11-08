/*
 * Answers every request for /api/* and /.auth/*. Used by the Cloud Function (index.js) and by the local
 * server (local.js). Works with Node's own request/response objects and with the Express-style ones
 * Cloud Functions passes in.
 *
 * Also, on the first request each server instance gets, adds anyone from the roster file(s) who isn't
 * in the database yet. If the database can't be reached, every page says why, and it tries again.
 */
const path = require("path");
const { problems, rosterFiles, FUNCTIONS_DIR } = require("./config");
const { openStore } = require("./store");
const { openBlobs, MAX } = require("./blobs");
const { handleAuth, currentUser } = require("./auth");
const { handle } = require("./handler");

// Same security headers as the static pages (firebase.json).
const SECURITY = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store"
};

let ctx = null;
const context = () => (ctx = ctx || { db: openStore().db, blobs: openBlobs() });

// ---------- roster ----------
const fs = require("fs");
function readPeople(file) {
  const people = JSON.parse(fs.readFileSync(file, "utf8"));
  return people.map((p, i) => ({ order: i + 1, ...p }));
}
// Adds people who aren't in the database yet. People already there are not changed.
async function addMissingPeople(db) {
  const added = [];
  for (const file of rosterFiles()) {
    for (const { id, ...doc } of readPeople(file)) {
      if (!id || (await db.doc(`roster/${id}`).get()).exists) continue;
      await db.doc(`roster/${id}`).set(doc);
      added.push(doc.email);
    }
  }
  if (added.length)
    console.log(
      `Added ${added.length} people from ${rosterFiles()
        .map(f => path.relative(FUNCTIONS_DIR, f))
        .join(", ")}.`
    );
  return added;
}
let prepared = null,
  dataProblem = "",
  retryAt = 0;
function describeDataError(e) {
  const name = process.env.FIRESTORE_DATABASE || "(default)";
  if (e.code === 5 || /NOT_FOUND|does not exist/i.test(e.message))
    return `The Firestore database "${name}" doesn't exist yet. Create it in Firebase console > Firestore Database > Create database.`;
  if (e.code === 7 || /PERMISSION_DENIED/i.test(e.message))
    return "The app isn't allowed to use Firestore. Check the Firestore database exists and the project is on the Blaze plan.";
  if (/bucket/i.test(e.message))
    return `Cloud Storage isn't set up: ${e.message}. Open Firebase console > Storage > Get started.`;
  return `The database couldn't be reached: ${e.message}`;
}
function prepare(db) {
  if (prepared && !(dataProblem && Date.now() > retryAt)) return prepared;
  prepared = (async () => {
    try {
      if (process.env.SEED_ROSTER !== "false") await addMissingPeople(db);
      dataProblem = "";
    } catch (e) {
      dataProblem = describeDataError(e);
      retryAt = Date.now() + 30e3;
      console.error(`Database problem: ${dataProblem}`, e);
    }
  })();
  return prepared;
}

// ---------- helpers ----------
function send(res, status, body, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries({ ...SECURITY, ...headers })) res.setHeader(k, v);
  res.end(body);
}
const json = (res, status, obj) =>
  send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8" });
function rawBody(req, limit) {
  if (req.rawBody) return Promise.resolve(req.rawBody); // Cloud Functions has read it already
  return new Promise((ok, bad) => {
    const chunks = [];
    let size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > limit) {
        bad(Object.assign(new Error("Too large"), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => ok(Buffer.concat(chunks)));
    req.on("error", bad);
  });
}
const esc = s =>
  String(s).replace(
    /[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
function setupPage(res, list) {
  send(
    res,
    503,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Setup needed</title><link rel="stylesheet" href="/styles.css"></head>
<body style="padding:48px 16px"><div style="max-width:640px;margin:auto"><h2>D365 Licence Check: setup needed</h2>
<p>The app isn't ready yet because of:</p><ul>${list.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
<p class="muted">See README, "Set up Firebase". Settings: .env and .env.&lt;alias&gt;, then <code>firebase deploy</code>. Database problems clear by themselves within a minute of being fixed.</p></div></body></html>`,
    { "Content-Type": "text/html; charset=utf-8" }
  );
}

// ---------- the request handler ----------
async function app(req, res) {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  try {
    const setup = problems();
    if (setup.length) {
      if (p.startsWith("/api/"))
        return json(res, 503, { message: "Setup needed: " + setup.join(" ") });
      return setupPage(res, setup);
    }
    const { db, blobs } = context();
    await prepare(db);
    if (dataProblem) {
      if (p.startsWith("/api/")) return json(res, 503, { message: dataProblem });
      return setupPage(res, [dataProblem]);
    }

    if (p.startsWith("/.auth/")) {
      let form = {};
      if (req.method === "POST")
        form = Object.fromEntries(new URLSearchParams((await rawBody(req, 1e5)).toString("utf8")));
      const out = await handleAuth(req, db, p, Object.fromEntries(url.searchParams), form);
      return send(res, out.status, out.body, out.headers);
    }

    if (p.startsWith("/api/")) {
      const user = await currentUser(req, db);
      if (p.startsWith("/api/admin/") && !user)
        return json(res, 401, { message: "Sign in to the dashboard first." });
      let body = {},
        raw = null;
      if (req.method === "POST") {
        const upload = p === "/api/upload" || p === "/api/admin/upload";
        if (Number(req.headers["content-length"] || 0) > (upload ? MAX : 1e6))
          return json(res, 413, { message: upload ? "Use an image under 10 MB." : "Too large." });
        const buf = await rawBody(req, upload ? MAX + 1 : 1e6);
        if (upload) raw = buf;
        else
          try {
            body = JSON.parse(buf.toString("utf8") || "{}");
          } catch (e) {
            body = {};
          }
      }
      const out = await handle(
        {
          method: req.method,
          path: p,
          query: Object.fromEntries(url.searchParams),
          headers: req.headers,
          body,
          raw,
          principal: user ? { name: user.email, roles: user.roles } : null
        },
        { db, blobs }
      );
      if (out.status >= 500) console.error(out.body);
      if (out.file)
        return send(res, 200, out.file.buf, {
          "Content-Type": out.file.type,
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition": "inline"
        });
      return json(res, out.status, out.body);
    }
    return send(res, 404, "Not found", { "Content-Type": "text/plain" });
  } catch (e) {
    console.error(e);
    if (!res.headersSent)
      json(res, e.status || 500, {
        message: e.status ? e.message : "Something went wrong. Try again."
      });
  }
}

module.exports = { app, addMissingPeople };
