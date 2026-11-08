/* User form: What you have today · one tab per missing licence · Additional modules · Review summary. */
"use strict";
(() => {
  const { M, L, esc, nameOf, $, fmtDate, api, fillImages } = window.LC;
  const licName = L.licName;

  // The personal token arrives in the link's fragment (#t=…), which browsers never send to servers or logs.
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
  const token = readToken(),
    auth = { "x-invite-token": token || "" };

  const F = {
    u: null,
    resp: null,
    director: "the IT Director",
    have: [],
    missing: [],
    shared: false,
    step: 0,
    never: false,
    device: "",
    apps: {},
    extraApps: [],
    noExtra: false,
    xNames: "",
    xShots: [],
    note: "",
    wrong: "",
    sent: false,
    busy: false
  };
  const appState = k => (F.apps[k] = F.apps[k] || { level: "", mods: [], tasks: [], other: "" });
  const otherApps = () => L.ALL_APPS.filter(k => !F.have.includes(k) && !F.missing.includes(k));
  function formSteps() {
    if (F.never)
      return [
        { id: "asis", label: "What you have today" },
        { id: "review", label: "Review summary" }
      ];
    return [
      { id: "asis", label: "What you have today" },
      ...F.missing.map(k => ({ id: "app", app: k, label: licName(k) })),
      { id: "extra", label: "Additional modules" },
      { id: "review", label: "Review summary" }
    ];
  }
  // What the form sends; the server cleans it again and works out the licence itself.
  const collect = () => ({
    never: F.never,
    device: F.device,
    apps: F.apps,
    extraApps: F.extraApps,
    noExtra: F.noExtra,
    extraNames: F.xNames,
    extraShots: F.xShots,
    wrong: F.wrong,
    note: F.note
  });
  const stepDone = s =>
    s.id === "asis"
      ? !F.shared || F.never || !!F.device
      : s.id === "app"
        ? !!appState(s.app).level &&
          (appState(s.app).level === "none" || appState(s.app).mods.length > 0)
        : s.id === "extra"
          ? F.noExtra ||
            ((F.extraApps.length > 0 || F.xNames.trim() || F.xShots.length) &&
              F.extraApps.every(k => appState(k).level))
          : F.sent;

  // While a request is sent back, keep the IT Director's comment in view on every tab.
  function backNote() {
    const r = F.resp;
    if (!r || r.status !== "returned") return "";
    const last = [...(r.history || [])]
      .reverse()
      .find(h => h.comment && h.action === "director_return");
    return last
      ? `<div class="stagebanner warn"><b>Sent back by ${esc(F.director)}:</b> “${esc(last.comment)}”</div>`
      : "";
  }
  function stageBanner() {
    const r = F.resp;
    if (!r || !r.status) return "";
    const last = [...(r.history || [])]
      .reverse()
      .find(h => h.comment && ["director_return", "director_reject"].includes(h.action));
    const d = F.director;
    const t = {
      submitted: [
        "info",
        `Sent on ${fmtDate(r.submittedAt)}. ${d}, IT Director, is reviewing it.`,
        "You can still change your answers and send them again."
      ],
      returned: [
        "warn",
        `${d} sent your answers back${last ? " on " + fmtDate(last.at) : ""}.`,
        "Please change your answers and send them again."
      ],
      approved: [
        "ok",
        "Your request is approved. IT is setting up your licence.",
        "Changing your answers now starts the review again."
      ],
      provisioned: [
        "ok",
        `Your licence is set up${r.provisionedLicence ? ": " + r.provisionedLicence : ""}.`,
        "Only change your answers if your work has changed."
      ],
      rejected: [
        "bad",
        "Your request was not approved.",
        "IT will be in touch. You can send changed answers if something is different."
      ]
    }[r.status];
    return t
      ? `<div class="stagebanner ${t[0]}"><b>${esc(t[1])}</b>${last && ["returned", "rejected"].includes(r.status) ? `<blockquote>“${esc(last.comment)}”<cite>${esc(nameOf(String(last.by).replace(/ \(IT Director\)$/, "")))}</cite></blockquote>` : ""}<div>${esc(t[2])}</div></div>`
      : "";
  }
  // What Microsoft's D365 licensing report found for this licence. Role names come from the report (roster gapRoles).
  function foundBox(app) {
    const roles = ((F.u && F.u.gapRoles) || {})[app] || [];
    const lead =
      roles.length === 1
        ? `One of your D365 roles, <b>${esc(roles[0])}</b>, includes features that need a ${esc(licName(app))} licence.`
        : roles.length
          ? `Some of your D365 roles, <b>${esc(roles.slice(0, -1).join(", "))}</b> and <b>${esc(roles[roles.length - 1])}</b>, include features that need a ${esc(licName(app))} licence.`
          : `Your D365 access includes features that need a ${esc(licName(app))} licence.`;
    return `<div class="found"><div class="fhead">Action needed: your D365 access isn’t fully licensed</div>${lead} You don't currently have this licence.
    <ul><li>Microsoft requires every D365 user to be licensed for the access they have, and checks this.</li><li>Until it's resolved, IT may need to remove this access, which could affect your work.</li></ul></div>
    <p><b>Please tell us below if you use these features.</b> If you do, we'll get you the right licence. If you don't, we'll remove the access.</p>`;
  }
  function levelPicker(app) {
    const a = appState(app);
    return `<div class="levels" role="radiogroup" aria-label="Licence level for ${esc(licName(app))}">${L.LEVELS.map(([v, n, nick, d]) => `<label class="opt level"><input type="radio" name="level-${app}" value="${v}" ${a.level === v ? "checked" : ""}><span><b>${esc(n)}</b>${nick ? ` <span class="nick">${esc(nick)}</span>` : ""}<small>${esc(L.levelText(app, v, d))}</small></span></label>`).join("")}</div>`;
  }
  function appDetails(app) {
    const a = appState(app);
    if (!a.level || a.level === "none") return "";
    const tasks = L.tasksFor(a.mods),
      warn = L.levelCheck(app, a);
    return `<div class="q"><h3>Which ${esc(licName(app))} areas do you use?</h3><p class="hint">As they appear in the D365 menu (☰).</p>
    <div class="tasks">${L.APP_MODS(app)
      .map(
        m =>
          `<label class="opt sm"><input type="checkbox" data-app="${app}" data-amod="${m.key}" ${a.mods.includes(m.key) ? "checked" : ""}>${esc(m.name)}</label>`
      )
      .join("")}</div></div>
    ${
      tasks.length
        ? `<div class="q"><h3>What do you do there? <span class="muted" style="font-weight:400">(optional, helps IT confirm the level)</span></h3>
    <div class="tasks">${tasks.map(([l, id]) => `<label class="opt sm"><input type="checkbox" data-app="${app}" data-atask="${esc(id)}" ${a.tasks.includes(id) ? "checked" : ""}>${esc(l)}</label>`).join("")}</div>
    <input type="text" data-app="${app}" data-aother="1" maxlength="200" value="${esc(a.other)}" placeholder="Something else? Name the modules or features you use in D365" aria-label="Other modules or features you use in D365"></div>`
        : ""
    }
    ${warn ? `<p class="levelwarn">${esc(warn)} That's fine: IT will check with you if needed.</p>` : ""}`;
  }
  function render() {
    const steps = formSteps();
    F.step = Math.min(F.step, steps.length - 1);
    const s = steps[F.step],
      u = F.u;
    const doneN = steps.filter((x, i) => i !== F.step && stepDone(x)).length;
    $("stepper").innerHTML = `<ol>${steps
      .map((x, i) => {
        const ok = i !== F.step && stepDone(x);
        return `<li class="${ok ? "done" : ""}${i === F.step ? " cur" : ""}"><button data-go="${i}" ${i === F.step ? 'aria-current="step"' : ""}><span class="num">${ok ? "✓" : i + 1}</span><span class="lbl">${esc(x.label)}${x.id === "app" ? "<small>Missing licence</small>" : ""}</span></button></li>`;
      })
      .join(
        ""
      )}</ol><div class="progress" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="${steps.length}" aria-valuenow="${doneN}"><i style="width:${Math.round((doneN / Math.max(steps.length, 1)) * 100)}%"></i></div>`;
    let h = `<div class="stephead"><span class="eyebrow">Tab ${F.step + 1} of ${steps.length}</span>`;
    if (s.id === "asis") {
      const n = nameOf(u.email),
        current = M.currentInfo(u, M.DEFAULT_PRICES).label;
      h += `<h2>What you have today</h2></div>${stageBanner()}
      <p>Hello${n && n !== u.email ? " " + esc(n.split(" ")[0]) : ""}, we’re making sure your D365 access fits your job. This takes about two minutes.</p>
      <dl class="factlist"><dt>You</dt><dd>${esc(u.email)}${u.jobTitle ? " · " + esc(u.jobTitle) : ""}</dd>
      <dt>Your licence</dt><dd>${F.have.length ? F.have.map(k => `<span class="chip ok">✓ ${esc(licName(k))}</span>`).join(" ") + ' <span class="muted">You keep this. Nothing to answer.</span>' : `<span class="chip">${esc(current)}</span> <span class="muted">You keep this.</span>`}</dd>
      <dt>Missing</dt><dd>${F.missing.length ? F.missing.map(k => `<span class="chip warn">${esc(licName(k))}</span>`).join(" ") : '<span class="muted">Nothing</span>'}</dd></dl>
      ${F.missing.length && !F.never ? `<div class="found"><div class="fhead">Action needed: your D365 access isn’t fully licensed</div>Your roles need ${F.missing.length === 1 ? "a licence" : F.missing.length + " licences"} you don’t have: <b>${esc(F.missing.map(licName).join(" and "))}</b>. Microsoft requires this to be fixed, and IT may need to remove that access, which could affect your work. The next ${F.missing.length === 1 ? "tab shows" : F.missing.length + " tabs show"} what to confirm.</div>` : ""}
      ${
        F.shared
          ? `<div class="q"><h3>This is a shared login. Where is it used?</h3><div class="radios">${[
              ["warehouse", "Warehouse scanner or receiving desk"],
              ["shopfloor", "Production-floor terminal"],
              ["office", "An office PC people share"]
            ]
              .map(
                ([v, l]) =>
                  `<label class="opt"><input type="radio" name="device" value="${v}" ${F.device === v ? "checked" : ""}>${l}</label>`
              )
              .join("")}</div></div>`
          : ""
      }
      <label class="opt sm" style="margin-top:12px"><input type="checkbox" id="neverBox" ${F.never ? "checked" : ""}>I don't use D365 at all</label>
      <p class="hint"><button class="linkbtn" id="wrongBtn" type="button">Something here isn’t right?</button></p>
      <div id="wrongBox" ${F.wrong ? "" : "hidden"}><textarea id="wrongText" maxlength="500" placeholder="For example: my job title has changed." aria-label="What isn't right">${esc(F.wrong)}</textarea></div>`;
    }
    if (s.id === "app") {
      h += `<h2>${esc(licName(s.app))}</h2></div>${backNote()}<p class="hint">${esc(L.APP_BLURB[s.app] || "")}.</p>
      ${foundBox(s.app)}
      <div class="q"><h3>First, which describes your work here?</h3>${levelPicker(s.app)}</div>${appDetails(s.app)}`;
    }
    if (s.id === "extra") {
      const opts = otherApps();
      h += `<h2>Do you need any additional modules?</h2></div>${backNote()}
      <p class="hint">Beyond what you have${F.missing.length ? " and the " + esc(F.missing.map(licName).join(" and ")) + " tab" + (F.missing.length > 1 ? "s" : "") : ""}. Most people need nothing more.</p>
      <label class="opt"><input type="checkbox" id="noExtraBox" ${F.noExtra ? "checked" : ""}><span><b>No, I don't need anything else</b></span></label>
      ${opts.length ? `<div class="q"><h3>Or tick a module you need:</h3><div class="tasks">${opts.map(k => `<label class="opt"><input type="checkbox" data-xapp="${k}" ${F.extraApps.includes(k) ? "checked" : ""}><span><b>${esc(licName(k))}</b><small>${esc(L.APP_BLURB[k] || "")}</small></span></label>`).join("")}</div></div>` : '<p class="muted">You already have, or are being asked about, every D365 module.</p>'}
      ${F.extraApps.map(k => `<div class="xblock"><h3>${esc(licName(k))}: which describes your work?</h3>${levelPicker(k)}${appDetails(k)}</div>`).join("")}
      ${
        F.noExtra
          ? ""
          : `<div class="xblock"><h3>Other D365 modules or pages you need <span class="muted" style="font-weight:400">(optional)</span></h3>
      <p class="hint">Write the module or page names as they appear in D365, one per line. You can also add screenshots (Windows + Shift + S).</p>
      <textarea id="xNames" maxlength="2000" aria-label="Other D365 modules or pages you need" placeholder="Engineering change management&#10;Warehouse management › Setup › Warehouses">${esc(F.xNames)}</textarea>
      <div id="shotBox"></div></div>`
      }`;
    }
    if (s.id === "review") {
      const rows = [],
        idx = id => steps.findIndex(x => x.app === id || x.id === id);
      rows.push(
        `<div class="sumrow"><div><b>What you have today</b><div>${F.never ? "Doesn't use D365: licence can be freed" : `Keeps ${esc(F.have.length ? F.have.map(licName).join(", ") : M.currentInfo(u, M.DEFAULT_PRICES).label)}`}${F.shared && F.device ? " · shared login" : ""}</div></div><button class="linkbtn" data-go="0">Edit</button></div>`
      );
      if (!F.never) {
        for (const k of [...F.missing, ...F.extraApps]) {
          const a = appState(k),
            w = L.levelCheck(k, a);
          rows.push(
            `<div class="sumrow"><div><b>${esc(licName(k))}${F.extraApps.includes(k) ? " (additional)" : ""}: ${esc(a.level ? L.LEVEL_NAME[a.level] : "not answered")}</b>${
              a.level && a.level !== "none"
                ? `<div>${a.mods.map(m => `<span class="chip">${esc(L.MOD[m].name)}</span>`).join(" ") || '<span class="muted">No areas ticked</span>'}</div>${
                    a.tasks.length || a.other
                      ? `<ul>${L.TASKS.filter(t => a.tasks.includes(t[1]))
                          .map(t => `<li>${esc(t[0])}</li>`)
                          .join("")}${a.other ? `<li>${esc(a.other)}</li>` : ""}</ul>`
                      : ""
                  }${w ? `<div class="levelwarn">${esc(w)}</div>` : ""}`
                : ""
            }</div><button class="linkbtn" data-go="${F.extraApps.includes(k) ? idx("extra") : idx(k)}">Edit</button></div>`
          );
        }
        if (!F.extraApps.length || F.xNames.trim() || F.xShots.length)
          rows.push(
            `<div class="sumrow"><div><b>Additional modules</b><div>${F.noExtra ? "None needed" : F.xNames.trim() || F.xShots.length || F.extraApps.length ? "" : '<span class="muted">Not answered</span>'}</div>${F.xNames.trim() ? `<pre class="pages">${esc(F.xNames.trim())}</pre>` : ""}${F.xShots.length ? `<div class="thumbs">${F.xShots.map(x => `<img data-shot="${esc(x.id)}" alt="${esc(x.name)}">`).join("")}</div>` : ""}</div><button class="linkbtn" data-go="${idx("extra")}">Edit</button></div>`
          );
      }
      const open = steps.filter(x => x.id !== "review" && !stepDone(x));
      h += `<h2>Review summary</h2></div>${F.resp && ["returned", "rejected"].includes(F.resp.status) ? stageBanner() : ""}<div class="summary">${rows.join("")}</div>
      ${open.length ? `<p class="levelwarn">Still to answer: ${esc(open.map(x => x.label).join(", "))}.</p>` : ""}
      <div class="q"><h3>Anything else we should know? <span class="muted" style="font-weight:400">(optional)</span></h3><textarea id="noteText" maxlength="1200" aria-label="Notes" placeholder="For example: I cover for Jane when she's on leave.">${esc(F.note)}</textarea></div>
      <p class="hint">${esc(F.director)}, IT Director, reviews your answers and sets up your licence.</p>
      <button class="btn" id="sendBtn" ${open.length ? "disabled" : ""}>${F.resp && F.resp.status ? "Send my changes" : "Send to IT"}</button><div id="sendMsg" aria-live="polite"></div>`;
    }
    $("stepBody").innerHTML = h;
    renderShots();
    fillImages($("stepBody"), auth);
    $("backBtn").hidden = F.step === 0;
    const nx = steps[F.step + 1];
    $("nextBtn").hidden = !nx;
    if (nx) $("nextBtn").textContent = `Next: ${nx.label} →`;
    $("navMsg").textContent = "";
  }
  function renderShots() {
    const box = $("shotBox");
    if (!box) return;
    box.innerHTML =
      `<div class="thumbs">${F.xShots.map((x, i) => `<figure><img data-shot="${esc(x.id)}" alt="${esc(x.name)}"><figcaption>${esc(x.name)} <button class="linkbtn" data-unshot="${i}">Remove</button></figcaption></figure>`).join("")}</div>` +
      (F.xShots.length < 5
        ? `<label class="btn ghost filebtn">Add screenshot<input type="file" id="shotInput" accept="image/png,image/jpeg,image/webp" multiple hidden></label>`
        : "");
    fillImages(box, auth);
  }
  function next() {
    const s = formSteps()[F.step];
    if (s.id === "asis" && F.shared && !F.never && !F.device)
      return void ($("navMsg").textContent = "Tell us where the shared login is used.");
    if (s.id === "app") {
      const a = appState(s.app);
      if (!a.level)
        return void ($("navMsg").textContent =
          `Choose which describes your ${licName(s.app)} work.`);
      if (a.level !== "none" && !a.mods.length)
        return void ($("navMsg").textContent = `Tick at least one ${licName(s.app)} area you use.`);
    }
    if (s.id === "extra") {
      if (!F.noExtra && !F.extraApps.length && !F.xNames.trim() && !F.xShots.length)
        return void ($("navMsg").textContent =
          "Tick “No, I don't need anything else”, or tell us what you need.");
      const k = F.extraApps.find(
        k => !appState(k).level || (appState(k).level !== "none" && !appState(k).mods.length)
      );
      if (k) return void ($("navMsg").textContent = `Finish the ${licName(k)} questions first.`);
    }
    F.step++;
    render();
    $("stepper").scrollIntoView({ block: "nearest" });
  }
  async function send() {
    if (F.busy) return;
    F.busy = true;
    $("sendBtn").disabled = true;
    try {
      const r = await api("/api/respond", {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ answers: collect() })
      });
      F.resp = r.request;
      F.sent = true;
      $("sendMsg").innerHTML =
        `<div class="toast ok">Thank you. Your answers are with ${esc(F.director)}, IT Director. You'll hear from IT once your licence is sorted.</div>`;
    } catch (e) {
      $("sendMsg").innerHTML = `<div class="toast bad">${esc(e.message)}</div>`;
      $("sendBtn").disabled = false;
    }
    F.busy = false;
  }
  $("form").addEventListener("click", e => {
    const g = e.target.closest("[data-go]");
    if (g) {
      F.step = +g.dataset.go;
      render();
      return;
    }
    if (e.target.id === "nextBtn") return next();
    if (e.target.id === "backBtn") {
      F.step--;
      render();
      return;
    }
    if (e.target.id === "sendBtn") return send();
    if (e.target.id === "wrongBtn") {
      $("wrongBox").hidden = !$("wrongBox").hidden;
      return;
    }
    const un = e.target.closest("[data-unshot]");
    if (un) {
      F.xShots.splice(+un.dataset.unshot, 1);
      renderShots();
    }
  });
  $("form").addEventListener("change", async e => {
    const t = e.target,
      d = t.dataset;
    if (t.id === "neverBox") {
      F.never = t.checked;
      return render();
    }
    if (t.name === "device") F.device = t.value;
    if (t.name && t.name.startsWith("level-")) {
      appState(t.name.slice(6)).level = t.value;
      return render();
    }
    if (d.amod) {
      const a = appState(d.app);
      a.mods = t.checked ? [...new Set([...a.mods, d.amod])] : a.mods.filter(m => m !== d.amod);
      const ok = new Set(L.tasksFor(a.mods).map(x => x[1]));
      a.tasks = a.tasks.filter(x => ok.has(x));
      return render();
    }
    if (d.atask) {
      const a = appState(d.app);
      a.tasks = t.checked
        ? [...new Set([...a.tasks, d.atask])]
        : a.tasks.filter(x => x !== d.atask);
      return render();
    }
    if (t.id === "noExtraBox") {
      F.noExtra = t.checked;
      if (t.checked) {
        F.extraApps = [];
        F.xNames = "";
        F.xShots = [];
      }
      return render();
    }
    if (d.xapp) {
      F.extraApps = t.checked
        ? [...new Set([...F.extraApps, d.xapp])]
        : F.extraApps.filter(k => k !== d.xapp);
      if (t.checked) F.noExtra = false;
      return render();
    }
    if (t.id === "shotInput") {
      $("navMsg").textContent = "Uploading…";
      for (const f of [...t.files].slice(0, 5 - F.xShots.length)) {
        if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 10 * 1024 * 1024) {
          $("navMsg").textContent = `${f.name}: use a PNG or JPG under 10 MB.`;
          continue;
        }
        try {
          const r = await api("/api/upload", {
            method: "POST",
            json: false,
            headers: { ...auth, "Content-Type": f.type },
            body: f
          });
          F.xShots.push({ id: r.id, name: f.name.slice(0, 80) });
        } catch (err) {
          $("navMsg").textContent = `${f.name}: ${err.message}`;
        }
      }
      if ($("navMsg").textContent === "Uploading…") $("navMsg").textContent = "";
      renderShots();
    }
  });
  $("form").addEventListener("input", e => {
    const t = e.target;
    if (t.id === "noteText") F.note = t.value;
    if (t.id === "wrongText") F.wrong = t.value;
    if (t.id === "xNames") F.xNames = t.value;
    if (t.dataset.aother) appState(t.dataset.app).other = t.value;
  });
  (async () => {
    if (!token) {
      $("state").innerHTML =
        "<h2>Open this page from your email</h2><p class='muted'>Each person gets a personal link from IT.</p>";
      return;
    }
    try {
      const me = await api("/api/me", { headers: auth }),
        u = me.user,
        r = me.request,
        x = (r && r.extra) || {};
      Object.assign(F, {
        u,
        resp: r,
        director: (me.director && me.director.name) || F.director,
        have: L.haveApps(u),
        missing: L.missingFor(u),
        shared: L.isShared(u),
        never: !!x.never,
        device: x.device || "",
        apps: JSON.parse(JSON.stringify(x.apps || {})),
        extraApps: x.extraApps || [],
        noExtra: !!x.noExtra,
        xNames: x.extraNames || "",
        xShots: x.extraShots || [],
        note: x.note || "",
        wrong: x.wrong || ""
      });
      $("state").hidden = true;
      $("form").hidden = false;
      render();
    } catch (e) {
      $("state").innerHTML =
        `<h2>We couldn't open your form</h2><p class="muted">${esc(e.message)}</p>`;
    }
  })();
})();
