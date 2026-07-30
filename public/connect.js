/*!
 * ALIX CONNECT Tracker (connect.js)
 * (c) Alix Work — Self-hosted, cookieless per default.
 * Einbindung:
 *   <script async src="https://alixwork.de/connect.js" data-key="pub_XXXX"></script>
 * API im Browser: window.AlixConnect
 */
(function () {
  if (window.AlixConnect && window.AlixConnect.__ready) return;

  var scriptEl =
    document.currentScript ||
    document.querySelector('script[data-key][src*="connect.js"]');
  var KEY = (scriptEl && scriptEl.getAttribute("data-key")) || null;
  var ENDPOINT =
    (scriptEl && scriptEl.getAttribute("data-endpoint")) ||
    "https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ac-track";
  var COOKIE_NAME = "_ac_vid";
  var CONSENT_KEY = "_ac_consent"; // localStorage

  if (
    navigator.doNotTrack === "1" ||
    window.doNotTrack === "1" ||
    navigator.msDoNotTrack === "1"
  ) {
    // Respect Do-Not-Track. No events sent.
    window.AlixConnect = { __ready: true, dnt: true, track: noop, identify: noop, consent: noop, chat: { open: noop } };
    return;
  }

  function noop() {}
  function now() { return Date.now(); }
  function safe(str, max) { try { return String(str || "").slice(0, max || 512); } catch (_) { return ""; } }

  function getCookie(n) {
    var v = document.cookie.match("(^|;)\\s*" + n + "\\s*=\\s*([^;]+)");
    return v ? decodeURIComponent(v.pop()) : null;
  }
  function setCookie(n, v, days) {
    var d = new Date();
    d.setTime(now() + days * 864e5);
    document.cookie =
      n + "=" + encodeURIComponent(v) + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
  }

  function utm() {
    var q = new URLSearchParams(location.search);
    var o = {};
    ["source", "medium", "campaign", "term", "content"].forEach(function (k) {
      var v = q.get("utm_" + k);
      if (v) o[k] = v;
    });
    return o;
  }

  var queue = [];
  var flushing = false;
  var lastFlush = 0;
  var scrollMax = 0;
  var scrollFlags = { 25: false, 50: false, 75: false, 100: false };
  var startedAt = now();

  function consent(state) {
    try { localStorage.setItem(CONSENT_KEY, state); } catch (_) {}
    if (state === "granted") {
      var vid = getCookie(COOKIE_NAME);
      if (!vid) {
        vid =
          "v_" +
          (crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + now());
        setCookie(COOKIE_NAME, vid, 365);
      }
    } else if (state === "denied") {
      setCookie(COOKIE_NAME, "", -1);
    }
  }

  function buildEvent(type, extra) {
    var vid = null;
    try {
      if (localStorage.getItem(CONSENT_KEY) === "granted") vid = getCookie(COOKIE_NAME);
    } catch (_) {}
    var ev = {
      type: type,
      url: safe(location.href, 2048),
      title: safe(document.title, 512),
      referrer: safe(document.referrer, 1024),
      language: safe(navigator.language, 8),
      screen: (screen.width || 0) + "x" + (screen.height || 0),
      utm: utm(),
      vid: vid,
    };
    if (extra && typeof extra === "object") ev.meta = extra;
    return ev;
  }

  function enqueue(type, extra) {
    if (!KEY) return;
    queue.push(buildEvent(type, extra));
    if (queue.length >= 8) flush();
    else scheduleFlush();
  }

  var flushTimer = null;
  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; flush(); }, 2500);
  }

  function flush(useBeacon) {
    if (flushing || !queue.length) return;
    var batch = queue.splice(0, queue.length);
    lastFlush = now();
    var payload = JSON.stringify({ key: KEY, events: batch });
    if (useBeacon && navigator.sendBeacon) {
      try {
        var blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(ENDPOINT, blob);
        return;
      } catch (_) { /* fallthrough */ }
    }
    flushing = true;
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      credentials: "omit",
    })
      .catch(function () { /* silent */ })
      .finally(function () { flushing = false; });
  }

  // Auto pageview
  var lastPath = location.pathname + location.search;
  function firePageview() {
    startedAt = now();
    scrollFlags = { 25: false, 50: false, 75: false, 100: false };
    scrollMax = 0;
    enqueue("pageview");
  }
  firePageview();

  // SPA support: patch pushState/replaceState
  ["pushState", "replaceState"].forEach(function (m) {
    var orig = history[m];
    history[m] = function () {
      var r = orig.apply(this, arguments);
      setTimeout(function () {
        var p = location.pathname + location.search;
        if (p !== lastPath) {
          lastPath = p;
          firePageview();
        }
      }, 0);
      return r;
    };
  });
  window.addEventListener("popstate", function () {
    var p = location.pathname + location.search;
    if (p !== lastPath) { lastPath = p; firePageview(); }
  });

  // Scroll depth
  function onScroll() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    var docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight;
    if (docH <= 0) return;
    var pct = Math.min(100, Math.round((scrollTop / docH) * 100));
    if (pct <= scrollMax) return;
    scrollMax = pct;
    [25, 50, 75, 100].forEach(function (t) {
      if (pct >= t && !scrollFlags[t]) {
        scrollFlags[t] = true;
        enqueue("scroll_depth", { pct: t });
      }
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  // Click heatmap: capture x/y as % of viewport + target info
  document.addEventListener("click", function (e) {
    try {
      var t = (e.target && e.target.closest)
        ? (e.target.closest("a,button,[role=button],input,textarea,select") || e.target)
        : e.target;
      var vw = window.innerWidth || 1;
      var vh = window.innerHeight || 1;
      var xPct = Math.max(0, Math.min(100, Math.round((e.clientX / vw) * 100)));
      var yPct = Math.max(0, Math.min(100, Math.round((e.clientY / vh) * 100)));
      var tag = t && t.tagName ? String(t.tagName).toLowerCase() : "";
      var text = safe((t && (t.innerText || t.value || t.alt)) || "", 120);
      var href = (t && t.href) ? safe(t.href, 512) : null;
      enqueue("click", { x_pct: xPct, y_pct: yPct, tag: tag, text: text, href: href, vw: vw, vh: vh });
    } catch (_) {}
  }, { passive: true, capture: true });

  // Heartbeat every 60s while tab visible, so "online now" stays fresh
  setInterval(function () {
    if (document.visibilityState === "visible") enqueue("heartbeat");
  }, 60_000);

  // Session end on tab hide
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      enqueue("session_end", { duration_ms: now() - startedAt });
      flush(true);
    }
  });
  window.addEventListener("pagehide", function () {
    enqueue("session_end", { duration_ms: now() - startedAt });
    flush(true);
  });

  // ---- Experiment assignment (Phase 16) ----
  var expCache = {}; // name -> variant
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return Math.abs(h); }
  function pickVariant(name, variants) {
    var vid = null;
    try { vid = getCookie(COOKIE_NAME); } catch (_) {}
    var seed = (vid || (navigator.userAgent + "|" + name)) + "|" + name;
    var bucket = hashStr(seed) % 100;
    var acc = 0;
    for (var i = 0; i < variants.length; i++) {
      acc += Number(variants[i].weight || 0);
      if (bucket < acc) return variants[i].key;
    }
    return variants[0] ? variants[0].key : "A";
  }

  window.AlixConnect = {
    __ready: true,
    key: KEY,
    init: function (opts) { if (opts && opts.key) KEY = opts.key; },
    track: function (type, meta) { enqueue(String(type || "custom"), meta || {}); },
    identify: function (info) { enqueue("identify", info || {}); },
    consent: consent,
    experiment: function (name, variants) {
      if (!name || !Array.isArray(variants) || !variants.length) return "A";
      if (expCache[name]) return expCache[name];
      var v = pickVariant(String(name), variants);
      expCache[name] = v;
      enqueue("experiment_exposure", { experiment: String(name), variant: v });
      return v;
    },
    chat: {
      open: function () { enqueue("chat_open_request"); openChat(); },
      close: function () { closeChat(); },
    },
    _flush: flush,
  };

  // ================= Live-Chat-Bubble (Branding pro Domain + Lead-Capture) =================
  var FN_BASE = ENDPOINT.replace(/\/ac-track\/?$/, "");
  var CHAT = FN_BASE + "/ac-chat";
  var LS_CONV = "_ac_conv";
  var cfg = null, conv = null, sinceIso = null, panel = null, launcher = null, bodyEl = null, footerEl = null, poller = null;

  function chatSess() {
    try { return getCookie(COOKIE_NAME) || "anon"; } catch (_) { return "anon"; }
  }
  try { conv = JSON.parse(localStorage.getItem(LS_CONV) || "null"); } catch (_) {}

  function el(tag, style, text) {
    var e = document.createElement(tag);
    if (style) e.setAttribute("style", style);
    if (text != null) e.textContent = text;
    return e;
  }

  function openChat() {
    if (!panel) return;
    panel.style.display = "flex";
    if (!bodyEl.hasChildNodes()) { conv && conv.id ? renderChat() : renderStart(); }
  }
  function closeChat() { if (panel) panel.style.display = "none"; }

  function mountWidget() {
    var primary = cfg.primary_color || "#0a0a0a";
    var accent = cfg.secondary_color || "#c9a24b";
    var pos = cfg.widget_position === "bottom-left" ? "left:20px;" : "right:20px;";

    launcher = el("button", "position:fixed;bottom:20px;" + pos + "z-index:2147483000;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:" + primary + ";color:" + accent + ";box-shadow:0 8px 24px rgba(0,0,0,.25);font-size:26px;line-height:1;");
    launcher.setAttribute("aria-label", "Chat öffnen");
    launcher.innerHTML = "\uD83D\uDCAC";

    panel = el("div", "position:fixed;bottom:90px;" + pos + "z-index:2147483000;width:340px;max-width:calc(100vw - 40px);height:480px;max-height:calc(100vh - 120px);background:#fff;color:#111;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.3);display:none;flex-direction:column;overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;");
    var header = el("div", "background:" + primary + ";color:" + accent + ";padding:14px 16px;font-weight:600;display:flex;align-items:center;gap:10px;");
    header.textContent = cfg.project_name || "Live Chat";
    var closeBtn = el("button", "margin-left:auto;background:transparent;color:" + accent + ";border:none;font-size:20px;cursor:pointer;", "\u00D7");
    closeBtn.onclick = closeChat;
    if (cfg.online === false) header.appendChild(el("div", "margin-left:auto;font-size:11px;background:rgba(255,255,255,.15);color:" + accent + ";padding:2px 8px;border-radius:10px;", "Außerhalb Geschäftszeiten"));
    header.appendChild(closeBtn);
    bodyEl = el("div", "flex:1;padding:12px;overflow-y:auto;background:#f7f7f8;display:flex;flex-direction:column;gap:8px;");
    footerEl = el("div", "border-top:1px solid #eee;padding:8px;background:#fff;");
    panel.appendChild(header); panel.appendChild(bodyEl); panel.appendChild(footerEl);
    document.body.appendChild(launcher); document.body.appendChild(panel);

    launcher.onclick = function () {
      if (panel.style.display === "flex") { closeChat(); return; }
      enqueue("chat_open_request");
      openChat();
    };
  }

  function bubble(txt, mine) {
    var primary = (cfg && cfg.primary_color) || "#0a0a0a";
    var b = el("div", "max-width:80%;padding:8px 12px;border-radius:12px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word;" + (mine ? "align-self:flex-end;background:" + primary + ";color:#fff;" : "align-self:flex-start;background:#fff;color:#111;border:1px solid #e5e7eb;"), txt);
    bodyEl.appendChild(b);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function renderStart() {
    var primary = cfg.primary_color || "#0a0a0a";
    var accent = cfg.secondary_color || "#c9a24b";
    footerEl.innerHTML = "";
    if (cfg.welcome_message) bubble(cfg.welcome_message, false);
    var form = el("form", "display:flex;flex-direction:column;gap:6px;");
    var inp = "padding:8px;border:1px solid #ddd;border-radius:8px;font:inherit;";
    var name = el("input", inp); name.placeholder = "Ihr Name"; name.required = true;
    var email = el("input", inp); email.type = "email"; email.placeholder = "E-Mail"; email.required = true;
    var msg = el("textarea", inp + "resize:none;"); msg.placeholder = "Ihre Nachricht"; msg.required = true; msg.rows = 3;
    var submit = el("button", "padding:10px;background:" + primary + ";color:" + accent + ";border:none;border-radius:8px;font-weight:600;cursor:pointer;", "Chat starten");
    submit.type = "submit";
    form.appendChild(name); form.appendChild(email); form.appendChild(msg); form.appendChild(submit);
    if (cfg.privacy_url) {
      var p = el("a", "font-size:11px;color:#888;text-decoration:underline;margin-top:4px;", "Datenschutz");
      p.href = cfg.privacy_url; p.target = "_blank"; p.rel = "noopener"; form.appendChild(p);
    }
    form.onsubmit = function (ev) {
      ev.preventDefault(); submit.disabled = true; submit.textContent = "…";
      fetch(CHAT + "?action=start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: KEY, name: name.value, email: email.value, initial_message: msg.value, page_url: location.href, visitor_hash: chatSess() }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.conversation_id) { submit.disabled = false; submit.textContent = "Chat starten"; return; }
        conv = { id: d.conversation_id, name: name.value };
        try { localStorage.setItem(LS_CONV, JSON.stringify(conv)); } catch (_) {}
        enqueue("chat_lead", { email: safe(email.value, 160), name: safe(name.value, 120) });
        bodyEl.innerHTML = ""; bubble(msg.value, true); renderChat();
      }).catch(function () { submit.disabled = false; submit.textContent = "Erneut versuchen"; });
    };
    footerEl.appendChild(form);
  }

  function renderChat() {
    var primary = cfg.primary_color || "#0a0a0a";
    var accent = cfg.secondary_color || "#c9a24b";
    footerEl.innerHTML = "";
    var row = el("div", "display:flex;gap:6px;align-items:center;");
    var input = el("input", "flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;font:inherit;");
    input.placeholder = "Nachricht schreiben…";
    var btn = el("button", "padding:8px 12px;background:" + primary + ";color:" + accent + ";border:none;border-radius:8px;font-weight:600;cursor:pointer;", "Senden");
    row.appendChild(input); row.appendChild(btn); footerEl.appendChild(row);
    function sendMsg() {
      var t = input.value.trim(); if (!t) return;
      input.value = ""; bubble(t, true);
      fetch(CHAT + "?action=send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: KEY, conversation_id: conv.id, message: t, name: conv.name, visitor_hash: chatSess() }),
      }).catch(function () {});
    }
    btn.onclick = sendMsg;
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); sendMsg(); } });
    startPolling();
  }

  function startPolling() {
    if (poller) return;
    var seen = {};
    function tick() {
      if (!conv || !conv.id) return;
      fetch(CHAT + "?action=poll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: KEY, conversation_id: conv.id, since: sinceIso }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        (d && d.messages ? d.messages : []).forEach(function (m) {
          if (seen[m.id]) return; seen[m.id] = true;
          sinceIso = m.created_at;
          if (m.direction === "outbound") bubble(m.body, false);
        });
      }).catch(function () {});
    }
    poller = setInterval(tick, 4000); tick();
  }

  if (KEY) {
    fetch(CHAT + "?action=config&api_key=" + encodeURIComponent(KEY))
      .then(function (r) { return r.json(); })
      .then(function (c) {
        if (!c || c.error || c.chat_enabled === false) return;
        cfg = c;
        if (document.body) mountWidget();
        else document.addEventListener("DOMContentLoaded", mountWidget);
      })
      .catch(function () {});
  }
})();

