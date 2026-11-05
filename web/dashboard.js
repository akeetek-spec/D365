/* IT dashboard: answers received, licences to procure, approvals; drill down per person. */
window.LC_DASH = (function () {
  "use strict";
  const M = window.LicenceModel,
    $ = id => document.getElementById(id);
  const esc = s =>
    String(s ?? "").replace(
      /[&<>"]/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
    );
  const money = n => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
  const nameOf = e => {
    const l = String(e || "").split("@")[0];
    return l.includes(".")
      ? l
          .split(".")
          .map(p => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""))
          .join(" ")
      : e;
  };
  const FULL = ["FIN", "SCM", "PO", "COM", "FINP", "SCMP"];
  const STAGE = {
    none: ["Not answered", ""],
    submitted: ["With supervisor", "info"],
    returned: ["Sent back to user", "warn"],
    manager_approved: ["With IT Director", "info"],
    approved: ["Approved, to set up", "warn"],
    provisioned: ["Set up", "ok"],
    rejected: ["Not approved", "bad"]
  };
  const ACT = {
    submit: "Sent",
    manager_approve: "Approved",
    manager_return: "Sent back",
    director_approve: "Approved",
    director_reject: "Declined",
    director_provision: "Set up"
  };
  const ORDER = {
    manager_approved: 0,
    approved: 1,
    submitted: 2,
    returned: 3,
    provisioned: 4,
    rejected: 5,
    none: 6
  };
  let data = null,
    filter = "all",
    open = new Set(),
    timer = null;
  async function api(path, opts = {}) {
    const r = await fetch(path, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) }
    });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(b.message || "Request failed"), b);
    return b;
  }
  // What each person needs on top of what they have.
  function analyse(u) {
    const resp = data.responses[u.id],
      a = resp && resp.answers,
      status = resp ? resp.status || "submitted" : "none";
    const cur = M.currentInfo(u, data.prices),
      rec = a ? M.recommend(a, data.prices) : null;
    const curFull = cur.keys.filter(k => FULL.includes(k)).map(k => M.LIC[k].app || k);
    const extra =
      rec && rec.kind === "FULL"
        ? rec.apps.map(k => M.LIC[k].app || k).filter(k => !curFull.includes(k))
        : [];
    const items = extra.map(k =>
      curFull.length || k !== (M.LIC[rec.base].app || rec.base)
        ? `${M.LIC[k].name} attach`
        : M.LIC[k].name
    );
    const delta = rec ? rec.cost - cur.cost : 0;
    const freed = a && a.freq === "never";
    return { u, resp, a, status, cur, rec, extra, items, delta, freed };
  }
  function evidence(a) {
    const n = (a && a.notes) || "",
      out = [];
    const body = n.startsWith("Access check: ") ? n.slice(14).split("\nNote: ")[0] : "";
    body
      .split(
        /\s(?=(?:Finance|Supply Chain Management|Project Operations|Commerce|Kept as is|Details to correct): )/
      )
      .forEach(x => {
        if (x.trim()) out.push(x.trim());
      });
    const note = n.includes("\nNote: ") ? n.split("\nNote: ")[1] : body ? "" : n;
    return { lines: out, note };
  }
  function render() {
    const rows = data.roster
        .map(analyse)
        .sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9)),
      total = rows.length;
    const answered = rows.filter(r => r.status !== "none").length;
    // procurement: counts per licence, approved vs pending
    const proc = {};
    let monthly = 0,
      approvedMonthly = 0,
      savings = 0;
    rows.forEach(r => {
      if (r.status === "none" || r.status === "rejected") return;
      if (r.delta > 0) {
        monthly += r.delta;
        if (["approved", "provisioned"].includes(r.status)) approvedMonthly += r.delta;
      }
      if (r.delta < 0) savings -= r.delta;
      r.items.forEach(i => {
        proc[i] = proc[i] || { n: 0, ok: 0 };
        proc[i].n++;
        if (["approved", "provisioned"].includes(r.status)) proc[i].ok++;
      });
    });
    const count = s => rows.filter(r => r.status === s).length;
    const procList = Object.entries(proc).sort((a, b) => b[1].n - a[1].n);
    $("dcards").innerHTML = `
    <div class="dcard"><div class="eyebrow">Answers received</div><div class="big">${answered} <span class="muted" style="font-size:16px">of ${total}</span></div>
      <div class="bar"><i style="width:${total ? Math.round((answered / total) * 100) : 0}%"></i></div><div class="muted">${total - answered} still to answer</div></div>
    <div class="dcard"><div class="eyebrow">Additional licences to procure</div><div class="big">${money(monthly)}<span class="muted" style="font-size:16px"> a month</span></div>
      ${procList.length ? `<ul>${procList.map(([k, v]) => `<li><span>${esc(k)}</span><span><b>${v.n}</b>${v.ok ? ` <span class="muted">(${v.ok} approved)</span>` : ""}</span></li>`).join("")}</ul>` : `<div class="muted">Nothing extra requested yet.</div>`}
      ${savings ? `<div class="muted" style="margin-top:6px">Can be freed up: ${money(savings)} a month</div>` : ""}</div>
    <div class="dcard"><div class="eyebrow">Approvals</div><ul>
      ${[
        ["submitted", "With supervisors"],
        ["manager_approved", "With IT Director"],
        ["approved", "Approved, to set up"],
        ["provisioned", "Set up"],
        ["returned", "Sent back to user"],
        ["rejected", "Not approved"]
      ]
        .map(([s, l]) => `<li><span>${l}</span><b>${count(s)}</b></li>`)
        .join("")}</ul></div>`;
    const F = [
      ["all", "Everyone", total],
      ["none", "Not answered", count("none")],
      ["extra", "Need more", rows.filter(r => r.items.length && r.status !== "rejected").length],
      ["back", "Sent back", count("returned")],
      ["director", "With IT Director", count("manager_approved")],
      ["setup", "To set up", count("approved")]
    ];
    $("dfilters").innerHTML = F.map(
      ([k, l, n]) =>
        `<button class="chip ${filter === k ? "acc" : ""}" data-f="${k}" aria-pressed="${filter === k}">${l} · ${n}</button>`
    ).join("");
    const show = rows.filter(
      r =>
        filter === "all" ||
        (filter === "none" && r.status === "none") ||
        (filter === "extra" && r.items.length && r.status !== "rejected") ||
        (filter === "back" && r.status === "returned") ||
        (filter === "director" && r.status === "manager_approved") ||
        (filter === "setup" && r.status === "approved")
    );
    const R = data.viewer.roles || [],
      role = R.includes("itdirector")
        ? "itdirector"
        : R.includes("itadmin")
          ? "itadmin"
          : "leadership";
    $("dlist").innerHTML =
      show
        .map(r => {
          const [sl, sc] = STAGE[r.status] || [r.status, ""];
          const req =
            r.status === "none"
              ? `<span>Report: missing ${esc((r.u.required || []).filter(x => !(r.u.current || []).includes(x)).join(", ") || "—")}</span>`
              : r.freed
                ? `<b>Doesn't use D365</b> <span>· licence can be freed</span>`
                : r.items.length
                  ? `<b>+ ${esc(r.items.join(", "))}</b> <span>· ${money(r.delta)}/mo</span>`
                  : `<b>No extra licence</b>${r.delta < 0 ? ` <span>· saves ${money(-r.delta)}/mo</span>` : ""}`;
          const isOpen = open.has(r.u.id);
          return `<div class="drow"><button data-open="${esc(r.u.id)}" aria-expanded="${isOpen}"><span class="who"><b>${esc(nameOf(r.u.email))}</b><span>${esc(r.u.jobTitle || r.u.email)}</span></span><span class="req">${req}</span><span class="end"><span class="chip ${sc}">${esc(sl)}</span><span aria-hidden="true">${isOpen ? "▴" : "▾"}</span></span></button>${isOpen ? detail(r, role) : ""}</div>`;
        })
        .join("") || `<div style="padding:14px" class="muted">Nobody in this view.</div>`;
    renderInvites(rows, role);
    const mail = data.outbox || [];
    $("dmail").hidden = !mail.length;
    $("dmail").querySelector("summary").textContent = `Emails waiting to send (${mail.length})`;
    $("dmailBody").innerHTML = mail
      .map(
        m =>
          `<div class="dmail"><b>${esc(m.subject)}</b> <span class="muted">to ${esc(m.to)}</span>${m.error ? `<div class="toast bad">Couldn’t be sent automatically: ${esc(m.error)}</div>` : ""}<pre>${esc(m.body)}</pre><button class="btn ghost" data-sent="${esc(m.id)}">Mark as sent</button></div>`
      )
      .join("");
    $("dprices").innerHTML = `<ul>${Object.entries(data.prices)
      .filter(([, v]) => typeof v === "number")
      .map(
        ([k, v]) =>
          `<li>${esc((M.LIC[k] || { name: k === "ATTACH" ? "Attach licence" : k }).name)}: ${money(v)}</li>`
      )
      .join("")}</ul>`;
  }
  const shortDate = iso =>
    new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  // Invite bar (IT Director): invite everyone not invited yet, or remind everyone who hasn't answered.
  function renderInvites(rows, role) {
    const box = $("dinvite");
    if (role !== "itdirector") {
      box.hidden = true;
      return;
    }
    const waiting = rows.filter(r => r.status === "none");
    const fresh = waiting.filter(r => !r.u.invitedAt);
    const how =
      data.mailMode !== "outbox"
        ? "Emails are sent straight away."
        : "Emails wait under “Emails waiting to send” for IT to send.";
    box.hidden = false;
    box.innerHTML = `<div><b>Invites</b><div class="muted">${fresh.length} not invited yet · ${waiting.length} haven’t answered · ${how}</div></div>
    <div class="acts"><button class="btn" data-invite="new" ${fresh.length ? "" : "disabled"}>Invite everyone not invited yet (${fresh.length})</button><button class="btn ghost" data-invite="remind" ${waiting.length ? "" : "disabled"}>Remind everyone who hasn’t answered (${waiting.length})</button></div>`;
  }
  function inviteLine(u) {
    return u.invitedAt
      ? `Invited ${esc(shortDate(u.invitedAt))}${u.inviteCount > 1 ? ` (${u.inviteCount} emails)` : ""}.`
      : "Not invited yet.";
  }
  function detail(r, role) {
    const ev = evidence(r.a),
      hist = (r.resp && r.resp.history) || [];
    const canAct = role === "itdirector",
      canSupport = role === "itdirector" || role === "itadmin";
    const lastBack = [...hist].reverse().find(h => h.action === "manager_return");
    const acts =
      canAct && ["submitted", "manager_approved"].includes(r.status)
        ? `<textarea data-cm="${esc(r.u.id)}" placeholder="Comment (needed to decline)" maxlength="1000"></textarea><button class="btn" data-act="approve" data-id="${esc(r.u.id)}">Approve</button><button class="btn ghost" data-act="reject" data-id="${esc(r.u.id)}">Decline</button>${r.status === "submitted" ? '<span class="muted">Supervisor hasn’t approved yet.</span>' : ""}`
        : canAct && r.status === "approved"
          ? `<button class="btn" data-act="provision" data-id="${esc(r.u.id)}">Mark licence as set up</button><span class="muted">${esc(r.rec ? M.licLabel(r.rec) : "")}</span>`
          : "";
    return `<div class="ddetail">
    <div><h4>What they told us</h4>${r.status === "none" ? `<div class="muted">Not answered yet. ${inviteLine(r.u)}</div>` : `<div>Uses D365 ${esc({ weekly: "regularly", daily: "regularly", rarely: "rarely", never: "not at all" }[r.a.freq] || "—")}${r.a.shared === "yes" ? ` · shared login (${esc(r.a.device)})` : ""}</div>${ev.lines.length ? `<ul>${ev.lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}${ev.note ? `<div style="margin-top:4px"><b>Note:</b> ${esc(ev.note)}</div>` : ""}`}</div>
    <div><h4>Licence</h4><div>Today: ${esc(r.cur.label)} (${money(r.cur.cost)})</div>${r.rec ? `<div>Needs: <b>${esc(M.licLabel(r.rec))}</b> (${money(r.rec.cost)})</div><div class="muted">${r.delta === 0 ? "No change in cost" : (r.delta > 0 ? "Adds " : "Saves ") + money(Math.abs(r.delta)) + " a month"}</div>` : ""}</div>
    <div><h4>Approval route</h4><div>1. ${esc(r.u.supervisorName || "Owner needed")}${r.u.managerEmail ? ` <span class="muted">${esc(r.u.managerEmail)}</span>` : ""}${r.u.managerEmailStatus === "derived" ? ' <span class="chip warn">email to confirm</span>' : ""}</div><div>2. IT Director, Andres Santana</div>
      ${
        hist.length
          ? `<ul style="margin-top:6px">${hist
              .slice(-5)
              .map(
                h =>
                  `<li>${esc(ACT[h.action] || h.action)} by ${esc(/@/.test(h.by || "") ? nameOf(h.by) : h.by)} · ${esc(new Date(h.at).toLocaleDateString(undefined, { day: "numeric", month: "short" }))}${h.comment ? `: “${esc(h.comment)}”` : ""}</li>`
              )
              .join("")}</ul>`
          : ""
      }</div>
    ${r.status === "returned" ? `<div class="acts"><span class="chip warn">Waiting for ${esc(nameOf(r.u.email))} to change and resend</span>${lastBack ? `<span class="muted">Sent back by ${esc(nameOf(lastBack.by))}: “${esc(lastBack.comment)}”</span>` : ""}</div>` : ""}
    ${acts ? `<div class="acts">${acts}</div>` : ""}
    ${canSupport && r.status === "none" ? `<div class="acts"><button class="btn ghost" data-reissue="${esc(r.u.id)}">${r.u.invitedAt ? "Send a new link" : "Send invite"}</button><span class="muted">${r.u.invitedAt ? "Earlier links stop working." : ""}</span></div>` : ""}
    ${canSupport ? `<div class="acts"><input type="email" data-mgr="${esc(r.u.id)}" placeholder="Change approver: name@championchair.com" style="flex:1 1 240px" maxlength="200"><button class="btn ghost" data-setmgr="${esc(r.u.id)}">Change approver</button></div>` : ""}</div>`;
  }
  async function reload() {
    try {
      data = await api("/api/admin/data");
      $("dashMsg").innerHTML = "";
      render();
      const R = data.viewer.roles || [];
      $("signout").hidden = false;
      $("signout").innerHTML =
        `${esc(data.viewer.name || "")} · ${R.includes("itdirector") ? "IT Director" : R.includes("itadmin") ? "IT team" : "Read-only"} · <a href="/.auth/logout">Sign out</a>`;
    } catch (e) {
      $("dashMsg").innerHTML = `<div class="toast bad">${esc(e.message)}</div>`;
    }
  }
  $("dfilters").addEventListener("click", e => {
    const b = e.target.closest("[data-f]");
    if (b) {
      filter = b.dataset.f;
      render();
    }
  });
  $("dlist").addEventListener("click", async e => {
    const o = e.target.closest("[data-open]");
    if (o) {
      const id = o.dataset.open;
      open.has(id) ? open.delete(id) : open.add(id);
      render();
      return;
    }
    const ri = e.target.closest("[data-reissue]");
    if (ri) {
      ri.disabled = true;
      try {
        await api("/api/admin/reissue", {
          method: "POST",
          body: JSON.stringify({ id: ri.dataset.reissue })
        });
        await reload();
        notice(
          data.mailMode !== "outbox"
            ? "Link sent."
            : "Link created. Send it from “Emails waiting to send”."
        );
      } catch (err) {
        $("dashMsg").innerHTML = `<div class="toast bad">${esc(err.message)}</div>`;
        ri.disabled = false;
      }
      return;
    }
    const sm = e.target.closest("[data-setmgr]");
    if (sm) {
      const id = sm.dataset.setmgr,
        inp = document.querySelector(`[data-mgr="${CSS.escape(id)}"]`),
        email = inp.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        inp.focus();
        inp.placeholder = "Enter a valid email address";
        return;
      }
      sm.disabled = true;
      try {
        await api("/api/admin/manager", {
          method: "POST",
          body: JSON.stringify({ userId: id, managerEmail: email })
        });
        await reload();
      } catch (err) {
        $("dashMsg").innerHTML = `<div class="toast bad">${esc(err.message)}</div>`;
        sm.disabled = false;
      }
      return;
    }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const id = b.dataset.id,
      cm = document.querySelector(`[data-cm="${CSS.escape(id)}"]`),
      comment = cm ? cm.value.trim() : "";
    if (b.dataset.act === "reject" && !comment) {
      cm.focus();
      cm.placeholder = "Add a short reason first";
      return;
    }
    b.disabled = true;
    try {
      await api("/api/admin/approval", {
        method: "POST",
        body: JSON.stringify({ userId: id, action: b.dataset.act, comment })
      });
      await reload();
    } catch (err) {
      $("dashMsg").innerHTML = `<div class="toast bad">${esc(err.message)}</div>`;
      b.disabled = false;
    }
  });
  function notice(text, kind = "ok") {
    $("dashMsg").innerHTML = `<div class="toast ${kind}">${esc(text)}</div>`;
    if (data && data.mailMode === "outbox" && (data.outbox || []).length) $("dmail").open = true;
  }
  $("dinvite").addEventListener("click", async e => {
    const b = e.target.closest("[data-invite]");
    if (!b || b.disabled) return;
    const n = (b.textContent.match(/\((\d+)\)/) || [])[1];
    const what =
      b.dataset.invite === "remind"
        ? `Send a reminder with a new link to ${n} people who haven’t answered?`
        : `Send invites to ${n} people who haven’t been invited yet?`;
    if (!window.confirm(what)) return;
    $("dinvite")
      .querySelectorAll("button")
      .forEach(x => (x.disabled = true));
    $("dashMsg").innerHTML = `<div class="toast">Sending… please keep this page open.</div>`;
    try {
      const r = await api("/api/admin/invite", {
        method: "POST",
        body: JSON.stringify({ scope: b.dataset.invite })
      });
      await reload();
      const done =
        r.mailMode !== "outbox"
          ? `${r.sent} ${r.sent === 1 ? "email" : "emails"} sent.`
          : `${r.sent} ${r.sent === 1 ? "invite is" : "invites are"} ready under “Emails waiting to send”.`;
      notice(
        r.failed.length
          ? `${done} Couldn’t send to ${r.failed.length}: ${r.failed.slice(0, 5).join(", ")}${r.failed.length > 5 ? ` and ${r.failed.length - 5} more` : ""}. They’re under “Emails waiting to send”.`
          : done,
        r.failed.length ? "bad" : "ok"
      );
    } catch (err) {
      await reload();
      $("dashMsg").innerHTML = `<div class="toast bad">${esc(err.message)}</div>`;
    }
  });
  $("dmailBody").addEventListener("click", async e => {
    const b = e.target.closest("[data-sent]");
    if (!b) return;
    b.disabled = true;
    try {
      await api("/api/admin/outbox-sent", {
        method: "POST",
        body: JSON.stringify({ id: b.dataset.sent })
      });
      await reload();
    } catch (err) {
      b.disabled = false;
    }
  });
  reload();
  timer = setInterval(() => {
    if (!$("view-dash").hidden && !document.querySelector(".ddetail textarea:focus")) reload();
  }, 60000);
  return { reload };
})();
