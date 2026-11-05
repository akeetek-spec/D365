// Checks for sending invites from the dashboard (/api/admin/invite, /api/admin/reissue): npm test
process.env.APP_URL = "https://licences.example.com";
process.env.IT_DIRECTOR_EMAIL = "andres.santana@championchair.com";
process.env.MAIL_MODE = "outbox";
const assert = require("assert");
const { handle } = require("../src/lib/handler");
const { memoryStore } = require("../src/lib/store");
const roster = require("../../data/roster.json");

const db = memoryStore({ roster: Object.fromEntries(roster.map(({ id, ...d }) => [id, d])) });
const director = { name: "andres.santana@championchair.com", roles: ["itdirector"] };
const itadmin = { name: "jennifer.derby@championchair.com", roles: ["itadmin"] };
const lead = { name: "paul", roles: ["leadership"] };
const call = (path, body, principal) =>
  handle({ method: body ? "POST" : "GET", path, headers: {}, body: body || {}, principal }, db);
const outbox = () => Object.values(db.data.outbox || {});
const linkFor = email => {
  const m = outbox()
    .filter(o => o.to.toLowerCase() === email.toLowerCase())
    .pop();
  return m && (m.body.match(/#t=([A-Za-z0-9_-]+)/) || [])[1];
};

(async () => {
  // Only the IT Director can send invites.
  assert.equal((await call("/api/admin/invite", { scope: "new" }, itadmin)).status, 403);
  assert.equal((await call("/api/admin/invite", { scope: "new" }, lead)).status, 403);
  assert.equal((await call("/api/admin/invite", { scope: "new" }, null)).status, 403);

  // Invite two people first.
  let r = await call("/api/admin/invite", { ids: ["amy-hart", "bryce-kriner"] }, director);
  assert.equal(r.status, 200);
  assert.equal(r.body.sent, 2);
  assert.equal(outbox().length, 2);
  let data = (await call("/api/admin/data", null, director)).body;
  const amy = data.roster.find(p => p.id === "amy-hart");
  assert(amy.invitedAt, "invitedAt recorded");
  assert.equal(amy.inviteCount, 1);
  assert.equal(data.mailMode, "outbox");

  // "Everyone not invited yet" skips the two already invited.
  r = await call("/api/admin/invite", { scope: "new" }, director);
  assert.equal(r.body.sent, roster.length - 2);
  r = await call("/api/admin/invite", { scope: "new" }, director);
  assert.equal(r.body.sent, 0, "nobody left to invite");

  // Amy answers; a reminder goes to everyone else, not to her.
  const t = linkFor(amy.email);
  r = await handle(
    {
      method: "POST",
      path: "/api/respond",
      headers: { "x-invite-token": t },
      body: {
        answers: { freq: "weekly", shared: "no", roles: ["keep-scm"], duties: [], notes: "" }
      },
      principal: null
    },
    db
  );
  assert.equal(r.status, 200);
  const before = outbox().filter(o => o.kind === "invite").length;
  r = await call("/api/admin/invite", { scope: "remind" }, director);
  assert.equal(r.body.sent, roster.length - 1);
  assert.equal(outbox().filter(o => o.kind === "invite").length, before + roster.length - 1);
  data = (await call("/api/admin/data", null, director)).body;
  assert.equal(data.roster.find(p => p.id === "bryce-kriner").inviteCount, 2);

  // Both reminder links work for Bryce; a new link from "Send a new link" stops the old ones.
  const bryce = data.roster.find(p => p.id === "bryce-kriner");
  const oldLink = linkFor(bryce.email);
  const me = tok =>
    handle({ method: "GET", path: "/api/me", headers: { "x-invite-token": tok }, body: {} }, db);
  assert.equal((await me(oldLink)).status, 200);
  assert.equal((await call("/api/admin/reissue", { id: "bryce-kriner" }, itadmin)).status, 200);
  assert.equal((await me(oldLink)).status, 401, "old link revoked");
  assert.equal((await me(linkFor(bryce.email))).status, 200, "new link works");

  console.log(`Invite checks passed. ${outbox().length} emails queued.`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
