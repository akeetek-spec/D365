// Sending invites from the dashboard (/api/admin/invite, /api/admin/reissue): npm test
process.env.APP_URL = "https://licences.example.com";
process.env.IT_DIRECTOR_EMAIL = "andres.santana@championchair.com";
process.env.MAIL_MODE = "outbox";
const assert = require("assert");
const { handle } = require("../src/handler");
const { memoryStore } = require("../src/store");
const { memoryBlobs } = require("../src/blobs");
const roster = require("../data/roster.json");

const db = memoryStore({ roster: Object.fromEntries(roster.map(({ id, ...d }) => [id, d])) });
const ctx = { db, blobs: memoryBlobs() };
const director = { name: "andres.santana@championchair.com", roles: ["itdirector"] };
const itadmin = { name: "jennifer.derby@championchair.com", roles: ["itadmin"] };
const lead = { name: "paul", roles: ["leadership"] };
const call = (path, body, principal, headers = {}) =>
  handle(
    {
      method: body ? "POST" : "GET",
      path,
      query: {},
      headers,
      body: body || {},
      raw: null,
      principal
    },
    ctx
  );
const outbox = () => Object.values(db.data.outbox || {});
const linkFor = email => {
  const m = outbox()
    .filter(o => o.to.toLowerCase() === email.toLowerCase())
    .pop();
  return m && (m.body.match(/#t=([A-Za-z0-9_-]+)/) || [])[1];
};
(async () => {
  for (const who of [itadmin, lead, null])
    assert.equal(
      (await call("/api/admin/invite", { scope: "new" }, who)).status,
      403,
      "only the IT Director"
    );

  let r = await call("/api/admin/invite", { ids: ["amy-hart", "bryce-kriner"] }, director);
  assert.equal(r.status, 200);
  assert.equal(r.body.sent, 2);
  let data = (await call("/api/admin/data", null, director)).body;
  const amy = data.roster.find(p => p.id === "amy-hart");
  assert(amy.invitedAt && amy.inviteCount === 1, "invite recorded");
  assert.equal(data.mailMode, "outbox");

  r = await call("/api/admin/invite", { scope: "new" }, director);
  assert.equal(r.body.sent, roster.length - 2, "the rest, not the two already invited");
  assert.equal((await call("/api/admin/invite", { scope: "new" }, director)).body.sent, 0);

  // Amy has answered: reminders go to everyone else.
  db.data.responses = { "amy-hart": { answers: {}, status: "submitted" } };
  r = await call("/api/admin/invite", { scope: "remind" }, director);
  assert.equal(r.body.sent, roster.length - 1);
  data = (await call("/api/admin/data", null, director)).body;
  assert.equal(data.roster.find(p => p.id === "bryce-kriner").inviteCount, 2);

  // The invite link works; "Send a new link" stops the old ones.
  const bryce = data.roster.find(p => p.id === "bryce-kriner");
  const old = linkFor(bryce.email);
  const me = t => call("/api/me", null, null, { "x-invite-token": t });
  assert.equal((await me(old)).status, 200);
  assert.equal((await call("/api/admin/reissue", { id: "bryce-kriner" }, itadmin)).status, 200);
  assert.equal((await me(old)).status, 401, "old link revoked");
  assert.equal((await me(linkFor(bryce.email))).status, 200, "new link works");
  console.log(`Invite checks passed. ${outbox().length} emails queued.`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
