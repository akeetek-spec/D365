// Licence model and check rules, shared with the browser (same files as frontend/).
globalThis.self = globalThis.self || globalThis;
require("./shared/catalog.js");
const M = require("./shared/licence.js");
M.setCatalog(globalThis.self.LicenceCatalog);
const L = require("./shared/levels.js")(globalThis.self.LicenceCatalog, M);
module.exports = { M, L };
