/*
 * All /api/* requests. Same endpoints and rules as the prototype, with real personal links,
 * Entra ID roles for the dashboard, and email through the outbox (and Graph when enabled).
 *
 * handle({ method, path, headers, body, principal }, db) -> { status, body }
 *   principal: { name, email, roles[] } from Static Web Apps sign-in, or null.
 */
const M = require("./model");
const tokens = require("./tokens");
const mail = require("./mail");

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const reply = (status, body) => ({ status, body });
const docData = async ref => {
  const s = await ref.get();
  return s.exists ? s.data() : null;
};
async function prices(db) {
  const p = await docData(db.doc("settings/prices"));
  return { ...M.DEFAULT_PRICES, ...(p && p.prices ? p.prices : {}) };
}
const director = () => process.env.IT_DIRECTOR_EMAIL;
const dashLink = () => `${(process.env.APP_URL || "").replace(/\/+$/, "")}/admin`;
const isShared = u => u.managerEmailStatus === "none" || /shared/i.test(u.jobTitle || "");
const publicUser = (id, u) => ({
  id,
  email: u.email,
  current: u.current || [],
  required: u.required || [],
  managerEmail: u.managerEmail || "",
  jobTitle: u.jobTitle || "",
  supervisorName: u.supervisorName || "",
  sharedAccount: isShared(u)
});
const publicRequest = r =>
  r && r.answers
    ? {
        answers: r.answers,
        rec: r.rec,
        submittedAt: r.submittedAt,
        status: r.status || "none",
        history: r.history || [],
        managerEmail: r.managerEmail || "",
        provisionedLicence: r.provisionedLicence || ""
      }
    : null;
const first = e => {
  const l = String(e).split("@")[0];
  return l.includes(".") ? l[0].toUpperCase() + l.split(".")[0].slice(1).toLowerCase() : "";
};
const hi = e => (first(e) ? `Hi ${first(e)},` : "Hello,");
const sign = "\nThanks,\nIT Team\n";
const stepFail = e =>
  reply(e.code === "comment_required" ? 400 : 409, { error: e.code, message: e.message });
const findUser = async (db, id) => docData(db.doc(`roster/${id}`));

// Email texts. Links are created per email; only their hashes are stored.
const T = {
  invite: async (db, id, u) => [
    u.email,
    "Please check your D365 licence (2 minutes)",
    `${hi(u.email)}\n\nWe're making sure everyone has the D365 licence their job needs, and nothing more. Please answer a few short questions:\n\n${tokens.link("user", await tokens.issue(db, "user", id))}\n\nThe link is personal to you and works for ${process.env.LINK_DAYS || 30} days.\n${sign}`,
    "invite"
  ],
  managerReview: async (db, m, u, rec) => [
    m,
    `Approval needed: D365 licence for ${u.email}`,
    `${hi(m)}\n\n${u.email} has told us how they use D365. Based on that, they need: ${rec.label}.\n\nPlease confirm this matches their job, or send it back with a comment:\n\n${tokens.link("manager", await tokens.issue(db, "manager", m))}\n\nThis link is personal to you and lists everyone in your team who is waiting.\n${sign}`,
    "manager_review"
  ],
  directorReview: async (db, u, rec) => [
    director(),
    `Ready for IT Director approval: ${u.email}`,
    `Hello,\n\nThe supervisor has approved the D365 licence request for ${u.email}: ${rec.label}.\n\nReview it on the dashboard: ${dashLink()}\n${sign}`,
    "director_review"
  ],
  returned: async (db, id, u, c) => [
    u.email,
    "Your D365 licence answers need a small change",
    `${hi(u.email)}\n\nYour supervisor has sent your D365 answers back with this comment:\n\n"${c}"\n\nPlease adjust your answers and send them again:\n\n${tokens.link("user", await tokens.issue(db, "user", id))}\n${sign}`,
    "returned"
  ],
  approved: async (db, u, rec) => [
    u.email,
    "Your D365 licence has been approved",
    `${hi(u.email)}\n\nYour D365 licence (${rec.label}) has been approved. IT will set it up and let you know when it's done.\n${sign}`,
    "approved"
  ],
  provisioned: async (db, u, lic) => [
    u.email,
    "Your D365 licence is ready",
    `${hi(u.email)}\n\nYour D365 access has been updated: ${lic}. If anything you need is missing, reply to this email.\n${sign}`,
    "provisioned"
  ],
  rejected: async (db, u, m, c) => [
    [u.email, m],
    `D365 licence request not approved: ${u.email}`,
    `Hello,\n\nThe IT Director has not approved the D365 licence request for ${u.email}:\n\n"${c}"\n\nIT will be in touch about next steps.\n${sign}`,
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
  const cur = (await findUser(db, id)) || u;
  await db.doc(`roster/${id}`).set({
    ...cur,
    invitedAt: new Date().toISOString(),
    inviteCount: (cur.inviteCount || 0) + 1
  });
  return outboxId;
}

async function handle(req, db) {
  const { method = "GET", path, headers = {}, body = {}, principal = null } = req;
  const h = k => headers[k] || headers[k.toLowerCase()] || "";
  try {
    // ---------- person answering ----------
    if (path === "/api/me" || path === "/api/respond") {
      const id = await tokens.resolve(db, "user", h("x-invite-token"));
      const u = id && (await findUser(db, id));
      if (!u)
        return reply(401, {
          message: "This link has expired or isn't valid. Ask IT to send you a new one."
        });
      const P = await prices(db);
      const r = await docData(db.doc(`responses/${id}`));
      if (path === "/api/me")
        return reply(200, {
          user: publicUser(id, u),
          response: r && r.answers ? r.answers : null,
          submittedAt: r ? r.submittedAt : null,
          request: publicRequest(r),
          prices: P
        });
      if (method !== "POST") return reply(405, { message: "Use POST." });
      const answers = M.limitToModules(M.cleanAnswers(body.answers), M.modulesFor(u));
      const rec = M.recommend(answers, P);
      if (!rec)
        return reply(400, { message: "Tell us whether you use D365 and what you do in it." });
      const managerEmail = u.managerEmail || String(body.managerEmail || "").trim();
      if (!EMAIL.test(managerEmail))
        return reply(400, {
          message: "Enter your supervisor's email address so they can approve your licence."
        });
      if (managerEmail.toLowerCase() === u.email.toLowerCase())
        return reply(400, { message: "Your approver has to be someone other than you." });
      const recOut = { kind: rec.kind, label: M.licLabel(rec), cost: rec.cost };
      let next;
      try {
        next = M.transition(r && r.status ? r : null, "submit", u.email, "", {
          answers,
          rec: recOut,
          submittedAt: new Date().toISOString(),
          managerEmail
        });
      } catch (e) {
        return stepFail(e);
      }
      await db.doc(`responses/${id}`).set(next);
      await send(db, T.managerReview(db, managerEmail, u, recOut));
      return reply(200, { ok: true, rec: recOut, why: rec.why, status: next.status, managerEmail });
    }
    // ---------- supervisor ----------
    if (path === "/api/manager" || path === "/api/manager/decision") {
      const me = await tokens.resolve(db, "manager", h("x-manager-token"));
      if (!me)
        return reply(401, {
          message: "This approval link has expired or isn't valid. Ask IT to send a new one."
        });
      if (path === "/api/manager") {
        const [ro, re] = await Promise.all(
          ["roster", "responses"].map(c => db.collection(c).get())
        );
        const byId = Object.fromEntries(ro.docs.map(d => [d.id, d.data()]));
        const team = re.docs
          .filter(
            d =>
              byId[d.id] &&
              String(d.data().managerEmail || "").toLowerCase() === me &&
              d.data().answers
          )
          .map(d => ({ user: publicUser(d.id, byId[d.id]), request: publicRequest(d.data()) }));
        return reply(200, { manager: { email: me }, team, prices: await prices(db) });
      }
      if (method !== "POST") return reply(405, { message: "Use POST." });
      const action =
        body.action === "approve"
          ? "manager_approve"
          : body.action === "return"
            ? "manager_return"
            : null;
      const r = body.userId && (await docData(db.doc(`responses/${body.userId}`)));
      if (!action || !r || String(r.managerEmail || "").toLowerCase() !== me)
        return reply(404, { message: "This request isn't in your team." });
      let next;
      try {
        next = M.transition(r, action, me, body.comment);
      } catch (e) {
        return stepFail(e);
      }
      await db.doc(`responses/${body.userId}`).set(next);
      const u = await findUser(db, body.userId);
      await send(
        db,
        action === "manager_approve"
          ? T.directorReview(db, u, r.rec)
          : T.returned(db, body.userId, u, next.history[next.history.length - 1].comment)
      );
      return reply(200, { ok: true, status: next.status });
    }
    // ---------- IT dashboard (Entra ID sign-in; route also locked in staticwebapp.config.json) ----------
    if (path.startsWith("/api/admin/")) {
      const roles = (principal && principal.roles) || [];
      const viewer = roles.includes("itdirector")
        ? "itdirector"
        : roles.includes("itadmin")
          ? "itadmin"
          : roles.includes("leadership")
            ? "leadership"
            : null;
      if (!viewer)
        return reply(403, {
          message: "You don't have access to the licence dashboard. Ask the IT Director."
        });
      const actor = principal.name || principal.email || "IT";
      if (path === "/api/admin/data") {
        const [ro, re, de, ob] = await Promise.all(
          ["roster", "responses", "decisions", "outbox"].map(c => db.collection(c).get())
        );
        return reply(200, {
          viewer: { name: actor, roles: [viewer] },
          roster: ro.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.order || 999) - (b.order || 999)),
          responses: Object.fromEntries(
            re.docs.map(d => [d.id, publicRequest(d.data())]).filter(([, v]) => v)
          ),
          decisions: Object.fromEntries(de.docs.map(d => [d.id, d.data()])),
          outbox:
            viewer === "leadership"
              ? []
              : ob.docs
                  .map(d => ({ id: d.id, ...d.data() }))
                  .filter(o => o.status === "pending")
                  .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
          prices: await prices(db),
          mailMode: mail.mode()
        });
      }
      if (viewer === "leadership")
        return reply(403, { message: "Leadership has a read-only view." });
      if (method !== "POST") return reply(405, { message: "Use POST." });
      if (path === "/api/admin/approval") {
        if (viewer !== "itdirector")
          return reply(403, { message: "Only the IT Director can approve and set up licences." });
        const map = {
          approve: "director_approve",
          reject: "director_reject",
          provision: "director_provision"
        };
        const r = body.userId && (await docData(db.doc(`responses/${body.userId}`)));
        if (!r || !map[body.action])
          return reply(404, { message: "This person hasn't sent answers yet." });
        const extra =
          body.action === "provision"
            ? {
                provisionedLicence: String(body.licence || (r.rec && r.rec.label) || "").slice(
                  0,
                  200
                ),
                provisionedAt: new Date().toISOString()
              }
            : {};
        let next;
        try {
          next = M.transition(r, map[body.action], `${actor} (IT Director)`, body.comment, extra);
        } catch (e) {
          return stepFail(e);
        }
        await db.doc(`responses/${body.userId}`).set(next);
        const u = await findUser(db, body.userId);
        if (body.action === "approve") await send(db, T.approved(db, u, r.rec));
        if (body.action === "provision")
          await send(db, T.provisioned(db, u, next.provisionedLicence));
        if (body.action === "reject")
          await send(db, T.rejected(db, u, r.managerEmail, body.comment));
        return reply(200, { ok: true, request: publicRequest(next) });
      }
      if (path === "/api/admin/manager") {
        const email = String(body.managerEmail || "").trim();
        if (!EMAIL.test(email)) return reply(400, { message: "Enter a valid email address." });
        const u = await findUser(db, body.userId);
        if (!u) return reply(404, { message: "No such person." });
        if (email.toLowerCase() === String(u.email).toLowerCase())
          return reply(400, { message: "The approver has to be someone other than the person." });
        const name = email
          .split("@")[0]
          .split(/[._]/)
          .map(p => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""))
          .join(" ");
        await db.doc(`roster/${body.userId}`).set({
          ...u,
          managerEmail: email,
          supervisorName: name,
          managerEmailStatus: "changed",
          approvalNote: `Approver changed from ${u.supervisorName || "none"} by ${actor}.`
        });
        const r = await docData(db.doc(`responses/${body.userId}`));
        let resent = false;
        if (r) {
          await db.doc(`responses/${body.userId}`).set({ ...r, managerEmail: email });
          if (
            r.status === "submitted" &&
            String(r.managerEmail).toLowerCase() !== email.toLowerCase()
          ) {
            await send(db, T.managerReview(db, email, u, r.rec));
            resent = true;
          }
        }
        return reply(200, { ok: true, resent });
      }
      if (path === "/api/admin/reissue") {
        const u = await findUser(db, body.id);
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
        const ids = Array.isArray(body.ids) ? body.ids.map(String) : null;
        const remind = body.scope === "remind";
        const people = ro.docs
          .map(d => ({ id: d.id, u: d.data() }))
          .filter(p => p.u && p.u.email && !answered.has(p.id))
          .filter(p => (ids ? ids.includes(p.id) : remind || !p.u.invitedAt));
        let sent = 0;
        const failed = [];
        for (const p of people) {
          try {
            const outboxId = await invite(db, p.id, p.u);
            const o = await docData(db.doc(`outbox/${outboxId}`));
            if (o && o.error) failed.push(p.u.email);
            else sent++;
          } catch (e) {
            failed.push(p.u.email);
          }
        }
        return reply(200, {
          ok: true,
          sent,
          failed,
          mailMode: mail.mode()
        });
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
      if (path === "/api/admin/decision") {
        const d = {
          decision: body.decision || "",
          status: body.status || "Open",
          note: String(body.note || "").slice(0, 2000),
          updatedBy: actor,
          updatedAt: new Date().toISOString()
        };
        await db.doc(`decisions/${body.id}`).set(d);
        return reply(200, { ok: true, decision: d });
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
    return reply(500, {
      message: "Something went wrong on our side. Please try again in a minute.",
      detail: process.env.DEBUG ? String(e.stack || e) : undefined
    });
  }
}
module.exports = { handle, T, send, invite };
