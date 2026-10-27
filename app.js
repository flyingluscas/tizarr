// UI, remote navigation and Sonarr/Radarr calls. ES2017 only (Tizen 5.0 = Chromium 63).
(function () {
  'use strict';

  var STRINGS = {
    unreachable: 'unreachable',
    badKey: 'invalid API key (check Settings)',
    testing: 'Testing…',
    connected: 'Connected',
    saveInvalid: 'Set up and test at least one server first.',
    searching: 'Searching…',
    noResults: 'No results.',
    movie: 'Movie',
    show: 'Show',
    request: 'Request',
    requesting: 'Requesting…',
    requested: 'Requested ✓',
    inLibrary: 'In library',
    retry: 'Retry: '
  };
  var NAMES = { sonarr: 'Sonarr', radarr: 'Radarr' };
  var CONFIG_KEY = 'tizarr.config';
  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, ESC: 27, BACK: 10009, DONE: 65376, CANCEL: 65385 };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  // ---- config ----
  function emptyServer() { return { url: '', apiKey: '', qualityProfileId: 0, rootFolderPath: '' }; }
  function loadConfig() {
    try {
      var c = JSON.parse(localStorage.getItem(CONFIG_KEY));
      if (c && c.sonarr && c.radarr) return c;
    } catch (e) { /* fall through to empty config */ }
    return { sonarr: emptyServer(), radarr: emptyServer() };
  }
  var config = loadConfig();

  // ---- api ----
  function api(server, method, path, body) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, server.url + path);
      xhr.timeout = 15000;
      xhr.setRequestHeader('X-Api-Key', server.apiKey);
      if (body) xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function () {
        var data = null;
        try { data = JSON.parse(xhr.responseText); } catch (e) { /* non-JSON body */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(xhr.status === 401 ? STRINGS.badKey : Logic.errorMessage(xhr.status, data)));
      };
      xhr.onerror = xhr.ontimeout = function () { reject(new Error(STRINGS.unreachable)); };
      xhr.send(body ? JSON.stringify(body) : null);
    });
  }

  // ---- navigation ----
  var current = null;

  function show(id, focusEl) {
    $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === id); });
    current = id;
    setFocus(focusEl || $('#' + id + ' [data-nav]'));
  }

  function setFocus(e) {
    if (!e) return;
    $$('.focused').forEach(function (f) { f.classList.remove('focused'); });
    e.classList.add('focused');
    e.scrollIntoView({ block: 'nearest' });
  }

  // Move to the nearest focusable in the pressed direction, favouring alignment.
  function move(dir) {
    var items = $$('#' + current + ' [data-nav]').filter(function (e) { return e.offsetParent !== null; });
    var cur = $('.focused');
    if (!cur || items.indexOf(cur) < 0) return setFocus(items[0]);
    var a = cur.getBoundingClientRect();
    var ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    var best = null, bestScore = Infinity;
    items.forEach(function (e) {
      if (e === cur) return;
      var b = e.getBoundingClientRect();
      var dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
      var main = { 37: -dx, 39: dx, 38: -dy, 40: dy }[dir];
      var side = (dir === KEY.LEFT || dir === KEY.RIGHT) ? Math.abs(dy) : Math.abs(dx);
      if (main <= 1) return;
      var score = main + side * 2;
      if (score < bestScore) { bestScore = score; best = e; }
    });
    if (best) setFocus(best);
  }

  function back() {
    if (current === 'details') return show('search', lastCard);
    if (current === 'settings' && Logic.isConfigValid(config)) return show('search');
    if (window.tizen) tizen.application.getCurrentApplication().exit();
  }

  // Leaving a text field: Enter in the browser, Done/Cancel on the Tizen keyboard.
  function finishTyping(input, submit) {
    input.blur();
    if (submit) input.dispatchEvent(new Event('submit-input'));
  }

  document.addEventListener('keydown', function (e) {
    var focused = $('.focused');
    var typing = document.activeElement && document.activeElement.tagName === 'INPUT';
    var k = e.keyCode;
    if (k === KEY.DONE || k === KEY.CANCEL) {
      if (typing) finishTyping(document.activeElement, k === KEY.DONE);
    } else if (k === KEY.ENTER) {
      if (typing) finishTyping(document.activeElement, true);
      else if (focused && focused.tagName === 'INPUT') focused.focus(); // opens the TV keyboard
      else if (focused) focused.click();
    } else if (k >= KEY.LEFT && k <= KEY.DOWN) {
      if (typing && (k === KEY.LEFT || k === KEY.RIGHT)) return; // move the text cursor
      if (typing) document.activeElement.blur();
      move(k);
    } else if (k === KEY.BACK || k === KEY.ESC) {
      if (typing) document.activeElement.blur();
      else back();
    } else {
      return;
    }
    e.preventDefault();
  });

  var actions = {};
  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-nav]');
    if (!target) return;
    setFocus(target);
    var action = actions[target.getAttribute('data-action')];
    if (action) action(target);
  });

  // ---- settings ----
  var draft = null;

  function section(name) { return $('.server[data-server=' + name + ']'); }

  function setStatus(e, text, isError) {
    e.textContent = text;
    e.classList.toggle('error', !!isError);
  }

  function readForm(name) {
    var sec = section(name);
    draft[name].url = Logic.normalizeUrl($('[data-field=url]', sec).value);
    draft[name].apiKey = $('[data-field=apiKey]', sec).value.trim();
  }

  function renderChips(sec, field, options, s) {
    var box = $('.chips[data-field=' + field + ']', sec);
    box.innerHTML = '';
    var known = options.some(function (o) { return o.value === s[field]; });
    if (!known) s[field] = options.length ? options[0].value : emptyServer()[field];
    options.forEach(function (o) {
      var b = el('button', 'chip' + (o.value === s[field] ? ' selected' : ''), o.label);
      b.setAttribute('data-nav', '');
      b.setAttribute('data-action', 'chip');
      b._value = o.value;
      box.appendChild(b);
    });
  }

  async function testServer(name) {
    readForm(name);
    var sec = section(name), s = draft[name], status = $('.status', sec);
    setStatus(status, STRINGS.testing);
    try {
      await api(s, 'GET', '/api/v3/system/status');
      var res = await Promise.all([api(s, 'GET', '/api/v3/qualityprofile'), api(s, 'GET', '/api/v3/rootfolder')]);
      renderChips(sec, 'qualityProfileId', res[0].map(function (p) { return { value: p.id, label: p.name }; }), s);
      renderChips(sec, 'rootFolderPath', res[1].map(function (f) { return { value: f.path, label: f.path }; }), s);
      setStatus(status, STRINGS.connected);
    } catch (err) {
      setStatus(status, err.message, true);
    }
  }

  function openSettings() {
    draft = JSON.parse(JSON.stringify(config));
    setStatus($('#settings-status'), '');
    Object.keys(NAMES).forEach(function (name) {
      var sec = section(name), s = draft[name];
      $('[data-field=url]', sec).value = s.url;
      $('[data-field=apiKey]', sec).value = s.apiKey;
      setStatus($('.status', sec), '');
      if (s.url && s.apiKey) testServer(name); // reload profile/folder chips
    });
    show('settings');
  }

  actions.settings = openSettings;
  actions.test = function (b) { testServer(b.closest('.server').getAttribute('data-server')); };
  actions.chip = function (b) {
    var box = b.parentNode;
    draft[box.closest('.server').getAttribute('data-server')][box.getAttribute('data-field')] = b._value;
    $$('.chip', box).forEach(function (c) { c.classList.toggle('selected', c === b); });
  };
  actions.save = function () {
    Object.keys(NAMES).forEach(readForm);
    if (!Logic.isConfigValid(draft)) return setStatus($('#settings-status'), STRINGS.saveInvalid, true);
    config = draft;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    show('search');
  };

  // ---- search ----
  var items = [], selected = null, lastCard = null;

  async function lookup(name, kind, path, q) {
    var s = config[name];
    if (!Logic.serverReady(s)) return { items: [] };
    try {
      var r = await api(s, 'GET', path + '?term=' + encodeURIComponent(q));
      return { items: r.slice(0, 20).map(function (x) { return Logic.toItem(kind, x); }) };
    } catch (err) {
      return { items: [], error: NAMES[name] + ': ' + err.message };
    }
  }

  async function search() {
    var q = $('#query').value.trim();
    if (!q) return;
    var notice = $('#notice');
    setStatus(notice, STRINGS.searching);
    var res = await Promise.all([
      lookup('radarr', 'movie', '/api/v3/movie/lookup', q),
      lookup('sonarr', 'show', '/api/v3/series/lookup', q)
    ]);
    items = Logic.interleave(res[0].items, res[1].items);
    var errors = res.filter(function (r) { return r.error; }).map(function (r) { return r.error; });
    setStatus(notice, errors.join(' · ') || (items.length ? '' : STRINGS.noResults), errors.length > 0);
    renderResults();
  }

  function renderResults() {
    var box = $('#results');
    box.innerHTML = '';
    items.forEach(function (it, i) {
      var card = el('button', 'card');
      card.setAttribute('data-nav', '');
      card.setAttribute('data-action', 'open');
      card._index = i;
      if (it.poster) {
        var img = el('img');
        img.src = it.poster;
        card.appendChild(img);
      } else {
        card.appendChild(el('div', 'noposter'));
      }
      if (it.inLibrary) card.appendChild(el('span', 'badge', STRINGS.inLibrary));
      card.appendChild(el('div', 't', it.title));
      card.appendChild(el('div', 'm', [it.year, STRINGS[it.kind]].filter(Boolean).join(' · ')));
      box.appendChild(card);
    });
    if (items.length) setFocus(box.firstChild);
  }

  $('#query').addEventListener('submit-input', search);

  // ---- details ----
  function setRequestButton(state, msg) {
    var b = $('#d-request');
    b.textContent = {
      ready: STRINGS.request, busy: STRINGS.requesting, done: STRINGS.requested,
      inLibrary: STRINGS.inLibrary, error: STRINGS.retry + msg
    }[state];
    b.disabled = state === 'busy' || state === 'done' || state === 'inLibrary';
    b.classList.toggle('error', state === 'error');
  }

  actions.open = function (card) {
    lastCard = card;
    selected = items[card._index];
    $('#d-poster').src = selected.poster;
    $('#d-title').textContent = selected.title;
    $('#d-meta').textContent = [selected.year, STRINGS[selected.kind]].filter(Boolean).join(' · ');
    $('#d-overview').textContent = selected.overview;
    setRequestButton(selected.inLibrary ? 'inLibrary' : 'ready');
    show('details');
  };

  actions.request = async function (b) {
    if (b.disabled) return;
    var it = selected, name = it.kind === 'movie' ? 'radarr' : 'sonarr';
    setRequestButton('busy');
    try {
      await api(config[name], 'POST', it.kind === 'movie' ? '/api/v3/movie' : '/api/v3/series',
        Logic.buildRequestBody(it.kind, it.raw, config[name]));
      it.inLibrary = true;
      lastCard.insertBefore(el('span', 'badge', STRINGS.inLibrary), lastCard.children[1]);
      setRequestButton('done');
    } catch (err) {
      setRequestButton('error', err.message);
    }
  };

  // ---- start ----
  if (Logic.isConfigValid(config)) show('search');
  else openSettings();
})();
