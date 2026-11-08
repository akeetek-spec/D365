/*
 * Where data is kept. All three have the same small shape the request handler uses:
 *   db.doc("collection/id").get() / .set(value) / .delete()     db.collection(name).get()
 *
 *   firestoreStore  Cloud Firestore through the Firebase Admin SDK (on Firebase, and the emulator)
 *   fileStore       one JSON file on your PC (.local-data/db.json), for the local server
 *   memoryStore     in memory, for tests
 *
 * Firestore's own doc()/collection() API already has this shape, so it is used as it is.
 * Collections: roster, responses, evidence, outbox, tokens, settings.
 */
require("./config"); // sets defaults such as STORE and DATA_DIR
const fs = require("fs");
const path = require("path");

let firestore = null;
function firestoreStore() {
  if (firestore) return firestore;
  const { getFirestore } = require("firebase-admin/firestore");
  const app = require("./firebase").app();
  firestore = process.env.FIRESTORE_DATABASE
    ? getFirestore(app, process.env.FIRESTORE_DATABASE)
    : getFirestore(app);
  firestore.settings({ ignoreUndefinedProperties: true });
  return firestore;
}

function fileStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const load = () => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      return {};
    }
  };
  const save = data => {
    fs.writeFileSync(file + ".tmp", JSON.stringify(data, null, 1));
    fs.renameSync(file + ".tmp", file);
  };
  const copy = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  return {
    doc(p) {
      const [c, id] = p.split("/");
      return {
        async get() {
          const v = (load()[c] || {})[id];
          return { exists: v !== undefined, data: () => copy(v) };
        },
        async set(v) {
          const d = load();
          (d[c] = d[c] || {})[id] = copy(v);
          save(d);
        },
        async delete() {
          const d = load();
          if (d[c]) delete d[c][id];
          save(d);
        }
      };
    },
    collection(c) {
      return {
        async get() {
          return {
            docs: Object.entries(load()[c] || {}).map(([id, v]) => ({ id, data: () => copy(v) }))
          };
        }
      };
    }
  };
}

function memoryStore(seed = {}) {
  const data = JSON.parse(JSON.stringify(seed));
  const col = c => (data[c] = data[c] || {});
  const copy = v => v && JSON.parse(JSON.stringify(v));
  return {
    data,
    doc(p) {
      const [c, id] = p.split("/");
      return {
        async get() {
          const v = col(c)[id];
          return { exists: v !== undefined, data: () => copy(v) };
        },
        async set(v) {
          col(c)[id] = copy(v);
        },
        async delete() {
          delete col(c)[id];
        }
      };
    },
    collection(c) {
      return {
        async get() {
          return { docs: Object.entries(col(c)).map(([id, v]) => ({ id, data: () => copy(v) })) };
        }
      };
    }
  };
}

// The store chosen by STORE (firestore on Firebase, file on your PC).
function openStore() {
  if (process.env.STORE === "firestore")
    return {
      db: firestoreStore(),
      label: `Firestore (${process.env.FIRESTORE_DATABASE || "(default)"} database)`
    };
  const file = path.join(process.env.DATA_DIR, "db.json");
  return { db: fileStore(file), label: file };
}

module.exports = { openStore, firestoreStore, fileStore, memoryStore };
