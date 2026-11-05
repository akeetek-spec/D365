(() => {
  "use strict";
  const M = window.LicenceModel;
  const $ = id => document.getElementById(id);
  const esc = s =>
    String(s ?? "").replace(
      /[&<>"]/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
    );
  const money = n => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
  const lvl = k => {
    const L = M.LIC[k] || M.LIC.NONE;
    return `<span class="chip lvl r${L.rank}">${esc(L.short)}</span>`;
  };
  const FREQ = {
    daily: "every day",
    weekly: "most weeks",
    rarely: "a few times a year",
    never: "not at all"
  };
  const ACT = {
    submit: "Sent answers",
    manager_approve: "Manager approved",
    manager_return: "Manager sent back",
    director_approve: "IT Director approved",
    director_reject: "IT Director rejected",
    director_provision: "Licence set up"
  };
  const ORDER = [
    "submitted",
    "returned",
    "manager_approved",
    "approved",
    "provisioned",
    "rejected"
  ];

  function readToken() {
    if (window.LC_MTOKEN) return window.LC_MTOKEN; // set by a hosting shell (demo)
    const m = location.hash.match(/(?:^#|&)m=([A-Za-z0-9_-]{40,64})/);
    if (m) {
      try {
        sessionStorage.setItem("lc-mtoken", m[1]);
      } catch (e) {}
      history.replaceState(null, "", location.pathname);
      return m[1];
    }
    try {
      return sessionStorage.getItem("lc-mtoken");
    } catch (e) {
      return null;
    }
  }
  let token = readToken();
  let data = { team: [], prices: M.DEFAULT_PRICES };
  let filter = "submitted";
  const drafts = {}; // comment drafts survive re-render

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        "x-manager-token": token || "",
        ...(opts.headers || {})
      }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.message || "Request failed"), body);
    return body;
  }
  const showState = (t, p) => {
    $("mstate").hidden = false;
    $("mstate").innerHTML = `<h2>${esc(t)}</h2>${p ? `<p class="muted">${esc(p)}</p>` : ""}`;
  };
  const name = email => {
    const l = String(email).split("@")[0];
    return l
      .split(/[._]/)
      .map(w => (w[0] ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  };

  function timeline(h) {
    if (!h || !h.length) return "";
    return `<ul class="timeline">${h.map(x => `<li><b>${esc(ACT[x.action] || x.action)}</b> · ${esc(x.by)} · <span class="muted">${esc(new Date(x.at).toLocaleString())}</span>${x.comment ? `<div>"${esc(x.comment)}"</div>` : ""}</li>`).join("")}</ul>`;
  }

  function card({ user, request: r }) {
    const P = data.prices;
    const rec = r.answers ? M.recommend(r.answers, P) : null;
    const cur = M.currentInfo(user, P);
    const delta = rec ? rec.cost - cur.cost : 0;
    const S = M.STAGES[r.status] || {};
    const a = r.answers || {};
    const open = r.status === "submitted";
    return `<article class="mgrcard" data-u="${esc(user.id)}">
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline">
      <h3>${esc(name(user.email))} <span class="muted" style="font:400 13px var(--sans)">${esc(user.email)}</span></h3>
      <span class="chip ${S.cls || ""}">${esc(S.label || r.status)}</span>
    </div>
    <div class="detailgrid">
      <div><div class="eyebrow">Licence requested</div><div class="em" style="font-size:16px">${esc(r.rec ? r.rec.label : "—")}</div>
        <div class="muted">${rec ? money(rec.cost) + " a month" : ""}${rec ? ` · today ${esc(cur.label)} (${money(cur.cost)})` : ""}</div>
        ${rec ? `<div class="${delta > 0 ? "pos" : delta < 0 ? "neg" : ""}">${delta === 0 ? "No change in cost" : (delta > 0 ? "Costs " : "Saves ") + money(Math.abs(delta)) + " a month"}</div>` : ""}</div>
      <div><div class="eyebrow">How they use D365</div><div>Uses it ${esc(FREQ[a.freq] || "—")}</div><div>Shared login: ${a.shared === "yes" ? "yes (" + esc(a.device || "?") + ")" : "no"}</div>
        ${a.notes ? `<div style="margin-top:4px"><b>Their note:</b> ${esc(a.notes)}</div>` : ""}</div>
      <div><div class="eyebrow">Roles they work in</div>${rec && rec.picks && rec.picks.length ? `<ul style="margin:4px 0 0;padding-left:18px">${rec.picks.map(p => `<li>${esc(p.role.name)} ${lvl(p.lic)}</li>`).join("")}</ul>` : `<div class="muted">None picked</div>`}
        ${a.duties && a.duties.length ? `<div class="muted">${a.duties.length} dut${a.duties.length === 1 ? "y" : "ies"} ticked</div>` : ""}</div>
    </div>
    ${
      open
        ? `<label class="hint" for="c-${esc(user.id)}">Comment (needed if you send it back)</label>
      <textarea id="c-${esc(user.id)}" data-c="${esc(user.id)}" maxlength="1000" placeholder="For example: she doesn't post vendor invoices any more, please untick that role.">${esc(drafts[user.id] || "")}</textarea>
      <div class="actions"><button class="btn sm" data-act="approve">Approve</button><button class="btn sm ghost" data-act="return">Send back to ${esc(name(user.email).split(" ")[0])}</button><span class="msg"></span></div>`
        : ""
    }
    <details><summary class="muted">History</summary>${timeline(r.history)}</details>
  </article>`;
  }

  function render() {
    const t = data.team;
    if (!t.length) {
      showState(
        "Nothing waiting for you",
        "When someone in your team sends their answers, they'll appear here and we'll email you."
      );
      $("team").innerHTML = "";
      $("mfilters").hidden = true;
      return;
    }
    $("mstate").hidden = true;
    $("mfilters").hidden = false;
    const n = k => t.filter(x => k === "all" || x.request.status === k).length;
    if (filter !== "all" && !n(filter)) filter = "all";
    $("mfilters").innerHTML = [
      ["submitted", "Waiting for you"],
      ["all", "Everyone"]
    ]
      .concat(ORDER.filter(k => k !== "submitted" && n(k)).map(k => [k, M.STAGES[k].label]))
      .map(
        ([k, l]) =>
          `<button data-f="${k}" aria-pressed="${filter === k}">${esc(l)} · ${n(k)}</button>`
      )
      .join("");
    const vis = t
      .filter(x => filter === "all" || x.request.status === filter)
      .sort((a, b) => ORDER.indexOf(a.request.status) - ORDER.indexOf(b.request.status));
    $("team").innerHTML = vis.length
      ? vis.map(card).join("")
      : `<p class="muted">Nobody here. You're all caught up.</p>`;
  }

  $("mfilters").addEventListener("click", e => {
    const b = e.target.closest("[data-f]");
    if (b) {
      filter = b.dataset.f;
      render();
    }
  });
  $("team").addEventListener("input", e => {
    if (e.target.dataset.c) drafts[e.target.dataset.c] = e.target.value;
  });
  $("team").addEventListener("click", async e => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const cardEl = b.closest("[data-u]"),
      id = cardEl.dataset.u,
      msg = cardEl.querySelector(".msg");
    const comment = (drafts[id] || "").trim();
    if (b.dataset.act === "return" && !comment) {
      msg.innerHTML = `<span class="toast bad">Add a comment so they know what to change.</span>`;
      cardEl.querySelector("textarea").focus();
      return;
    }
    cardEl.querySelectorAll("button").forEach(x => (x.disabled = true));
    try {
      await api("/api/manager/decision", {
        method: "POST",
        body: JSON.stringify({ userId: id, action: b.dataset.act, comment })
      });
      delete drafts[id];
      await load();
    } catch (err) {
      msg.innerHTML = `<span class="toast bad">${esc(err.message)}</span>`;
      cardEl.querySelectorAll("button").forEach(x => (x.disabled = false));
    }
  });

  async function load() {
    if (!token) {
      showState(
        "Open this page from your email",
        "Approval links are personal. Use the link in the email we sent you."
      );
      return;
    }
    try {
      data = await api("/api/manager");
      $("mgrWho").textContent = `Signed in by link as ${data.manager.email}`;
      render();
    } catch (e) {
      showState("We couldn't open your approvals", e.message);
    }
  }
  window.LC_MANAGER = {
    restart(t) {
      token = t;
      filter = "submitted";
      load();
    }
  };
  load();
})();
