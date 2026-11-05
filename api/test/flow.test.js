// End-to-end check of the approval workflow against the in-memory store: npm test
process.env.APP_URL = "https://licences.example.com";
process.env.IT_DIRECTOR_EMAIL = "andres.santana@championchair.com";
process.env.MAIL_MODE = "outbox";
const assert = require("assert");
const { handle, T, send } = require("../src/lib/handler");
const { memoryStore } = require("../src/lib/store");
const roster = require("../../data/roster.json");
const db = memoryStore({ roster: Object.fromEntries(roster.map(({ id, ...d }) => [id, d])) });
const mails = () => Object.values(db.data.outbox || {});
const lastLink = (to, kind) => {
  const m = mails()
    .filter(o => o.to.toLowerCase().includes(to.toLowerCase()))
    .pop();
  const x = m.body.match(new RegExp(`#${kind}=([A-Za-z0-9_-]+)`));
  return x && x[1];
};
const call = (path, opts = {}) =>
  handle(
    {
      method: opts.body ? "POST" : "GET",
      path,
      headers: opts.headers || {},
      body: opts.body || {},
      principal: opts.principal || null
    },
    db
  );
const director = { name: "Andres Santana", roles: ["itdirector"] },
  itadmin = { name: "Jennifer Derby", roles: ["itadmin"] },
  lead = { name: "Paul", roles: ["leadership"] };
(async () => {
  const amy = roster.find(r => r.id === "amy-hart");
  await send(db, T.invite(db, "amy-hart", amy));
  const t = lastLink(amy.email, "t");
  assert(t, "invite link");
  let r = await call("/api/me", { headers: { "x-invite-token": t } });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.jobTitle, "Material Planning Manager");
  assert.equal(r.body.user.sharedAccount, false);
  assert.equal(
    (await call("/api/me", { headers: { "x-invite-token": "x".repeat(43) } })).status,
    401
  );
  const answers = {
    freq: "weekly",
    shared: "no",
    roles: ["keep-scm", "fin-accounts-payable-clerk"],
    duties: [],
    notes:
      "Access check: Finance: needed, every week. Tasks: Enter or match vendor invoices. Kept as is: Supply Chain Management."
  };
  r = await call("/api/respond", { headers: { "x-invite-token": t }, body: { answers } });
  assert.equal(r.status, 200);
  assert.equal(r.body.rec.label, "Supply Chain Management + Finance attach");
  assert.equal(r.body.managerEmail, "Omar.Nunez@ChampionChair.com");
  let m = lastLink("omar.nunez", "m");
  assert(m, "supervisor link");
  r = await call("/api/manager", { headers: { "x-manager-token": m } });
  assert.equal(r.body.team.length, 1);
  r = await call("/api/manager/decision", {
    headers: { "x-manager-token": m },
    body: { userId: "amy-hart", action: "return", comment: "Add journals too." }
  });
  assert.equal(r.body.status, "returned");
  const t2 = lastLink(amy.email, "t");
  assert(t2 && t2 !== t, "returned email carries a fresh link");
  r = await call("/api/me", { headers: { "x-invite-token": t2 } });
  assert.equal(r.body.request.status, "returned");
  assert.equal(r.body.request.history.pop().comment, "Add journals too.");
  r = await call("/api/respond", {
    headers: { "x-invite-token": t2 },
    body: { answers: { ...answers, roles: [...answers.roles, "fin-accountant"] } }
  });
  assert.equal(r.body.status, "submitted");
  m = lastLink("omar.nunez", "m");
  r = await call("/api/manager/decision", {
    headers: { "x-manager-token": m },
    body: { userId: "amy-hart", action: "approve" }
  });
  assert.equal(r.body.status, "manager_approved");
  assert(
    mails().some(o => o.kind === "director_review" && o.to === "andres.santana@championchair.com")
  );
  assert.equal((await call("/api/admin/data", { principal: null })).status, 403);
  r = await call("/api/admin/data", { principal: lead });
  assert.equal(r.status, 200);
  assert.equal(r.body.outbox.length, 0);
  assert.equal(
    (
      await call("/api/admin/approval", {
        principal: lead,
        body: { userId: "amy-hart", action: "approve" }
      })
    ).status,
    403
  );
  assert.equal(
    (
      await call("/api/admin/approval", {
        principal: itadmin,
        body: { userId: "amy-hart", action: "approve" }
      })
    ).status,
    403
  );
  r = await call("/api/admin/approval", {
    principal: director,
    body: { userId: "amy-hart", action: "approve" }
  });
  assert.equal(r.body.request.status, "approved");
  r = await call("/api/admin/approval", {
    principal: director,
    body: { userId: "amy-hart", action: "provision" }
  });
  assert.equal(r.body.request.status, "provisioned");
  // IT changes an approver; the change sticks on the roster.
  const bryce = roster.find(x => x.id === "bryce-kriner");
  await send(db, T.invite(db, "bryce-kriner", bryce));
  const tb = lastLink(bryce.email, "t");
  await call("/api/respond", {
    headers: { "x-invite-token": tb },
    body: { answers: { freq: "weekly", shared: "no", roles: ["keep-scm"], duties: [], notes: "" } }
  });
  r = await call("/api/admin/manager", {
    principal: itadmin,
    body: { userId: "bryce-kriner", managerEmail: "Omar.Nunez@ChampionChair.com" }
  });
  assert.equal(r.body.resent, true);
  assert.equal(db.data.roster["bryce-kriner"].managerEmail, "Omar.Nunez@ChampionChair.com");
  // Reissue revokes the old link.
  await call("/api/admin/reissue", { principal: itadmin, body: { id: "bryce-kriner" } });
  assert.equal((await call("/api/me", { headers: { "x-invite-token": tb } })).status, 401);
  assert.equal(
    (await call("/api/me", { headers: { "x-invite-token": lastLink(bryce.email, "t") } })).status,
    200
  );
  console.log(
    `All workflow checks passed. ${mails().length} emails queued: ${[...new Set(mails().map(o => o.kind))].join(", ")}.`
  );
})().catch(e => {
  console.error(e);
  process.exit(1);
});
