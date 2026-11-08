// The Firebase Admin app, created once. On Firebase it picks up the project and storage bucket by
// itself; elsewhere set GOOGLE_CLOUD_PROJECT (and STORAGE_BUCKET for screenshots).
let instance = null;
function app() {
  if (instance) return instance;
  const { initializeApp, getApps } = require("firebase-admin/app");
  instance =
    getApps()[0] ||
    initializeApp(process.env.STORAGE_BUCKET ? { storageBucket: process.env.STORAGE_BUCKET } : {});
  return instance;
}
module.exports = { app };
