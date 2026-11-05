/*
 * Settings. Values come from the environment (on Firebase App Hosting: apphosting.yaml), then from
 * local.env in the project folder (copy local.env.example), then from the defaults below.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const envFile = path.join(ROOT, "local.env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

// Firebase App Hosting runs on Cloud Run, which sets K_SERVICE.
const IN_CLOUD = !!process.env.K_SERVICE;

const defaults = {
  PORT: IN_CLOUD ? "8080" : "4280",
  HOST: IN_CLOUD ? "0.0.0.0" : "127.0.0.1",
  STORE: IN_CLOUD ? "firestore" : "file",
  APP_URL: "",
  DATA_FILE: path.join(ROOT, ".local-data", "db.json"),
  ROSTER_FILE: path.join(ROOT, "data", "roster.json"),
  MAIL_MODE: "outbox",
  IT_DIRECTOR_EMAIL: "andres.santana@championchair.com",
  ROLE_ITDIRECTOR: "andres.santana@championchair.com",
  ROLE_ITADMIN: "jennifer.derby@championchair.com",
  ROLE_LEADERSHIP: "",
  LINK_DAYS: "30"
};
for (const [k, v] of Object.entries(defaults)) if (!process.env[k]) process.env[k] = v;
// One or more roster files, comma-separated (for example "data/roster.json,data/roster.test.json").
// Relative paths are read from the project folder.
process.env.ROSTER_FILE = process.env.ROSTER_FILE.split(",")
  .map(f => f.trim())
  .filter(Boolean)
  .map(f => path.resolve(ROOT, f))
  .join(",");
const appUrlGiven = !!process.env.APP_URL;
if (!process.env.APP_URL) process.env.APP_URL = `http://localhost:${process.env.PORT}`;
process.env.APP_URL = process.env.APP_URL.replace(/\/+$/, "");

// Dashboard sign-in (SIGN_IN):
//   firebase   email + password accounts made in Firebase console > Authentication (production)
//   test       pick who to be, no password: your PC, or a cloud testing backend with its own database
//   microsoft  Microsoft Entra ID (optional)
// If SIGN_IN isn't set: microsoft when AAD_* is set, firebase when FIREBASE_API_KEY is set, else test.
const SIGN_IN = ["firebase", "test", "microsoft"].includes(process.env.SIGN_IN)
  ? process.env.SIGN_IN
  : process.env.AAD_CLIENT_ID && process.env.AAD_TENANT_ID
    ? "microsoft"
    : process.env.FIREBASE_API_KEY
      ? "firebase"
      : "test";
const db = process.env.FIRESTORE_DATABASE;
const USING_TEST_DATABASE = !!db && db !== "(default)";

// Settings that must be right before the app can safely run where other people can reach it.
function startupProblems() {
  const out = [];
  if (IN_CLOUD && !appUrlGiven)
    out.push(
      "APP_URL is not set. Set it to the app's public address (it goes into every email link)."
    );
  const needSessionSecret = () => {
    if (String(process.env.SESSION_SECRET || "").length < 32)
      out.push("SESSION_SECRET must be set to a random value of at least 32 characters.");
  };
  if (SIGN_IN === "microsoft") {
    for (const k of ["AAD_TENANT_ID", "AAD_CLIENT_ID", "AAD_CLIENT_SECRET"])
      if (!process.env[k]) out.push(`${k} is not set (needed for Microsoft sign-in).`);
    needSessionSecret();
  } else if (SIGN_IN === "firebase") {
    if (!process.env.FIREBASE_API_KEY)
      out.push(
        "FIREBASE_API_KEY is not set. Copy the Web API key from Firebase console > Project settings > General."
      );
    if (IN_CLOUD) needSessionSecret();
  } else if (IN_CLOUD) {
    // The test page has no password. In the cloud it is only allowed on a testing backend that is
    // switched on for it AND uses its own Firestore database, so it can never open the real data.
    if (process.env.ALLOW_TEST_SIGNIN !== "true" || !USING_TEST_DATABASE)
      out.push(
        "No sign-in is set up. For production set SIGN_IN=firebase and FIREBASE_API_KEY. " +
          "The test sign-in page (no password) only runs in the cloud with ALLOW_TEST_SIGNIN=true " +
          "and a separate FIRESTORE_DATABASE (for example test)."
      );
  }
  if (process.env.MAIL_MODE === "gmail") {
    if (!/@/.test(process.env.MAIL_SENDER || ""))
      out.push("MAIL_SENDER must be the Gmail address emails are sent from.");
    if (String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "").length !== 16)
      out.push(
        "GMAIL_APP_PASSWORD must be the 16-character Google App Password (not the account password)."
      );
  }
  if (process.env.MAIL_MODE === "graph") {
    for (const k of ["MAIL_SENDER", "GRAPH_TENANT_ID", "GRAPH_CLIENT_ID", "GRAPH_CLIENT_SECRET"])
      if (!process.env[k]) out.push(`${k} is not set (needed for MAIL_MODE=graph).`);
  }
  return out;
}

const list = k =>
  String(process.env[k] || "")
    .toLowerCase()
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
// Same rule as /api/get-roles in api/src/functions/api.js.
function rolesFor(email) {
  const e = String(email || "").toLowerCase();
  return [
    ["ROLE_ITDIRECTOR", "itdirector"],
    ["ROLE_ITADMIN", "itadmin"],
    ["ROLE_LEADERSHIP", "leadership"]
  ]
    .filter(([k]) => list(k).includes(e))
    .map(([, r]) => r);
}
// People offered on the local sign-in page.
const signInChoices = () => [
  ...new Set([...list("ROLE_ITDIRECTOR"), ...list("ROLE_ITADMIN"), ...list("ROLE_LEADERSHIP")])
];

module.exports = {
  ROOT,
  IN_CLOUD,
  SIGN_IN,
  USING_TEST_DATABASE,
  rolesFor,
  signInChoices,
  startupProblems
};
