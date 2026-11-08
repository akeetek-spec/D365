/* Picks the view from the address: /admin → IT dashboard (signed in), #t=… → the person's form. */
(async () => {
  const $ = id => document.getElementById(id);
  const show = id =>
    ["form", "dash", "none"].forEach(v => {
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
  if (location.pathname.replace(/\/+$/, "") === "/admin") {
    const me = await fetch("/.auth/me")
      .then(r => r.json())
      .catch(() => ({}));
    if (!me.clientPrincipal) {
      location.href = "/.auth/login/aad?post_login_redirect_uri=/admin";
      return;
    }
    $("tagline").textContent = "Answers received, licences to buy, role changes and decisions.";
    show("dash");
    await load("/dashboard.js");
    return;
  }
  let has = /(?:^#|&)t=/.test(location.hash);
  try {
    has = has || !!sessionStorage.getItem("lc-token");
  } catch (e) {}
  if (has) {
    show("form");
    await load("/form.js");
    return;
  }
  show("none");
})();
