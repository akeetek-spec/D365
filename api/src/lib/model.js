// Loads the licence model shared with the browser (same files as web/), plus the "keep" roles.
globalThis.self = globalThis.self || globalThis;
require("./shared/catalog.js");
const M = require("./shared/licence.js");
M.setCatalog(globalThis.self.LicenceCatalog);
require("./shared/keep-roles.js")(globalThis.self.LicenceCatalog, M);
module.exports = M;
