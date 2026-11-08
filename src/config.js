/*
 * Settings, read from environment variables.
 *
 * On Firebase they come from .env (shared) plus .env.<alias> (prod or test), and
 * secrets (GMAIL_APP_PASSWORD) from Secret Manager. On your PC, local.js loads .env and
 * .env.local before this file is read.
 */
const path = require("path");

const FUNCTIONS_DIR = path.join(__dirname, "..");

// Cloud Functions (2nd gen) runs on Cloud Run, which sets K_SERVICE. The emulator sets FUNCTIONS_EMULATOR.
const IN_CLOUD = !!process.env.K_SERVICE && process.env.FUNCTIONS_EMULATOR !== "true";

function applyDefaults() {
  const defaults = {
    STORE: IN_CLOUD || process.env.FUNCTIONS_EMULATOR === "true" ? "firestore" : "file",
    DATA_DIR: path.join(FUNCTIONS_DIR, ".local-data"),
    ROSTER_FILE: "data/roster.json",
    MAIL_MODE: "outbox",
    MAIL_FROM_NAME: "D365 Licence Check",
    IT_DIRECTOR_NAME: "Andres Santana",
    IT_DIRECTOR_EMAIL: "andres.santana@championchair.com",
    ROLE_ITDIRECTOR: "andres.santana@championchair.com",
    ROLE_ITADMIN: "jennifer.derby@championchair.com",
    LINK_DAYS: "30"
  };
  for (const [k, v] of Object.entries(defaults)) if (!process.env[k]) process.env[k] = v;
  // On Firebase the site's address is https://<project-id>.web.app unless APP_URL says otherwise
  // (set APP_URL for a custom domain).
  if (
    !process.env.APP_URL &&
    IN_CLOUD &&
    (process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT)
  )
    process.env.APP_URL = `https://${process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT}.web.app`;
  if (process.env.APP_URL) process.env.APP_URL = process.env.APP_URL.replace(/\/+$/, "");
}
applyDefaults();

// Dashboard sign-in:
//   firebase  email + password accounts made in Firebase console > Authentication > Users (production)
//   test      pick who to be, no password (your PC; in the cloud only with ALLOW_TEST_SIGNIN=true)
const signIn = () =>
  process.env.SIGN_IN === "firebase" ? "firebase" : process.env.SIGN_IN === "env" ? "env" : "test";

// SIGN_IN=env passwords: DASHBOARD_PASSWORDS="email:password;email:password", and DEFAULT_PASSWORD for any
// dashboard person who isn't listed. Returns the password expected for this email, or "".
function envPasswordFor(email) {
  const e = String(email || "").toLowerCase();
  for (const part of String(process.env.DASHBOARD_PASSWORDS || "").split(";")) {
    const i = part.indexOf(":");
    if (i > 0 && part.slice(0, i).trim().toLowerCase() === e) return part.slice(i + 1).trim();
  }
  return rolesFor(e).length ? String(process.env.DEFAULT_PASSWORD || "") : "";
}

const list = k =>
  String(process.env[k] || "")
    .toLowerCase()
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
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
const signInChoices = () => [
  ...new Set([...list("ROLE_ITDIRECTOR"), ...list("ROLE_ITADMIN"), ...list("ROLE_LEADERSHIP")])
];
// Roster files, comma-separated, relative to the project folder.
const rosterFiles = () =>
  String(process.env.ROSTER_FILE)
    .split(",")
    .map(f => f.trim())
    .filter(Boolean)
    .map(f => path.resolve(FUNCTIONS_DIR, f));

// Settings that must be right before the app is safe to use. Shown on a "Setup needed" page.
function problems() {
  const out = [];
  if (IN_CLOUD && !process.env.APP_URL)
    out.push("APP_URL is not set. In .env.<alias> set it to the site's address.");
  if (signIn() === "firebase" && !process.env.WEB_API_KEY)
    out.push(
      "WEB_API_KEY is not set. Copy the Web API key from Firebase console > Project settings > General into .env.<alias>."
    );
  if (signIn() === "env" && !process.env.DEFAULT_PASSWORD && !process.env.DASHBOARD_PASSWORDS)
    out.push("No dashboard passwords are set. Set DEFAULT_PASSWORD (or DASHBOARD_PASSWORDS) in .env.<alias>.");
  if (signIn() === "test" && IN_CLOUD && process.env.ALLOW_TEST_SIGNIN !== "true")
    out.push(
      "No sign-in is set up. For production set SIGN_IN=firebase and WEB_API_KEY. The test sign-in (no password) only works with ALLOW_TEST_SIGNIN=true, for a testing project."
    );
  if (process.env.MAIL_MODE === "gmail") {
    if (!/@/.test(process.env.MAIL_SENDER || ""))
      out.push("MAIL_SENDER must be the Gmail address emails are sent from.");
    const raw = String(process.env.GMAIL_APP_PASSWORD || "");
    const letters = raw.replace(/[^A-Za-z]/g, "").length;
    if (!raw.trim())
      out.push(
        'GMAIL_APP_PASSWORD is not set. Run "firebase functions:secrets:set GMAIL_APP_PASSWORD" and deploy again.'
      );
    else if (/^[A-Za-z\s]*$/.test(raw) && letters !== 16)
      out.push(
        `GMAIL_APP_PASSWORD has ${letters} letters; a Google App Password has exactly 16. Set it again with "firebase functions:secrets:set GMAIL_APP_PASSWORD" and deploy.`
      );
  }
  return out;
}

module.exports = {
  FUNCTIONS_DIR,
  IN_CLOUD,
  applyDefaults,
  signIn,
  envPasswordFor,
  rolesFor,
  signInChoices,
  rosterFiles,
  problems
};
