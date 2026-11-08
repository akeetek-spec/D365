/*
 * Screenshot storage: Cloud Storage for Firebase, folder "screenshots/" (private; no public access).
 * Each file is stored under a random 32-character id, with who it belongs to kept as metadata,
 * and is only ever served through /api/file/<id> after an access check.
 */
const crypto = require("crypto");
const MAX = 10 * 1024 * 1024;
// Only real PNG, JPEG or WebP images, checked by their first bytes rather than the declared type.
function sniff(buf) {
  if (
    buf.length > 8 &&
    buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length > 12 &&
    buf.slice(0, 4).toString() === "RIFF" &&
    buf.slice(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  return null;
}
function check(buf) {
  if (!buf || !buf.length) return "The file is empty.";
  if (buf.length > MAX) return "Use an image under 10 MB.";
  if (!sniff(buf)) return "Use a PNG, JPG or WebP image.";
  return "";
}
const newId = () => crypto.randomBytes(16).toString("hex");

// Cloud Storage for Firebase (the project's default bucket, or STORAGE_BUCKET). Files are private:
// storage.rules allow no direct access; only this server reads them.
function storageBlobs() {
  const { getStorage } = require("firebase-admin/storage");
  const bucket = getStorage(require("./firebase").app()).bucket();
  const file = id => bucket.file(`screenshots/${id}`);
  return {
    async put(buf, meta) {
      const id = newId();
      await file(id).save(buf, {
        resumable: false,
        contentType: sniff(buf),
        metadata: { metadata: { owner: String(meta.owner || ""), kind: String(meta.kind || "") } }
      });
      return id;
    },
    async get(id) {
      if (!/^[a-f0-9]{32}$/.test(id)) return null;
      try {
        const [[md], [buf]] = await Promise.all([file(id).getMetadata(), file(id).download()]);
        return { buf, type: md.contentType, meta: md.metadata || {} };
      } catch (e) {
        if (e.code === 404) return null;
        throw e;
      }
    },
    async meta(id) {
      if (!/^[a-f0-9]{32}$/.test(id)) return null;
      try {
        const [md] = await file(id).getMetadata();
        return md.metadata || {};
      } catch (e) {
        if (e.code === 404) return null;
        throw e;
      }
    }
  };
}
// Files in a folder on your PC (.local-data/files), for the local server.
function folderBlobs(dir) {
  const fs = require("fs"),
    path = require("path");
  fs.mkdirSync(dir, { recursive: true });
  const p = id => path.join(dir, id);
  return {
    async put(buf, meta) {
      const id = newId();
      fs.writeFileSync(p(id), buf);
      fs.writeFileSync(
        p(id) + ".json",
        JSON.stringify({
          type: sniff(buf),
          meta: { owner: String(meta.owner || ""), kind: String(meta.kind || "") }
        })
      );
      return id;
    },
    async get(id) {
      if (!/^[a-f0-9]{32}$/.test(id) || !fs.existsSync(p(id))) return null;
      const info = JSON.parse(fs.readFileSync(p(id) + ".json", "utf8"));
      return { buf: fs.readFileSync(p(id)), type: info.type, meta: info.meta };
    },
    async meta(id) {
      if (!/^[a-f0-9]{32}$/.test(id) || !fs.existsSync(p(id) + ".json")) return null;
      return JSON.parse(fs.readFileSync(p(id) + ".json", "utf8")).meta;
    }
  };
}
// Picks the same kind of storage as the data (Cloud Storage with Firestore, a folder with the file store).
function openBlobs() {
  if (process.env.STORE === "firestore") return storageBlobs();
  return folderBlobs(require("path").join(process.env.DATA_DIR, "files"));
}
function memoryBlobs() {
  const files = {};
  return {
    files,
    async put(buf, meta) {
      const id = newId();
      files[id] = {
        buf,
        type: sniff(buf),
        meta: { owner: String(meta.owner || ""), kind: String(meta.kind || "") }
      };
      return id;
    },
    async get(id) {
      return files[id] || null;
    },
    async meta(id) {
      return files[id] ? files[id].meta : null;
    }
  };
}
module.exports = { openBlobs, storageBlobs, folderBlobs, memoryBlobs, check, sniff, MAX };
