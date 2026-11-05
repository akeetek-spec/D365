// One HTTP function serves every /api/* path; handler.js does the routing.
const { app } = require("@azure/functions");
const { handle } = require("../lib/handler");
const { tableStore } = require("../lib/store");
const db = tableStore();

// Static Web Apps calls /api/get-roles after Entra ID sign-in to assign dashboard roles (rolesSource).
// Roles come from app settings: comma-separated email lists.
function rolesFor(userDetails) {
  const email = String(userDetails || "").toLowerCase();
  const list = k =>
    String(process.env[k] || "")
      .toLowerCase()
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  return [
    ["ROLE_ITDIRECTOR", "itdirector"],
    ["ROLE_ITADMIN", "itadmin"],
    ["ROLE_LEADERSHIP", "leadership"]
  ]
    .filter(([k]) => list(k).includes(email))
    .map(([, r]) => r);
}

// Static Web Apps passes the signed-in user (dashboard only) in this header.
function principalFrom(request) {
  const raw = request.headers.get("x-ms-client-principal");
  if (!raw) return null;
  try {
    const p = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    return { name: p.userDetails, email: p.userDetails, roles: p.userRoles || [] };
  } catch (e) {
    return null;
  }
}

app.http("api", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "{*path}",
  handler: async (request, context) => {
    const path = "/api/" + (request.params.path || "");
    if (path === "/api/get-roles") {
      let u = {};
      try {
        u = await request.json();
      } catch (e) {}
      return { jsonBody: { roles: rolesFor(u.userDetails) } };
    }
    let body = {};
    if (request.method === "POST") {
      try {
        body = await request.json();
      } catch (e) {
        body = {};
      }
    }
    const headers = Object.fromEntries(request.headers.entries());
    const out = await handle(
      { method: request.method, path, headers, body, principal: principalFrom(request) },
      db
    );
    if (out.status >= 500) context.error(out.body);
    return { status: out.status, jsonBody: out.body, headers: { "Cache-Control": "no-store" } };
  }
});
