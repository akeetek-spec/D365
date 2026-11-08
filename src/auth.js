/*
 * Dashboard sign-in, at the same addresses the front end already uses:
 *   /.auth/login/aad   sign-in page (?post_login_redirect_uri=/admin)
 *   /.auth/me          who is signed in
 *   /.auth/logout      sign out
 *   /.auth/reset       "Forgot password?" (email + password sign-in only)
 *
 * SIGN_IN=firebase  email + password. Accounts are made in Firebase console > Authentication > Users.
 *                   The password is checked by Firebase Authentication (its REST API, from this server),
 *                   so no Firebase script runs in the browser and the strict page security stays as it is.
 * SIGN_IN=env       email + password, with the passwords kept in the settings file (DEFAULT_PASSWORD, or
 *                   DASHBOARD_PASSWORDS="email:password;email:password"). Checked by this server.
 * SIGN_IN=test      pick who to be, no password. Your PC, or a testing project with ALLOW_TEST_SIGNIN=true.
 *
 * Who may use the dashboard comes from ROLE_ITDIRECTOR / ROLE_ITADMIN / ROLE_LEADERSHIP and is checked on
 * every request. The session is a signed cookie named __session (the only cookie Firebase Hosting passes
 * to Cloud Functions), valid for 8 hours. The signing key is SESSION_SECRET if set, otherwise a random key
 * the app creates once and keeps in the database (settings/session).
 */
const crypto = require("crypto");
const { signIn, rolesFor, signInChoices, envPasswordFor } = require("./config");

const COOKIE = "__session";
const HOURS = 8;
const secure = () => /^https:/i.test(process.env.APP_URL || "");
const IDENTITY = () =>
  process.env.FIREBASE_AUTH_EMULATOR_HOST
    ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com`
    : "https://identitytoolkit.googleapis.com";

// ---------- signing key ----------
let keyPromise = null;
function signingKey(db) {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32)
    return Promise.resolve(process.env.SESSION_SECRET);
  keyPromise =
    keyPromise ||
    (async () => {
      const ref = db.doc("settings/session");
      let s = await ref.get();
      if (!s.exists || !(s.data() || {}).key) {
        await ref.set({
          key: crypto.randomBytes(32).toString("hex"),
          createdAt: new Date().toISOString()
        });
        s = await ref.get();
      }
      return s.data().key;
    })().catch(e => {
      keyPromise = null;
      throw e;
    });
  return keyPromise;
}

// ---------- signed cookie ----------
const mac = (key, v) => crypto.createHmac("sha256", key).update(v).digest("base64url");
async function seal(db, obj) {
  const v = Buffer.from(JSON.stringify({ ...obj, x: Date.now() + HOURS * 3600e3 })).toString(
    "base64url"
  );
  return `${v}.${mac(await signingKey(db), v)}`;
}
async function unseal(db, token) {
  const [v, sig] = String(token || "").split(".");
  if (!v || !sig) return null;
  const a = Buffer.from(mac(await signingKey(db), v)),
    b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(v, "base64url").toString("utf8"));
    return obj.x > Date.now() ? obj : null;
  } catch (e) {
    return null;
  }
}
const readCookie = req => {
  const m = String(req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
};
const cookie = (value, maxAge) =>
  `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax${secure() ? "; Secure" : ""}; Max-Age=${maxAge}`;

// The signed-in dashboard user with roles worked out now from the settings, or null.
async function currentUser(req, db) {
  const s = await unseal(db, readCookie(req));
  if (!s || !s.e) return null;
  return { email: s.e, name: s.e, roles: rolesFor(s.e) };
}
const startSession = async (db, email) => cookie(await seal(db, { e: email }), HOURS * 3600);

// ---------- pages ----------
const esc = s =>
  String(s).replace(
    /[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
const safeBack = u => (typeof u === "string" && /^\/(?!\/)/.test(u) ? u : "/admin");
const page = (title, inner) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<link rel="stylesheet" href="/styles.css"><style>
body{display:flex;justify-content:center;padding:48px 16px}.box{max-width:460px;width:100%}
.opt{display:block;padding:10px 0;border-bottom:1px solid #ddd;cursor:pointer}.opt span{color:#777;font-size:.85em;margin-left:6px}
input[type=email],input[type=password]{width:100%;padding:10px 12px;margin:4px 0 14px;box-sizing:border-box;font:15px var(--sans);border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--fg)}
label.f{display:block;font-weight:600;font-size:14px}.err{color:#b00020}.ok{color:#1b6e3a}.links{margin-top:14px;font-size:14px}
.testbadge{display:inline-block;background:#fff3cd;color:#7a5a00;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:600}
</style></head><body><div class="box">${inner}</div></body></html>`;

function testLoginPage(back, msg = "") {
  const options = signInChoices()
    .map(
      e =>
        `<label class="opt"><input type="radio" name="email" value="${esc(e)}"> ${esc(e)} <span>${esc(rolesFor(e).join(", "))}</span></label>`
    )
    .join("");
  return page(
    "Sign in (test)",
    `<form method="post" action="/.auth/login/aad"><span class="testbadge">TEST</span><h2>Sign in to the dashboard</h2>
<p class="muted">Test sign-in, no password. Production uses email and password.</p>
${msg ? `<p class="err">${esc(msg)}</p>` : ""}${options}
<input type="hidden" name="back" value="${esc(back)}"><p><button class="btn" type="submit">Sign in</button></p></form>`
  );
}
function passwordLoginPage(back, msg = "", email = "", reset = true) {
  return page(
    "Sign in",
    `<form method="post" action="/.auth/login/aad"><h2>Sign in to the dashboard</h2>
${msg ? `<p class="err">${esc(msg)}</p>` : ""}
<label class="f" for="email">Email</label><input type="email" id="email" name="email" value="${esc(email)}" autocomplete="username" required>
<label class="f" for="password">Password</label><input type="password" id="password" name="password" autocomplete="current-password" required>
<input type="hidden" name="back" value="${esc(back)}"><button class="btn" type="submit">Sign in</button>
${reset ? `<div class="links"><a href="/.auth/reset">Forgot password?</a></div>` : ""}</form>`
  );
}
function resetPage(msg = "", ok = false) {
  return page(
    "Reset password",
    `<form method="post" action="/.auth/reset"><h2>Reset your password</h2>
${msg ? `<p class="${ok ? "ok" : "err"}">${esc(msg)}</p>` : `<p class="muted">Enter your email. If it has a dashboard account, you'll get a link to set a new password.</p>`}
<label class="f" for="email">Email</label><input type="email" id="email" name="email" autocomplete="username" required>
<button class="btn" type="submit">Send reset link</button>
<div class="links"><a href="/admin">Back to sign in</a></div></form>`
  );
}
const noAccessPage = email =>
  page(
    "No access",
    `<h2>No access to the dashboard</h2><p>You're signed in as <b>${esc(email)}</b>, but this account isn't on the list of people who can use the licence dashboard.</p>
<p class="muted">Ask the IT Director to add you.</p><p><a href="/.auth/logout">Sign out</a></p>`
  );

// ---------- Firebase Authentication (email + password) ----------
const FIREBASE_ERRORS = {
  EMAIL_NOT_FOUND: "Wrong email or password.",
  INVALID_PASSWORD: "Wrong email or password.",
  INVALID_LOGIN_CREDENTIALS: "Wrong email or password.",
  INVALID_EMAIL: "Enter a valid email address.",
  USER_DISABLED: "This account has been switched off. Ask the IT Director.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Wait a few minutes and try again."
};
async function identity(method, body) {
  const res = await fetch(
    `${IDENTITY()}/v1/accounts:${method}?key=${encodeURIComponent(process.env.WEB_API_KEY)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String((out.error && out.error.message) || res.status).split(" ")[0];
    const e = new Error(
      FIREBASE_ERRORS[code] ||
        (/API_KEY|PERMISSION|CONFIGURATION|OPERATION_NOT_ALLOWED/.test(code)
          ? `Sign-in isn't set up correctly (${code}). Check WEB_API_KEY, and that Email/Password is enabled in Firebase console > Authentication > Sign-in method.`
          : `Sign-in failed (${code}).`)
    );
    e.code = code;
    throw e;
  }
  return out;
}

// ---------- routes ----------
// Returns { status, headers, body } for a /.auth/* request. form: parsed form fields for POSTs.
async function handleAuth(req, db, pathname, query, form) {
  const html = (status, body, headers = {}) => ({
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", ...headers },
    body
  });
  const go = (to, setCookie) => ({
    status: 302,
    headers: { Location: to, ...(setCookie ? { "Set-Cookie": setCookie } : {}) },
    body: ""
  });

  if (pathname === "/.auth/me") {
    const u = await currentUser(req, db);
    return {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        clientPrincipal: u
          ? {
              identityProvider: signIn(),
              userId: u.email,
              userDetails: u.email,
              userRoles: ["anonymous", "authenticated", ...u.roles]
            }
          : null
      })
    };
  }
  if (pathname === "/.auth/logout") return go("/", cookie("", 0));

  if (pathname === "/.auth/login/aad") {
    const back = safeBack(req.method === "GET" ? query.post_login_redirect_uri : form.back);
    if (signIn() === "firebase") {
      if (req.method === "GET") return html(200, passwordLoginPage(back));
      const email = String(form.email || "")
        .trim()
        .toLowerCase();
      if (!email || !form.password)
        return html(200, passwordLoginPage(back, "Enter your email and password.", email));
      let who;
      try {
        const r = await identity("signInWithPassword", {
          email,
          password: String(form.password),
          returnSecureToken: true
        });
        who = String(r.email || email).toLowerCase();
      } catch (e) {
        return html(200, passwordLoginPage(back, e.message, email));
      }
      if (!rolesFor(who).length) return html(403, noAccessPage(who));
      return go(back, await startSession(db, who));
    }
    if (signIn() === "env") {
      if (req.method === "GET") return html(200, passwordLoginPage(back, "", "", false));
      const email = String(form.email || "")
        .trim()
        .toLowerCase();
      const want = Buffer.from(envPasswordFor(email)),
        got = Buffer.from(String(form.password || ""));
      if (!want.length || want.length !== got.length || !crypto.timingSafeEqual(want, got))
        return html(200, passwordLoginPage(back, "Wrong email or password.", email, false));
      return go(back, await startSession(db, email));
    }
    // test sign-in
    if (req.method === "GET") return html(200, testLoginPage(back));
    const email = String(form.email || "")
      .trim()
      .toLowerCase();
    if (!email) return html(200, testLoginPage(back, "Choose a person."));
    if (!rolesFor(email).length)
      return html(200, testLoginPage(back, `${email} has no dashboard role.`));
    return go(back, await startSession(db, email));
  }

  if (pathname === "/.auth/reset" && signIn() === "firebase") {
    if (req.method === "GET") return html(200, resetPage());
    const email = String(form.email || "")
      .trim()
      .toLowerCase();
    // Only dashboard users get a reset email; the reply is the same either way.
    if (email && rolesFor(email).length) {
      try {
        await identity("sendOobCode", { requestType: "PASSWORD_RESET", email });
      } catch (e) {
        if (!/EMAIL_NOT_FOUND/.test(e.code)) return html(200, resetPage(e.message));
      }
    }
    return html(
      200,
      resetPage(
        "If that email has a dashboard account, a reset link is on its way. Check the inbox (and spam).",
        true
      )
    );
  }
  return { status: 404, headers: { "Content-Type": "text/plain" }, body: "Not found" };
}

module.exports = { handleAuth, currentUser };
