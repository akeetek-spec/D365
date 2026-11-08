/*
 * Email. Every message is written to the outbox collection first, so IT can see what went out.
 *   MAIL_MODE=outbox  only queues; IT sends from the dashboard's "Emails waiting to send" list.
 *   MAIL_MODE=gmail   also sends through Gmail from MAIL_SENDER, signing in with a Google App Password
 *                     (secret GMAIL_APP_PASSWORD), never the account's normal password.
 * If sending fails, the email stays in "Emails waiting to send" with the reason, so nothing is lost.
 */
const mode = () => (process.env.MAIL_MODE === "gmail" ? "gmail" : "outbox");

let transport = null;
async function gmailSend(to, subject, body) {
  const nodemailer = require("nodemailer");
  transport =
    transport ||
    nodemailer.createTransport({
      // smtp.gmail.com unless SMTP_HOST is set (another provider, or a test server)
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true,
      pool: true, // one connection reused for a batch of invites
      maxConnections: 1,
      auth: {
        user: process.env.MAIL_SENDER,
        // a Google App Password is shown with spaces between groups: keep only its 16 letters.
        // Any other password (digits or symbols) is used exactly as given.
        pass: /^[A-Za-z\s]*$/.test(process.env.GMAIL_APP_PASSWORD || "")
          ? String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "")
          : process.env.GMAIL_APP_PASSWORD
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
  if (mode() === "gmail") {
    try {
      await gmailSend([].concat(to), subject, body);
      Object.assign(rec, {
        status: "sent",
        sentAt: new Date().toISOString(),
        body: "(sent by Gmail)"
      });
    } catch (e) {
      rec.error = e.message;
    }
  }
  await db.doc(`outbox/${id}`).set(rec);
  return id;
}
module.exports = { queue, mode };
