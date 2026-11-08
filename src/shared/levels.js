/*
 * Licence check rules shared by the browser and the API (same file in frontend/ and api/src/lib/shared/).
 * Adds to the licence model: roles that stand for licences a person already has ("keep-*"),
 * roles that stand for the level a person confirms ("level-*"), and the IT Director's "send back" step.
 * Exposes the D365 menu areas, plain-language tasks, level wording, and how answers become a licence.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.LicenceLevels = factory(root.LicenceCatalog, root.LicenceModel);
})(typeof self !== "undefined" ? self : this, function install(cat, M) {
  "use strict";
  const FULL = ["FIN", "SCM", "PO", "COM", "FINP", "SCMP"];
  const ALL_APPS = ["FIN", "SCM", "COM", "PO"];
  const licName = k => (M.LIC[k] || { name: k }).name;
  const appOf = k => (M.LIC[k] && M.LIC[k].app) || k;

  // ---- extra roles and workflow step (idempotent) ----
  const role = (id, name, licence, source) => ({
    id,
    name,
    licence,
    source,
    description: "",
    duties: []
  });
  const KEEP = {
    FIN: "Finance",
    SCM: "Supply Chain Management",
    PO: "Project Operations",
    COM: "Commerce"
  };
  for (const m of cat.modules) {
    if (!m.areas.some(a => a.name === "Current access")) {
      if (KEEP[m.key])
        m.areas.push({
          name: "Current access",
          roles: [
            role(
              "keep-" + m.key.toLowerCase(),
              `Current ${KEEP[m.key]} access (kept)`,
              m.key,
              "already assigned"
            )
          ]
        });
      if (m.key === "ALL")
        m.areas.push({
          name: "Current access",
          roles: [
            role(
              "keep-act",
              "Current Operations – Activity access (kept)",
              "ACT",
              "already assigned"
            )
          ]
        });
    }
    if (!m.areas.some(a => a.name === "Confirmed level")) {
      if (ALL_APPS.includes(m.key))
        m.areas.push({
          name: "Confirmed level",
          roles: [
            role(
              "level-full-" + m.key.toLowerCase(),
              `Confirmed: Full user for ${KEEP[m.key]}`,
              m.key,
              "confirmed by the user"
            )
          ]
        });
      if (m.key === "ALL")
        m.areas.push({
          name: "Confirmed level",
          roles: [
            role(
              "level-act",
              "Confirmed: Operations – Activity user",
              "ACT",
              "confirmed by the user"
            ),
            role("level-tm", "Confirmed: Team Member", "TM", "confirmed by the user")
          ]
        });
    }
  }
  M.setCatalog(cat);
  M.TRANSITIONS.director_return = {
    who: "itdirector",
    from: ["submitted", "manager_approved", "approved"],
    to: "returned"
  };

  // ---- D365 menu areas, in plain menu names, with the licence each belongs to ----
  const MODULES = [
    [
      "Finance and accounting",
      [
        ["GL", "General ledger", "FIN"],
        ["AP", "Accounts payable", "FIN"],
        ["AR", "Accounts receivable", "FIN"],
        ["CB", "Cash and bank management", "FIN"],
        ["CC", "Credit and collections", "FIN"],
        ["FA", "Fixed assets", "FIN"],
        ["BUD", "Budgeting", "FIN"],
        ["TAX", "Tax", "FIN"],
        ["EXP", "Expense management", "FIN"]
      ]
    ],
    [
      "Sales and purchasing",
      [
        ["SM", "Sales and marketing", "SCM"],
        ["PROC", "Procurement and sourcing", "SCM"]
      ]
    ],
    [
      "Products, planning and production",
      [
        ["PIM", "Product information management", "SCM"],
        ["ECM", "Engineering change management", "SCM"],
        ["MP", "Master planning", "SCM"],
        ["PROD", "Production control", "SCM"],
        ["COST", "Cost management", "SCM"]
      ]
    ],
    [
      "Stock and shipping",
      [
        ["INV", "Inventory management", "SCM"],
        ["WH", "Warehouse management", "SCM"],
        ["TRANS", "Transportation management", "SCM"]
      ]
    ],
    [
      "Service and assets",
      [
        ["SERV", "Service management", "SCM"],
        ["ASSET", "Asset management", "SCM"]
      ]
    ],
    ["Stores and online sales", [["COMM", "Retail and commerce", "COM"]]],
    ["Projects", [["PMA", "Project management and accounting", "PO"]]],
    [
      "Admin and general",
      [
        ["ORG", "Organization administration", ""],
        ["SYS", "System administration", ""],
        ["WS", "Workspaces and dashboards only", ""]
      ]
    ]
  ];
  const MOD = Object.fromEntries(
    MODULES.flatMap(([, ms]) => ms.map(([k, n, a]) => [k, { key: k, name: n, app: a }]))
  );
  const ALLMODS = Object.keys(MOD).filter(k => MOD[k].app);
  const APP_MODS = app => Object.values(MOD).filter(m => m.app === app);
  // Plain-language tasks, each mapped to the D365 role that covers it. Evidence for IT; the level decides the licence.
  const TASKS = [
    ["Enter or update sales orders or returns", "scm-sales-clerk", ["SM", "AR", "COMM"]],
    ["Handle customer service cases", "scm-customer-service-representative", ["SM", "SERV"]],
    ["Enter or match vendor invoices", "fin-accounts-payable-clerk", ["AP"]],
    ["Pay vendors", "fin-accounts-payable-payments-clerk", ["AP", "CB"]],
    [
      "Post customer invoices, payments or collections",
      "fin-accounts-receivable-clerk",
      ["AR", "CC"]
    ],
    ["Manage customer credit limits and holds", "fin-credit-management-clerk", ["CC", "AR", "SM"]],
    ["Post journals, reconcile or close the books", "fin-accountant", ["GL", "CB", "FA", "TAX"]],
    ["Prepare or file tax", "fin-tax-accountant", ["TAX"]],
    ["Review financial results (management view)", "fin-chief-financial-officer", ["GL", "BUD"]],
    ["Enter or approve my department's budget", "fin-budget-contributor", ["BUD"]],
    ["Create or change purchase orders", "scm-purchasing-agent", ["PROC"]],
    ["Raise purchase requisitions", "all-requester", ["PROC"]],
    ["Plan or schedule production, run master planning", "scm-production-planner", ["MP", "PROD"]],
    ["Release or start production orders", "scm-production-supervisor", ["PROD"]],
    ["Report production on the floor (start, finish, time)", "scm-machine-operator", ["PROD"]],
    [
      "Create or change BOMs, routes or product configurations",
      "scm-product-designer",
      ["PIM", "ECM", "PROD"]
    ],
    [
      "Raise or process engineering change requests",
      "po-engineering-change-request-clerk",
      ["ECM", "PIM"]
    ],
    ["Set up items, products or variants", "scm-materials-manager", ["PIM", "INV"]],
    ["Update costs or standard costs", "scm-cost-accountant", ["COST", "INV"]],
    ["Receive, pick, count or ship goods", "scm-warehouse-worker", ["INV", "WH", "TRANS"]],
    ["Set up warehouses or warehouse processes", "scm-warehouse-manager", ["WH"]],
    ["Plan loads, carriers or freight", "scm-transportation-coordinator", ["TRANS"]],
    ["Record quality checks", "scm-quality-control-clerk", ["INV", "PROD"]],
    ["Dispatch service work", "scm-service-dispatcher", ["SERV", "ASSET"]],
    ["Manage product catalogs or online listings", "com-catalog-manager", ["COMM"]],
    ["Set channel pricing, assortments or promotions", "com-merchandising-manager", ["COMM"]],
    ["Manage order routing rules", "com-distributed-order-management-dom-administrator", ["COMM"]],
    ["Plan projects, budgets or resources", "po-project-manager", ["PMA"]],
    ["Project invoicing or project accounting", "po-project-accountant", ["PMA"]],
    ["Enter project timesheets or expenses", "po-project-timesheet-user", ["PMA"]],
    ["Approve things sent to me (invoices, requisitions, expenses)", "all-approver", ALLMODS],
    ["Look things up or run reports only", "all-viewer", ALLMODS]
  ].filter(t => M.ROLES[t[1]]);
  const tasksFor = mods => TASKS.filter(t => t[2].some(m => mods.includes(m)));

  // ---- levels a person can confirm for a missing or additional licence ----
  const LEVELS = [
    [
      "full",
      "Full user",
      "The “Editor”",
      "You create or change key records here: purchase orders, BOMs and configurations, production plans, prices, journals or setups."
    ],
    [
      "tm",
      "Team Member",
      "The “Viewer / Light User”",
      "You mostly look things up and run reports, approve things sent to you, raise requisitions, or enter time and expenses."
    ],
    [
      "none",
      "I don't need it",
      "",
      "You don't work in these areas, or someone else does it for you."
    ]
  ];
  const LEVEL_NAME = {
    full: "Full user",
    act: "Operations – Activity",
    tm: "Team Member",
    none: "Not needed"
  };
  const LEVEL_RANK = { none: 0, tm: 1, act: 2, full: 3 };
  const LEVEL_TEXT = {
    FIN: {
      full: "You post or change financial records: journals, vendor and customer invoices, payments, period close, budgets or finance setups.",
      tm: "You look up balances, invoices and reports, approve invoices or expenses sent to you, or enter your own time and expenses."
    },
    SCM: {
      full: "You create or change key records: purchase orders, BOMs and configurations, production plans, items, prices or setups.",
      tm: "You look up orders, stock and items, run reports, approve things sent to you, or raise purchase requisitions."
    },
    COM: {
      full: "You set up or change sales channels, product catalogs, pricing, promotions or order routing rules.",
      tm: "You look up channel orders, stock or reports, or approve things sent to you."
    },
    PO: {
      full: "You plan projects, budgets and resources, or handle project invoicing and project accounting.",
      tm: "You enter your own timesheets or expenses, approve project time sent to you, or look up project information."
    }
  };
  const levelText = (app, v, d) =>
    v === "none"
      ? `You don't work in ${licName(app)}, or someone else does it for you.`
      : (LEVEL_TEXT[app] || {})[v] || d;
  const APP_BLURB = {
    FIN: "General ledger, payables, receivables, cash and bank, credit, fixed assets, budgeting, tax",
    SCM: "Sales and marketing, procurement, products, planning, production, inventory and warehouses",
    COM: "Retail and commerce: channels, catalogs, store and online orders",
    PO: "Project management and accounting: projects, budgets, timesheets, project invoicing"
  };
  const STAGE = {
    none: ["Not answered", ""],
    submitted: ["With IT Director", "info"],
    manager_approved: ["With IT Director", "info"],
    returned: ["Sent back to user", "warn"],
    approved: ["Approved, to set up", "warn"],
    provisioned: ["Licence set up", "ok"],
    rejected: ["Declined", "bad"]
  };

  // ---- people ----
  const haveApps = u =>
    (M.modulesFor({ required: u.current || [] }) || []).filter(k => FULL.includes(k));
  const missingFor = u => {
    const have = haveApps(u);
    return (M.modulesFor(u) || []).filter(k => ALL_APPS.includes(k) && !have.includes(k));
  };
  const keepsAct = u => (u.current || []).some(c => M.nameToKey(c) === "ACT");
  const isShared = u => u.managerEmailStatus === "none" || /shared/i.test(u.jobTitle || "");

  // ---- answers → licence ----
  const VALID_LEVEL = ["full", "act", "tm", "none"];
  const str = (v, n) =>
    String(v == null ? "" : v)
      .trim()
      .slice(0, n);
  const shotList = (v, n) =>
    (Array.isArray(v) ? v : [])
      .filter(s => s && /^[a-f0-9]{32}$/.test(s.id))
      .slice(0, n)
      .map(s => ({ id: s.id, name: str(s.name, 80) }));
  /** Clean what the form sends: only known apps, areas, tasks and levels survive. */
  function cleanForm(u, ans) {
    ans = ans || {};
    const missing = missingFor(u),
      have = haveApps(u);
    const extraApps = (Array.isArray(ans.extraApps) ? ans.extraApps : []).filter(
      k => ALL_APPS.includes(k) && !have.includes(k) && !missing.includes(k)
    );
    const apps = {};
    for (const k of [...missing, ...extraApps]) {
      const a = (ans.apps || {})[k] || {},
        level = VALID_LEVEL.includes(a.level) ? a.level : "";
      const mods = (Array.isArray(a.mods) ? a.mods : []).filter(m => MOD[m] && MOD[m].app === k);
      const ok = new Set(tasksFor(mods).map(t => t[1]));
      apps[k] = {
        level,
        mods: level && level !== "none" ? mods : [],
        tasks:
          level && level !== "none"
            ? (Array.isArray(a.tasks) ? a.tasks : []).filter(t => ok.has(t))
            : [],
        other: level && level !== "none" ? str(a.other, 200) : ""
      };
    }
    const noExtra = !!ans.noExtra;
    return {
      never: !!ans.never,
      device:
        isShared(u) && ["warehouse", "shopfloor", "office"].includes(ans.device) ? ans.device : "",
      apps,
      missing,
      extraApps: noExtra ? [] : extraApps,
      noExtra,
      extraNames: noExtra ? "" : str(ans.extraNames, 2000),
      extraShots: noExtra ? [] : shotList(ans.extraShots, 5),
      wrong: str(ans.wrong, 500),
      note: str(ans.note, 1200)
    };
  }
  /** Which form tabs still need an answer (empty means it can be sent). */
  function openItems(u, f) {
    if (f.never) return [];
    const out = [];
    if (isShared(u) && !f.device) out.push("What you have today");
    for (const k of f.missing) {
      const a = f.apps[k] || {};
      if (!a.level || (a.level !== "none" && !a.mods.length)) out.push(licName(k));
    }
    if (!f.noExtra && !f.extraApps.length && !f.extraNames && !f.extraShots.length)
      out.push("Additional modules");
    for (const k of f.extraApps) {
      const a = f.apps[k] || {};
      if (!a.level || (a.level !== "none" && !a.mods.length)) {
        out.push("Additional modules");
        break;
      }
    }
    return [...new Set(out)];
  }
  /** Answers in the licence model's shape: kept licences plus one role per confirmed level. */
  function modelAnswers(u, f) {
    if (f.never)
      return { freq: "never", shared: "", device: "", roles: [], duties: [], notes: f.note };
    const roles = haveApps(u).map(k => "keep-" + k.toLowerCase());
    if (!roles.length && keepsAct(u)) roles.push("keep-act");
    for (const k of [...f.missing, ...f.extraApps]) {
      const a = f.apps[k];
      if (!a || !a.level || a.level === "none") continue;
      roles.push(
        a.level === "full"
          ? "level-full-" + k.toLowerCase()
          : a.level === "act"
            ? "level-act"
            : "level-tm"
      );
    }
    if (!roles.length) roles.push("level-tm");
    return {
      freq: "weekly",
      shared: isShared(u) ? "yes" : "no",
      device: f.device,
      roles,
      duties: [],
      notes: f.note
    };
  }
  /** Base + attach compared with today. Today's base is kept when it costs at least as much, so only the new app is an attach. */
  function licencePlan(u, rec, P) {
    const cur = M.currentInfo(u, P),
      curApps = cur.keys.filter(k => FULL.includes(k)).map(appOf);
    if (!rec || rec.kind !== "FULL")
      return {
        cur,
        base: null,
        attach: [],
        newBase: null,
        newAttach: [],
        delta: rec ? rec.cost - cur.cost : 0
      };
    const apps = rec.apps.map(appOf),
      price = k => P[k] || 0;
    const keepBase = curApps.filter(a => apps.includes(a)).sort((x, y) => price(y) - price(x))[0];
    const base = keepBase && price(keepBase) >= price(appOf(rec.base)) ? keepBase : appOf(rec.base),
      attach = apps.filter(a => a !== base);
    return {
      cur,
      base,
      attach,
      newBase: curApps.length ? null : base,
      newAttach: (curApps.length ? apps : attach).filter(a => !curApps.includes(a)),
      delta: rec.cost - cur.cost
    };
  }
  const planLabel = (rec, p) =>
    rec && rec.kind === "FULL" && p.base
      ? licName(p.base) +
        (p.attach.length ? " + " + p.attach.map(a => licName(a) + " attach").join(" + ") : "")
      : rec
        ? M.licLabel(rec)
        : "";
  const taskRank = id => {
    const r = M.ROLES[id];
    const l = r ? M.roleLicence(r, []) : "TM";
    return FULL.includes(l) ? 3 : l === "ACT" ? 2 : 1;
  };
  /** Do the ticked tasks agree with the level picked? Empty string when they do. */
  function levelCheck(app, a) {
    if (!a || !a.level || a.level === "none" || !(a.tasks || []).length) return "";
    const top = Math.max(...a.tasks.map(taskRank)),
      chosen = LEVEL_RANK[a.level];
    if (top > chosen)
      return top === 3
        ? "The tasks ticked usually need a Full user licence."
        : "The tasks ticked usually need more than Team Member.";
    if (chosen === 3 && top < 3)
      return top === 2
        ? "The tasks ticked may not need a Full user licence."
        : "The tasks ticked are usually covered by Team Member.";
    return "";
  }
  /** Everything the dashboard needs about one person. */
  function analyse(u, resp, P) {
    const f = resp && resp.extra,
      status = resp ? resp.status || "submitted" : "none";
    const a = resp && resp.answers,
      rec = a ? M.recommend(a, P) : null,
      plan = licencePlan(u, rec, P);
    const checks = f
      ? Object.entries(f.apps || {})
          .map(([k, v]) => [k, levelCheck(k, v)])
          .filter(([, w]) => w)
      : [];
    const freed = !!(f && f.never);
    // A missing licence answered below Full user means no licence to buy, but the security roles that need it must change.
    const roleActions = !f
      ? []
      : freed
        ? ["Disable the user or remove all licences"]
        : (f.missing || [])
            .map(k => [k, (f.apps || {})[k]])
            .filter(
              ([k, v]) =>
                v &&
                v.level &&
                v.level !== "full" &&
                !(rec && rec.kind === "FULL" && rec.apps.map(appOf).includes(k))
            )
            .map(([k, v]) => {
              const rs =
                ((u.gapRoles || {})[k] || []).join(", ") || `${licName(k)}-level security roles`;
              return v.level === "none"
                ? `Remove ${rs} (needs ${licName(k)}, not needed)`
                : `Replace ${rs} (needs ${licName(k)}) with a ${v.level === "act" ? "Operations – Activity" : "Team Member"}-level role`;
            });
    const mods = f
      ? [
          ...new Set(
            Object.values(f.apps || {}).flatMap(v => (v.level && v.level !== "none" ? v.mods : []))
          )
        ]
      : [];
    return { u, r: resp, x: f || {}, a, status, rec, plan, checks, roleActions, freed, mods };
  }
  return {
    FULL,
    ALL_APPS,
    licName,
    appOf,
    MODULES,
    MOD,
    ALLMODS,
    APP_MODS,
    TASKS,
    tasksFor,
    LEVELS,
    LEVEL_NAME,
    LEVEL_RANK,
    levelText,
    APP_BLURB,
    STAGE,
    haveApps,
    missingFor,
    keepsAct,
    isShared,
    cleanForm,
    openItems,
    modelAnswers,
    licencePlan,
    planLabel,
    levelCheck,
    analyse
  };
});
