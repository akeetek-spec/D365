// End-to-end check of the workflow against in-memory storage: npm test
process.env.APP_URL = "https://licences.example.com";
process.env.IT_DIRECTOR_EMAIL = "andres.santana@championchair.com";
process.env.IT_DIRECTOR_NAME = "Andres Santana";
process.env.MAIL_MODE = "outbox";
const assert = require("assert");
const { handle, T, send } = require("../src/handler");
const { memoryStore } = require("../src/store");
const { memoryBlobs } = require("../src/blobs");
const roster = require("../data/roster.json");
const db = memoryStore({ roster: Object.fromEntries(roster.map(({ id, ...d }) => [id, d])) }),
  blobs = memoryBlobs(),
  ctx = { db, blobs };
const mails = () => Object.values(db.data.outbox || {});
const lastLink = (to, kind) => {
  const m = mails()
    .filter(o => o.to.toLowerCase().includes(to.toLowerCase()))
    .pop();
  const x = m && m.body.match(new RegExp(`#${kind}=([A-Za-z0-9_-]+)`));
  return x && x[1];
};
const call = (path, o = {}) =>
  handle(
    {
      method: o.method || (o.body || o.raw ? "POST" : "GET"),
      path,
      query: o.query || {},
      headers: o.headers || {},
      body: o.body || {},
      raw: o.raw || null,
      principal: o.principal || null
    },
    ctx
  );
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32)
]);
const director = { name: "Andres Santana", roles: ["itdirector"] },
  itadmin = { name: "Jennifer Derby", roles: ["itadmin"] },
  lead = { name: "Paul", roles: ["leadership"] };
const invite = async id => {
  const u = roster.find(r => r.id === id);
  await send(db, T.invite(db, id, u));
  return lastLink(u.email, "t");
};
(async () => {
  // Rivelyn: has SCM, missing Commerce and Finance. Finance as Full user, Commerce not needed.
  const t = await invite("rivelyn-yip"),
    H = { "x-invite-token": t };
  let r = await call("/api/me", { headers: H });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.jobTitle, "Production Planner");
  assert.equal(r.body.request, null);
  assert.deepEqual(
    r.body.user.gapRoles.COM,
    ["Inventory Manager"],
    "the person sees the role causing each missing licence"
  );
  assert.equal(
    (await call("/api/me", { headers: { "x-invite-token": "x".repeat(43) } })).status,
    401
  );
  assert.equal(
    (await call("/api/upload", { headers: H, raw: Buffer.from("not an image") })).status,
    400
  );
  const up = await call("/api/upload", { headers: H, raw: PNG });
  assert.equal(up.status, 200);
  const shot = up.body.id;
  r = await call("/api/respond", {
    headers: H,
    body: { answers: { apps: { FIN: { level: "full", mods: ["AP"] } }, noExtra: false } }
  });
  assert.equal(r.status, 400, "unanswered tabs are refused");
  assert.match(r.body.message, /Commerce/);
  const answers = {
    apps: {
      COM: { level: "none" },
      FIN: {
        level: "full",
        mods: ["AP", "PROD"],
        tasks: ["all-viewer", "fin-accounts-payable-clerk"],
        other: "Vendor queries"
      }
    },
    extraNames: "Engineering change management",
    extraShots: [{ id: shot, name: "ecm.png" }],
    note: "Cover for AP"
  };
  r = await call("/api/respond", { headers: H, body: { answers } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const saved = db.data.responses["rivelyn-yip"];
  assert.equal(saved.rec.label, "Supply Chain Management + Finance attach");
  assert.equal(saved.rec.cost, 240);
  assert.deepEqual(saved.extra.apps.FIN.mods, ["AP"], "areas from other licences are dropped");
  assert(
    mails().some(o => o.kind === "director_review" && o.to === "andres.santana@championchair.com")
  );
  // Screenshot access: owner and IT only.
  assert.equal((await call(`/api/file/${shot}`, { headers: H })).status, 200);
  assert.equal((await call(`/api/file/${shot}`)).status, 404);
  const t2 = await invite("gbehensky");
  assert.equal(
    (await call(`/api/file/${shot}`, { headers: { "x-invite-token": t2 } })).status,
    404
  );
  assert.equal((await call(`/api/file/${shot}`, { principal: lead })).status, 200);
  // Someone else's screenshot can't be attached.
  r = await call("/api/respond", {
    headers: { "x-invite-token": t2 },
    body: {
      answers: {
        apps: { FIN: { level: "tm", mods: ["AR"] } },
        extraShots: [{ id: shot, name: "x" }]
      }
    }
  });
  assert.equal(r.status, 400);
  // gbehensky: has SCM, missing Finance, Team Member → no licence to buy, a role change.
  r = await call("/api/respond", {
    headers: { "x-invite-token": t2 },
    body: { answers: { apps: { FIN: { level: "tm", mods: ["AR"] } }, noExtra: true } }
  });
  assert.equal(r.status, 200);
  assert.equal(db.data.responses.gbehensky.rec.cost, 210);
  // Dashboard access by role.
  assert.equal((await call("/api/admin/data")).status, 403);
  r = await call("/api/admin/data", { principal: lead });
  assert.equal(r.status, 200);
  assert.equal(r.body.outbox.length, 0);
  r = await call("/api/admin/data", { principal: director });
  assert.equal(Object.keys(r.body.responses).length, 2);
  const { M, L } = require("../src/model");
  const g = r.body.roster.find(x => x.id === "gbehensky"),
    ga = L.analyse(g, r.body.responses.gbehensky, r.body.prices);
  assert.equal(
    ga.roleActions[0],
    "Replace Accounts payable centralized payments clerk (needs Finance) with a Team Member-level role"
  );
  assert.equal(ga.plan.delta, 0, "Team Member for a missing licence costs nothing extra");
  assert.equal(
    (
      await call("/api/admin/approval", {
        principal: itadmin,
        body: { userId: "rivelyn-yip", action: "approve" }
      })
    ).status,
    403
  );
  assert.equal(
    (
      await call("/api/admin/approval", {
        principal: lead,
        body: { userId: "rivelyn-yip", action: "approve" }
      })
    ).status,
    403
  );
  // Send back needs a comment; the person gets a fresh link and sees the comment.
  assert.equal(
    (
      await call("/api/admin/approval", {
        principal: director,
        body: { userId: "rivelyn-yip", action: "return" }
      })
    ).status,
    400
  );
  r = await call("/api/admin/approval", {
    principal: director,
    body: { userId: "rivelyn-yip", action: "return", comment: "Is Team Member enough for Finance?" }
  });
  assert.equal(r.body.request.status, "returned");
  const t3 = lastLink("Rivelyn.Yip", "t");
  assert(t3 && t3 !== t);
  r = await call("/api/me", { headers: { "x-invite-token": t3 } });
  assert.equal(r.body.request.status, "returned");
  assert.equal(r.body.request.history.pop().comment, "Is Team Member enough for Finance?");
  r = await call("/api/respond", {
    headers: { "x-invite-token": t3 },
    body: {
      answers: { ...answers, apps: { COM: { level: "none" }, FIN: { level: "tm", mods: ["AP"] } } }
    }
  });
  assert.equal(r.body.request.status, "submitted");
  assert.equal(db.data.responses["rivelyn-yip"].rec.cost, 210);
  // Approve, then set up.
  r = await call("/api/admin/approval", {
    principal: director,
    body: { userId: "rivelyn-yip", action: "approve" }
  });
  assert.equal(r.body.request.status, "approved");
  r = await call("/api/admin/approval", {
    principal: director,
    body: { userId: "rivelyn-yip", action: "provision" }
  });
  assert.equal(r.body.request.status, "provisioned");
  // IT-only evidence.
  r = await call("/api/admin/evidence", {
    principal: itadmin,
    body: { userId: "amy-hart", pages: "Master planning › Workspaces › Master planning" }
  });
  assert.equal(r.status, 200);
  r = await call("/api/admin/upload", {
    principal: itadmin,
    query: { userId: "amy-hart", name: "amy.png" },
    raw: PNG
  });
  assert.equal(r.body.evidence.shots.length, 1);
  const ev = r.body.evidence.shots[0].id;
  assert.equal(
    (await call(`/api/file/${ev}`, { headers: { "x-invite-token": await invite("amy-hart") } }))
      .status,
    404,
    "people can't see IT evidence"
  );
  assert.equal(
    (
      await call("/api/admin/evidence", {
        principal: lead,
        body: { userId: "amy-hart", pages: "x" }
      })
    ).status,
    403
  );
  // Reissue revokes the old link.
  await call("/api/admin/reissue", { principal: itadmin, body: { id: "gbehensky" } });
  assert.equal((await call("/api/me", { headers: { "x-invite-token": t2 } })).status, 401);
  console.log(
    `All workflow checks passed. ${mails().length} emails queued: ${[...new Set(mails().map(o => o.kind))].join(", ")}.`
  );
})().catch(e => {
  console.error(e);
  process.exit(1);
});
