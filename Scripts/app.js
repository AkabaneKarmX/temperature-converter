/*
 * TEMP·CONV — instrument wiring.
 * Pure math lives in Scripts/convert.js (TempCore). This file only:
 * parses untrusted input through TempCore, renders with textContent,
 * persists validated state, and never trusts a byte it reads back.
 */
(function () {
  'use strict';

  if (!window.TempCore) {
    var err0 = document.getElementById('err-line');
    if (err0) err0.textContent = 'CORE FAILED TO LOAD — hard reload required';
    return;
  }
  var T = window.TempCore;

  /* ── shorthands ─────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }

  var elInput = $('input-temp');
  var elFrom = $('unit-from');
  var elTo = $('unit-to');
  var elSwap = $('swap-units');
  var elSign = $('sign-flip');
  var elHeroVal = $('hero-value');
  var elHeroUnit = $('hero-unit');
  var elTgtTag = $('tgt-tag');
  var elSrcTag = $('src-tag');
  var elHeroCopy = $('copy-hero');
  var elRowVal = {
    C: $('row-val-C'), F: $('row-val-F'), K: $('row-val-K'), R: $('row-val-R')
  };
  var elRows = Array.prototype.slice.call(document.querySelectorAll('.row'));
  var elHint = $('hint-line');
  var elErr = $('err-line');
  var elLive = $('live-region');
  var elPrec = $('precision-scale');
  var elPresets = Array.prototype.slice.call(document.querySelectorAll('.preset'));
  var elRecentList = $('recent-list');
  var elRecentClear = $('recent-clear');
  var elTheme = $('theme-toggle');
  var elShare = $('btn-share');
  var elUpdate = $('btn-update');

  var SYM = { C: '°C', F: '°F', K: 'K', R: '°R' };
  var NAME = { C: 'Celsius', F: 'Fahrenheit', K: 'Kelvin', R: 'Rankine' };
  var PRESET_REFS = [0, 37, 100, -273.15];
  var STORE = { units: 'tc.units', prec: 'tc.prec', theme: 'tc.theme', recent: 'tc.recent' };

  /* ── storage (validated read, guarded write) ────────────────── */
  function lsRead(key, validator) {
    try {
      var raw = localStorage.getItem(key);
      if (typeof raw !== 'string' || raw.length > 4096) return null;
      var val = JSON.parse(raw);
      var out = validator(val);
      return out === null ? null : out;
    } catch (e) { return null; }
  }

  function lsWrite(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { /* quota/private mode — state stays session-only */ }
  }

  function validUnits(v) {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return null;
    var f = v.from, t = v.to;
    if (T.SCALES.indexOf(f) === -1 || T.SCALES.indexOf(t) === -1 || f === t) return null;
    return { from: f, to: t };
  }

  function validPrec(v) {
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4) return v;
    return null;
  }

  function validTheme(v) {
    return (v === 'dark' || v === 'light') ? v : null;
  }

  function validRecent(v) {
    if (!Array.isArray(v)) return null;
    var out = [];
    for (var i = 0; i < v.length && out.length < 5; i++) {
      var e = v[i];
      if (e === null || typeof e !== 'object') continue;
      if (typeof e.v !== 'number' || !Number.isFinite(e.v)) continue;
      if (T.SCALES.indexOf(e.from) === -1 || T.SCALES.indexOf(e.to) === -1) continue;
      out.push({ v: e.v, from: e.from, to: e.to, ts: typeof e.ts === 'number' ? e.ts : Date.now() });
    }
    return out.length ? out : null;
  }

  /* ── state ──────────────────────────────────────────────────── */
  var state = {
    units: lsRead(STORE.units, validUnits),
    prec: lsRead(STORE.prec, validPrec),
    recent: lsRead(STORE.recent, validRecent),
    lastValid: null,
    urlTouched: false
  };

  /* shareable URL state — every field re-validated before use */
  (function readUrl() {
    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { params = null; }
    if (!params) return;
    var f = params.get('from'), t = params.get('to'), p = params.get('prec');
    if (typeof f === 'string' && T.SCALES.indexOf(f) !== -1) {
      state.units = {
        from: f,
        to: (typeof t === 'string' && T.SCALES.indexOf(t) !== -1 && t !== f) ? t : (f === 'C' ? 'F' : 'C')
      };
    } else if (typeof t === 'string' && T.SCALES.indexOf(t) !== -1) {
      state.units = { from: 'C', to: t };
    }
    if (typeof p === 'string' && p.length <= 1 && /^[0-4]$/.test(p)) {
      state.prec = Number(p);
    }
    var v = params.get('v');
    if (typeof v === 'string' && v.length <= 24) {
      var pre = T.parseInput(v);
      if (pre.ok && !pre.empty && !state.units) state.units = { from: 'C', to: 'F' };
      if (pre.ok && !pre.empty) elInput.value = String(pre.value);
    }
  })();

  if (!state.units) state.units = { from: 'C', to: 'F' };
  if (state.prec === null) state.prec = 2;
  if (!state.recent) state.recent = [];

  elFrom.value = state.units.from;
  elTo.value = state.units.to;
  elPrec.value = String(state.prec);

  /* ── theme (system default + manual override) ───────────────── */
  (function initTheme() {
    var stored = lsRead(STORE.theme, validTheme);
    if (stored) document.documentElement.setAttribute('data-theme', stored);
    if (elTheme) {
      syncThemeLabel();
      elTheme.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme');
        var sysLight = false;
        try { sysLight = window.matchMedia('(prefers-color-scheme: light)').matches; } catch (e) {}
        var visualNow = cur || (sysLight ? 'light' : 'dark');
        var next = visualNow === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        lsWrite(STORE.theme, next);
        syncThemeLabel();
        syncThemeMeta();
        buzz();
      });
    }
  })();

  function syncThemeLabel() {
    var cur = document.documentElement.getAttribute('data-theme');
    var sysLight = false;
    try { sysLight = window.matchMedia('(prefers-color-scheme: light)').matches; } catch (e) {}
    var visualNow = cur || (sysLight ? 'light' : 'dark');
    elTheme.setAttribute('aria-label', 'Switch theme, currently ' + visualNow);
  }

  function syncThemeMeta() {
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    var cur = document.documentElement.getAttribute('data-theme');
    var sysLight = false;
    try { sysLight = window.matchMedia('(prefers-color-scheme: light)').matches; } catch (e) {}
    var c = cur === 'light' || (!cur && sysLight) ? '#F4F4F0' : '#0A0A0A';
    metas.forEach(function (m) { m.setAttribute('content', c); });
  }

  /* ── haptics ────────────────────────────────────────────────── */
  function buzz() {
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
  }

  /* ── hero color: cold → neutral → hot, shaped so midrange stays phosphor ── */
  function hexToRgb(hx) {
    var h = hx.trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mix(a, b, k) {
    var r = Math.round(a[0] + (b[0] - a[0]) * k);
    var g = Math.round(a[1] + (b[1] - a[1]) * k);
    var bb = Math.round(a[2] + (b[2] - a[2]) * k);
    return 'rgb(' + r + ',' + g + ',' + bb + ')';
  }
  var pal = null;
  function palette(theme) {
    var cs = getComputedStyle(document.documentElement);
    pal = {
      cold: hexToRgb(cs.getPropertyValue('--cold')),
      hot: hexToRgb(cs.getPropertyValue('--hot')),
      fg: hexToRgb(cs.getPropertyValue('--fg'))
    };
    return pal;
  }
  function setHeroTempColor(c) {
    if (!pal) palette();
    var t = Math.max(0, Math.min(1, (c + 40) / 100));
    var s = t * t * (3 - 2 * t); // smoothstep: room temp stays near-neutral
    elHeroVal.style.color = s < 0.5
      ? mix(pal.cold, pal.fg, s / 0.5)
      : mix(pal.fg, pal.hot, (s - 0.5) / 0.5);
  }
  function resetHeroColor() {
    elHeroVal.style.color = '';
  }

  /* ── hint bands (what does this feel like) ──────────────────── */
  function feelPhrase(c) {
    if (c < -100) return 'CRYO ZONE — lab-grade cold, no natural habitat';
    if (c < -40) return 'EXTREME COLD — exposed skin fails within minutes';
    if (c < -18) return 'HARD FREEZE — standing water goes solid';
    if (c < 0) return 'FREEZING — ice season, pipes at risk';
    if (c < 15) return 'COLD — layers on';
    if (c < 24) return 'MILD — comfortable, nothing squeaks';
    if (c < 30) return 'WARM — short-sleeve zone';
    if (c < 37) return 'HOT — shade and water';
    if (c < 45) return 'FEVER HEAT — dangerous for exertion';
    if (c < 60) return 'SCALDING — brief contact burns';
    return 'BOILING CLASS — touch equals injury';
  }

  var MSG = {
    format: 'NON-NUMERIC INPUT — digits only, e.g. -40 · 36,6 · 1e3',
    magnitude: 'MAGNITUDE — beyond float range',
    absolute: function (min) {
      return 'ABSOLUTE FLOOR — nothing below ' + min + ' in this scale';
    },
    range: 'OUT OF RANGE — instrument caps at ±1e12 °C'
  };

  /* ── url sync (shareable state) ─────────────────────────────── */
  function syncUrl() {
    if (!state.lastValid) return;
    var s = state.lastValid;
    var q = new URLSearchParams();
    q.set('v', String(s.v));
    q.set('from', s.from);
    q.set('to', state.units.to);
    q.set('prec', String(state.prec));
    try {
      history.replaceState(null, '', location.pathname + '?' + q.toString());
    } catch (e) { /* sandboxed contexts */ }
  }

  /* ── render ─────────────────────────────────────────────────── */
  function clearRender() {
    elHeroVal.textContent = '——';
    resetHeroColor();
    T.SCALES.forEach(function (u) { elRowVal[u].textContent = '——'; });
    elHint.textContent = 'AWAITING INPUT';
    elErr.textContent = '';
    elInput.removeAttribute('aria-invalid');
    elLive.textContent = '';
  }

  function renderError(err) {
    var msg;
    if (err.reason === 'absolute') {
      var minInFrom = T.fmt(T.fromC(T.ABS_ZERO_C, state.units.from), 2) + ' ' + SYM[state.units.from];
      msg = MSG.absolute(minInFrom);
    } else {
      msg = MSG[err.reason] || 'INVALID INPUT';
    }
    elErr.textContent = msg;
    elInput.setAttribute('aria-invalid', 'true');
    elHeroVal.textContent = '——';
    resetHeroColor();
    T.SCALES.forEach(function (u) { elRowVal[u].textContent = '——'; });
    elHint.textContent = 'AWAITING VALID INPUT';
    elLive.textContent = msg;
  }

  function renderValid(parsed, vres) {
    var fromU = state.units.from;
    var toU = state.units.to;
    var prec = state.prec;
    var heroOut = T.convert(parsed.value, fromU, toU);

    state.lastValid = { v: parsed.value, from: fromU, to: toU, c: vres.c };

    elInput.removeAttribute('aria-invalid');
    elErr.textContent = '';

    elHeroVal.textContent = T.fmt(heroOut, prec);
    setHeroTempColor(vres.c);
    elHeroUnit.textContent = SYM[toU];
    elTgtTag.textContent = SYM[toU];

    T.SCALES.forEach(function (u) {
      la(u);
    });
    function la(u) {
      var row = elRows.filter(function (n) { return n.getAttribute('data-unit') === u; })[0];
      if (!row) return;
      var hidden = u === toU;
      if (hidden) {
        row.setAttribute('data-hidden', 'true');
        row.style.display = 'none';
      } else {
        row.removeAttribute('data-hidden');
        row.style.display = '';
      }
      elRowVal[u].textContent = T.fmt(T.convert(parsed.value, fromU, u), prec);
    }

    elHint.textContent = feelPhrase(vres.c);

    var parts = [];
    T.SCALES.forEach(function (u) {
      if (u !== fromU) parts.push(T.fmt(T.convert(parsed.value, fromU, u), prec) + ' ' + SYM[u]);
    });
    elLive.textContent = parsed.value + ' ' + SYM[fromU] + ' equals ' + parts.join(', ') + '. ' + feelPhrase(vres.c);
  }

  /* ── compute pipeline ───────────────────────────────────────── */
  function compute() {
    var parsed = T.parseInput(elInput.value, T.MAX_INPUT_CHARS);
    if (parsed.empty) { clearRender(); return; }
    if (!parsed.ok) { renderError(parsed); return; }
    var vres = T.validate(parsed.value, state.units.from);
    if (!vres.ok) { renderError(vres); return; }
    renderValid(parsed, vres);
    scheduleUrl();
    scheduleHistory();
  }

  var urlTimer = 0, hisTimer = 0;
  function scheduleUrl() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(syncUrl, 400);
  }
  function scheduleHistory() {
    clearTimeout(hisTimer);
    hisTimer = setTimeout(commitHistory, 900);
  }

  /* ── history ────────────────────────────────────────────────── */
  function commitHistory() {
    var s = state.lastValid;
    if (!s) return;
    var last = state.recent[0];
    if (last && last.v === s.v && last.from === s.from && last.to === s.to) {
      last.ts = Date.now();
    } else {
      state.recent.unshift({ v: s.v, from: s.from, to: s.to, ts: Date.now() });
      state.recent = state.recent.slice(0, 5);
    }
    lsWrite(STORE.recent, state.recent);
    renderRecent();
  }

  function cleanNum(v) { return String(v); }

  function renderRecent() {
    elRecentList.textContent = '';
    if (!state.recent.length) {
      var li = document.createElement('li');
      li.className = 'recent-empty';
      li.textContent = 'NO LOGGED CONVERSIONS';
      elRecentList.appendChild(li);
      return;
    }
    state.recent.forEach(function (e) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'recent-item';
      var out = T.convert(e.v, e.from, e.to);
      b.setAttribute('aria-label', 'Restore conversion ' + String(e.v) + ' ' + NAME[e.from] + ' to ' + NAME[e.to]);
      var sp1 = document.createElement('span');
      sp1.className = 'r-pair';
      sp1.textContent = T.fmt(e.v, 2) + ' ' + SYM[e.from] + ' → ' + T.fmt(out, 2) + ' ' + SYM[e.to];
      var sp2 = document.createElement('span');
      sp2.className = 'r-time';
      var dt = new Date(e.ts);
      sp2.textContent = ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2);
      b.appendChild(sp1); b.appendChild(sp2);
      b.addEventListener('click', function () {
        state.units = { from: e.from, to: e.to };
        elFrom.value = e.from;
        elTo.value = e.to;
        elInput.value = cleanNum(e.v);
        syncUnitTags();
        compute();
        buzz();
      });
      li.appendChild(b);
      elRecentList.appendChild(li);
    });
  }

  elRecentClear.addEventListener('click', function () {
    state.recent = [];
    lsWrite(STORE.recent, state.recent);
    renderRecent();
    buzz();
  });

  /* ── tags + presets ─────────────────────────────────────────── */
  function syncUnitTags() {
    elSrcTag.textContent = SYM[state.units.from];
    elTgtTag.textContent = SYM[state.units.to];
    elHeroUnit.textContent = SYM[state.units.to];
    elPresets.forEach(function (p) {
      var refc = Number(p.getAttribute('data-refc'));
      var inFrom = T.fromC(refc, state.units.from);
      var val = T.fmt(inFrom, 2).replace(/(\.\d*?)0+(?=\D|$)/, '$1').replace(/\.$/, '');
      p.querySelector('.preset-val').textContent = val + ' ' + SYM[state.units.from];
    });
  }

  elFrom.addEventListener('change', function () {
    state.units.from = elFrom.value;
    lsWrite(STORE.units, state.units);
    syncUnitTags();
    compute();
  });

  elTo.addEventListener('change', function () {
    state.units.to = elTo.value;
    lsWrite(STORE.units, state.units);
    syncUnitTags();
    compute();
  });

  elSwap.addEventListener('click', function () {
    var s = state.lastValid;
    var fromNow = state.units.from;
    var toNow = state.units.to;
    state.units = { from: toNow, to: fromNow };
    elFrom.value = toNow;
    elTo.value = fromNow;
    if (s) elInput.value = cleanNum(T.convert(s.v, s.from, toNow));
    lsWrite(STORE.units, state.units);
    syncUnitTags();
    compute();
    buzz();
  });

  elSign.addEventListener('click', function () {
    var parsed = T.parseInput(elInput.value, T.MAX_INPUT_CHARS);
    if (parsed.ok && !parsed.empty) {
      elInput.value = cleanNum(-parsed.value);
      compute();
      buzz();
    }
  });

  elPresets.forEach(function (p) {
    p.addEventListener('click', function () {
      var refc = Number(p.getAttribute('data-refc'));
      var inFrom = T.fromC(refc, state.units.from);
      elInput.value = T.fmt(inFrom, 4).replace(/(\.\d*?)0+(?=\D|$)/, '$1').replace(/\.$/, '');
      compute();
      buzz();
    });
  });

  elPrec.addEventListener('change', function () {
    var p = Number(elPrec.value);
    state.prec = validPrec(p) || 2;
    lsWrite(STORE.prec, state.prec);
    compute();
  });

  /* ── input keyboard ─────────────────────────────────────────── */
  elInput.addEventListener('input', compute);
  elInput.addEventListener('focus', function () { try { elInput.select(); } catch (e) {} });

  elInput.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      elInput.value = '';
      compute();
      return;
    }
    var step = 0;
    if (ev.key === 'ArrowUp') step = ev.shiftKey ? 10 : (ev.altKey ? 0.1 : 1);
    if (ev.key === 'ArrowDown') step = ev.shiftKey ? -10 : (ev.altKey ? -0.1 : -1);
    if (step !== 0) {
      ev.preventDefault();
      var parsed = T.parseInput(elInput.value, T.MAX_INPUT_CHARS);
      var base = 0;
      if (parsed.ok && !parsed.empty) base = parsed.value;
      elInput.value = cleanNum(base + step);
      compute();
    }
  });

  /* ── copy (clipboard + legacy fallback) ─────────────────────── */
  function flashCopied(btn) {
    var prev = btn.textContent;
    btn.textContent = 'COPIED';
    buzz();
    setTimeout(function () { btn.textContent = prev; }, 1200);
  }

  function copyText(text, btn) {
    var done = function () { flashCopied(btn); };
    var fail = function () {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var okc = document.execCommand('copy');
        document.body.removeChild(ta);
        if (okc) done();
        else btn.textContent = 'BLOCKED';
      } catch (e) {
        btn.textContent = 'BLOCKED';
        setTimeout(function () { btn.textContent = 'COPY'; }, 1200);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else {
      fail();
    }
  }

  elHeroCopy.addEventListener('click', function () {
    var s = state.lastValid;
    if (s) copyText(T.fmt(T.convert(s.v, s.from, state.units.to), state.prec) + ' ' + SYM[state.units.to], elHeroCopy);
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
    btn.addEventListener('click', function () {
      var s = state.lastValid;
      if (s) copyText(T.fmt(T.convert(s.v, s.from, btn.getAttribute('data-copy')), state.prec) + ' ' + SYM[btn.getAttribute('data-copy')], btn);
    });
  });

  elShare.addEventListener('click', function () {
    syncUrl();
    copyText(location.href, elShare);
    flashCopied(elShare);
  });

  /* ── service worker + update path ───────────────────────────── */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      if (reg.waiting) elUpdate.classList.remove('hidden');
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            elUpdate.classList.remove('hidden');
          }
        });
      });
      elUpdate.addEventListener('click', function () {
        if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
      });
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        location.reload();
      });
    }).catch(function () { /* offline file:// context */ });
  }

  /* ── boot ───────────────────────────────────────────────────── */
  syncUnitTags();
  renderRecent();
  compute();
})();
