/* ALIX CONNECT widget — cookieless tracker + live chat.
   Embed: <script async src="https://alixwork.de/connect.js" data-key="YOUR_API_KEY"></script> */
(function () {
  if (window.__alixConnectLoaded) return;
  var scriptEl = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    for (var i = s.length - 1; i >= 0; i--) if ((s[i].src || '').indexOf('connect.js') !== -1) return s[i];
    return null;
  })();
  var API_KEY = scriptEl && scriptEl.getAttribute('data-key');
  if (!API_KEY) { console.warn('[alix-connect] missing data-key'); return; }
  window.__alixConnectLoaded = true;

  var BACKEND = 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1';
  var TRACK = BACKEND + '/ac-track';
  var CHAT = BACKEND + '/ac-chat';
  var LS_KEY = 'alix_connect_conv';
  var SESS_KEY = 'alix_connect_sess';

  function uuid() { return 'xxxxxxxxxxxx4xxxyxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); }
  function sess() { var s = null; try { s = sessionStorage.getItem(SESS_KEY); } catch (e) {} if (!s) { s = uuid(); try { sessionStorage.setItem(SESS_KEY, s); } catch (e) {} } return s; }
  function getUTM() { var p = new URLSearchParams(location.search); var o = {}; ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) { var v = p.get(k); if (v) o[k] = v; }); return o; }
  function baseEvent(type) { return Object.assign({ event_type: type, page_url: location.href, page_title: document.title, referrer: document.referrer, language: navigator.language, screen_size: screen.width + 'x' + screen.height, session_hash: sess() }, getUTM()); }
  function send(events) {
    var payload = JSON.stringify({ api_key: API_KEY, events: events });
    try { navigator.sendBeacon(TRACK, new Blob([payload], { type: 'application/json' })); }
    catch (e) { fetch(TRACK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function () {}); }
  }

  send([baseEvent('pageview')]);
  var startedAt = Date.now();
  window.addEventListener('beforeunload', function () { send([Object.assign(baseEvent('pagetime'), { duration_ms: Date.now() - startedAt })]); });

  var cfg = null, conv = null, sinceIso = null;
  try { conv = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}

  fetch(CHAT + '?action=config&api_key=' + encodeURIComponent(API_KEY))
    .then(function (r) { return r.json(); })
    .then(function (c) { if (!c || c.error || c.chat_enabled === false) return; cfg = c; mount(); })
    .catch(function () {});

  function h(tag, style, text) { var e = document.createElement(tag); if (style) e.setAttribute('style', style); if (text != null) e.textContent = text; return e; }

  function mount() {
    var primary = cfg.primary_color || '#0a0a0a';
    var accent = cfg.secondary_color || '#c9a24b';
    var pos = cfg.widget_position === 'bottom-left' ? 'left:20px;' : 'right:20px;';

    var launcher = h('button', 'position:fixed;bottom:20px;' + pos + 'z-index:2147483000;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:' + primary + ';color:' + accent + ';box-shadow:0 8px 24px rgba(0,0,0,0.25);font-size:26px;');
    launcher.innerHTML = '&#128172;';
    launcher.setAttribute('aria-label', 'Chat öffnen');

    var panel = h('div', 'position:fixed;bottom:90px;' + pos + 'z-index:2147483000;width:340px;max-width:calc(100vw - 40px);height:480px;max-height:calc(100vh - 120px);background:#fff;color:#111;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,0.3);display:none;flex-direction:column;overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;');
    var header = h('div', 'background:' + primary + ';color:' + accent + ';padding:14px 16px;font-weight:600;display:flex;align-items:center;gap:10px;');
    header.textContent = cfg.project_name || 'Live Chat';
    var closeBtn = h('button', 'margin-left:auto;background:transparent;color:' + accent + ';border:none;font-size:20px;cursor:pointer;', '×');
    closeBtn.onclick = function () { panel.style.display = 'none'; };
    header.appendChild(closeBtn);
    var body = h('div', 'flex:1;padding:12px;overflow-y:auto;background:#f7f7f8;display:flex;flex-direction:column;gap:8px;');
    var footer = h('div', 'border-top:1px solid #eee;padding:8px;background:#fff;');

    panel.appendChild(header); panel.appendChild(body); panel.appendChild(footer);
    document.body.appendChild(launcher); document.body.appendChild(panel);

    function bubble(txt, mine) {
      var b = h('div', 'max-width:80%;padding:8px 12px;border-radius:12px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word;' + (mine ? 'align-self:flex-end;background:' + primary + ';color:#fff;' : 'align-self:flex-start;background:#fff;color:#111;border:1px solid #e5e7eb;'), txt);
      body.appendChild(b); body.scrollTop = body.scrollHeight;
    }

    function renderStart() {
      footer.innerHTML = '';
      if (cfg.welcome_message) bubble(cfg.welcome_message, false);
      var form = h('form', 'display:flex;flex-direction:column;gap:6px;');
      var name = h('input'); name.placeholder = 'Ihr Name'; name.required = true; name.setAttribute('style', 'padding:8px;border:1px solid #ddd;border-radius:8px;');
      var email = h('input'); email.type = 'email'; email.placeholder = 'E-Mail'; email.required = true; email.setAttribute('style', 'padding:8px;border:1px solid #ddd;border-radius:8px;');
      var msg = h('textarea'); msg.placeholder = 'Ihre Nachricht'; msg.required = true; msg.rows = 3; msg.setAttribute('style', 'padding:8px;border:1px solid #ddd;border-radius:8px;resize:none;');
      var submit = h('button', 'padding:10px;background:' + primary + ';color:' + accent + ';border:none;border-radius:8px;font-weight:600;cursor:pointer;', 'Chat starten');
      submit.type = 'submit';
      form.appendChild(name); form.appendChild(email); form.appendChild(msg); form.appendChild(submit);
      if (cfg.privacy_url) { var p = h('a', 'font-size:11px;color:#888;text-decoration:underline;margin-top:4px;', 'Datenschutz'); p.href = cfg.privacy_url; p.target = '_blank'; form.appendChild(p); }
      form.onsubmit = function (ev) {
        ev.preventDefault(); submit.disabled = true; submit.textContent = '...';
        fetch(CHAT + '?action=start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: API_KEY, name: name.value, email: email.value, initial_message: msg.value, page_url: location.href, visitor_hash: sess() }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d.conversation_id) { submit.disabled = false; submit.textContent = 'Chat starten'; return; }
            conv = { id: d.conversation_id, name: name.value };
            try { localStorage.setItem(LS_KEY, JSON.stringify(conv)); } catch (e) {}
            body.innerHTML = ''; bubble(msg.value, true); renderChat();
          }).catch(function () { submit.disabled = false; submit.textContent = 'Erneut versuchen'; });
      };
      footer.appendChild(form);
    }

    function renderChat() {
      footer.innerHTML = '';
      var row = h('div', 'display:flex;gap:6px;');
      var input = h('input'); input.placeholder = 'Nachricht schreiben...'; input.setAttribute('style', 'flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;');
      var btn = h('button', 'padding:8px 12px;background:' + primary + ';color:' + accent + ';border:none;border-radius:8px;font-weight:600;cursor:pointer;', 'Senden');
      row.appendChild(input); row.appendChild(btn); footer.appendChild(row);
      function sendMsg() {
        var t = input.value.trim(); if (!t) return; input.value = ''; bubble(t, true);
        fetch(CHAT + '?action=send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: API_KEY, conversation_id: conv.id, message: t, name: conv.name, visitor_hash: sess() }) }).catch(function () {});
      }
      btn.onclick = sendMsg;
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); sendMsg(); } });
      poll();
    }

    var poller = null;
    function poll() {
      if (poller) return;
      var seenIds = {};
      function tick() {
        if (!conv) return;
        fetch(CHAT + '?action=poll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: API_KEY, conversation_id: conv.id, since: sinceIso }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            (d.messages || []).forEach(function (m) {
              if (seenIds[m.id]) return; seenIds[m.id] = true;
              sinceIso = m.created_at;
              if (m.direction === 'outbound') bubble(m.body, false);
            });
          }).catch(function () {});
      }
      poller = setInterval(tick, 4000); tick();
    }

    launcher.onclick = function () {
      panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
      if (panel.style.display === 'flex' && !body.hasChildNodes()) {
        if (conv && conv.id) { renderChat(); } else { renderStart(); }
      }
    };
  }
})();
