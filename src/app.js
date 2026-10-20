const K = window.Keycodes;
// Current board: definition + laid-out keys ({ r, c, x, y, w, h, rot }), width/height in key units.
let L = null;
const GHOST = (() => { const b = Definitions.fromBuiltin(window.BUILTIN_BOARDS[0]); return { ...b, ...Definitions.layoutKeys(b, []) }; })();
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const state = {
  dev: null,
  proto: 0,
  layers: 0,
  keymap: null,      // Uint16Array, canonical (modern) keycodes
  original: null,    // as read on connect, for "changed" dots
  layer: 2,
  sel: null,         // index into L.keys
  group: 'basic',
  macroCount: 0,
  macroSize: 0,
  macros: [],        // steps[] per macro
  macroSel: 0,
  rgb: null,
};

// ---------------- utils ----------------
let toastTimer;
function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 2200);
}
function busy(text, frac) {
  if (text === false) return $('#busy').classList.add('hidden');
  $('#busy').classList.remove('hidden');
  $('#busyText').textContent = text;
  $('#busyBar').style.width = Math.round((frac ?? 0) * 100) + '%';
}
const idx = (layer, r, c) => (layer * L.rows + r) * L.cols + c;

// ---------------- keyboard drawing ----------------
function drawKeyboard(host, u, withCodes, layout = L) {
  host.innerHTML = '';
  host.style.setProperty('--u', u + 'px');
  const gap = 4;
  const inner = el('div', 'kb-inner');
  inner.style.width = layout.width * u - gap + 'px';
  inner.style.height = layout.height * u - gap + 'px';
  layout.keys.forEach((k, i) => {
    const key = el('div', 'key');
    key.style.left = k.x * u + 'px';
    key.style.top = k.y * u + 'px';
    key.style.width = k.w * u - gap + 'px';
    key.style.height = k.h * u - gap + 'px';
    if (k.rot) {
      key.style.transformOrigin = `${(k.rot.rx - k.x) * u}px ${(k.rot.ry - k.y) * u}px`;
      key.style.transform = `rotate(${k.rot.r}deg)`;
    }
    key.dataset.i = i;
    if (withCodes) key.addEventListener('click', () => selectKey(i));
    inner.append(key);
  });
  host.append(inner);
}

function fitKeyboard() {
  const panel = $('#main .panel[data-panel=keymap]');
  const byWidth = (panel.clientWidth - 44 - 24) / L.width;
  const byHeight = (panel.clientHeight - 60 - 24 - 32 - 230) / L.height; // leave room for layer bar + picker
  const u = Math.max(28, Math.min(60, Math.floor(Math.min(byWidth, byHeight))));
  drawKeyboard($('#kb'), u, true);
  renderKeys();
}

function renderKeys() {
  if (!state.keymap) return;
  document.querySelectorAll('#kb .key').forEach(node => {
    const k = L.keys[node.dataset.i];
    const i = idx(state.layer, k.r, k.c);
    const code = state.keymap[i];
    const d = K.describe(code);
    // transparent key on an upper layer: show what falls through from the layer below
    const parent = fallthroughLayer(state.layer);
    const below = code === 1 && parent != null ? K.describe(state.keymap[idx(parent, k.r, k.c)]).main : null;
    node.innerHTML = below != null
      ? `<span class="m">${esc(below)}</span><span class="s">▽</span>`
      : `<span class="m">${esc(d.main)}</span>${d.sub ? `<span class="s">${esc(d.sub)}</span>` : ''}`;
    node.classList.toggle('trns', code === 1);
    node.classList.toggle('changed', code !== state.original[i]);
    node.classList.toggle('sel', +node.dataset.i === state.sel);
    node.classList.toggle('down', track.down.has(+node.dataset.i));
    node.title = K.describeLong(code) + '  ·  ' + K.hex(code);
  });
  renderSelInfo();
}

function selectKey(i) {
  state.sel = i;
  renderKeys();
  revealCurrent();
}

// Switch the picker to the tab that holds the selected key's code and scroll it into view.
function groupOf(code) {
  const g = K.GROUPS.find(g => g.keys.some(n => K.KC[n] === code));
  if (g) return g.id;
  if (code >= 0x7700 && code <= 0x777f) return 'macro';
  return 'special';
}

function revealCurrent() {
  const code = currentCode();
  if (code != null) {
    const cur = K.GROUPS.find(g => g.id === state.group);
    if (!cur.keys.some(n => K.KC[n] === code)) {
      const g = groupOf(code);
      if (g !== state.group && !(g === 'special' && state.group === 'special')) { state.group = g; renderGroups(); }
    }
  }
  renderPicker();
  markPickerDown();
  document.querySelector('#pickerBody .pk.cur')?.scrollIntoView({ block: 'nearest' });
}

// Highlight in the list the codes of physically held keys.
function markPickerDown() {
  if (!state.keymap) return;
  const codes = new Set([...track.down].map(i => state.keymap[idx(state.layer, L.keys[i].r, L.keys[i].c)]));
  document.querySelectorAll('#pickerBody .pk').forEach(b => b.classList.toggle('down', codes.has(+b.dataset.code)));
}

function currentCode() {
  if (state.sel == null) return null;
  const k = L.keys[state.sel];
  return state.keymap[idx(state.layer, k.r, k.c)];
}

function renderSelInfo() {
  const code = currentCode();
  if (code == null) {
    $('#selCap').textContent = '—';
    $('#selText').textContent = t('sel.none');
    return;
  }
  $('#selCap').textContent = K.describe(code).main || '∅';
  $('#selText').textContent = t('sel.info', { desc: K.describeLong(code), hex: K.hex(code), n: state.layer, name: layerName(state.layer) });
}

const layerName = l => (L.roles?.[l] ? t('role.' + L.roles[l]) : t('layer.n', { n: l }));
const roleLayer = role => (L.roles ? L.roles.indexOf(role) : -1);

// Layer a transparent key falls through to when this layer is shown.
function fallthroughLayer(l) {
  if (l > state.baseLayer) return state.baseLayer;
  const role = L.roles?.[l];
  if (role) {
    if (role.startsWith('mac') && role !== 'mac') return roleLayer('mac');
    if (role !== 'mac' && role !== 'win') return roleLayer('win');
    return null;
  }
  return l > 0 ? 0 : null;
}

function renderLayers() {
  const seg = $('#layerSeg');
  seg.innerHTML = '';
  for (let l = 0; l < state.layers; l++) {
    const label = L.roles?.[l] ? `${l} · ${esc(layerName(l))}` : esc(layerName(l));
    const b = el('button', l === state.layer ? 'active' : '', `${label}${l === roleLayer('win') ? '<span class="tag">●</span>' : ''}`);
    b.onclick = () => { state.layer = state.baseLayer = l; track.stickLayer = null; renderLayers(); renderKeys(); renderPicker(); };
    seg.append(b);
  }
  if (state.layer !== state.baseLayer) {
    const held = track.down.size && momentaryLayer(track.down) === state.layer;
    $('#layerTip').textContent = held
      ? t('layer.held', { n: state.layer })
      : t('layer.pinned', { n: state.layer, base: state.baseLayer });
    return;
  }
  const role = L.roles?.[state.layer];
  $('#layerTip').textContent = role ? t('tip.' + role) : '';
}

// ---------------- key press tracking ----------------
// Primary: VIA switch-matrix polling (sees every physical key, incl. Fn, app focus not needed).
// Fallback: DOM key events mapped through the current layer (only while the window is focused).
const track = { mode: null, down: new Set(), gen: 0 };

const DOM_CODES = (() => {
  const m = {};
  for (let i = 0; i < 26; i++) m['Key' + String.fromCharCode(65 + i)] = 0x04 + i;
  '1234567890'.split('').forEach((d, i) => (m['Digit' + d] = 0x1e + i));
  for (let i = 1; i <= 12; i++) m['F' + i] = 0x39 + i;
  Object.assign(m, {
    Enter: 0x28, Escape: 0x29, Backspace: 0x2a, Tab: 0x2b, Space: 0x2c, Minus: 0x2d, Equal: 0x2e,
    BracketLeft: 0x2f, BracketRight: 0x30, Backslash: 0x31, Semicolon: 0x33, Quote: 0x34, Backquote: 0x35,
    Comma: 0x36, Period: 0x37, Slash: 0x38, CapsLock: 0x39, PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48,
    Insert: 0x49, Home: 0x4a, PageUp: 0x4b, Delete: 0x4c, End: 0x4d, PageDown: 0x4e,
    ArrowRight: 0x4f, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52, ContextMenu: 0x65,
    ControlLeft: 0xe0, ShiftLeft: 0xe1, AltLeft: 0xe2, MetaLeft: 0xe3,
    ControlRight: 0xe4, ShiftRight: 0xe5, AltRight: 0xe6, MetaRight: 0xe7,
  });
  return m;
})();

let keyIndexByRC = new Map();
const keymapVisible = () => !$('#main').classList.contains('hidden') && !$('[data-panel=keymap]').classList.contains('hidden');
const typingInField = () => ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);

// Layer that the held keys activate, starting from the user-chosen base layer
// (follows MO()/LT() keys, so Fn → layer 3 and Fn+M → layer 4 resolve like the firmware does).
function momentaryLayer(down) {
  const chain = layerChain(down);
  return chain[chain.length - 1];
}

function layerChain(down) {
  let l = state.baseLayer;
  const chain = [l];
  for (let depth = 0; depth < 4; depth++) {
    let found = null;
    for (const i of down) {
      const k = L.keys[i];
      const c = state.keymap[idx(l, k.r, k.c)];
      let t = null;
      if (c >= 0x5220 && c <= 0x523f) t = c & 0x1f;
      else if (c >= 0x4000 && c <= 0x4fff) t = (c >> 8) & 0xf;
      if (t != null && t !== l && t < state.layers) { found = t; break; }
    }
    if (found == null) break;
    l = found;
    chain.push(l);
  }
  return chain;
}

function isLayerKey(i, layer) {
  const k = L.keys[i];
  const c = state.keymap[idx(layer, k.r, k.c)];
  return (c >= 0x5220 && c <= 0x523f) || (c >= 0x4000 && c <= 0x4fff);
}

function setDown(next) {
  const pressed = [...next].filter(i => !track.down.has(i));
  const changed = pressed.length || next.size !== track.down.size;
  track.down = next;

  // Fn held → show its layer. After a key was picked on that layer, stay there once Fn is
  // released so it can be edited; the next press without Fn returns to the base layer.
  const fn = momentaryLayer(next);
  let target;
  if (fn !== state.baseLayer) target = fn;
  else if (track.stickLayer != null && !pressed.length) target = track.stickLayer;
  else { track.stickLayer = null; target = state.baseLayer; }
  if (target !== state.layer) {
    state.layer = target;
    renderLayers();
    renderKeys();
    if (!pressed.length) renderPicker();
  } else if (changed && state.layer !== state.baseLayer) {
    renderLayers(); // refresh the "Fn held / pinned" hint
  }

  if (pressed.length && $('#selectOnPress').checked && keymapVisible() && !typingInField()) {
    // Fn, Fn+M etc. only switch the shown layer; they never become the selection
    const chain = [...new Set([...layerChain(next), state.baseLayer, state.layer])];
    const pick = pressed.filter(i => !chain.some(l => isLayerKey(i, l))).pop();
    if (pick != null) {
      if (fn !== state.baseLayer) track.stickLayer = fn;
      selectKey(pick);
    } else {
      document.querySelectorAll('#kb .key').forEach(n => n.classList.toggle('down', next.has(+n.dataset.i)));
    }
  } else if (changed) {
    document.querySelectorAll('#kb .key').forEach(n => n.classList.toggle('down', next.has(+n.dataset.i)));
    markPickerDown();
  }
}

function setTrackState() {
  const s = $('#trackState');
  s.classList.toggle('on', !!track.mode);
  s.textContent = t('track.label', { mode: t('track.' + (track.mode || 'off')) });
  s.title = t(track.mode === 'matrix' ? 'track.matrix.tip' : 'track.dom.tip');
}

async function startTracking() {
  const gen = ++track.gen;
  track.down = new Set();
  try {
    await state.dev.matrixState(L.rows, L.cols);
    track.mode = 'matrix';
  } catch {
    track.mode = 'dom';
  }
  setTrackState();
  if (track.mode !== 'matrix') return;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  while (gen === track.gen && state.dev) {
    if (keymapVisible() && $('#busy').classList.contains('hidden')) {
      try {
        const rc = await state.dev.matrixState(L.rows, L.cols);
        if (gen !== track.gen) break;
        setDown(new Set([...rc].map(k => keyIndexByRC.get(k)).filter(i => i != null)));
      } catch { /* transient; keep polling */ }
    }
    await wait(40);
  }
}

function stopTracking() {
  track.gen++;
  track.mode = null;
  track.down = new Set();
}

function domKeyIndex(e) {
  const hid = DOM_CODES[e.code];
  if (hid == null || !state.keymap) return null;
  // look on the visible layer first, then on the base layers
  for (const l of [state.layer, 2, 0]) {
    if (l >= state.layers) continue;
    const i = L.keys.findIndex(k => state.keymap[idx(l, k.r, k.c)] === hid);
    if (i >= 0) return i;
  }
  return null;
}

function bindDomTracking() {
  window.addEventListener('keydown', e => {
    // a focused button must not be "clicked" by Space/Enter typed on the keyboard being configured
    if (keymapVisible() && e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) e.preventDefault();
    if (track.mode !== 'dom' || typingInField()) return;
    const i = domKeyIndex(e);
    if (i != null && !track.down.has(i)) setDown(new Set([...track.down, i]));
  }, true);
  window.addEventListener('keyup', e => {
    if (track.mode !== 'dom') return;
    const i = domKeyIndex(e);
    if (i != null) { const n = new Set(track.down); n.delete(i); setDown(n); }
  }, true);
  window.addEventListener('blur', () => track.mode === 'dom' && setDown(new Set()));
}

// ---------------- picker ----------------
function renderGroups() {
  const seg = $('#groupSeg');
  seg.innerHTML = '';
  K.GROUPS.forEach(g => {
    if (g.id === 'custom' && !g.keys.length) return;
    const title = g.id === 'custom' ? L.vendor || t('grp.custom') : t('grp.' + g.id);
    const b = el('button', g.id === state.group ? 'active' : '', esc(title));
    b.onclick = () => { state.group = g.id; renderGroups(); renderPicker(); };
    seg.append(b);
  });
}

function pkButton(code, label, title) {
  const b = el('button', 'pk', esc(label));
  b.dataset.code = code;
  if (label.length > 7) b.classList.add('wide');
  if (code === currentCode()) b.classList.add('cur');
  b.title = (title || K.describeLong(code)) + ' · ' + K.hex(code);
  b.onclick = () => { b.blur(); assign(code); };
  return b;
}

function renderPicker() {
  const body = $('#pickerBody');
  body.innerHTML = '';
  const g = K.GROUPS.find(x => x.id === state.group);
  if (g.id === 'special') return renderBuilders(body);
  if (g.id === 'macro') {
    if (!state.macroCount) { body.append(el('div', 'empty', esc(t('macro.unsupported')))); return; }
    for (let m = 0; m < state.macroCount; m++) {
      const n = state.macros[m]?.length || 0;
      body.append(pkButton(K.MACRO(m), 'M' + m, n ? t('macro.pk', { n: m, k: n }) : t('macro.pk.empty', { n: m })));
    }
    return;
  }
  g.keys.forEach(name => {
    const code = K.KC[name];
    body.append(pkButton(code, K.LABEL[code] || (name === 'KC_NO' ? '∅' : name)));
  });
}

function comboKeySelect(id) {
  const s = el('select');
  s.id = id;
  K.BASIC_FOR_COMBO.forEach(name => {
    const o = el('option', null, esc(K.LABEL[K.KC[name]]));
    o.value = K.KC[name];
    s.append(o);
  });
  return s;
}

function layerSelect(id) {
  const s = el('select');
  s.id = id;
  for (let l = 0; l < Math.max(state.layers, 1); l++) {
    const o = el('option', null, `${l} · ${esc(layerName(l))}`);
    o.value = l;
    s.append(o);
  }
  return s;
}

function modChecks(prefix) {
  const wrap = el('div', 'brow');
  [['Ctrl', 1], ['Shift', 2], ['Alt', 4], ['Win', 8]].forEach(([n, bit]) => {
    const lab = el('label', 'chk', `<input type="checkbox" data-bit="${bit}" class="${prefix}"> ${n}`);
    wrap.append(lab);
  });
  return wrap;
}
const readMods = cls => [...document.querySelectorAll('.' + cls)].reduce((m, c) => (c.checked ? m | +c.dataset.bit : m), 0);

function renderBuilders(body) {
  const wrap = el('div', 'builder');

  // combo
  const c1 = el('div', 'bcard', `<h4>${t('b.combo.h')}</h4><p>${t('b.combo.p')}</p>`);
  c1.append(modChecks('cm'));
  const r1 = el('div', 'brow');
  const ks = comboKeySelect('cmKey');
  const bOnlyMods = el('label', 'chk', `<input type="checkbox" id="cmNoKey"> ${t('b.combo.mods')}`);
  const a1 = el('button', 'pill dark', esc(t('b.assign')));
  a1.onclick = () => {
    const mods = readMods('cm');
    if (!mods) return toast(t('b.combo.need'), true);
    if ($('#cmNoKey').checked) {
      // e.g. Alt+Shift: hold first mod as key, the rest as modifiers
      const bits = [1, 2, 4, 8].filter(b => mods & b);
      const base = { 1: 0xe0, 2: 0xe1, 4: 0xe2, 8: 0xe3 }[bits[0]];
      const rest = bits.slice(1).reduce((a, b) => a | b, 0);
      return assign(rest ? K.withMods(rest, base) : base);
    }
    assign(K.withMods(mods, +ks.value));
  };
  r1.append(ks, bOnlyMods, a1);
  c1.append(r1);

  // layers
  const c2 = el('div', 'bcard', `<h4>${t('b.layer.h')}</h4><p>${t('b.layer.p')}</p>`);
  const r2 = el('div', 'brow');
  const kind = el('select');
  ['MO', 'TG', 'TO', 'OSL', 'DF']
    .forEach(v => { const o = el('option', null, esc(t('b.layer.' + v))); o.value = v; kind.append(o); });
  const ls = layerSelect('lyr');
  const a2 = el('button', 'pill dark', esc(t('b.assign')));
  a2.onclick = () => assign(K.layer[kind.value](+ls.value));
  r2.append(kind, ls, a2);
  c2.append(r2);

  // layer tap
  const c3 = el('div', 'bcard', `<h4>${t('b.lt.h')}</h4><p>${t('b.lt.p')}</p>`);
  const r3 = el('div', 'brow');
  const ltk = comboKeySelect('ltKey');
  const ltl = layerSelect('ltLayer');
  const a3 = el('button', 'pill dark', esc(t('b.assign')));
  a3.onclick = () => {
    if (+ltl.value > 15) return toast(t('b.lt.max'), true);
    assign(K.layer.LT(+ltl.value, +ltk.value));
  };
  r3.append(ltk, ltl, a3);
  c3.append(r3);

  // mod tap
  const c4 = el('div', 'bcard', `<h4>${t('b.mt.h')}</h4><p>${t('b.mt.p')}</p>`);
  c4.append(modChecks('mt'));
  const r4 = el('div', 'brow');
  const mtk = comboKeySelect('mtKey');
  const a4 = el('button', 'pill dark', esc(t('b.assign')));
  a4.onclick = () => {
    const mods = readMods('mt');
    if (!mods) return toast(t('b.mt.need'), true);
    assign(K.modTap(mods, +mtk.value));
  };
  r4.append(mtk, a4);
  c4.append(r4);

  // raw
  const c5 = el('div', 'bcard', `<h4>${t('b.raw.h')}</h4><p>${t('b.raw.p')}</p>`);
  const r5 = el('div', 'brow');
  const raw = el('input');
  raw.type = 'text';
  raw.placeholder = '0x0000';
  raw.value = currentCode() != null ? K.hex(currentCode()) : '';
  const a5 = el('button', 'pill dark', esc(t('b.assign')));
  a5.onclick = () => {
    const v = parseInt(raw.value, 16);
    if (Number.isNaN(v) || v < 0 || v > 0xffff) return toast(t('b.raw.bad'), true);
    assign(v);
  };
  r5.append(raw, a5);
  c5.append(r5);

  wrap.append(c1, c2, c3, c4, c5);
  body.append(wrap);
}

async function assign(code) {
  if (state.sel == null) return toast(t('assign.nosel'), true);
  const k = L.keys[state.sel];
  if (code === K.KC.RF_DFU && !confirm(t('assign.dfu'))) return;
  try {
    await state.dev.setKeycode(state.layer, k.r, k.c, K.toDevice(code, state.proto));
    state.keymap[idx(state.layer, k.r, k.c)] = code;
    renderKeys();
    renderPicker();
    const node = document.querySelector(`#kb .key[data-i="${state.sel}"]`);
    node?.classList.add('flash');
    setTimeout(() => node?.classList.remove('flash'), 500);
    toast(t('assign.ok'));
  } catch (e) {
    toast(e.message, true);
  }
}

// ---------------- macros ----------------
function renderMacroList() {
  const list = $('#macroList');
  list.innerHTML = '';
  for (let m = 0; m < state.macroCount; m++) {
    const n = state.macros[m].length;
    const b = el('button', m === state.macroSel ? 'active' : '', `M${m} <span class="cnt">${n ? t('m.steps', { n }) : t('m.empty')}</span>`);
    b.onclick = () => { state.macroSel = m; renderMacroList(); renderMacroEditor(); };
    list.append(b);
  }
}

function macroUsage() {
  const used = Macros.buildBuffer(state.macros, state.proto).length;
  return { used, ok: used <= state.macroSize };
}

function renderMacroEditor() {
  const steps = state.macros[state.macroSel];
  $('#macroTitle').textContent = 'M' + state.macroSel;
  const u = macroUsage();
  $('#macroUsage').textContent = t('m.usage', { used: u.used, size: state.macroSize });
  $('#macroUsage').style.color = u.ok ? '' : 'var(--danger)';
  const box = $('#macroSteps');
  box.innerHTML = '';
  if (!steps.length) box.append(el('div', 'empty', esc(t('m.none'))));
  steps.forEach((s, i) => {
    const row = el('div', 'step');
    row.append(el('span', 'n', i + 1));
    row.append(el('span', 'kind', esc(t('m.k.' + s.type))));
    const body = el('div', 'body');
    if (s.type === 'combo') {
      [['Ctrl', 0xe0], ['Shift', 0xe1], ['Alt', 0xe2], ['Win', 0xe3]].forEach(([n, code]) => {
        const lab = el('label', 'chk', `<input type="checkbox" ${s.mods.includes(code) ? 'checked' : ''}> ${n}`);
        lab.querySelector('input').onchange = e => {
          s.mods = e.target.checked ? [...s.mods, code] : s.mods.filter(m => m !== code);
          s.mods.sort((a, b) => a - b);
          renderMacroEditor();
        };
        body.append(lab);
      });
      const sel = comboKeySelect('');
      const none = el('option', null, esc(t('m.nokey')));
      none.value = 0;
      sel.prepend(none);
      sel.value = s.key;
      sel.onchange = () => { s.key = +sel.value; renderMacroEditor(); };
      body.append(sel);
    } else if (s.type === 'text') {
      const inp = el('input');
      inp.type = 'text';
      inp.value = s.text;
      inp.placeholder = t('m.text.ph');
      inp.oninput = () => {
        s.text = inp.value;
        const u = macroUsage();
        $('#macroUsage').textContent = t('m.usage', { used: u.used, size: state.macroSize });
        if (/[^\x20-\x7e]/.test(inp.value)) inp.style.borderColor = 'var(--danger)'; else inp.style.borderColor = '';
      };
      body.append(inp);
    } else if (s.type === 'delay') {
      const inp = el('input');
      inp.type = 'number';
      inp.min = 0;
      inp.step = 10;
      inp.value = s.ms;
      inp.oninput = () => (s.ms = +inp.value);
      body.append(inp, el('span', 'muted small', esc(t('m.ms'))));
    } else {
      body.append(el('span', null, esc(K.describeLong(s.code))));
    }
    row.append(body);
    const x = el('button', 'x', '×');
    x.title = t('m.del');
    x.onclick = () => { steps.splice(i, 1); renderMacroEditor(); renderMacroList(); };
    row.append(x);
    box.append(row);
  });
}

function addStep(type) {
  const steps = state.macros[state.macroSel];
  if (type === 'combo') steps.push({ type, mods: [0xe0], key: K.KC.KC_C });
  if (type === 'text') steps.push({ type, text: '' });
  if (type === 'delay') steps.push({ type, ms: 100 });
  renderMacroEditor();
  renderMacroList();
}

async function saveMacros() {
  const buf = Macros.buildBuffer(state.macros, state.proto);
  if (buf.length > state.macroSize) return toast(t('m.toobig'), true);
  try {
    busy(t('m.writing'), 0.5);
    await state.dev.writeMacroBuffer(buf);
    toast(t('m.saved'));
  } catch (e) {
    toast(e.message, true);
  } finally {
    busy(false);
  }
}

// ---------------- lighting ----------------

// Reads whatever the lighting channel supports; missing values hide their row.
async function loadLighting() {
  state.rgb = null;
  const channel = L.lighting ?? 3; // unknown boards: try RGB matrix
  state.dev.setLighting(channel, state.proto);
  const get = async id => { try { return await state.dev.rgbGet(id); } catch { return null; } };
  const bri = await get(RGB.BRIGHTNESS);
  if (!bri) return;
  const eff = await get(RGB.EFFECT);
  const spd = channel === 1 ? null : await get(RGB.SPEED);
  const col = channel === 1 ? null : await get(RGB.COLOR);
  state.rgb = { bri: bri[0], eff: eff?.[0], spd: spd?.[0], hue: col?.[0], sat: col?.[1] };
}

function renderLighting() {
  $('#lightCard').classList.toggle('hidden', !state.rgb);
  $('#lightNA').classList.toggle('hidden', !!state.rgb);
  if (!state.rgb) return;
  const has = { lEffect: state.rgb.eff != null, lSpeed: state.rgb.spd != null, lHue: state.rgb.hue != null, lSat: state.rgb.sat != null };
  Object.entries(has).forEach(([id, on]) => $('#' + id).closest('.row').classList.toggle('hidden', !on));
  const sel = $('#lEffect');
  sel.innerHTML = '';
  // effect names are only known for NuPhy's RGB-matrix build; other boards get numbers
  const fx = L.vendor === 'NuPhy' && L.lighting === 3 ? I18N.effects() : [];
  const n = Math.max(fx.length, state.rgb.eff + 1);
  for (let i = 0; i < n; i++) { const o = el('option', null, esc(`${i} · ${fx[i] ?? t('l.fx.n', { n: i })}`)); o.value = i; sel.append(o); }
  sel.value = state.rgb.eff;
  $('#lBright').value = state.rgb.bri;
  $('#lSpeed').value = state.rgb.spd ?? 0;
  $('#lHue').value = state.rgb.hue ?? 0;
  $('#lSat').value = state.rgb.sat ?? 0;
  updateLightLabels();
}

function updateLightLabels() {
  $('#lBrightV').textContent = Math.round(($('#lBright').value / 255) * 100) + '%';
  $('#lSpeedV').textContent = Math.round(($('#lSpeed').value / 255) * 100) + '%';
  $('#lSatV').textContent = Math.round(($('#lSat').value / 255) * 100) + '%';
  $('#lSwatch').style.background = `hsl(${($('#lHue').value / 255) * 360}, ${($('#lSat').value / 255) * 100}%, 50%)`;
}

function bindLighting() {
  const live = (id, fn) => {
    let t;
    $(id).addEventListener('input', () => {
      updateLightLabels();
      clearTimeout(t);
      t = setTimeout(() => fn().catch(e => toast(e.message, true)), 60);
    });
  };
  live('#lBright', () => state.dev.rgbSet(RGB.BRIGHTNESS, +$('#lBright').value));
  live('#lSpeed', () => state.dev.rgbSet(RGB.SPEED, +$('#lSpeed').value));
  live('#lHue', () => state.dev.rgbSet(RGB.COLOR, +$('#lHue').value, +$('#lSat').value));
  live('#lSat', () => state.dev.rgbSet(RGB.COLOR, +$('#lHue').value, +$('#lSat').value));
  $('#lEffect').addEventListener('change', () => state.dev.rgbSet(RGB.EFFECT, +$('#lEffect').value).catch(e => toast(e.message, true)));
  $('#btnSaveLight').onclick = async () => {
    try { await state.dev.rgbSave(); toast(t('l.saved')); } catch (e) { toast(e.message, true); }
  };
}

// ---------------- backup ----------------
function exportLayout() {
  const data = {
    keyboard: L.name,
    matrix: [L.rows, L.cols],
    protocol: state.proto,
    layers: Array.from({ length: state.layers }, (_, l) =>
      L.keys.map(k => K.hex(state.keymap[idx(l, k.r, k.c)]))),
    macros: state.macros,
  };
  const a = el('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'air75-v2-layout.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importLayout() {
  const inp = el('input');
  inp.type = 'file';
  inp.accept = '.json';
  inp.onchange = async () => {
    try {
      const data = JSON.parse(await inp.files[0].text());
      if (!Array.isArray(data.layers)) throw new Error(t('io.bad'));
      // a backup only fits the same keyboard: same matrix and the same key list
      if ((data.matrix && (data.matrix[0] !== L.rows || data.matrix[1] !== L.cols)) || data.layers[0]?.length !== L.keys.length) {
        throw new Error(t('io.bad'));
      }
      const writes = [];
      data.layers.slice(0, state.layers).forEach((codes, l) => codes.forEach((h, n) => {
        const k = L.keys[n];
        const code = parseInt(h, 16);
        if (k && !Number.isNaN(code) && state.keymap[idx(l, k.r, k.c)] !== code) writes.push([l, k, code]);
      }));
      for (let i = 0; i < writes.length; i++) {
        const [l, k, code] = writes[i];
        busy(t('io.writing', { i: i + 1, n: writes.length }), i / writes.length);
        await state.dev.setKeycode(l, k.r, k.c, K.toDevice(code, state.proto));
        state.keymap[idx(l, k.r, k.c)] = code;
      }
      if (Array.isArray(data.macros) && state.macroCount) {
        state.macros = Array.from({ length: state.macroCount }, (_, i) => data.macros[i] || []);
        await state.dev.writeMacroBuffer(Macros.buildBuffer(state.macros, state.proto));
      }
      busy(false);
      renderKeys(); renderMacroList(); renderMacroEditor();
      toast(t('io.done', { n: writes.length }));
    } catch (e) {
      busy(false);
      toast(e.message, true);
    }
  };
  inp.click();
}

async function resetKeymap() {
  if (!confirm(t('reset.ask'))) return;
  try {
    busy(t('reset.busy'), 0.2);
    await state.dev.resetKeymap();
    await loadKeymap();
    toast(t('reset.done'));
  } catch (e) {
    toast(e.message, true);
  } finally {
    busy(false);
  }
}

// ---------------- connection ----------------
async function loadKeymap() {
  const raw = await state.dev.readKeymap(state.layers, L.rows, L.cols, f => busy(t('c.reading'), f * 0.8));
  state.keymap = Uint16Array.from(raw, c => K.fromDevice(c, state.proto));
  state.original = state.keymap.slice();
}

async function connect(dev) {
  if (state.dev || state.connecting) return;
  state.connecting = true;
  try {
    $('#auth').classList.add('connecting');
    await dev.open();
    state.dev = dev;
    busy(t('c.connecting'), 0.05);
    state.proto = await dev.protocolVersion();
    state.layers = await dev.layerCount();
    if (!state.layers) throw new Error(t('c.nolayers'));
    await setBoard(dev);
    const win = roleLayer('win');
    state.layer = state.baseLayer = win >= 0 && win < state.layers ? win : 0;
    state.sel = null;
    await loadKeymap();

    busy(t('c.macros'), 0.85);
    state.macroCount = await dev.macroCount().catch(() => 0);
    state.macroSize = state.macroCount ? await dev.macroBufferSize() : 0;
    if (state.macroCount && state.macroSize) {
      const buf = await dev.readMacroBuffer(state.macroSize);
      state.macros = Macros.splitMacros(buf, state.macroCount, state.proto)
        .map(b => Macros.toSteps(Macros.decode(b, state.proto)));
    } else state.macros = [];

    busy(t('c.light'), 0.95);
    await loadLighting();

    $('#devName').textContent = dev.name || L.name;
    state.group = 'basic';
    renderDevMeta();
    $('#auth').classList.add('hidden');
    $('#main').classList.remove('hidden');
    renderLayers(); renderGroups(); fitKeyboard(); renderPicker();
    if (state.macroCount) { renderMacroList(); renderMacroEditor(); }
    renderLighting();
    startTracking();
    toast(t('c.ok'));
  } catch (e) {
    console.error(e);
    toast(t('c.err', { msg: e.message }), true);
    await dev.close().catch(() => {});
    state.dev = null;
  } finally {
    state.connecting = false;
    $('#auth').classList.remove('connecting');
    busy(false);
  }
}

function disconnected(quiet) {
  stopTracking();
  state.dev = null;
  state.sel = null;
  state.keymap = null;
  $('#main').classList.add('hidden');
  $('#auth').classList.remove('hidden');
  if (!quiet) toast(t('c.lost'), true);
}

// ---------------- keyboard definition ----------------
// Pick the definition for the connected device and lay out its keys with the stored layout options.
async function setBoard(dev, override) {
  let def = override || await Definitions.resolve(dev.vid, dev.pid, dev.name);
  if (!def) def = await askForDefinition(dev);
  if (!def) throw new Error(t('def.title'));
  const choices = def.labels.length ? Definitions.decodeOptions(await dev.layoutOptions(), def.labels) : [];
  L = { ...def, ...Definitions.layoutKeys(def, choices) };
  keyIndexByRC = new Map(L.keys.map((k, i) => [k.r + ',' + k.c, i]));
  K.setCustom(L.custom || []);
}

function readDefinitionFile() {
  return new Promise(resolve => {
    const inp = el('input');
    inp.type = 'file';
    inp.accept = '.json';
    inp.onchange = async () => {
      try {
        resolve(Definitions.fromFile(JSON.parse(await inp.files[0].text())));
      } catch (e) {
        toast(t('def.bad', { msg: e.message }), true);
        resolve(null);
      }
    };
    inp.click();
  });
}

// Shown when neither built-in definitions nor the VIA database know the keyboard.
function askForDefinition(dev) {
  const h = n => '0x' + n.toString(16).toUpperCase().padStart(4, '0');
  $('#defText').textContent = t('def.text', { name: dev.name || 'Keyboard', vid: h(dev.vid), pid: h(dev.pid) });
  busy(false);
  $('#defPrompt').classList.remove('hidden');
  return new Promise(resolve => {
    const done = def => { $('#defPrompt').classList.add('hidden'); resolve(def); };
    $('#defCancel').onclick = () => done(null);
    $('#defLoad').onclick = async () => {
      const def = await readDefinitionFile();
      if (!def) return;
      if (def.rows * def.cols < 1) return toast(t('def.bad', { msg: 'matrix' }), true);
      Definitions.remember(dev.vid, dev.pid, def);
      toast(t('def.loaded', { name: def.name }));
      done(def);
    };
  });
}

// "Definition" button: load another JSON for the connected keyboard and re-read everything.
async function replaceDefinition() {
  const def = await readDefinitionFile();
  if (!def) return;
  Definitions.remember(state.dev.vid, state.dev.pid, def);
  const dev = state.dev;
  disconnected(true);
  await dev.close().catch(() => {});
  await connect(dev);
  toast(t('def.loaded', { name: def.name }));
}

// ---------------- language ----------------
function renderDevMeta() {
  if (!state.dev) return;
  const h = n => '0x' + n.toString(16).toUpperCase().padStart(4, '0');
  $('#devMeta').textContent = t('c.meta', {
    vidpid: `VID ${h(state.dev.vid)} · PID ${h(state.dev.pid)}`, proto: state.proto, layers: state.layers,
    macros: state.macroCount, src: t('def.src.' + L.source),
  });
}

function renderLangSwitch() {
  document.querySelectorAll('.lang-seg').forEach(seg => {
    seg.innerHTML = '';
    [['ru', 'RU'], ['en', 'EN']].forEach(([code, label]) => {
      const b = el('button', I18N.lang === code ? 'active' : '', label);
      b.onclick = () => setLanguage(code);
      seg.append(b);
    });
  });
}

function setLanguage(lang) {
  if (lang === I18N.lang) return;
  I18N.set(lang);
  I18N.apply();
  renderLangSwitch();
  if (!state.keymap) return;
  renderDevMeta();
  renderLayers();
  renderGroups();
  renderKeys();
  renderPicker();
  markPickerDown();
  setTrackState();
  if (state.macroCount) { renderMacroList(); renderMacroEditor(); }
  const fx = L.vendor === 'NuPhy' && L.lighting === 3 ? I18N.effects() : [];
  [...$('#lEffect').options].forEach((o, i) => (o.textContent = `${i} · ${fx[i] ?? t('l.fx.n', { n: i })}`));
}

// ---------------- boot ----------------
function init() {
  I18N.apply();
  renderLangSwitch();
  drawKeyboard($('#ghostKb'), 46, false, GHOST);

  $('#btnConnect').onclick = async () => {
    try {
      const dev = window.DEMO ? window.DEMO() : await ViaDevice.pick();
      if (!dev) return toast(t('c.notfound'), true);
      await connect(dev);
    } catch (e) {
      toast(e.message, true);
    }
  };

  document.querySelectorAll('#tabs .tab').forEach(tab => tab.onclick = () => {
    document.querySelectorAll('#tabs .tab').forEach(x => x.classList.toggle('active', x === tab));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== tab.dataset.tab));
    if (tab.dataset.tab === 'macros' && !state.macroCount) {
      $('#macroSteps').innerHTML = `<div class="empty">${esc(t('macro.unsupported'))}</div>`;
    }
  });

  document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => state.macroCount && addStep(b.dataset.add));
  $('#btnSaveMacros').onclick = saveMacros;
  $('#btnReset').onclick = resetKeymap;
  $('#btnDef').onclick = replaceDefinition;
  $('#btnBackup').onclick = exportLayout;
  $('#btnRestore').onclick = importLayout;
  bindLighting();

  window.addEventListener('resize', () => state.keymap && fitKeyboard());
  bindDomTracking();

  if (navigator.hid && !window.DEMO) {
    navigator.hid.addEventListener('disconnect', e => { if (state.dev && e.device === state.dev.hid) disconnected(); });
    navigator.hid.addEventListener('connect', async () => {
      if (state.dev) return;
      const dev = await ViaDevice.known();
      if (dev) connect(dev);
    });
    ViaDevice.known().then(dev => dev && !state.dev && connect(dev));
  }
}

init();
