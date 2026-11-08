/*
 * Personal links. Only a SHA-256 hash of each token is stored, so the store never holds a usable link.
 * Personal links (#t=…) open that person's form.
 */
const crypto = require("crypto");
const hash = t => crypto.createHash("sha256").update(String(t)).digest("hex");
const days = () => Number(process.env.LINK_DAYS || 30);
async function issue(db, kind, subject) {
  const token = crypto.randomBytes(32).toString("base64url"); // 43 characters
  const now = Date.now();
  await db
    .doc(`tokens/${hash(token)}`)
    .set({
      kind,
      subject: String(subject).toLowerCase(),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + days() * 864e5).toISOString(),
      revoked: false
    });
  return token;
}
async function resolve(db, kind, token) {
  if (!token || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const s = await db.doc(`tokens/${hash(token)}`).get();
  const t = s.exists ? s.data() : null;
  if (!t || t.kind !== kind || t.revoked || Date.parse(t.expiresAt) < Date.now()) return null;
  return t.subject;
}
async function revokeAll(db, kind, subject) {
  const all = await db.collection("tokens").get();
  for (const d of all.docs) {
    const t = d.data();
    if (t.kind === kind && t.subject === String(subject).toLowerCase() && !t.revoked)
      await db.doc(`tokens/${d.id}`).set({ ...t, revoked: true });
  }
}
const link = (kind, token) =>
  `${(process.env.APP_URL || "").replace(/\/+$/, "")}/#${kind === "user" ? "t" : "m"}=${token}`;
module.exports = { issue, resolve, revokeAll, link };
