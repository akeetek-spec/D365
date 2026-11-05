/*
 * Small document store over Azure Table Storage: one table per collection, one row per document,
 * the document kept as JSON. Same doc(path).get()/set() and collection(name).get() shape the
 * prototype used, so the request handling logic ports over unchanged.
 */
const { TableClient } = require("@azure/data-tables");
const TABLES = {
  roster: "Roster",
  responses: "Responses",
  outbox: "Outbox",
  settings: "Settings",
  decisions: "Decisions",
  tokens: "Tokens"
};
const PK = "doc";
const clients = {};
function table(collection) {
  const name = TABLES[collection];
  if (!name) throw new Error("Unknown collection " + collection);
  if (!clients[name])
    clients[name] = TableClient.fromConnectionString(process.env.STORAGE_CONNECTION, name, {
      allowInsecureConnection: /UseDevelopmentStorage|127\.0\.0\.1|localhost/.test(
        process.env.STORAGE_CONNECTION || ""
      )
    });
  return clients[name];
}
const created = new Set();
async function ensure(collection) {
  if (created.has(collection)) return;
  try {
    await table(collection).createTable();
  } catch (e) {
    if (e.statusCode !== 409) throw e;
  }
  created.add(collection);
}
const unpack = e => JSON.parse(e.json || "{}");
function tableStore() {
  return {
    doc(path) {
      const [collection, id] = path.split("/");
      return {
        async get() {
          await ensure(collection);
          try {
            const e = await table(collection).getEntity(PK, id);
            return { exists: true, data: () => unpack(e) };
          } catch (err) {
            if (err.statusCode === 404) return { exists: false, data: () => undefined };
            throw err;
          }
        },
        async set(value) {
          await ensure(collection);
          await table(collection).upsertEntity(
            { partitionKey: PK, rowKey: id, json: JSON.stringify(value) },
            "Replace"
          );
        },
        async delete() {
          await ensure(collection);
          try {
            await table(collection).deleteEntity(PK, id);
          } catch (err) {
            if (err.statusCode !== 404) throw err;
          }
        }
      };
    },
    collection(collection) {
      return {
        async get() {
          await ensure(collection);
          const docs = [];
          for await (const e of table(collection).listEntities({
            queryOptions: { filter: `PartitionKey eq '${PK}'` }
          }))
            docs.push({ id: e.rowKey, data: () => unpack(e) });
          return { docs };
        }
      };
    }
  };
}
// In-memory store with the same shape, for tests and local trials without Azurite.
function memoryStore(seed = {}) {
  const data = JSON.parse(JSON.stringify(seed));
  const col = c => (data[c] = data[c] || {});
  return {
    data,
    doc(path) {
      const [c, id] = path.split("/");
      return {
        async get() {
          const v = col(c)[id];
          return { exists: v !== undefined, data: () => v && JSON.parse(JSON.stringify(v)) };
        },
        async set(v) {
          col(c)[id] = JSON.parse(JSON.stringify(v));
        },
        async delete() {
          delete col(c)[id];
        }
      };
    },
    collection(c) {
      return {
        async get() {
          return {
            docs: Object.entries(col(c)).map(([id, v]) => ({
              id,
              data: () => JSON.parse(JSON.stringify(v))
            }))
          };
        }
      };
    }
  };
}
module.exports = { tableStore, memoryStore };
