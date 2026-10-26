/* Shared behaviour: icons, navigation shell, preferences, audio, dialogs, tabs, toast */
(function () {
  'use strict';

  /* ── Icons (stroke, rounded) ─────────────────────────────────── */
  var ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h4.5V14h4v5.5h4.5V10"/>',
    path: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H14a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h5.5"/>',
    review: '<rect x="3" y="6" width="14" height="14" rx="3"/><path d="M7 3h11a3 3 0 0 1 3 3v11"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    volume: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
    flame: '<path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.5 1.5 1.2 2 2 2-.5-3.500 0-6.500 1-8.500z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
    micoff: '<path d="M3 3l18 18"/><path d="M9 9V6a3 3 0 0 1 5.5-1.7M15 10v1a3 3 0 0 1-4.5 2.6M5.5 11.5a6.5 6.5 0 0 0 10.8 4.8M12 18v3"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    share: '<path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    download: '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="m8.500 14-1.500 7 5-3 5 3-1.500-7"/>',
    book: '<path d="M4 5.500A2.500 2.500 0 0 1 6.500 3H20v15H6.500A2.500 2.500 0 0 0 4 20.500z"/><path d="M4 20.500A2.500 2.500 0 0 0 6.500 23H20"/>',
    pencil: '<path d="M4 20l1-4.500L16.500 4a2.100 2.100 0 0 1 3 3L8 18.500z"/><path d="M14.500 6l3 3"/>',
    replay: '<path d="M4 4v6h6"/><path d="M5.500 14.500A8 8 0 1 0 6 7l-2 3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.500M12 7.800v.1"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    heart: '<path d="M12 20s-8-4.800-8-11a4.500 4.500 0 0 1 8-2.700A4.500 4.500 0 0 1 20 9c0 6.200-8 11-8 11z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.500 2"/>'
  };
  function icons(root) {
    (root || document).querySelectorAll('i[data-i]').forEach(function (el) {
      var d = ICONS[el.dataset.i];
      if (!d) return;
      el.classList.add('ic');
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<svg viewBox="0 0 24 24">' + d + '</svg>';
      el.removeAttribute('data-i');
    });
  }

  /* ── Preferences (applies on every screen) ───────────────────── */
  var DEFAULTS = { pinyin: 'always', hv: true, tone: true, trad: false, buttons: 2, minutes: 10, voice: 'f', mic: 'hold' };
  function loadPrefs() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('od.prefs') || '{}')); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  }
  var prefs = loadPrefs();
  function applyPrefs() {
    var b = document.body;
    b.classList.toggle('no-hv', !prefs.hv);
    b.classList.toggle('no-tone', !prefs.tone);
    b.classList.toggle('no-py', prefs.pinyin === 'hide');
  }
  function setPref(k, v) {
    prefs[k] = v;
    try { localStorage.setItem('od.prefs', JSON.stringify(prefs)); } catch (e) { /* storage unavailable */ }
    applyPrefs();
  }

  /* ── Audio (browser TTS stands in for the pre-rendered TTS files) ── */
  function speak(text, rate) {
    if (!('speechSynthesis' in window) || !text) return;
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = rate || 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  /* ── Toast ───────────────────────────────────────────────────── */
  var toastTimer;
  function toast(msg) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 2800);
  }

  /* ── Navigation shell ────────────────────────────────────────── */
  var NAV = [
    { id: 'today', href: 'today.html', icon: 'home', label: 'Hôm nay' },
    { id: 'path', href: 'path.html', icon: 'path', label: 'Lộ trình' },
    { id: 'review', href: 'review.html', icon: 'review', label: 'Ôn tập' },
    { id: 'dictionary', href: 'dictionary.html', icon: 'search', label: 'Tra từ' },
    { id: 'profile', href: 'profile.html', icon: 'user', label: 'Tôi' }
  ];
  function buildNav() {
    var page = document.body.dataset.nav;
    if (!page) return;
    document.body.classList.add('has-nav');
    var nav = document.createElement('nav');
    nav.className = 'nav';
    nav.setAttribute('aria-label', 'Điều hướng chính');
    var html = '<a class="brand" href="index.html" aria-label="Trang tổng quan"><span class="logo" lang="zh">学</span><span class="word">Tiếng Trung</span></a>';
    NAV.forEach(function (n) {
      html += '<a href="' + n.href + '"' + (n.id === page ? ' aria-current="page"' : '') + '><i data-i="' + n.icon + '"></i><span>' + n.label + '</span></a>';
    });
    html += '<a class="nav-extra" href="pinyin.html"' + (page === 'pinyin' ? ' aria-current="page"' : '') + '><i data-i="volume"></i><span>Bảng pinyin</span></a>';
    html += '<div class="nav-foot"><a href="sources.html"><i data-i="info"></i><span>Nguồn dữ liệu</span></a></div>';
    nav.innerHTML = html;
    document.body.insertBefore(nav, document.body.firstChild);
  }

  /* ── Delegated interactions ──────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-say],[data-open],[data-close],[data-toast],[data-copy],[data-print]');
    if (!t) return;
    if (t.dataset.say) { speak(t.dataset.say, parseFloat(t.dataset.rate) || undefined); }
    if (t.dataset.open) { var d = document.querySelector(t.dataset.open); if (d && d.showModal) d.showModal(); }
    if (t.hasAttribute('data-close')) { var dl = t.closest('dialog'); if (dl) dl.close(); }
    if (t.dataset.toast) toast(t.dataset.toast);
    if (t.dataset.print !== undefined) window.print();
    if (t.dataset.copy) {
      var txt = t.dataset.copy === 'url' ? location.href : t.dataset.copy;
      var done = function () { toast('Đã sao chép link'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, done); else done();
    }
  });
  document.addEventListener('click', function (e) {
    var dlg = e.target;
    if (dlg.tagName === 'DIALOG' && dlg.open) dlg.close();
  });

  function tabs(root) {
    var btns = root.querySelectorAll('[data-tab]');
    function show(id) {
      btns.forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === id)); });
      document.querySelectorAll('[data-panel]').forEach(function (p) {
        if (root.dataset.group && p.dataset.group !== root.dataset.group) return;
        p.hidden = p.dataset.panel !== id;
      });
      root.dispatchEvent(new CustomEvent('tabchange', { detail: id }));
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.tab); }); });
    return show;
  }

  function switches(root) {
    (root || document).querySelectorAll('.switch[data-pref]').forEach(function (s) {
      s.setAttribute('aria-checked', String(!!prefs[s.dataset.pref]));
      s.addEventListener('click', function () {
        var on = s.getAttribute('aria-checked') !== 'true';
        s.setAttribute('aria-checked', String(on));
        setPref(s.dataset.pref, on);
      });
    });
    (root || document).querySelectorAll('.seg[data-pref]').forEach(function (g) {
      var key = g.dataset.pref;
      g.querySelectorAll('button').forEach(function (b) {
        var val = isNaN(b.dataset.v) ? b.dataset.v : Number(b.dataset.v);
        b.setAttribute('aria-pressed', String(prefs[key] === val));
        b.addEventListener('click', function () {
          setPref(key, val);
          g.querySelectorAll('button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        });
      });
    });
  }

  /* Tone contour paths (viewBox 0 0 60 40), shared by pinyin + speaking */
  var CONTOUR = {
    1: 'M6 10H54', 2: 'M6 32 54 8', 3: 'M6 14Q22 42 54 8', 4: 'M6 6 54 34', 5: 'M24 22h12'
  };

  window.OD = {
    icons: icons, prefs: function () { return prefs; }, setPref: setPref, speak: speak, toast: toast,
    tabs: tabs, switches: switches, CONTOUR: CONTOUR
  };

  document.addEventListener('DOMContentLoaded', function () {
    buildNav();
    applyPrefs();
    icons();
    switches();
    document.querySelectorAll('dialog [data-close]').forEach(function () { /* delegated above */ });
  });
})();
