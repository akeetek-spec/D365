/* User form: one question to start, one page per missing licence, then review and send. */
(function () {
  "use strict";
  const M = window.LicenceModel;
  const $ = id => document.getElementById(id);
  const esc = s =>
    String(s ?? "").replace(
      /[&<>"]/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
    );
  const money = n => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
  const licName = k => (M.LIC[k] || { name: k }).name;
  // Plain-language tasks per module, each mapped to the D365 role that covers it.
  const TASKS = {
    FIN: [
      ["Enter or match vendor invoices", "fin-accounts-payable-clerk"],
      ["Post customer invoices, payments or collections", "fin-accounts-receivable-clerk"],
      ["Post journals, reconcile or close the books", "fin-accountant"],
      ["Manage customer credit limits and holds", "fin-credit-management-clerk"],
      ["Review financial results (management view)", "fin-chief-financial-officer"],
      ["Enter or approve my department's budget", "fin-budget-contributor"],
      ["Approve invoices or expenses sent to me", "all-approver"],
      ["Look things up or run reports only", "all-viewer"]
    ],
    SCM: [
      ["Create or change purchase orders", "scm-purchasing-agent"],
      ["Plan or schedule production, run master planning", "scm-production-planner"],
      ["Create or change BOMs, routes or product configurations", "scm-product-designer"],
      ["Set up items, inventory or warehouse data", "scm-materials-manager"],
      ["Enter or update sales orders", "scm-sales-clerk"],
      ["Receive, pick or ship goods", "scm-warehouse-worker"],
      ["Report production (start, finish, time)", "scm-machine-operator"],
      ["Record quality checks", "scm-quality-control-clerk"],
      ["Raise purchase requisitions", "all-requester"],
      ["Look things up or run reports only", "all-viewer"]
    ],
    PO: [
      ["Plan projects, budgets or resources", "po-project-manager"],
      ["Project invoicing or project accounting", "po-project-accountant"],
      ["Raise or process engineering change requests", "po-engineering-change-request-clerk"],
      ["Enter project timesheets or expenses", "po-project-timesheet-user"],
      ["Approve project time, expenses or materials", "po-project-approver"],
      ["Look things up or run reports only", "all-viewer"]
    ],
    COM: [
      ["Manage product catalogs or online listings", "com-catalog-manager"],
      ["Set channel pricing, assortments or promotions", "com-merchandising-manager"],
      ["Manage order routing rules (DOM)", "com-distributed-order-management-dom-administrator"],
      ["Handle returns or service in sales channels", "com-retail-service"],
      ["Pick, receive or count stock in a channel", "com-retail-warehouse-clerk"],
      ["Look things up or run reports only", "all-viewer"]
    ]
  };
  const NEED = [
    ["yes", "Yes, I need it for my job"],
    ["unsure", "Not sure, help me decide"],
    ["no", "No, I don't need it"]
  ];
  const NEED_TXT = { yes: "needed", unsure: "not sure", no: "not needed" };
  const USE_TXT = { weekly: "regularly", rarely: "rarely", never: "not at all" };

  // The personal token arrives in the link's fragment (#t=...), which browsers never send to servers or logs.
  function readToken() {
    const m = location.hash.match(/(?:^#|&)t=([A-Za-z0-9_-]{40,64})/);
    if (m) {
      try {
        sessionStorage.setItem("lc-token", m[1]);
      } catch (e) {}
      history.replaceState(null, "", location.pathname);
      return m[1];
    }
    try {
      return sessionStorage.getItem("lc-token");
    } catch (e) {
      return null;
    }
  }
  let token = readToken(),
    me = null,
    PRICES = { ...M.DEFAULT_PRICES };
  let keepAct = false,
    have = [],
    missing = [],
    sharedAcct = false,
    managerOnFile = "",
    submitted = false;
  const need = {},
    tasks = {},
    other = {};
  let steps = [],
    cur = 0;

  const val = n => (document.querySelector(`input[name="${n}"]:checked`) || {}).value || "";
  // The "Do you use D365?" question was removed: everyone invited is treated as a regular user.
  const use = () => "weekly";
  const taskName = (k, id) => (TASKS[k].find(t => t[1] === id) || [id])[0];
  function buildSteps() {
    steps = [{ id: "you", label: "You" }];
    if (use() !== "never") missing.forEach(k => steps.push({ id: k, label: licName(k), mod: k }));
    steps.push({ id: "review", label: "Review and send" });
  }
  function modDone(k) {
    return (
      need[k] === "no" || (need[k] && ((tasks[k] || new Set()).size || (other[k] || "").trim()))
    );
  }
  function youDone() {
    return use() && (!sharedAcct || use() === "never" || val("device"));
  }
  function renderStepper() {
    $("stepper").innerHTML = `<ol>${steps
      .map((s, i) => {
        const done = s.mod ? modDone(s.mod) : s.id === "you" ? youDone() : submitted;
        const sub = s.mod
          ? need[s.mod]
            ? NEED_TXT[need[s.mod]]
            : "To do"
          : s.id === "you"
            ? done
              ? "Done"
              : "To do"
            : submitted
              ? "Sent"
              : "Send";
        return `<li class="${done ? "done" : ""}${i === cur ? " cur" : ""}"><button data-go="${i}" ${i === cur ? 'aria-current="step"' : ""}><span class="num">${done && i !== cur ? "✓" : i + 1}</span><span class="lbl">${esc(s.label)}<small>${esc(sub)}</small></span></button></li>`;
      })
      .join("")}</ol>`;
  }
  function answers() {
    const u = use(),
      roles = [];
    if (u !== "never") {
      have.forEach(k => roles.push("keep-" + k.toLowerCase()));
      if (!have.length && keepAct) roles.push("keep-act");
      missing.forEach(k => {
        if (need[k] === "yes" || need[k] === "unsure")
          (tasks[k] || new Set()).forEach(id => roles.push(id));
      });
      if (!roles.length) roles.push("all-viewer");
    }
    const lines = [];
    if (u !== "never")
      missing.forEach(k => {
        if (!need[k]) return;
        if (need[k] === "no") {
          lines.push(`${licName(k)}: not needed.`);
          return;
        }
        const t = [...(tasks[k] || [])].map(id => taskName(k, id));
        if ((other[k] || "").trim()) t.push("Other: " + other[k].trim());
        lines.push(`${licName(k)}: ${NEED_TXT[need[k]]}. Tasks: ${t.join("; ") || "none ticked"}.`);
      });
    if (u !== "never" && (have.length || keepAct))
      lines.push(
        `Kept as is: ${have.length ? have.map(licName).join(", ") : "Operations – Activity"}.`
      );
    const note = $("notes").value.trim();
    return {
      freq: u,
      shared: sharedAcct && u !== "never" ? "yes" : u === "never" ? "" : "no",
      device: sharedAcct ? val("device") : "",
      roles,
      duties: [],
      notes:
        (lines.length ? "Access check: " + lines.join(" ") : "") +
        (note ? (lines.length ? "\nNote: " : "") + note : "")
    };
  }
  function update() {
    const a = answers(),
      rec = M.recommend(a, PRICES),
      curInfo = me ? M.currentInfo(me.user, PRICES) : null;
    $("vLic").textContent = rec ? M.licLabel(rec) : "Answer the questions";
    const d = rec && curInfo ? rec.cost - curInfo.cost : 0;
    $("vCost").innerHTML = rec
      ? `${money(rec.cost)} a month${curInfo ? ` · today ${esc(curInfo.label)}: ${d === 0 ? "no change" : (d > 0 ? "adds " : "saves ") + money(Math.abs(d))}` : ""}`
      : "";
    const why = [];
    if (a.freq === "never") why.push("You don't use D365, so this licence can be freed up.");
    else {
      if (have.length)
        why.push(`You keep ${have.map(licName).join(" and ")}, which you already have.`);
      else if (keepAct) why.push("You keep Operations – Activity, which you already have.");
      missing.forEach(k => {
        if (need[k] === "no") why.push(`You don't need ${licName(k)}, so it isn't requested.`);
        else if (
          need[k] &&
          rec &&
          !rec.picks.some(
            p => p.role.module === k && ["FIN", "SCM", "PO", "COM", "FINP", "SCMP"].includes(p.lic)
          ) &&
          (tasks[k] || new Set()).size
        )
          why.push(`Your ${licName(k)} tasks don't need a full ${licName(k)} licence.`);
      });
    }
    $("vWhy").innerHTML = why.map(w => `<li>${esc(w)}</li>`).join("");
    const mgrOk =
      managerOnFile || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("managerEmail").value.trim());
    const ready = youDone() && (a.freq === "never" || missing.every(modDone));
    $("submit").disabled = !rec || !mgrOk || !ready;
    $("youNext").textContent = !use()
      ? ""
      : use() === "never"
        ? "We'll go straight to review."
        : missing.length
          ? `Next: ${missing.length === 1 ? "one question" : missing.length + " short questions"} about ${missing.map(licName).join(" and ")}, the access the licence report says you're missing.`
          : "";
    renderStepper();
    if (steps[cur] && steps[cur].id === "review") renderSummary();
  }
  function renderMod(k) {
    $("modTitle").textContent = `Do you need ${licName(k)}?`;
    $("modIntro").textContent =
      `The licence report says your roles need ${licName(k)}, which you don't have today.`;
    $("needOpts").innerHTML = NEED.map(
      ([v, l]) =>
        `<label class="opt"><input type="radio" name="need" value="${v}" ${need[k] === v ? "checked" : ""}>${esc(l)}</label>`
    ).join("");
    const show = need[k] === "yes" || need[k] === "unsure";
    $("taskBox").hidden = !show;
    if (show) {
      $("taskQ").textContent =
        need[k] === "unsure"
          ? `Which of these do you do? We'll work out whether you need ${licName(k)}.`
          : `What do you do in ${licName(k)}?`;
      const sel = tasks[k] || new Set();
      $("taskList").innerHTML = TASKS[k]
        .map(
          ([l, id]) =>
            `<label class="opt"><input type="checkbox" data-task="${esc(id)}" ${sel.has(id) ? "checked" : ""}>${esc(l)}</label>`
        )
        .join("");
      $("otherTask").value = other[k] || "";
    }
  }
  function renderSummary() {
    const a = answers(),
      rows = [];
    rows.push(
      `<div class="sumrow"><div><b>You</b><div class="muted">Uses D365 ${esc(USE_TXT[a.freq] || "—")}${sharedAcct && a.device ? " · shared login" : ""}${have.length && a.freq !== "never" ? ` · keeps ${esc(have.map(licName).join(", "))}` : ""}</div></div><button class="linkbtn" data-go="0">Edit</button></div>`
    );
    steps.forEach((s, i) => {
      if (!s.mod) return;
      const k = s.mod;
      const t = [...(tasks[k] || [])].map(id => taskName(k, id));
      if ((other[k] || "").trim()) t.push(other[k].trim());
      rows.push(
        `<div class="sumrow"><div><b>${esc(licName(k))}: ${esc(NEED_TXT[need[k]] || "not answered")}</b>${need[k] && need[k] !== "no" ? `${t.length ? `<ul>${t.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}` : ""}</div><button class="linkbtn" data-go="${i}">Edit</button></div>`
      );
    });
    $("summary").innerHTML = rows.join("");
  }
  function go(i) {
    buildSteps();
    i = Math.max(0, Math.min(steps.length - 1, i));
    cur = i;
    const s = steps[i];
    $("navMsg").textContent = "";
    $("step-you").hidden = s.id !== "you";
    $("step-mod").hidden = !s.mod;
    $("step-review").hidden = s.id !== "review";
    const of = `Step ${i + 1} of ${steps.length}`;
    if (s.mod) {
      $("modCount").textContent = of;
      renderMod(s.mod);
    } else if (s.id === "you") $("youCount").textContent = of;
    else {
      $("revCount").textContent = of;
      renderSummary();
    }
    $("backBtn").hidden = i === 0;
    const nx = steps[i + 1];
    $("nextBtn").hidden = !nx;
    if (nx) $("nextBtn").textContent = `Next: ${nx.label} →`;
    update();
    const top = $("stepper").getBoundingClientRect().top;
    if (top < 0) $("stepper").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function next() {
    const s = steps[cur];
    if (s.id === "you") {
      if (sharedAcct && use() !== "never" && !val("device"))
        return void ($("navMsg").textContent = "Tell us where the shared login is used.");
    }
    if (s.mod) {
      const k = s.mod;
      if (!need[k])
        return void ($("navMsg").textContent = `Tell us whether you need ${licName(k)}.`);
      if (need[k] !== "no" && !((tasks[k] || new Set()).size || (other[k] || "").trim()))
        return void ($("navMsg").textContent =
          "Tick at least one task, or describe it under Something else.");
    }
    go(cur + 1);
  }
  // events
  $("stepper").addEventListener("click", e => {
    const b = e.target.closest("[data-go]");
    if (b) go(+b.dataset.go);
  });
  $("summary").addEventListener("click", e => {
    const b = e.target.closest("[data-go]");
    if (b) go(+b.dataset.go);
  });
  $("nextBtn").addEventListener("click", next);
  $("backBtn").addEventListener("click", () => go(cur - 1));
  $("form").addEventListener("change", e => {
    const t = e.target,
      k = steps[cur] && steps[cur].mod;
    if (k && t.name === "need") {
      need[k] = t.value;
      renderMod(k);
    }
    if (k && t.dataset.task) {
      tasks[k] = tasks[k] || new Set();
      t.checked ? tasks[k].add(t.dataset.task) : tasks[k].delete(t.dataset.task);
    }
    update();
  });
  $("form").addEventListener("input", e => {
    const k = steps[cur] && steps[cur].mod;
    if (k && e.target.id === "otherTask") other[k] = e.target.value;
    update();
  });

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        "x-invite-token": token || "",
        ...(opts.headers || {})
      }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.message || "Request failed"), body);
    return body;
  }
  $("submit").addEventListener("click", async () => {
    $("submit").disabled = true;
    $("submitMsg").innerHTML = "";
    try {
      const r = await api("/api/respond", {
        method: "POST",
        body: JSON.stringify({ answers: answers(), managerEmail: $("managerEmail").value.trim() })
      });
      $("submitMsg").innerHTML =
        `<div class="toast ok">Thank you. We've sent your request (${esc(r.rec.label)}) to ${esc(r.managerEmail)} to approve. You'll hear from us once your licence is set up. You can come back with the same link to change your answers.</div>`;
      submitted = true;
      const ros = (me && me.user) || {};
      showStage(
        {
          status: "submitted",
          managerEmail: r.managerEmail,
          history: [{ at: new Date().toISOString(), action: "submit" }]
        },
        ros
      );
    } catch (e) {
      $("submitMsg").innerHTML =
        `<div class="toast bad">${esc(e.message || "Couldn't send your answers. Try again.")}</div>`;
    } finally {
      update();
    }
  });
  // Where the request stands, and what the user should do next.
  let stage = "none";
  function showStage(req, ros) {
    stage = (req && req.status) || "none";
    const hist = (req && req.history) || [];
    const last = [...hist]
      .reverse()
      .find(h => h.comment && ["manager_return", "director_reject"].includes(h.action));
    const who = (ros && ros.supervisorName) || (req && req.managerEmail) || "your supervisor";
    const when = h =>
      new Date(h.at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    const T = {
      submitted: [
        "info",
        `Sent to ${who} on ${hist.length ? when(hist[hist.length - 1]) : "—"}. Waiting for their approval.`,
        "You can still change your answers. Sending again replaces the request and lets your supervisor know."
      ],
      returned: [
        "warn",
        `${who} sent your request back${last ? " on " + when(last) : ""}.`,
        "Please change your answers below, then send it again. It goes back to them to approve."
      ],
      manager_approved: [
        "info",
        `${who} approved your request. It's with the IT Director now.`,
        "Changing your answers now starts the approval again."
      ],
      approved: [
        "ok",
        "Your request is approved. IT is setting up your licence.",
        "Changing your answers now starts the approval again."
      ],
      provisioned: [
        "ok",
        `Your licence is set up${req && req.provisionedLicence ? ": " + req.provisionedLicence : ""}.`,
        "Only change your answers if your work has changed. It starts the approval again."
      ],
      rejected: [
        "bad",
        "Your request was not approved.",
        "IT will be in touch. You can change your answers and send them again if something has changed."
      ]
    }[stage];
    const html = T
      ? `<div class="stagebanner ${T[0]}"><b>${esc(T[1])}</b>${
          last && ["returned", "rejected"].includes(stage)
            ? `<blockquote>“${esc(last.comment)}”<cite>${esc(
                /@/.test(last.by)
                  ? last.by
                      .split("@")[0]
                      .split(".")
                      .map(p => (p ? p[0].toUpperCase() + p.slice(1) : ""))
                      .join(" ")
                  : last.by
              )}</cite></blockquote>`
            : ""
        }<div>${esc(T[2])}</div></div>`
      : "";
    $("stageTop").innerHTML = html;
    $("stageBox").innerHTML = stage === "returned" || stage === "rejected" ? html : "";
    $("submit").textContent =
      stage === "none"
        ? "Send to my supervisor"
        : stage === "returned"
          ? "Send again to my supervisor"
          : ["submitted"].includes(stage)
            ? "Update and resend"
            : "Send changes (restarts approval)";
  }
  function restore(resp) {
    if (!resp) return;
    if (resp.device) {
      const d = document.querySelector(`input[name="device"][value="${resp.device}"]`);
      if (d) d.checked = true;
    }
    (resp.roles || []).forEach(id => {
      const r = M.ROLES[id];
      if (!r) return;
      const k = missing.find(k => TASKS[k].some(t => t[1] === id));
      if (k) (tasks[k] = tasks[k] || new Set()).add(id);
    });
    let n = resp.notes || "";
    for (const k of missing) {
      const m = n.match(
        new RegExp(
          licName(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
            ": (needed|not sure|not needed)(?:, ([^.]+))?\\."
        )
      );
      if (m) {
        need[k] = Object.keys(NEED_TXT).find(x => NEED_TXT[x] === m[1]);
      }
      const o = n.match(
        new RegExp(
          licName(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
            ": [^.]*?Tasks: [^\\n]*?Other: ([^;.]+)"
        )
      );
      if (o) other[k] = o[1];
    }
    const nt = n.match(/(?:^|\n)Note: ([\s\S]*)$/);
    $("notes").value = nt ? nt[1] : n.startsWith("Access check:") ? "" : n;
  }
  async function start() {
    if (!token) {
      $("state").hidden = false;
      $("form").hidden = true;
      $("state").innerHTML =
        "<h2>Open this page from your email</h2><p class='muted'>Each person gets a personal link from IT.</p>";
      return;
    }
    try {
      me = await api("/api/me");
      PRICES = { ...PRICES, ...(me.prices || {}) };
      const req = M.modulesFor(me.user) || [];
      have = M.modulesFor({ required: me.user.current || [] }) || [];
      missing = req.filter(k => !have.includes(k) && TASKS[k]);
      keepAct = (me.user.current || []).some(c => M.nameToKey(c) === "ACT");
      const ros = me.user;
      sharedAcct = !!ros.sharedAccount;
      $("deviceQ").hidden = !sharedAcct;
      const local = me.user.email.split("@")[0],
        first = local.includes(".") ? local.split(".")[0] : "";
      $("whoLine").textContent =
        `${first ? "Hi " + first[0].toUpperCase() + first.slice(1).toLowerCase() + ", we" : "We"} want to make sure you have the right D365 licence: everything you need and nothing you don't. This takes about two minutes.`;
      const curInfo = M.currentInfo(me.user, PRICES);
      $("facts").innerHTML = `<dl class="factlist">
      <dt>You</dt><dd>${esc(me.user.email)}${ros.jobTitle ? ` · ${esc(ros.jobTitle)}` : ""}</dd>
      <dt>Supervisor</dt><dd>${esc(ros.supervisorName || "Not on file")}</dd>
      <dt>You have</dt><dd>${have.length ? have.map(k => `<span class="chip ok">✓ ${esc(licName(k))}</span>`).join(" ") + ` <span class="muted">Nothing to do for ${have.length === 1 ? "this" : "these"}.</span>` : `<span class="chip">${esc(curInfo.label)}</span>`}</dd>
      <dt>Report says missing</dt><dd>${missing.length ? missing.map(k => `<span class="chip warn">${esc(licName(k))}</span>`).join(" ") : '<span class="muted">Nothing</span>'}</dd></dl>`;
      managerOnFile = me.user.managerEmail || (me.request && me.request.managerEmail) || "";
      $("mgrOnFile").textContent = managerOnFile
        ? `${ros.supervisorName || managerOnFile} (${managerOnFile}) approves your request first, then the IT Director.`
        : "";
      $("mgrAsk").hidden = !!managerOnFile;
      restore(me.response);
      submitted = !!(me.request && me.request.status && me.request.status !== "none");
      showStage(me.request, ros);
      $("state").hidden = true;
      $("form").hidden = false;
      cur = 0;
      go(0);
    } catch (e) {
      $("state").hidden = false;
      $("form").hidden = true;
      $("state").innerHTML =
        `<h2>We couldn't open your form</h2><p class="muted">${esc(e.message || "Try again in a minute.")}</p>`;
    }
  }

  start();
})();
