/*
 * Every /api/* request. Workflow: the person answers → the IT Director approves, sends back or declines
 * → the IT Director marks the licence as set up. No supervisor step.
 *
 * handle({ method, path, query, headers, body, raw, principal }, { db, blobs }) → { status, body } or { status, file }
 *   body: parsed JSON. raw: Buffer (uploads). principal: { name, roles[] } from the dashboard sign-in, or null.
 */
const { M, L } = require("./model");
const tokens = require("./tokens");
const mail = require("./mail");
const { check } = require("./blobs");

const reply = (status, body) => ({ status, body });
const docData = async ref => {
  const s = await ref.get();
  return s.exists ? s.data() : null;
};
async function prices(db) {
  const p = await docData(db.doc("settings/prices"));
  return { ...M.DEFAULT_PRICES, ...(p && p.prices ? p.prices : {}) };
}
const DIRECTOR = () => ({
  name: process.env.IT_DIRECTOR_NAME || "the IT Director",
  email: process.env.IT_DIRECTOR_EMAIL
});
const dashLink = () => `${(process.env.APP_URL || "").replace(/\/+$/, "")}/admin`;
const first = e => {
  const l = String(e).split("@")[0];
  return l.includes(".") ? l[0].toUpperCase() + l.split(".")[0].slice(1).toLowerCase() : "";
};
const hi = e => (first(e) ? `Hi ${first(e)},` : "Hello,");
const sign = "\nThanks,\nIT Team\n";
const stepFail = e =>
  reply(e.code === "comment_required" ? 400 : 409, { error: e.code, message: e.message });
const publicUser = (id, u) => ({
  id,
  email: u.email,
  current: u.current || [],
  required: u.required || [],
  jobTitle: u.jobTitle || "",
  managerEmailStatus: u.managerEmailStatus || "",
  gapRoles: u.gapRoles || {}
});
const publicRequest = r =>
  r && r.answers
    ? {
        status: r.status || "submitted",
        submittedAt: r.submittedAt,
        history: r.history || [],
        extra: r.extra || {},
        answers: r.answers,
        rec: r.rec,
        provisionedLicence: r.provisionedLicence || ""
      }
    : null;

const T = {
  invite: async (db, id, u) => [
    u.email,
    "Quick action needed: Confirm your D365 license by Friday, November 13",
    `${hi(u.email)}\n\nOn behalf of ${DIRECTOR().name}, we're reviewing D365 access to make sure everyone has the right license for their role.\n\nCould you take a minute to complete this short form by Friday, November 13?\n\n${tokens.link("user", await tokens.issue(db, "user", id))}\n\nThank you for your help!\n\nBest regards,\nIT Team\n`,
    "invite"
  ],
  directorReview: async (u, label, cost) => [
    DIRECTOR().email,
    `D365 licence request: ${u.email}`,
    `Hello,\n\n${u.email} has answered the licence check. It adds up to: ${label} (${cost} a month).\n\nReview it on the dashboard: ${dashLink()}\n${sign}`,
    "director_review"
  ],
  returned: async (db, id, u, c) => [
    u.email,
    "Your D365 answers need a small change",
    `${hi(u.email)}\n\n${DIRECTOR().name} has sent your D365 answers back with this comment:\n\n"${c}"\n\nPlease change your answers and send them again:\n\n${tokens.link("user", await tokens.issue(db, "user", id))}\n${sign}`,
    "returned"
  ],
  approved: async (u, label) => [
    u.email,
    "Your D365 licence has been approved",
    `${hi(u.email)}\n\nYour D365 licence (${label}) has been approved. IT will set it up and let you know when it's done.\n${sign}`,
    "approved"
  ],
  provisioned: async (u, lic) => [
    u.email,
    "Your D365 licence is ready",
    `${hi(u.email)}\n\nYour D365 access has been updated: ${lic}. If anything you need is missing, reply to this email.\n${sign}`,
    "provisioned"
  ],
  rejected: async (u, c) => [
    u.email,
    "Your D365 licence request",
    `${hi(u.email)}\n\n${DIRECTOR().name} has not approved your D365 licence request:\n\n"${c}"\n\nIT will be in touch.\n${sign}`,
    "rejected"
  ]
};
const send = async (db, made) => {
  const [to, subject, body, kind] = await made;
  return mail.queue(db, to, subject, body, kind);
};
// Email one person their personal link and note when they were invited. With revoke, older links stop working.
// Returns the outbox id of the email.
async function invite(db, id, u, { revoke = false } = {}) {
  if (revoke) await tokens.revokeAll(db, "user", id);
  const outboxId = await send(db, T.invite(db, id, u));
  const cur = (await docData(db.doc(`roster/${id}`))) || u;
  await db
    .doc(`roster/${id}`)
    .set({ ...cur, invitedAt: new Date().toISOString(), inviteCount: (cur.inviteCount || 0) + 1 });
  return outboxId;
}
const money = n => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");

async function handle(req, { db, blobs }) {
  const {
    method = "GET",
    path,
    query = {},
    headers = {},
    body = {},
    raw = null,
    principal = null
  } = req;
  const h = k => headers[k] || headers[k.toLowerCase()] || "";
  const roles = (principal && principal.roles) || [];
  const viewer = roles.includes("itdirector")
    ? "itdirector"
    : roles.includes("itadmin")
      ? "itadmin"
      : roles.includes("leadership")
        ? "leadership"
        : null;
  try {
    // ---------- screenshots (served only after an access check) ----------
    const fm = path.match(/^\/api\/file\/([a-f0-9]{32})$/);
    if (fm) {
      const f = await blobs.get(fm[1]);
      if (!f) return reply(404, { message: "Not found" });
      const owner = await tokens.resolve(db, "user", h("x-invite-token"));
      if (!viewer && !(owner && owner === f.meta.owner && f.meta.kind === "user"))
        return reply(404, { message: "Not found" });
      return { status: 200, file: { buf: f.buf, type: f.type } };
    }
    // ---------- person answering (personal link) ----------
    if (["/api/me", "/api/respond", "/api/upload"].includes(path)) {
      const id = await tokens.resolve(db, "user", h("x-invite-token"));
      const u = id && (await docData(db.doc(`roster/${id}`)));
      if (!u)
        return reply(401, {
          message: "This link has expired or isn't valid. Ask IT to send you a new one."
        });
      if (path === "/api/me") {
        const r = await docData(db.doc(`responses/${id}`));
        return reply(200, {
          user: publicUser(id, u),
          request: publicRequest(r),
          director: { name: DIRECTOR().name }
        });
      }
      if (method !== "POST") return reply(405, { message: "Use POST." });
      if (path === "/api/upload") {
        const bad = check(raw);
        if (bad) return reply(400, { message: bad });
        return reply(200, { id: await blobs.put(raw, { owner: id, kind: "user" }) });
      }
      // /api/respond: the server works out the licence from the answers; nothing about the licence is taken from the browser.
      const f = L.cleanForm(u, body.answers);
      for (const s of f.extraShots) {
        const m = await blobs.meta(s.id);
        if (!m || m.owner !== id || m.kind !== "user")
          return reply(400, { message: "One of the screenshots couldn't be found. Add it again." });
      }
      const open = L.openItems(u, f);
      if (open.length) return reply(400, { message: `Still to answer: ${open.join(", ")}.` });
      const P = await prices(db),
        answers = M.cleanAnswers(L.modelAnswers(u, f)),
        rec = M.recommend(answers, P),
        plan = L.licencePlan(u, rec, P);
      const recOut = {
        kind: rec.kind,
        label: f.never ? "No licence needed" : L.planLabel(rec, plan),
        cost: rec.cost,
        base: plan.base,
        attach: plan.attach
      };
      const prev = await docData(db.doc(`responses/${id}`));
      let next;
      try {
        next = M.transition(prev && prev.status ? prev : null, "submit", u.email, "", {
          answers,
          rec: recOut,
          extra: f,
          submittedAt: new Date().toISOString()
        });
      } catch (e) {
        return stepFail(e);
      }
      await db.doc(`responses/${id}`).set(next);
      await send(db, T.directorReview(u, recOut.label, money(rec.cost)));
      return reply(200, { ok: true, request: publicRequest(next) });
    }
    // ---------- IT dashboard (signed in; roles from ROLE_* settings) ----------
    if (path.startsWith("/api/admin/")) {
      if (!viewer)
        return reply(403, {
          message: "You don't have access to the licence dashboard. Ask the IT Director."
        });
      const actor = principal.name || "IT";
      if (path === "/api/admin/data") {
        const [ro, re, ob, ev] = await Promise.all(
          ["roster", "responses", "outbox", "evidence"].map(c => db.collection(c).get())
        );
        return reply(200, {
          viewer: { name: actor, roles: [viewer] },
          director: { name: DIRECTOR().name },
          prices: await prices(db),
          mailMode: mail.mode(),
          roster: ro.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.order || 999) - (b.order || 999)),
          responses: Object.fromEntries(
            re.docs.map(d => [d.id, publicRequest(d.data())]).filter(([, v]) => v)
          ),
          evidence: Object.fromEntries(ev.docs.map(d => [d.id, d.data()])),
          outbox:
            viewer === "leadership"
              ? []
              : ob.docs
                  .map(d => ({ id: d.id, ...d.data() }))
                  .filter(o => o.status === "pending")
                  .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        });
      }
      if (viewer === "leadership")
        return reply(403, { message: "Leadership has a read-only view." });
      if (method !== "POST") return reply(405, { message: "Use POST." });
      if (path === "/api/admin/approval") {
        if (viewer !== "itdirector")
          return reply(403, {
            message: "Only the IT Director can approve, send back, decline or set up licences."
          });
        const map = {
            approve: "director_approve",
            return: "director_return",
            reject: "director_reject",
            provision: "director_provision"
          },
          action = map[body.action];
        const r = body.userId && (await docData(db.doc(`responses/${body.userId}`))),
          u = body.userId && (await docData(db.doc(`roster/${body.userId}`)));
        if (!r || !u || !action)
          return reply(404, { message: "This person hasn't sent answers yet." });
        const comment = String(body.comment || "")
          .trim()
          .slice(0, 1000);
        if (action === "director_return" && !comment)
          return reply(400, {
            error: "comment_required",
            message: "Add a comment so the person knows what to change."
          });
        const extra =
          action === "director_provision"
            ? {
                provisionedLicence: (r.rec && r.rec.label) || "",
                provisionedAt: new Date().toISOString()
              }
            : {};
        let next;
        try {
          next = M.transition(r, action, `${actor} (IT Director)`, comment, extra);
        } catch (e) {
          return stepFail(e);
        }
        await db.doc(`responses/${body.userId}`).set(next);
        if (action === "director_approve") await send(db, T.approved(u, r.rec.label));
        if (action === "director_return") await send(db, T.returned(db, body.userId, u, comment));
        if (action === "director_reject") await send(db, T.rejected(u, comment));
        if (action === "director_provision")
          await send(db, T.provisioned(u, next.provisionedLicence));
        return reply(200, { ok: true, request: publicRequest(next) });
      }
      if (path === "/api/admin/evidence" || path === "/api/admin/upload") {
        const userId = path === "/api/admin/upload" ? query.userId : body.userId;
        if (!userId || !(await docData(db.doc(`roster/${userId}`))))
          return reply(404, { message: "No such person." });
        const ev = (await docData(db.doc(`evidence/${userId}`))) || { pages: "", shots: [] };
        ev.shots = ev.shots || [];
        if (path === "/api/admin/upload") {
          if (ev.shots.length >= 10)
            return reply(400, { message: "Up to 10 screenshots per person." });
          const bad = check(raw);
          if (bad) return reply(400, { message: bad });
          ev.shots.push({
            id: await blobs.put(raw, { owner: userId, kind: "evidence" }),
            name: String(query.name || "screenshot").slice(0, 80)
          });
        } else {
          if (typeof body.pages === "string") ev.pages = body.pages.slice(0, 3000);
          if (Number.isInteger(body.removeShot)) ev.shots.splice(body.removeShot, 1);
        }
        await db
          .doc(`evidence/${userId}`)
          .set({ ...ev, updatedAt: new Date().toISOString(), updatedBy: actor });
        return reply(200, { ok: true, evidence: ev });
      }
      if (path === "/api/admin/reissue") {
        const u = await docData(db.doc(`roster/${body.id}`));
        if (!u) return reply(404, { message: "No such person." });
        await invite(db, body.id, u, { revoke: true });
        return reply(200, { ok: true });
      }
      // Send invites from the dashboard (IT Director only).
      //   scope "new":    everyone who hasn't answered and hasn't been invited yet
      //   scope "remind": everyone who hasn't answered (a fresh link; earlier links keep working)
      //   ids [...]:      only these people (if they haven't answered)
      if (path === "/api/admin/invite") {
        if (viewer !== "itdirector")
          return reply(403, { message: "Only the IT Director can send invites." });
        const [ro, re] = await Promise.all([
          db.collection("roster").get(),
          db.collection("responses").get()
        ]);
        const answered = new Set(re.docs.filter(d => (d.data() || {}).answers).map(d => d.id));
        const ids = Array.isArray(body.ids) ? body.ids.map(String) : null,
          remind = body.scope === "remind";
        const people = ro.docs
          .map(d => ({ id: d.id, u: d.data() }))
          .filter(p => p.u && p.u.email && !answered.has(p.id))
          .filter(p => (ids ? ids.includes(p.id) : remind || !p.u.invitedAt));
        let sent = 0;
        const failed = [];
        for (const p of people) {
          try {
            const o = await docData(db.doc(`outbox/${await invite(db, p.id, p.u)}`));
            if (o && o.error) failed.push(p.u.email);
            else sent++;
          } catch (e) {
            failed.push(p.u.email);
          }
        }
        return reply(200, { ok: true, sent, failed, mailMode: mail.mode() });
      }
      if (path === "/api/admin/outbox-sent") {
        const o = await docData(db.doc(`outbox/${body.id}`));
        if (!o) return reply(404, { message: "No such email." });
        await db.doc(`outbox/${body.id}`).set({
          ...o,
          status: "sent",
          sentAt: new Date().toISOString(),
          sentBy: actor,
          body: "(removed after sending)"
        });
        return reply(200, { ok: true });
      }
      if (path === "/api/admin/prices") {
        if (viewer !== "itdirector")
          return reply(403, { message: "Only the IT Director can change prices." });
        const P = { ...(await prices(db)) };
        for (const k of Object.keys(M.DEFAULT_PRICES))
          if (Number.isFinite(Number(body[k]))) P[k] = Number(body[k]);
        await db.doc("settings/prices").set({ prices: P });
        return reply(200, { ok: true, prices: P });
      }
    }
    return reply(404, { message: "Not found" });
  } catch (e) {
    console.error(`${method} ${path} failed:`, e); // shows the real cause in the App Hosting / Functions logs
    // Screenshot storage problems get a clear message, so the cause is visible without opening the logs.
    const storage =
      /bucket|storage\.objects|does not have storage|Caller does not have|code: ?403|"code":403/i.test(
        `${e && e.message}`
      );
    return reply(500, {
      message: /\/upload$/.test(path)
        ? `Screenshot upload failed: ${String((e && (e.message || e.code)) || e).slice(0, 200)}`
        : storage
          ? "Screenshots can't be saved: Cloud Storage isn't set up or this server isn't allowed to use it. Ask IT to check the storage bucket and its permissions."
          : "Something went wrong on our side. Please try again in a minute.",
      detail: process.env.DEBUG ? String(e.stack || e) : undefined
    });
  }
}
module.exports = { handle, T, send, invite };
