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

  window.AlixConnect = {
    __ready: true,
    key: KEY,
    init: function (opts) { if (opts && opts.key) KEY = opts.key; },
    track: function (type, meta) { enqueue(String(type || "custom"), meta || {}); },
    identify: function (info) { enqueue("identify", info || {}); },
    consent: consent,
    chat: {
      open: function () {
        // Placeholder — the visible chat widget iframe ships in Phase 12.
        enqueue("chat_open_request");
      },
    },
    _flush: flush,
  };
})();
