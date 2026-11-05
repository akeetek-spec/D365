#!/usr/bin/env node
/*
 * Node.js server for the whole app (npm start). Runs on your PC and on Firebase App Hosting.
 * It does what Azure Static Web Apps does in the Azure setup:
 *   - serves web/ with the same routes and security headers as web/staticwebapp.config.json
 *   - sends /api/* to the same request handler the Azure Function uses (api/src/lib/handler.js)
 *   - dashboard sign-in at /.auth/* (Microsoft sign-in, or a test page on your PC; see auth.js)
 *   - keeps data in Firestore (cloud) or .local-data/db.json (your PC); see store.js
 */
const { ROOT, SIGN_IN, startupProblems } = require("./config");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { openStore } = require("./store");
const { handleAuth, currentUser } = require("./auth");
const { addMissing, rosterFiles } = require("./roster");
const { handle } = require("../api/src/lib/handler");

const WEB = path.join(ROOT, "web");
const swaConfig = JSON.parse(fs.readFileSync(path.join(WEB, "staticwebapp.config.json"), "utf8"));
const problems = startupProblems();
let db = null,
  storeLabel = "";
try {
  ({ db, label: storeLabel } = openStore());
} catch (e) {
  problems.push(`The data store couldn't be opened: ${e.message}`);
}
// Set when the database can't be reached at start-up; the app keeps running and retries.
let dataProblem = "";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};
const ASSET = /\.(js|css|png|svg|ico|json)$/i;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...swaConfig.globalHeaders, ...headers });
  res.end(body);
}
const json = (res, status, obj, headers = {}) =>
  send(res, status, JSON.stringify(obj), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
const redirect = (res, to, headers = {}) => send(res, 302, "", { Location: to, ...headers });
const esc = s =>
  String(s).replace(
    /[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
function readBody(req, limit = 1e6) {
  return new Promise((ok, bad) => {
    let size = 0;
    const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > limit) {
        bad(Object.assign(new Error("Request too large"), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
    req.on("error", bad);
  });
}
// Shown instead of the app when required settings are missing (values are never shown).
function setupPage(res) {
  send(
    res,
    503,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Setup needed</title><link rel="stylesheet" href="/styles.css"></head>
<body style="padding:48px 16px"><div style="max-width:620px;margin:auto"><h2>D365 Licence Check: setup needed</h2>
<p>The app isn't running yet because these need attention:</p><ul>${[...problems, ...(dataProblem ? [dataProblem] : [])].map(p => `<li>${esc(p)}</li>`).join("")}</ul>
<p class="muted">Fix them in apphosting.yaml (or local.env on your PC) and deploy again. See README, "Firebase App Hosting".</p></div></body></html>`,
    { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
  );
}

// ---------- /api/* ----------
async function api(req, res, url) {
  const s = currentUser(req);
  if (url.pathname.startsWith("/api/admin/")) {
    const allowed = ["itdirector", "itadmin", "leadership"];
    if (!s) return json(res, 401, { message: "Sign in to the dashboard first." });
    if (!s.roles.some(r => allowed.includes(r)))
      return json(res, 403, { message: "You don't have access to the dashboard." });
  }
  if (url.pathname === "/api/get-roles") return json(res, 200, { roles: s ? s.roles : [] });
  let body = {};
  if (req.method === "POST") {
    try {
      body = JSON.parse((await readBody(req)) || "{}");
    } catch (e) {
      if (e.status) throw e;
      body = {};
    }
  }
  const principal = s ? { name: s.email, email: s.email, roles: s.roles } : null;
  const out = await handle(
    { method: req.method, path: url.pathname, headers: req.headers, body, principal },
    db
  );
  if (out.status >= 500) console.error(out.body);
  return json(res, out.status, out.body);
}

// ---------- static files ----------
function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found", { "Content-Type": "text/plain" });
    const ext = path.extname(file).toLowerCase();
    send(res, 200, data, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      // Pages, scripts and styles are checked on every visit, so a new deploy shows up straight away
      // (App Hosting's CDN and browsers would otherwise keep old copies for a while).
      "Cache-Control": [".png", ".svg", ".ico"].includes(ext) ? "public, max-age=86400" : "no-cache"
    });
  });
}
function staticFile(req, res, url) {
  const p = decodeURIComponent(url.pathname);
  if (p.replace(/\/+$/, "") === "/admin") {
    if (!currentUser(req)) return redirect(res, "/.auth/login/aad?post_login_redirect_uri=/admin");
    return serveFile(res, path.join(WEB, "index.html"));
  }
  const file = path.normalize(path.join(WEB, p));
  const inside = file.startsWith(WEB + path.sep);
  if (
    inside &&
    path.basename(file) !== "staticwebapp.config.json" &&
    fs.existsSync(file) &&
    fs.statSync(file).isFile()
  )
    return serveFile(res, file);
  if (ASSET.test(p)) return send(res, 404, "Not found", { "Content-Type": "text/plain" });
  return serveFile(res, path.join(WEB, "index.html")); // navigationFallback
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if ((problems.length || dataProblem) && url.pathname !== "/styles.css") return setupPage(res);
    if (url.pathname.startsWith("/.auth/")) {
      const out = await handleAuth(req, url, readBody);
      return send(res, out.status, out.body, out.headers);
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/"))
      return await api(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
    return staticFile(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent)
      json(res, e.status || 500, { message: e.status ? e.message : "Something went wrong." });
  }
});

// Start listening straight away (the cloud health check waits for this), then prepare the data.
listen();
if (problems.length) console.error("Setup needed:\n  - " + problems.join("\n  - "));
else prepareData();

// Explains a database error in plain words.
function describeDataError(e) {
  const name = process.env.FIRESTORE_DATABASE || "(default)";
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "this project";
  if (e.code === 5 || /NOT_FOUND|does not exist/i.test(e.message))
    return `The Firestore database "${name}" doesn't exist in ${project}. Create it in Firebase console > Firestore Database > Create database (Database ID: ${name}).`;
  if (e.code === 7 || /PERMISSION_DENIED/i.test(e.message))
    return `The app isn't allowed to use Firestore. In Google Cloud console > IAM, give firebase-app-hosting-compute@<project-id>.iam.gserviceaccount.com the role "Cloud Datastore User".`;
  if (e.code === 4 || /DEADLINE|timed out/i.test(e.message))
    return `Firestore didn't answer in time (${e.message}). The app will keep trying.`;
  return `The database couldn't be reached: ${e.message}`;
}

// Adds anyone from the roster files who isn't in the data yet (existing people are not changed).
// If the database can't be reached, shows why on every page and tries again every minute.
async function prepareData() {
  try {
    if (process.env.SEED_ROSTER !== "false") {
      const added = await Promise.race([
        addMissing(db, rosterFiles()),
        new Promise((_, bad) =>
          setTimeout(
            () => bad(Object.assign(new Error("timed out after 30 seconds"), { code: 4 })),
            30e3
          )
        )
      ]);
      if (added.length)
        console.log(
          `Added ${added.length} people from ${rosterFiles()
            .map(f => path.relative(ROOT, f))
            .join(", ")}${added.length <= 5 ? `: ${added.join(", ")}` : ""}.`
        );
    }
    if (dataProblem) console.log("Database reachable again.");
    dataProblem = "";
  } catch (e) {
    dataProblem = describeDataError(e);
    console.error(`Database problem: ${dataProblem}\n${e.stack || e}`);
    setTimeout(prepareData, 60e3);
  }
}

function listen() {
  server.listen(Number(process.env.PORT), process.env.HOST, () => {
    console.log(`\nD365 Licence Check is running at ${process.env.APP_URL}`);
    console.log(`  Dashboard:  ${process.env.APP_URL}/admin`);
    console.log(
      `  Sign-in:    ${{ microsoft: "Microsoft", firebase: "email + password (Firebase Authentication)", test: "test page (no password)" }[SIGN_IN]}`
    );
    console.log(`  Data:       ${storeLabel}`);
    console.log(
      `  Email mode: ${process.env.MAIL_MODE}${process.env.MAIL_MODE === "outbox" ? " (nothing is sent; links appear on the dashboard)" : ""}`
    );
    console.log(`Send invites from the dashboard, or run "npm run invite" in another terminal.\n`);
  });
}
