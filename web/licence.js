/*
 * Licence model shared by the browser (window.LicenceModel) and the API (require()).
 * It mirrors D365's own security model: Module > Role > Duty > Privilege > Object (menu item),
 * where each object carries a licence level and a user needs the highest level among
 * everything they actually use.
 *
 * Rules from the Microsoft Dynamics 365 Licensing Guide, October 2026:
 *  - one base licence per full user: the highest-priced app they need (p.5-6)
 *  - each further Finance, SCM, Commerce or Project Operations app is a $30 attach (p.6 table)
 *  - Team Members, Operations - Activity and Operations - Device use rights (p.64-66);
 *    devices: point of sale, store manager, production floor, warehouse
 *  - the lowest licence covering each standard security role (Finance, SCM, Project Operations,
 *    Commerce role tables). Roles listed in several apps' tables (e.g. subscription billing,
 *    landed cost, global cost accounting) carry anyOf and are covered by any of those apps.
 * Team Members, Activity and Device prices are not in the guide: estimates, confirm with reseller.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LicenceModel = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LIC = {
    FINP: { name: "Finance Premium", short: "Finance Premium", rank: 4, app: "FIN" },
    SCMP: { name: "Supply Chain Management Premium", short: "SCM Premium", rank: 4, app: "SCM" },
    FIN: { name: "Finance", short: "Finance", rank: 3 },
    SCM: { name: "Supply Chain Management", short: "SCM", rank: 3 },
    COM: { name: "Commerce", short: "Commerce", rank: 3 },
    PO: { name: "Project Operations", short: "Project Ops", rank: 3 },
    ACT: { name: "Operations – Activity", short: "Activity", rank: 2 },
    DEV: { name: "Operations – Device", short: "Device", rank: 2 },
    TM: { name: "Team Members", short: "Team Members", rank: 1 },
    NONE: { name: "No licence", short: "None", rank: 0 },
    APP: { name: "Full licence for the role's module", short: "Full", rank: 3 } // D365 "Enterprise"/"Operations" level
  };
  const FULL_KEYS = ["FINP", "SCMP", "FIN", "SCM", "COM", "PO"];
  const isFull = k => FULL_KEYS.includes(k);

  const DEFAULT_PRICES = {
    FINP: 300,
    SCMP: 300,
    FIN: 210,
    SCM: 210,
    COM: 210,
    PO: 135,
    ATTACH: 30,
    ACT: 50,
    TM: 8,
    DEV: 75
  };
  const PRICE_SOURCES = {
    FINP: "guide",
    SCMP: "guide",
    FIN: "guide",
    SCM: "guide",
    COM: "guide",
    PO: "guide",
    ATTACH: "guide",
    ACT: "estimate",
    TM: "estimate",
    DEV: "estimate"
  };
  const ORDER = ["SCMP", "FINP", "SCM", "FIN", "COM", "PO"];

  // ---------------- catalog ----------------
  let CATALOG = { modules: [] };
  const ROLES = {},
    DUTIES = {};
  function setCatalog(cat) {
    CATALOG = cat || { modules: [] };
    for (const k of Object.keys(ROLES)) delete ROLES[k];
    for (const k of Object.keys(DUTIES)) delete DUTIES[k];
    CATALOG.modules.forEach(m =>
      m.areas.forEach(a =>
        a.roles.forEach(r => {
          ROLES[r.id] = Object.assign(r, { module: m.key, area: a.name });
          (r.duties || []).forEach(d => {
            DUTIES[d.id] = Object.assign(d, { roleId: r.id });
          });
        })
      )
    );
  }
  if (typeof self !== "undefined" && self.LicenceCatalog) setCatalog(self.LicenceCatalog);

  /** Map a licence name from D365 or the report to a key. */
  function nameToKey(s) {
    const x = String(s || "").toLowerCase();
    if (!x) return null;
    if (x.includes("premium") && x.includes("finance")) return "FINP";
    if (x.includes("premium") && (x.includes("supply") || x.includes("scm"))) return "SCMP";
    if (x.includes("activity") || x === "functional") return "ACT";
    if (x === "task") return "TM";
    if (x === "enterprise" || x === "operations" || x === "full") return "APP";
    if (x.includes("device")) return "DEV";
    if (x.includes("team member")) return "TM";
    if (x.includes("supply chain") || x === "scm") return "SCM";
    if (x.includes("finance")) return "FIN";
    if (x.includes("commerce") || x.includes("retail")) return "COM";
    if (x.includes("project")) return "PO";
    if (x === "none" || x.includes("universal") || x.includes("self")) return "NONE";
    return null;
  }
  const maxKey = keys =>
    keys.filter(Boolean).sort((a, b) => LIC[b].rank - LIC[a].rank)[0] || "NONE";

  /** Licence a role needs: from the duties the user ticked (when the catalog has them), else the role's level. */
  function roleLicence(role, dutyIds) {
    const ticked = (role.duties || []).filter(d => dutyIds.includes(d.id));
    if (!ticked.length) return role.licence;
    const keys = [];
    ticked.forEach(d =>
      (d.privileges || []).forEach(p => {
        if (p.licence) keys.push(nameToKey(p.licence));
        (p.objects || []).forEach(o => keys.push(nameToKey(o.licence)));
      })
    );
    const k = maxKey(keys);
    if (k === "NONE") return role.licence;
    // An object marked with the generic full level ("Operations", "Enterprise") means this role's own app.
    if (k === "APP")
      return isFull(role.licence)
        ? role.licence
        : FULL_KEYS.includes(role.module)
          ? role.module
          : "SCM";
    return k;
  }

  function normaliseFull(keys) {
    const s = new Set(keys.filter(isFull));
    if (s.has("FINP")) s.delete("FIN");
    if (s.has("SCMP")) s.delete("SCM");
    return [...s];
  }
  function priceFull(apps, P) {
    apps = normaliseFull(apps);
    if (!apps.length) return { base: null, attaches: [], cost: 0 };
    const sorted = apps.sort((a, b) => P[b] - P[a] || ORDER.indexOf(a) - ORDER.indexOf(b));
    return {
      base: sorted[0],
      attaches: sorted.slice(1),
      cost: P[sorted[0]] + (sorted.length - 1) * P.ATTACH
    };
  }
  function licLabel(r) {
    if (!r) return "—";
    if (r.kind === "FULL")
      return (
        LIC[r.base].name +
        (r.attaches.length ? " + " + r.attaches.map(a => LIC[a].short).join(" + ") + " attach" : "")
      );
    return LIC[r.kind].name;
  }

  function cleanAnswers(a) {
    a = a || {};
    const pick = (v, ok) => (ok.includes(v) ? v : "");
    const roles = Array.isArray(a.roles) ? [...new Set(a.roles.filter(id => ROLES[id]))] : [];
    return {
      freq: pick(a.freq, ["daily", "weekly", "rarely", "never"]),
      shared: pick(a.shared, ["yes", "no"]),
      device: pick(a.device, ["warehouse", "shopfloor", "store", "office"]),
      roles,
      duties: Array.isArray(a.duties)
        ? [...new Set(a.duties.filter(id => DUTIES[id] && roles.includes(DUTIES[id].roleId)))]
        : [],
      manager: String(a.manager || "").slice(0, 120),
      notes: String(a.notes || "").slice(0, 2000)
    };
  }

  const DEVICE_AREAS = /distribution|manufactur|warehouse|store|commerce roles/i;

  /**
   * A role listed in several apps' tables (role.anyOf, e.g. Subscription billing manager in Finance,
   * SCM and Commerce) is covered by any of those apps' full licences. Use an app the user already
   * needs for other roles, so the shared role never adds an attach licence on its own.
   */
  function resolveShared(picks) {
    const flex = p => p.role.anyOf && p.lic === p.role.licence && isFull(p.lic);
    const have = new Set(picks.filter(p => !flex(p) && isFull(p.lic)).map(p => p.lic));
    const hit = p => {
      for (const k of have) if (p.role.anyOf.includes(appOf(k))) return k;
      return null;
    };
    let left = picks.filter(flex);
    left.forEach(p => {
      const k = hit(p);
      if (k) {
        p.lic = k;
        p.via = "shared";
      }
    });
    left = left.filter(p => !p.via);
    // the rest: greedily pick the app that covers the most remaining shared roles (fewest attaches)
    while (left.length) {
      const counts = {};
      left.forEach(p =>
        p.role.anyOf.forEach(
          a => (counts[a] = (counts[a] || 0) + 1 + (a === p.role.licence ? 0.5 : 0))
        )
      ); // ties go to the module the role was picked in
      const best = Object.keys(counts).sort(
        (a, b) => counts[b] - counts[a] || ORDER.indexOf(a) - ORDER.indexOf(b)
      )[0];
      left.forEach(p => {
        if (p.role.anyOf.includes(best)) {
          p.via = p.lic === best ? p.via : "shared";
          p.lic = best;
        }
      });
      left = left.filter(p => p.lic !== best);
    }
    return picks;
  }

  function recommend(ans, P) {
    P = P || DEFAULT_PRICES;
    if (!ans || !ans.freq) return null;
    if (ans.freq === "never")
      return {
        kind: "NONE",
        cost: 0,
        apps: [],
        why: ["You said you don't use D365, so the licence can be freed up."],
        picks: []
      };
    const duties = ans.duties || [];
    const picks = (ans.roles || [])
      .filter(id => ROLES[id])
      .map(id => ({ role: ROLES[id], lic: roleLicence(ROLES[id], duties) }));
    if (!picks.length) return null;
    resolveShared(picks);
    const why = [];
    const full = normaliseFull(picks.map(p => p.lic));
    const top = maxKey(picks.map(p => p.lic));
    if (ans.shared === "yes") {
      const deviceOk =
        !full.length && picks.every(p => p.lic === "TM" || DEVICE_AREAS.test(p.role.area));
      if (
        deviceOk &&
        (ans.device === "warehouse" || ans.device === "shopfloor" || ans.device === "store")
      )
        return {
          kind: "DEV",
          cost: P.DEV,
          apps: [],
          picks,
          why: [
            "A shared warehouse, production-floor, point-of-sale or store-manager device can be licensed per device.",
            "Anyone can use the device; nobody needs a named licence for this work."
          ]
        };
      why.push(
        "Shared logins can't hold a named-user licence. Each person who does this work needs their own login."
      );
    }
    if (full.length) {
      const p = priceFull(full, P);
      [p.base, ...p.attaches].forEach(k => {
        const names = picks
          .filter(x => x.lic === k || (LIC[k].app && x.lic === LIC[k].app))
          .map(x => x.role.name);
        why.push(LIC[k].name + " because of: " + names.join(", ") + ".");
      });
      if (full.includes("FINP") && full.includes("SCMP"))
        why.push(
          "Finance Premium and SCM Premium together: the guide lists no Premium attach. Confirm pricing with your reseller."
        );
      if (picks.some(x => x.via === "shared"))
        why.push(
          "Roles shared between apps (" +
            picks
              .filter(x => x.via === "shared")
              .map(x => x.role.name)
              .join(", ") +
            ") are covered by an app you already need."
        );
      if (p.attaches.length)
        why.push(
          "One base licence plus " +
            p.attaches.length +
            " attach licence" +
            (p.attaches.length > 1 ? "s" : "") +
            " at $" +
            P.ATTACH +
            ", not separate full licences."
        );
      return {
        kind: "FULL",
        base: p.base,
        attaches: p.attaches,
        apps: normaliseFull(full),
        cost: p.cost,
        why,
        picks,
        sharedFlag: ans.shared === "yes"
      };
    }
    const k = top === "ACT" ? "ACT" : "TM";
    why.push(
      LIC[k].name + " covers all your roles: " + picks.map(x => x.role.name).join(", ") + "."
    );
    return { kind: k, cost: P[k], apps: [], why, picks, sharedFlag: ans.shared === "yes" };
  }

  function currentInfo(r, P) {
    P = P || DEFAULT_PRICES;
    const keys = (r.current || []).map(nameToKey).filter(Boolean);
    const full = normaliseFull(keys);
    if (full.length) {
      const p = priceFull(full, P);
      return { keys, full, cost: p.cost, label: keys.map(k => LIC[k].name).join(" + ") };
    }
    const k = maxKey(keys);
    return { keys, full: [], cost: k === "NONE" ? 0 : P[k], label: LIC[k].name };
  }
  function requiredInfo(r, P) {
    P = P || DEFAULT_PRICES;
    const full = normaliseFull((r.required || []).map(nameToKey));
    const p = priceFull(full, P);
    return {
      full,
      cost: p.cost,
      label: p.base
        ? LIC[p.base].name +
          (p.attaches.length
            ? " + " + p.attaches.map(a => LIC[a].short).join(" + ") + " attach"
            : "")
        : "—"
    };
  }

  const CAT = {
    await: { label: "Awaiting answers", cls: "" },
    remove: { label: "Remove licence", cls: "ok" },
    device: { label: "Shared login", cls: "bad" },
    roles: { label: "Role clean-up", cls: "warn" },
    downgrade: { label: "Downgrade", cls: "ok" },
    attach: { label: "Buy attach", cls: "info" },
    upgrade: { label: "Upgrade", cls: "bad" },
    match: { label: "No change", cls: "ok" }
  };
  const appOf = k => (LIC[k] && LIC[k].app ? LIC[k].app : k);

  function suggest(r, rec, P) {
    P = P || DEFAULT_PRICES;
    const cur = currentInfo(r, P),
      req = requiredInfo(r, P);
    if (!rec)
      return {
        cat: "await",
        text: "No answers yet. Report says roles need " + req.label + ".",
        delta: Math.max(req.cost, cur.cost) - cur.cost,
        removeRoles: []
      };
    const delta = rec.cost - cur.cost;
    // Assigned D365 roles the user did not pick (only when role assignments were imported).
    const picked = new Set((rec.picks || []).map(p => p.role.name.toLowerCase()));
    const removeRoles = (r.assignedRoles || []).filter(n => !picked.has(String(n).toLowerCase()));
    if (rec.kind === "NONE")
      return {
        cat: "remove",
        text: "Remove the licence and the D365 roles; disable the login if no longer needed.",
        delta,
        removeRoles: r.assignedRoles || []
      };
    if (rec.kind === "DEV")
      return {
        cat: "device",
        text: "License the shared device (Operations – Device); disable the generic named login.",
        delta,
        removeRoles
      };
    const recApps = rec.kind === "FULL" ? rec.apps.map(appOf) : [];
    const extraApps = req.full.map(appOf).filter(a => !recApps.includes(a));
    const curRank = Math.max(0, ...cur.keys.map(k => LIC[k].rank));
    const parts = [];
    let cat = "match";
    if (rec.sharedFlag) {
      parts.push("Shared login: create named logins for each person.");
      cat = "device";
    }
    if (removeRoles.length) {
      parts.push("Remove roles not used: " + removeRoles.join(", ") + ".");
      if (cat === "match") cat = "roles";
    } else if (extraApps.length) {
      parts.push("Remove roles that pull in " + extraApps.map(a => LIC[a].name).join(", ") + ".");
      if (cat === "match") cat = "roles";
    }
    if (rec.kind === "FULL") {
      const curApps = cur.full.map(appOf);
      const missing = rec.apps.filter(a => !curApps.includes(appOf(a)));
      if (!cur.full.length) {
        parts.push("Assign " + licLabel(rec) + ".");
        cat = "upgrade";
      } else if (missing.length) {
        parts.push("Add " + missing.map(a => LIC[a].short).join(" + ") + " attach.");
        if (cat === "match" || cat === "roles") cat = "attach";
      }
      const unused = curApps.filter(a => !recApps.includes(a));
      if (unused.length && !missing.length) {
        parts.push(
          "Assigned " + unused.map(a => LIC[a].short).join(", ") + " isn't needed for their roles."
        );
        if (cat === "match") cat = "downgrade";
      }
    } else if (LIC[rec.kind].rank < curRank) {
      parts.push("Downgrade to " + LIC[rec.kind].name + " and trim roles to match.");
      if (cat === "match" || cat === "roles") cat = "downgrade";
    } else if (LIC[rec.kind].rank > curRank) {
      parts.push("Assign " + LIC[rec.kind].name + ".");
      cat = "upgrade";
    }
    if (!parts.length) parts.push("Assigned licence matches their roles.");
    return { cat, text: parts.join(" "), delta, removeRoles };
  }

  /** Modules a user is asked about: the full apps their report row says their roles require (null = all). */
  function modulesFor(u) {
    const keys = [
      ...new Set(
        ((u && u.required) || [])
          .map(nameToKey)
          .filter(k => k && isFull(k))
          .map(k => LIC[k].app || k)
      )
    ];
    return keys.length ? keys : null;
  }
  /** Drop roles (and their duties) outside the user's modules. */
  function limitToModules(ans, mods) {
    if (!mods) return ans;
    const roles = ans.roles.filter(
      id => ROLES[id] && (ROLES[id].module === "ALL" || mods.includes(ROLES[id].module))
    );
    return {
      ...ans,
      roles,
      duties: ans.duties.filter(id => DUTIES[id] && roles.includes(DUTIES[id].roleId))
    };
  }

  // ---------------- approval workflow ----------------
  // User submits > Manager approves > IT Director approves > IT Director provisions. Leadership views only.
  const STAGES = {
    none: { label: "Not answered", cls: "", step: 0 },
    submitted: { label: "Awaiting manager", cls: "info", step: 1 },
    returned: { label: "Returned to user", cls: "warn", step: 1 },
    manager_approved: { label: "Awaiting IT Director", cls: "info", step: 2 },
    approved: { label: "Approved, to provision", cls: "warn", step: 3 },
    provisioned: { label: "Provisioned", cls: "ok", step: 4 },
    rejected: { label: "Rejected", cls: "bad", step: 4 }
  };
  // action -> { who, from: allowed current stages, to }
  const TRANSITIONS = {
    submit: {
      who: "user",
      from: [
        "none",
        "submitted",
        "returned",
        "manager_approved",
        "approved",
        "provisioned",
        "rejected"
      ],
      to: "submitted"
    },
    manager_approve: { who: "manager", from: ["submitted"], to: "manager_approved" },
    manager_return: { who: "manager", from: ["submitted"], to: "returned" },
    director_approve: {
      who: "itdirector",
      from: ["manager_approved", "submitted"],
      to: "approved"
    },
    director_reject: {
      who: "itdirector",
      from: ["submitted", "manager_approved", "approved"],
      to: "rejected"
    },
    director_provision: { who: "itdirector", from: ["approved"], to: "provisioned" }
  };
  /** Apply a workflow action; returns the new request or throws {code}. Pure: no I/O. */
  function transition(reqst, action, actor, comment, extra) {
    const t = TRANSITIONS[action];
    if (!t) throw Object.assign(new Error("Unknown action"), { code: "bad_action" });
    const cur = (reqst && reqst.status) || "none";
    if (!t.from.includes(cur))
      throw Object.assign(
        new Error(`Can't ${action.replace("_", " ")} a request that is "${STAGES[cur].label}".`),
        { code: "bad_state" }
      );
    if (
      (action === "manager_return" || action === "director_reject") &&
      !String(comment || "").trim()
    )
      throw Object.assign(new Error("Add a comment so the user knows why."), {
        code: "comment_required"
      });
    const at = new Date().toISOString();
    const entry = {
      at,
      action,
      by: actor || "",
      stage: t.to,
      comment: String(comment || "").slice(0, 1000)
    };
    if (action === "director_approve" && cur === "submitted")
      entry.note = "Manager step skipped by IT Director";
    const next = {
      ...(reqst || {}),
      ...(extra || {}),
      status: t.to,
      updatedAt: at,
      history: [...((reqst && reqst.history) || []), entry]
    };
    return next;
  }

  return {
    STAGES,
    TRANSITIONS,
    transition,
    modulesFor,
    limitToModules,
    LIC,
    DEFAULT_PRICES,
    PRICE_SOURCES,
    CAT,
    ROLES,
    DUTIES,
    get CATALOG() {
      return CATALOG;
    },
    setCatalog,
    nameToKey,
    roleLicence,
    priceFull,
    licLabel,
    cleanAnswers,
    recommend,
    currentInfo,
    requiredInfo,
    suggest
  };
});
