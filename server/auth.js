/*
 * Dashboard sign-in. Serves the same /.auth/* addresses Azure Static Web Apps uses, so the front end
 * works unchanged:
 *   /.auth/login/aad   start sign-in (?post_login_redirect_uri=/admin)
 *   /.auth/login/aad/callback   Microsoft sends people back here
 *   /.auth/me          who is signed in
 *   /.auth/logout      sign out
 *
 *   /.auth/reset       "Forgot password?" (Firebase sign-in only)
 *
 * Modes (SIGN_IN, see config.js):
 *   firebase   email + password. Accounts are made in Firebase console > Authentication > Users.
 *              The password is checked by Firebase Authentication (its REST API, from this server),
 *              so no Firebase script runs in the browser.
 *   password   a fixed list of email + password pairs in ADMIN_LOGINS (JSON). No reset, no other steps.
 *   test       a page where you pick who to be. No password: your PC, or a cloud testing backend
 *              with its own database (config.js enforces that).
 *   microsoft  Microsoft Entra ID sign-in (OpenID Connect, authorization code flow). Optional.
 *
 * Who may use the dashboard comes from ROLE_ITDIRECTOR / ROLE_ITADMIN / ROLE_LEADERSHIP and is checked
 * on every request, so removing someone from those lists takes effect straight away.
 * The session is a signed cookie (no server memory), so it works with several app instances.
 */
const crypto = require("crypto");
const { SIGN_IN, rolesFor, signInChoices } = require("./config");

const SESSION_HOURS = 8;
const SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString("hex"); // test mode only: sessions end when the server restarts
const SECURE = /^https:/i.test(process.env.APP_URL || "");
const AUTHORITY = (process.env.AAD_AUTHORITY || "https://login.microsoftonline.com").replace(
  /\/+$/,
  ""
);
const CALLBACK = () => `${process.env.APP_URL}/.auth/login/aad/callback`;
// Firebase Authentication REST API (or the Firebase Auth emulator on your PC).
const IDENTITY = process.env.FIREBASE_AUTH_EMULATOR_HOST
  ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com`
  : "https://identitytoolkit.googleapis.com";

// ---------- signed cookies ----------
const sign = v => crypto.createHmac("sha256", SECRET).update(v).digest("base64url");
function seal(obj, minutes) {
  const v = Buffer.from(JSON.stringify({ ...obj, x: Date.now() + minutes * 60e3 })).toString(
    "base64url"
  );
  return `${v}.${sign(v)}`;
}
function unseal(token) {
  const [v, s] = String(token || "").split(".");
  if (!v || !s) return null;
  const a = Buffer.from(sign(v)),
    b = Buffer.from(s);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(v, "base64url").toString("utf8"));
    return obj.x > Date.now() ? obj : null;
  } catch (e) {
    return null;
  }
}
const readCookie = (req, name) => {
  const m = String(req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
};
const cookie = (name, value, maxAgeSeconds) =>
  `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${SECURE ? "; Secure" : ""}; Max-Age=${maxAgeSeconds}`;

// Signed-in person, with roles worked out now from the settings. null if not signed in.
function currentUser(req) {
  const s = unseal(readCookie(req, "lc_session"));
  if (!s || !s.e) return null;
  return { email: s.e, name: s.n || s.e, roles: rolesFor(s.e) };
}
const startSession = (email, name) =>
  cookie("lc_session", seal({ e: email, n: name }, SESSION_HOURS * 60), SESSION_HOURS * 3600);

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
input[type=email],input[type=password]{width:100%;padding:10px 12px;margin:4px 0 14px;box-sizing:border-box}
input[type=password]{font:15px var(--sans);color:var(--fg);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
label.f{display:block;font-weight:600;font-size:14px}.err{color:#b00020}.ok{color:#1b6e3a}
.links{margin-top:14px;font-size:14px}
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
    `<form method="post" action="/.auth/login/aad"><h2>Sign in to the dashboard</h2>
<p class="muted">Test sign-in, no password. Only for testing; production uses email and password.</p>
${msg ? `<p class="err">${esc(msg)}</p>` : ""}${options}
<p>Or another email address:</p><input type="email" name="other" placeholder="name@championchair.com">
<input type="hidden" name="back" value="${esc(back)}"><button class="btn" type="submit">Sign in</button></form>`
  );
}
function passwordLoginPage(back, msg = "", email = "", forgot = true) {
  return page(
    "Sign in",
    `<form method="post" action="/.auth/login/aad"><h2>Sign in to the dashboard</h2>
${msg ? `<p class="err">${esc(msg)}</p>` : ""}
<label class="f" for="email">Email</label><input type="email" id="email" name="email" value="${esc(email)}" autocomplete="username" required>
<label class="f" for="password">Password</label><input type="password" id="password" name="password" autocomplete="current-password" required>
<input type="hidden" name="back" value="${esc(back)}"><button class="btn" type="submit">Sign in</button>
${forgot ? '<div class="links"><a href="/.auth/reset">Forgot password?</a></div>' : ""}</form>`
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
const errorPage = msg =>
  page(
    "Sign-in problem",
    `<h2>Sign-in didn't work</h2><p>${esc(msg)}</p><p><a href="/admin">Try again</a></p>`
  );

// ---------- Microsoft Entra ID ----------
function microsoftStart(back) {
  const state = crypto.randomBytes(16).toString("base64url");
  const nonce = crypto.randomBytes(16).toString("base64url");
  const q = new URLSearchParams({
    client_id: process.env.AAD_CLIENT_ID,
    response_type: "code",
    redirect_uri: CALLBACK(),
    response_mode: "query",
    scope: "openid profile email",
    state,
    nonce,
    prompt: "select_account"
  });
  return {
    location: `${AUTHORITY}/${encodeURIComponent(process.env.AAD_TENANT_ID)}/oauth2/v2.0/authorize?${q}`,
    cookie: cookie("lc_login", seal({ s: state, n: nonce, b: back }, 10), 600)
  };
}

// Exchanges the code for an ID token. The token comes straight from Microsoft over HTTPS using the
// client secret, so its contents can be trusted (OpenID Connect Core 3.1.3.7); we still check the
// audience, tenant, nonce and expiry.
async function microsoftFinish(url, req) {
  const login = unseal(readCookie(req, "lc_login"));
  if (url.searchParams.get("error"))
    throw new Error(url.searchParams.get("error_description") || url.searchParams.get("error"));
  if (!login || login.s !== url.searchParams.get("state"))
    throw new Error("The sign-in took too long or was started in another window.");
  const res = await fetch(
    `${AUTHORITY}/${encodeURIComponent(process.env.AAD_TENANT_ID)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AAD_CLIENT_ID,
        client_secret: process.env.AAD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: url.searchParams.get("code") || "",
        redirect_uri: CALLBACK(),
        scope: "openid profile email"
      })
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.id_token)
    throw new Error(body.error_description || `Microsoft sign-in failed (${res.status}).`);
  const claims = JSON.parse(Buffer.from(body.id_token.split(".")[1], "base64url").toString("utf8"));
  const tenant = String(process.env.AAD_TENANT_ID).toLowerCase();
  const issuerOk =
    claims.iss === `${AUTHORITY}/${claims.tid}/v2.0` &&
    (!/^[0-9a-f-]{36}$/.test(tenant) || String(claims.tid).toLowerCase() === tenant);
  if (claims.aud !== process.env.AAD_CLIENT_ID || !issuerOk)
    throw new Error("This sign-in is for a different app or organisation.");
  if (claims.nonce !== login.n)
    throw new Error("The sign-in could not be confirmed. Please try again.");
  if (!claims.exp || claims.exp * 1000 < Date.now() - 60e3)
    throw new Error("The sign-in has expired. Please try again.");
  const email = String(claims.email || claims.preferred_username || claims.upn || "").toLowerCase();
  if (!email) throw new Error("Microsoft didn't share an email address for this account.");
  return { email, name: claims.name || email, back: safeBack(login.b) };
}

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
    `${IDENTITY}/v1/accounts:${method}?key=${encodeURIComponent(process.env.FIREBASE_API_KEY)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String((out.error && out.error.message) || res.status).split(" ")[0];
    const e = new Error(
      FIREBASE_ERRORS[code] ||
        (/API_KEY|PERMISSION|CONFIGURATION|OPERATION_NOT_ALLOWED/.test(code)
          ? `Sign-in isn't set up correctly (${code}). Check FIREBASE_API_KEY and that Email/Password is enabled in Firebase Authentication.`
          : `Sign-in failed (${code}).`)
    );
    e.code = code;
    throw e;
  }
  return out;
}
// The password is checked by Firebase over HTTPS with this project's API key, so the answer is trusted.
async function firebaseSignIn(email, password) {
  const r = await identity("signInWithPassword", { email, password, returnSecureToken: true });
  return { email: String(r.email || email).toLowerCase(), name: r.displayName || r.email || email };
}

// ---------- fixed list (SIGN_IN=password) ----------
const sha = v => crypto.createHash("sha256").update(String(v)).digest();
function listSignIn(email, password) {
  let list = [];
  try {
    list = JSON.parse(process.env.ADMIN_LOGINS || "[]");
  } catch (e) {}
  let hit = null;
  for (const u of list) {
    const okMail = String(u.email || "").toLowerCase() === email;
    const okPass = crypto.timingSafeEqual(sha(u.password), sha(password));
    if (okMail && okPass) hit = u;
  }
  if (!hit) throw new Error("Wrong email or password.");
  return { email, name: hit.name || email };
}

// ---------- routes ----------
// Returns { status, headers, body } for a /.auth/* request.
async function handleAuth(req, url, readBody) {
  const html = (status, body, headers = {}) => ({
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    },
    body
  });
  const go = (to, setCookie) => ({
    status: 302,
    headers: {
      Location: to,
      "Cache-Control": "no-store",
      ...(setCookie ? { "Set-Cookie": setCookie } : {})
    },
    body: ""
  });

  if (url.pathname === "/.auth/me") {
    const u = currentUser(req);
    return {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      body: JSON.stringify({
        clientPrincipal: u
          ? {
              identityProvider: "aad",
              userId: u.email,
              userDetails: u.email,
              userRoles: ["anonymous", "authenticated", ...u.roles]
            }
          : null
      })
    };
  }
  if (url.pathname === "/.auth/logout") return go("/", cookie("lc_session", "", 0));

  if (SIGN_IN === "microsoft") {
    if (url.pathname === "/.auth/login/aad" && req.method === "GET") {
      const s = microsoftStart(safeBack(url.searchParams.get("post_login_redirect_uri")));
      return go(s.location, s.cookie);
    }
    if (url.pathname === "/.auth/login/aad/callback" && req.method === "GET") {
      let who;
      try {
        who = await microsoftFinish(url, req);
      } catch (e) {
        return html(400, errorPage(e.message), { "Set-Cookie": cookie("lc_login", "", 0) });
      }
      if (!rolesFor(who.email).length)
        return html(403, noAccessPage(who.email), { "Set-Cookie": cookie("lc_login", "", 0) });
      return go(who.back, [startSession(who.email, who.name), cookie("lc_login", "", 0)]);
    }
    return { status: 404, headers: { "Content-Type": "text/plain" }, body: "Not found" };
  }

  if (SIGN_IN === "firebase" || SIGN_IN === "password") {
    const fixed = SIGN_IN === "password";
    if (url.pathname === "/.auth/login/aad") {
      if (req.method === "GET")
        return html(
          200,
          passwordLoginPage(
            safeBack(url.searchParams.get("post_login_redirect_uri")),
            "",
            "",
            !fixed
          )
        );
      const form = new URLSearchParams(await readBody(req));
      const email = String(form.get("email") || "")
        .trim()
        .toLowerCase();
      const back = safeBack(form.get("back"));
      if (!email || !form.get("password"))
        return html(200, passwordLoginPage(back, "Enter your email and password.", email, !fixed));
      let who;
      try {
        who = fixed
          ? listSignIn(email, String(form.get("password")))
          : await firebaseSignIn(email, String(form.get("password")));
      } catch (e) {
        return html(200, passwordLoginPage(back, e.message, email, !fixed));
      }
      if (!rolesFor(who.email).length) return html(403, noAccessPage(who.email));
      return go(back, startSession(who.email, who.name));
    }
    if (url.pathname === "/.auth/reset" && !fixed) {
      if (req.method === "GET") return html(200, resetPage());
      const email = String(new URLSearchParams(await readBody(req)).get("email") || "")
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

  // test sign-in
  if (url.pathname === "/.auth/login/aad") {
    if (req.method === "GET")
      return html(200, testLoginPage(safeBack(url.searchParams.get("post_login_redirect_uri"))));
    const form = new URLSearchParams(await readBody(req));
    const email = String(form.get("other") || form.get("email") || "")
      .trim()
      .toLowerCase();
    const back = safeBack(form.get("back"));
    if (!email) return html(200, testLoginPage(back, "Choose a person or enter an email address."));
    if (!rolesFor(email).length)
      return html(
        200,
        testLoginPage(
          back,
          `${email} has no dashboard role. Add it to ROLE_ITDIRECTOR, ROLE_ITADMIN or ROLE_LEADERSHIP.`
        )
      );
    return go(back, startSession(email, email));
  }
  return { status: 404, headers: { "Content-Type": "text/plain" }, body: "Not found" };
}

module.exports = { handleAuth, currentUser };
