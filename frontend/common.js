/* Small helpers shared by the form and the dashboard. */
"use strict";
window.LC = (() => {
  const M = window.LicenceModel,
    L = window.LicenceLevels;
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
  const $ = id => document.getElementById(id);
  const fmtDate = iso =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      ...opts,
      headers: {
        ...(opts.json !== false ? { "Content-Type": "application/json" } : {}),
        ...(opts.headers || {})
      }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
      throw Object.assign(new Error(body.message || "Something went wrong. Try again."), {
        status: res.status
      });
    return body;
  }
  // Screenshots are private: fetch them with the right credentials, then show them from memory.
  const urls = {};
  async function imageUrl(id, headers) {
    if (urls[id]) return urls[id];
    const res = await fetch(`/api/file/${id}`, {
      credentials: "same-origin",
      headers: headers || {}
    });
    if (!res.ok) return "";
    return (urls[id] = URL.createObjectURL(await res.blob()));
  }
  function fillImages(root, headers) {
    root.querySelectorAll("img[data-shot]").forEach(async img => {
      const u = await imageUrl(img.dataset.shot, headers);
      if (u) {
        img.src = u;
        const a = img.closest("a[data-shotlink]");
        if (a) a.href = u;
      }
    });
  }
  return { M, L, esc, money, nameOf, $, fmtDate, api, fillImages };
})();
