/*
 * Picks where data is kept.
 *   STORE=file       .local-data/db.json (default on your PC)
 *   STORE=firestore  Google Cloud Firestore (default on Firebase App Hosting / Cloud Run)
 *
 * Firestore's own doc(path).get()/set()/delete() and collection(name).get() already match the shape
 * the request handler uses, so the Firestore client is used as it is.
 */
const { fileStore } = require("./file-store");

function openStore() {
  if (process.env.STORE === "firestore") {
    const { Firestore } = require("@google-cloud/firestore");
    const options = { ignoreUndefinedProperties: true };
    if (process.env.FIRESTORE_DATABASE) options.databaseId = process.env.FIRESTORE_DATABASE;
    const db = new Firestore(options);
    return { db, label: `Firestore (${process.env.FIRESTORE_DATABASE || "(default)"} database)` };
  }
  return { db: fileStore(process.env.DATA_FILE), label: process.env.DATA_FILE };
}

module.exports = { openStore };
