/* Picks the view from the link: #t=… user form, #m=… supervisor approvals, /admin IT dashboard. */
(async () => {
  const $ = id => document.getElementById(id);
  const show = id =>
    ["form", "mgr", "dash", "none"].forEach(v => {
      $("view-" + v).hidden = v !== id;
    });
  const load = src =>
    new Promise((ok, bad) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = bad;
      document.body.appendChild(s);
    });
  const has = k => new RegExp(`(?:^#|&)${k}=`).test(location.hash);
  const kept = k => {
    try {
      return sessionStorage.getItem(k);
    } catch (e) {
      return null;
    }
  };
  const path = location.pathname.replace(/\/+$/, "");
  if (path === "/admin") {
    const me = await fetch("/.auth/me")
      .then(r => r.json())
      .catch(() => ({}));
    if (!me.clientPrincipal) {
      location.href = "/.auth/login/aad?post_login_redirect_uri=/admin";
      return;
    }
    $("tagline").textContent = "Answers received, licences to procure, and approvals.";
    show("dash");
    await load("/dashboard.js");
    return;
  }
  if (has("m") || (!has("t") && kept("lc-mtoken") && !kept("lc-token"))) {
    $("tagline").textContent = "Approve the D365 licence requests from your team.";
    show("mgr");
    await load("/manager.js");
    return;
  }
  if (has("t") || kept("lc-token")) {
    show("form");
    await load("/form.js");
    return;
  }
  show("none");
})();
