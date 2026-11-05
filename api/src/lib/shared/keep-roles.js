/*
 * "Keep" roles stand for licences a person already has, so the recommendation keeps them
 * without asking the person to re-describe that work. Shared by the browser and the API.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else factory(root.LicenceCatalog, root.LicenceModel);
})(typeof self !== "undefined" ? self : this, function addKeepRoles(cat, M) {
  if (!cat || !M) return;
  const KEEP = {
    FIN: "Finance",
    SCM: "Supply Chain Management",
    PO: "Project Operations",
    COM: "Commerce"
  };
  const role = (id, name, licence) => ({
    id,
    name,
    licence,
    source: "already assigned",
    description: "Already licensed today; kept as is.",
    duties: []
  });
  for (const m of cat.modules) {
    if (m.areas.some(a => a.name === "Current access")) continue;
    if (KEEP[m.key])
      m.areas.push({
        name: "Current access",
        roles: [
          role(
            "keep-" + m.key.toLowerCase(),
            `Current ${KEEP[m.key]} access (kept, not reviewed)`,
            m.key
          )
        ]
      });
    if (m.key === "ALL")
      m.areas.push({
        name: "Current access",
        roles: [
          role("keep-act", "Current Operations – Activity access (kept, not reviewed)", "ACT")
        ]
      });
  }
  M.setCatalog(cat);
});
