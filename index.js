/*
 * Cloud Function "app": everything under /api/* and /.auth/* (Firebase Hosting sends those here, see
 * firebase.json). The pages themselves (frontend/) are served by Firebase Hosting.
 *
 * Settings: .env (shared) and .env.<alias> (prod or test).
 *
 * Secret GMAIL_APP_PASSWORD (Cloud Secret Manager): the Google App Password, used when MAIL_MODE=gmail.
 * The first deploy asks for its value and creates it. While email isn't sent automatically
 * (MAIL_MODE=outbox) any value will do, for example "none". Change it later with
 * "firebase functions:secrets:set GMAIL_APP_PASSWORD" and deploy again.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

exports.app = onRequest(
  {
    region: "us-central1", // must match "region" in firebase.json
    memory: "512MiB",
    timeoutSeconds: 300, // sending invites to everyone can take a minute
    maxInstances: 5,
    secrets: [gmailAppPassword]
  },
  (req, res) => require("./src/app").app(req, res)
);
