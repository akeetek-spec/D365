/*
 * Local document store: same doc(path).get()/set()/delete() and collection(name).get() shape as
 * api/src/lib/store.js, kept in one JSON file. The file is read on every call and written right
 * away, so the server and the roster script can both use it.
 */
const fs = require("fs");
const path = require("path");

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
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
    fs.renameSync(tmp, file);
  };
  const copy = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  return {
    file,
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
          if (d[c]) {
            delete d[c][id];
            save(d);
          }
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
module.exports = { fileStore };
