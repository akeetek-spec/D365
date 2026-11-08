/* IT Director dashboard: four totals, people list, one-click drill-down, IT-only evidence. */
"use strict";
(() => {
  const { M, L, esc, money, nameOf, $, fmtDate, api, fillImages } = window.LC;
  const licName = L.licName;
  const D = { data: null, filter: "all", open: new Set() };
  const can = role => (D.data.viewer.roles || []).includes(role);
  const isDirector = () => can("itdirector"),
    canSupport = () => can("itdirector") || can("itadmin");

  function outcome(r) {
    if (r.status === "none") return { text: "Not answered", cls: "muted" };
    if (r.freed) return { text: `Free up licence · saves ${money(r.plan.cur.cost)}/mo`, cls: "ok" };
    const buy = [
      r.plan.newBase && `${licName(r.plan.newBase)} base`,
      ...r.plan.newAttach.map(a => `${licName(a)} attach`)
    ].filter(Boolean);
    if (buy.length)
      return { text: `Buy ${buy.join(" + ")} · +${money(r.plan.delta)}/mo`, cls: "warn" };
    if (r.roleActions.length) return { text: "Role change, no licence to buy", cls: "info" };
    return { text: r.plan.delta < 0 ? `Saves ${money(-r.plan.delta)}/mo` : "No change", cls: "" };
  }
  const shots = list =>
    (list || []).length
      ? `<div class="thumbs">${list.map(s => `<a data-shotlink target="_blank" rel="noopener"><img data-shot="${esc(s.id)}" alt="${esc(s.name)}"></a>`).join("")}</div>`
      : "";
  function evidenceBlock(r) {
    const e = D.data.evidence[r.u.id] || { pages: "", shots: [] },
      id = esc(r.u.id),
      n = (e.shots || []).length + (e.pages ? 1 : 0);
    if (!canSupport())
      return n
        ? `<details class="evidence"><summary>IT evidence (${n})</summary>${e.pages ? `<pre class="pages">${esc(e.pages)}</pre>` : ""}${shots(e.shots)}</details>`
        : "";
    return `<details class="evidence"${n ? " open" : ""}><summary>IT evidence${n ? ` (${n})` : ""} <span class="muted">only IT sees this</span></summary>
    <textarea data-evpages="${id}" maxlength="3000" placeholder="Pages they use, one per line" aria-label="Pages they use">${esc(e.pages || "")}</textarea>
    <div class="thumbs">${(e.shots || []).map((x, i) => `<figure><a data-shotlink target="_blank" rel="noopener"><img data-shot="${esc(x.id)}" alt="${esc(x.name)}"></a><figcaption><button class="linkbtn" data-evdel="${id}" data-i="${i}">Remove</button></figcaption></figure>`).join("")}</div>
    <div class="acts"><button class="btn ghost" data-evsave="${id}">Save</button>${(e.shots || []).length < 10 ? `<label class="btn ghost filebtn">Add screenshot<input type="file" data-evshot="${id}" accept="image/png,image/jpeg,image/webp" multiple hidden></label>` : ""}<span class="muted" data-evmsg="${id}"></span></div></details>`;
  }
  // Invites: when the person was invited, and a button to (re)send their personal link.
  function inviteBlock(u) {
    const when = u.invitedAt
      ? `Invited ${esc(fmtDate(u.invitedAt))}${u.inviteCount > 1 ? ` (${u.inviteCount} emails)` : ""}.`
      : "Not invited yet.";
    if (!canSupport()) return `<p class="muted">${when}</p>`;
    return `<p class="muted">${when}</p><button class="btn ghost" data-reissue="${esc(u.id)}">${u.invitedAt ? "Send a new link" : "Send invite"}</button>${u.invitedAt ? '<p class="muted">Earlier links stop working.</p>' : ""}`;
  }
  function renderInvites(rows) {
    const box = $("dinvite");
    if (!isDirector()) {
      box.hidden = true;
      return;
    }
    const waiting = rows.filter(r => r.status === "none"),
      fresh = waiting.filter(r => !r.u.invitedAt);
    const how =
      D.data.mailMode === "outbox"
        ? "Emails wait under “Emails waiting to send” for IT to send."
        : "Emails are sent straight away.";
    box.hidden = false;
    box.innerHTML = `<div><b>Invites</b><div class="muted">${fresh.length} not invited yet · ${waiting.length} haven’t answered · ${how}</div></div>
    <div class="acts"><button class="btn" data-invite="new" ${fresh.length ? "" : "disabled"}>Invite everyone not invited yet (${fresh.length})</button><button class="btn ghost" data-invite="remind" ${waiting.length ? "" : "disabled"}>Remind everyone who hasn’t answered (${waiting.length})</button></div>`;
  }
  function detail(r) {
    const today = r.plan.cur.label;
    const causes = Object.keys(r.u.gapRoles || {}).length
      ? `<h4>Roles causing it${r.u.reportRefreshed ? ` <span class="muted" style="text-transform:none;letter-spacing:0">(D365 report ${esc(fmtDate(r.u.reportRefreshed))})</span>` : ""}</h4><ul class="causes">${Object.entries(
          r.u.gapRoles
        )
          .map(([k, rs]) => `<li><b>${esc(licName(k))}:</b> ${esc(rs.join(", "))}</li>`)
          .join("")}</ul>`
      : "";
    if (r.status === "none")
      return `<div class="ddetail"><div class="dcol"><h4>Today</h4>${esc(today)}<h4>Report says missing</h4>${esc(L.missingFor(r.u).map(licName).join(", ") || "Nothing")}${causes}</div><div class="dcol"><h4>Invite</h4>${inviteBlock(r.u)}</div>${evidenceBlock(r)}</div>`;
    const x = r.x;
    const said = r.freed
      ? "<p>Doesn't use D365.</p>"
      : Object.entries(x.apps || {})
          .map(
            ([
              k,
              v
            ]) => `<div class="said"><b>${esc(licName(k))}:</b> ${esc(L.LEVEL_NAME[v.level] || "not answered")}${(x.extraApps || []).includes(k) ? ' <span class="muted">(additional)</span>' : ""}
      ${v.level && v.level !== "none" ? `<div class="muted">${esc([...(v.mods || []).map(m => (L.MOD[m] ? L.MOD[m].name : m)), ...L.TASKS.filter(t => (v.tasks || []).includes(t[1])).map(t => t[0]), v.other].filter(Boolean).join(" · "))}</div>` : ""}</div>`
          )
          .join("") +
        (x.extraNames
          ? `<div class="said"><b>Also asked for:</b><pre class="pages">${esc(x.extraNames)}</pre></div>`
          : "") +
        shots(x.extraShots) +
        (x.device ? `<div class="said"><b>Shared login:</b> ${esc(x.device)}</div>` : "") +
        (x.note ? `<div class="said"><b>Note:</b> ${esc(x.note)}</div>` : "") +
        (x.wrong ? `<div class="said"><b>Details to correct:</b> ${esc(x.wrong)}</div>` : "");
    const needs =
      r.rec && r.rec.kind === "FULL" ? L.planLabel(r.rec, r.plan) : r.rec ? M.licLabel(r.rec) : "";
    const flags = [
      ...r.roleActions.map(a => `<div class="rolefix">${esc(a)}</div>`),
      ...r.checks.map(([k, w]) => `<div class="levelwarn">${esc(licName(k))}: ${esc(w)}</div>`)
    ].join("");
    const last = (r.r.history || []).slice(-1)[0],
      id = esc(r.u.id);
    const acts = !isDirector()
      ? `<p class="muted">${esc((L.STAGE[r.status] || [r.status])[0])}</p>`
      : ["submitted", "manager_approved"].includes(r.status)
        ? `<textarea data-cm="${id}" placeholder="Comment (needed to send back or decline)" maxlength="1000"></textarea><div class="btnrow"><button class="btn" data-act="approve" data-id="${id}">Approve</button><button class="btn ghost" data-act="return" data-id="${id}">Send back</button><button class="btn ghost" data-act="reject" data-id="${id}">Decline</button></div>`
        : r.status === "approved"
          ? `<button class="btn" data-act="provision" data-id="${id}">Mark licence as set up</button>`
          : `<p class="muted">${esc((L.STAGE[r.status] || [r.status])[0])}${last ? " · " + esc(fmtDate(last.at)) : ""}${last && last.comment ? `: “${esc(last.comment)}”` : ""}</p>`;
    return `<div class="ddetail">
    <div class="dcol"><h4>They said</h4>${said || '<span class="muted">Nothing to add</span>'}</div>
    <div class="dcol"><h4>Licence</h4><div>${esc(today)} → <b>${esc(r.freed ? "None" : needs)}</b></div><div class="muted">${r.plan.delta === 0 ? "No change in cost" : (r.plan.delta > 0 ? "Adds " : "Saves ") + money(Math.abs(r.plan.delta)) + " a month"}</div>${flags}${causes}</div>
    <div class="dcol"><h4>Decision</h4>${acts}</div>
    ${evidenceBlock(r)}</div>`;
  }
  function render() {
    const P = D.data.prices,
      ORDER = {
        submitted: 0,
        manager_approved: 0,
        approved: 1,
        returned: 2,
        none: 3,
        provisioned: 4,
        rejected: 5
      };
    const rows = D.data.roster
      .map(u => L.analyse(u, D.data.responses[u.id], P))
      .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
    const total = rows.length,
      answered = rows.filter(r => r.status !== "none").length,
      live = rows.filter(r => !["none", "rejected"].includes(r.status));
    const review = rows.filter(r => ["submitted", "manager_approved"].includes(r.status)).length;
    const buy = {};
    let add = 0,
      save = 0;
    live.forEach(r => {
      if (r.plan.newBase)
        buy[licName(r.plan.newBase) + " base"] = (buy[licName(r.plan.newBase) + " base"] || 0) + 1;
      r.plan.newAttach.forEach(a => {
        const k = licName(a) + " attach";
        buy[k] = (buy[k] || 0) + 1;
      });
      if (r.plan.delta > 0) add += r.plan.delta;
      else save -= r.plan.delta;
    });
    const roles = live.filter(r => r.roleActions.length).length;
    const tile = (n, l, sub, cls) =>
      `<div class="tile ${cls}"><b>${n}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
    $("dcards").innerHTML = `<div class="tiles">
    ${tile(`${answered}<i>/${total}</i>`, "answered", `<span class="bar"><i style="width:${Math.round((answered / Math.max(total, 1)) * 100)}%"></i></span>`, "t-teal")}
    ${tile(review, "to review", review ? "Waiting for a decision" : "All caught up", review ? "t-red" : "t-teal")}
    ${tile(
      money(add),
      "a month to buy",
      Object.entries(buy)
        .map(([k, n]) => `${n} × ${esc(k)}`)
        .join(" · ") || "Nothing yet",
      "t-green"
    )}
    ${tile(roles, "role changes", save ? `Saves ${money(save)}/mo` : "Instead of buying", "t-sky")}</div>`;
    renderInvites(rows);
    const FL = [
      ["review", "To review", review],
      ["none", "Not answered", total - answered],
      [
        "done",
        "Decided",
        rows.filter(r => ["approved", "provisioned", "rejected", "returned"].includes(r.status))
          .length
      ],
      ["all", "Everyone", total]
    ];
    $("dfilters").innerHTML = FL.map(
      ([k, l, n]) =>
        `<button class="chip ${D.filter === k ? "acc" : ""}" data-f="${k}" aria-pressed="${D.filter === k}">${l} · ${n}</button>`
    ).join("");
    const show = rows.filter(
      r =>
        D.filter === "all" ||
        (D.filter === "review" && ["submitted", "manager_approved"].includes(r.status)) ||
        (D.filter === "none" && r.status === "none") ||
        (D.filter === "done" &&
          ["approved", "provisioned", "rejected", "returned"].includes(r.status))
    );
    $("dlist").innerHTML =
      show
        .map(r => {
          const [sl, sc] = L.STAGE[r.status] || [r.status, ""],
            open = D.open.has(r.u.id),
            o = outcome(r);
          return `<div class="drow"><button data-open="${esc(r.u.id)}" aria-expanded="${open}"><span class="who"><b>${esc(nameOf(r.u.email))}</b><span>${esc(r.u.jobTitle || r.u.email)}</span></span><span class="req"><span class="oc ${o.cls}">${esc(o.text)}</span></span><span class="end"><span class="chip ${sc}">${esc(sl)}</span><span aria-hidden="true">${open ? "▴" : "▾"}</span></span></button>${open ? detail(r) : ""}</div>`;
        })
        .join("") || '<div class="muted" style="padding:14px">Nobody in this view.</div>';
    fillImages($("dlist"));
    const usage = {};
    live.forEach(r =>
      r.mods.forEach(m => {
        (usage[m] = usage[m] || []).push(nameOf(r.u.email));
      })
    );
    $("dmods").innerHTML = Object.keys(usage).length
      ? `<ul class="modusage">${Object.entries(usage)
          .sort((a, b) => b[1].length - a[1].length)
          .map(
            ([m, ps]) =>
              `<li><span><b>${esc(L.MOD[m] ? L.MOD[m].name : m)}</b> <span class="muted">${esc(L.MOD[m] && L.MOD[m].app ? licName(L.MOD[m].app) : "")}</span></span><span title="${esc(ps.join(", "))}">${ps.length}</span></li>`
          )
          .join("")}</ul>`
      : '<p class="muted">No answers yet.</p>';
    $("dmodsSum").textContent = `D365 areas in use (${Object.keys(usage).length})`;
    $("dmail").hidden = !D.data.outbox.length;
    $("dmailSum").textContent = `Emails waiting to send (${D.data.outbox.length})`;
    $("dmailBody").innerHTML = D.data.outbox
      .map(
        m =>
          `<div class="dmail"><b>${esc(m.subject)}</b> <span class="muted">to ${esc(m.to)}</span>${m.error ? `<div class="toast bad">Couldn’t be sent automatically: ${esc(m.error)}</div>` : ""}<pre>${esc(m.body)}</pre><button class="btn ghost" data-sent="${esc(m.id)}">Mark as sent</button></div>`
      )
      .join("");
    const R = D.data.viewer.roles || [];
    $("signout").hidden = false;
    $("signout").innerHTML =
      `${esc(D.data.viewer.name || "")} · ${R.includes("itdirector") ? "IT Director" : R.includes("itadmin") ? "IT team" : "Read-only"} · <a href="/.auth/logout">Sign out</a>`;
  }
  async function load() {
    try {
      D.data = await api("/api/admin/data");
      $("dashMsg").innerHTML = "";
      render();
    } catch (e) {
      $("dashMsg").innerHTML = `<div class="toast bad">${esc(e.message)}</div>`;
    }
  }
  function notice(text, kind = "ok") {
    $("dashMsg").innerHTML = `<div class="toast ${kind}">${esc(text)}</div>`;
    if (D.data && D.data.mailMode === "outbox" && D.data.outbox.length) $("dmail").open = true;
  }
  const say = e => {
    $("dashMsg").innerHTML = `<div class="toast bad">${esc(e.message)}</div>`;
  };
  $("view-dash").addEventListener("change", async e => {
    const t = e.target;
    if (!t.dataset.evshot) return;
    const id = t.dataset.evshot,
      msg = document.querySelector(`[data-evmsg="${id}"]`);
    msg.textContent = "Uploading…";
    for (const f of [...t.files].slice(0, 10)) {
      if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 10 * 1024 * 1024) {
        msg.textContent = `${f.name}: use a PNG or JPG under 10 MB.`;
        continue;
      }
      try {
        const r = await api(
          `/api/admin/upload?userId=${encodeURIComponent(id)}&name=${encodeURIComponent(f.name.slice(0, 80))}`,
          { method: "POST", json: false, headers: { "Content-Type": f.type }, body: f }
        );
        D.data.evidence[id] = r.evidence;
      } catch (err) {
        msg.textContent = `${f.name}: ${err.message}`;
      }
    }
    render();
  });
  $("view-dash").addEventListener("click", async e => {
    const f = e.target.closest("[data-f]");
    if (f) {
      D.filter = f.dataset.f;
      return render();
    }
    const o = e.target.closest("[data-open]");
    if (o) {
      const id = o.dataset.open;
      D.open.has(id) ? D.open.delete(id) : D.open.add(id);
      return render();
    }
    const es = e.target.closest("[data-evsave]");
    if (es) {
      const id = es.dataset.evsave;
      try {
        const r = await api("/api/admin/evidence", {
          method: "POST",
          body: JSON.stringify({
            userId: id,
            pages: document.querySelector(`[data-evpages="${id}"]`).value
          })
        });
        D.data.evidence[id] = r.evidence;
        document.querySelector(`[data-evmsg="${id}"]`).textContent = "Saved";
      } catch (err) {
        say(err);
      }
      return;
    }
    const ed = e.target.closest("[data-evdel]");
    if (ed) {
      try {
        const r = await api("/api/admin/evidence", {
          method: "POST",
          body: JSON.stringify({ userId: ed.dataset.evdel, removeShot: +ed.dataset.i })
        });
        D.data.evidence[ed.dataset.evdel] = r.evidence;
        render();
      } catch (err) {
        say(err);
      }
      return;
    }
    const inv = e.target.closest("[data-invite]");
    if (inv && !inv.disabled) {
      const n = (inv.textContent.match(/\((\d+)\)/) || [])[1];
      if (
        !window.confirm(
          inv.dataset.invite === "remind"
            ? `Send a reminder with a new link to ${n} people who haven’t answered?`
            : `Send invites to ${n} people who haven’t been invited yet?`
        )
      )
        return;
      $("dinvite")
        .querySelectorAll("button")
        .forEach(x => (x.disabled = true));
      $("dashMsg").innerHTML = '<div class="toast">Sending… please keep this page open.</div>';
      try {
        const r = await api("/api/admin/invite", {
          method: "POST",
          body: JSON.stringify({ scope: inv.dataset.invite })
        });
        await load();
        const done =
          r.mailMode === "outbox"
            ? `${r.sent} ${r.sent === 1 ? "invite is" : "invites are"} ready under “Emails waiting to send”.`
            : `${r.sent} ${r.sent === 1 ? "email" : "emails"} sent.`;
        notice(
          r.failed.length
            ? `${done} Couldn’t send to ${r.failed.length}: ${r.failed.slice(0, 5).join(", ")}${r.failed.length > 5 ? ` and ${r.failed.length - 5} more` : ""}. They’re under “Emails waiting to send”.`
            : done,
          r.failed.length ? "bad" : "ok"
        );
      } catch (err) {
        await load();
        say(err);
      }
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
        await load();
        notice(
          D.data.mailMode === "outbox"
            ? "Link created. Send it from “Emails waiting to send”."
            : "Link sent."
        );
      } catch (err) {
        say(err);
        ri.disabled = false;
      }
      return;
    }
    const s = e.target.closest("[data-sent]");
    if (s) {
      try {
        await api("/api/admin/outbox-sent", {
          method: "POST",
          body: JSON.stringify({ id: s.dataset.sent })
        });
        await load();
      } catch (err) {
        say(err);
      }
      return;
    }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const id = b.dataset.id,
      act = b.dataset.act,
      cm = document.querySelector(`[data-cm="${id}"]`),
      comment = cm ? cm.value.trim() : "";
    if (["return", "reject"].includes(act) && !comment) {
      cm.focus();
      cm.placeholder = "Add a short comment for the person first";
      return;
    }
    b.disabled = true;
    try {
      await api("/api/admin/approval", {
        method: "POST",
        body: JSON.stringify({ userId: id, action: act, comment })
      });
      await load();
    } catch (err) {
      say(err);
      b.disabled = false;
    }
  });
  setInterval(() => {
    if (!$("view-dash").hidden && !document.querySelector("#view-dash textarea:focus")) load();
  }, 60000);
  load();
})();
