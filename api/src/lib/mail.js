/*
 * Email. Every message is written to the Outbox table first, so IT can see what went out.
 *   MAIL_MODE=outbox  only queues; IT sends from the dashboard's "Emails waiting to send" list.
 *   MAIL_MODE=graph   also sends through Microsoft Graph from MAIL_SENDER (application permission
 *                     Mail.Send, restricted to that mailbox with an application access policy).
 *   MAIL_MODE=gmail   also sends through Gmail from MAIL_SENDER, signing in with a Google App Password
 *                     (GMAIL_APP_PASSWORD), never the account's normal password.
 *   MAIL_MODE=smtp    also sends through any SMTP server (default Microsoft 365, smtp.office365.com:587)
 *                     from MAIL_SENDER, signing in with SMTP_PASSWORD exactly as given.
 * If sending fails, the email stays in "Emails waiting to send" with the error, so nothing is lost.
 */
const mode = () =>
  ["graph", "gmail", "smtp"].includes(process.env.MAIL_MODE) ? process.env.MAIL_MODE : "outbox";

let cred = null;
async function graphSend(to, subject, body) {
  const { ClientSecretCredential } = require("@azure/identity");
  cred =
    cred ||
    new ClientSecretCredential(
      process.env.GRAPH_TENANT_ID,
      process.env.GRAPH_CLIENT_ID,
      process.env.GRAPH_CLIENT_SECRET
    );
  const { token } = await cred.getToken("https://graph.microsoft.com/.default");
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(process.env.MAIL_SENDER)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "Text", content: body },
          toRecipients: []
            .concat(to)
            .filter(Boolean)
            .map(a => ({ emailAddress: { address: a } }))
        },
        saveToSentItems: true
      })
    }
  );
  if (!res.ok) throw new Error(`Graph sendMail ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
let transport = null;
async function gmailSend(to, subject, body) {
  const nodemailer = require("nodemailer");
  const smtp = mode() === "smtp";
  transport =
    transport ||
    nodemailer.createTransport({
      // gmail: smtp.gmail.com:465. smtp: Microsoft 365 on 587 (STARTTLS). SMTP_HOST/PORT/SECURE override.
      host: process.env.SMTP_HOST || (smtp ? "smtp.office365.com" : "smtp.gmail.com"),
      port: Number(process.env.SMTP_PORT || (smtp ? 587 : 465)),
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : !smtp,
      pool: true, // one connection reused for a batch of invites
      maxConnections: 1,
      auth: {
        user: process.env.MAIL_SENDER,
        // gmail: keep only the 16 letters (Google shows the code with spaces between groups)
        pass: smtp
          ? String(process.env.SMTP_PASSWORD || "").trim() // a secret saved with a trailing newline still works
          : String(process.env.GMAIL_APP_PASSWORD || "").replace(/[^A-Za-z]/g, "")
      }
    });
  await transport.sendMail({
    from: {
      name: process.env.MAIL_FROM_NAME || "D365 Licence Check",
      address: process.env.MAIL_SENDER
    },
    to: [].concat(to).filter(Boolean),
    subject,
    text: body
  });
}
async function queue(db, to, subject, body, kind) {
  const id =
    new Date().toISOString().replace(/[-:.TZ]/g, "") + "-" + Math.random().toString(36).slice(2, 7);
  const rec = {
    to: [].concat(to).filter(Boolean).join("; "),
    subject,
    body,
    kind,
    status: "pending",
    createdAt: new Date().toISOString(),
    error: ""
  };
  if (mode() !== "outbox") {
    try {
      if (mode() === "graph") await graphSend([].concat(to), subject, body);
      else await gmailSend([].concat(to), subject, body);
      Object.assign(rec, {
        status: "sent",
        sentAt: new Date().toISOString(),
        body: `(sent by ${{ graph: "Microsoft 365", smtp: "SMTP" }[mode()] || "Gmail"})`
      });
    } catch (e) {
      rec.error = e.message;
    }
  }
  await db.doc(`outbox/${id}`).set(rec);
  return id;
}
module.exports = { queue, mode };
