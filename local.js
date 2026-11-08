#!/usr/bin/env node
/*
 * Runs the whole app on your PC without Firebase: npm start (in the project folder), then http://localhost:4280
 * Serves frontend/ like Firebase Hosting and sends /api/* and /.auth/* to the same code the Cloud Function runs.
 *
 * Settings: .env, then .env.local (yours; not deployed). By default data is kept in
 * .local-data/ and the dashboard uses the test sign-in. To use the Firebase emulators instead, see README.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");

// Load .env files the way Firebase does (values already set win), before any settings are read.
for (const f of [".env.local", ".env"]) {
  const file = path.join(__dirname, f);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const PORT = Number(process.env.PORT || 4280);
process.env.APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

const { app } = require("./src/app");
const { signIn } = require("./src/config");
const { openStore } = require("./src/store");

// Static pages: frontend/ (or public if the deploy copy is used).
const WEB = fs.existsSync(path.join(__dirname, "frontend"))
  ? path.join(__dirname, "frontend")
  : path.join(__dirname, "public");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};
const HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-cache"
};
function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(WEB, decodeURIComponent(pathname)));
  const ok = file.startsWith(WEB + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile();
  if (!ok) {
    if (/\.(js|css|png|svg|ico|json)$/i.test(pathname)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    file = path.join(WEB, "index.html"); // same as the "**" rewrite in firebase.json
  }
  res.writeHead(200, {
    ...HEADERS,
    "Content-Type": TYPES[path.extname(file)] || "application/octet-stream"
  });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname.startsWith("/api/") || pathname.startsWith("/.auth/")) return app(req, res);
    serveStatic(req, res, pathname);
  })
  .listen(PORT, process.env.HOST || "127.0.0.1", () => {
    console.log(`\nD365 Licence Check is running at ${process.env.APP_URL}`);
    console.log(`  Dashboard:  ${process.env.APP_URL}/admin`);
    console.log(
      `  Sign-in:    ${{ firebase: "email + password (Firebase Authentication)", env: "email + password (from the settings file)" }[signIn()] || "test page (no password)"}`
    );
    console.log(`  Data:       ${openStore().label}`);
    console.log(
      `  Email:      ${process.env.MAIL_MODE}${process.env.MAIL_MODE === "outbox" ? " (nothing is sent; links appear on the dashboard)" : ""}\n`
    );
  });
