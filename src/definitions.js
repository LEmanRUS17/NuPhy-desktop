// Keyboard definitions: built-in NuPhy V2 boards, VIA's public definition database, or a user-supplied JSON.
// Everything is normalised to a "board":
//   { name, vendorId, productId, rows, cols, keys: [{r,c,x,y,w,h,rot}], optionKeys: [{g,ch,key}], labels,
//     roles?, custom: [{name,label,desc}], lighting, vendor, source }

const VIA_DEFS = 'https://usevia.app/definitions';
const vpid = (vid, pid) => vid * 65536 + pid;

// Labels for NuPhy custom keycodes (shared by all V2 boards; order per board comes from boards.js).
const NUPHY_KC = {
  RF_DFU: ['RF DFU', 'Прошивка радиомодуля — не назначайте', 'Radio module firmware update — do not assign'],
  LNK_USB: ['USB', 'Режим: кабель', 'Mode: wired'],
  LNK_RF: ['2.4G', 'Режим: 2.4 ГГц донгл', 'Mode: 2.4 GHz dongle'],
  LNK_BLE1: ['BT 1', 'Bluetooth профиль 1', 'Bluetooth profile 1'],
  LNK_BLE2: ['BT 2', 'Bluetooth профиль 2', 'Bluetooth profile 2'],
  LNK_BLE3: ['BT 3', 'Bluetooth профиль 3', 'Bluetooth profile 3'],
  MAC_TASK: ['Mission', 'macOS: Mission Control', 'macOS: Mission Control'],
  MAC_SEARCH: ['Spotlight', 'macOS: Spotlight', 'macOS: Spotlight'],
  MAC_VOICE: ['Dictation', 'macOS: диктовка', 'macOS: dictation'],
  MAC_CONSOLE: ['Launchpad', 'macOS: Launchpad', 'macOS: Launchpad'],
  MAC_DND: ['DND', 'macOS: не беспокоить', 'macOS: do not disturb'],
  MAC_PRT: ['Shot', 'macOS: скриншот экрана', 'macOS: full screenshot'],
  MAC_PRTA: ['Shot ▭', 'macOS: скриншот области', 'macOS: area screenshot'],
  SIDE_VAI: ['Side Bri+', 'Боковая подсветка: яркость +', 'Side light: brightness +'],
  SIDE_VAD: ['Side Bri−', 'Боковая подсветка: яркость −', 'Side light: brightness −'],
  SIDE_MOD: ['Side ▶', 'Боковая подсветка: режим', 'Side light: mode'],
  SIDE_MOD_A: ['Side ▶A', 'Боковая подсветка: режим A', 'Side light: mode A'],
  SIDE_MOD_B: ['Side ▶B', 'Боковая подсветка: режим B', 'Side light: mode B'],
  SIDE_HUI: ['Side Hue', 'Боковая подсветка: цвет', 'Side light: color'],
  SIDE_SPI: ['Side Spd+', 'Боковая подсветка: скорость +', 'Side light: speed +'],
  SIDE_SPD: ['Side Spd−', 'Боковая подсветка: скорость −', 'Side light: speed −'],
  DEV_RESET: ['Reset', 'Сброс клавиатуры к заводским (удерживать)', 'Factory reset (hold)'],
  SLEEP_MODE: ['Sleep', 'Вкл/выкл глубокий сон', 'Toggle deep sleep'],
  BAT_SHOW: ['Battery', 'Показать заряд батареи', 'Show battery level'],
  BAT_NUM: ['Bat %', 'Заряд цифрами', 'Battery as digits'],
  RGB_TEST: ['RGB Test', 'Тест подсветки', 'Lighting test'],
  SHIFT_GRV: ['Shift `', 'Esc, с Shift — `~', 'Esc, with Shift — `~'],
};

function fromBuiltin(b) {
  return {
    name: b.name, vendorId: b.vendorId, productId: b.pids[0], rows: b.rows, cols: b.cols,
    keys: b.keys.map(([r, c, x, y, w, h]) => ({ r, c, x, y, w, h, rot: null })),
    optionKeys: [], labels: [], roles: b.roles, vendor: 'NuPhy', lighting: 3, source: 'builtin',
    custom: b.custom.map(name => {
      const [label, ru, en] = NUPHY_KC[name] || [name, name, name];
      return { name, label, desc: { ru, en } };
    }),
  };
}

function lightingChannel(def) {
  const items = [].concat(def.menus || [], def.lighting || []).map(m => (typeof m === 'string' ? m : JSON.stringify(m)));
  const has = s => items.some(m => m.includes(s));
  if (has('rgb_matrix')) return 3;
  if (has('rgblight')) return 2;
  if (has('backlight')) return 1;
  return null;
}

function customFrom(def) {
  return (def.customKeycodes || []).map(k => ({
    name: k.name || k.shortName,
    label: k.shortName || k.name || '?',
    desc: k.title || k.name || '',
  }));
}

// VIA's hosted definitions are already parsed: layouts.keys / layouts.optionKeys[group][choice].
function fromHosted(def, source) {
  const conv = k => ({ r: k.row, c: k.col, x: k.x, y: k.y, w: k.w || 1, h: k.h || 1, rot: k.r ? { r: k.r, rx: k.rx, ry: k.ry } : null, d: k.d });
  const optionKeys = [];
  Object.entries(def.layouts.optionKeys || {}).forEach(([g, choices]) =>
    Object.entries(choices).forEach(([ch, keys]) => keys.forEach(k => optionKeys.push({ g: +g, ch: +ch, key: conv(k) }))));
  return {
    name: def.name, vendorId: def.vendorProductId >>> 16, productId: def.vendorProductId & 0xffff,
    rows: def.matrix.rows, cols: def.matrix.cols,
    keys: def.layouts.keys.map(conv).filter(k => !k.d), optionKeys: optionKeys.filter(o => !o.key.d),
    labels: def.layouts.labels || [], vendor: null, lighting: lightingChannel(def), custom: customFrom(def), source,
  };
}

// Minimal KLE (keyboard-layout-editor) reader for raw VIA JSON files.
// Legends hold "row,col" for the matrix and optionally "group,choice" for layout options.
function parseKLE(rows) {
  const keys = [];
  const optionKeys = [];
  let r = 0, rx = 0, ry = 0, y = 0;
  for (const row of rows) {
    if (!Array.isArray(row)) continue; // metadata object
    let x = rx;
    let w = 1, h = 1, decal = false;
    for (const item of row) {
      if (typeof item === 'object') {
        if (item.r != null) r = item.r;
        if (item.rx != null) rx = item.rx;
        if (item.ry != null) ry = item.ry;
        if (item.rx != null || item.ry != null) { x = rx; y = ry; }
        if (item.x != null) x += item.x;
        if (item.y != null) y += item.y;
        if (item.w != null) w = item.w;
        if (item.h != null) h = item.h;
        if (item.d != null) decal = item.d;
        continue;
      }
      const parts = String(item).split('\n').filter(p => /^\d+,\d+$/.test(p.trim()));
      if (!decal && parts.length) {
        const [mr, mc] = parts[0].split(',').map(Number);
        const key = { r: mr, c: mc, x, y, w, h, rot: r ? { r, rx, ry } : null };
        if (parts.length > 1) {
          const [g, ch] = parts[parts.length - 1].split(',').map(Number);
          optionKeys.push({ g, ch, key });
        } else keys.push(key);
      }
      x += w;
      w = 1; h = 1; decal = false;
    }
    y += 1;
  }
  return { keys, optionKeys };
}

// QMK info.json / keyboard.json (layouts.<NAME>.layout[] with matrix).
function fromQmkInfo(j) {
  const layout = Object.values(j.layouts)[0].layout;
  const rows = j.matrix_size?.rows ?? j.matrix_pins?.rows?.length ?? Math.max(...layout.map(k => k.matrix[0])) + 1;
  const cols = j.matrix_size?.cols ?? j.matrix_pins?.cols?.length ?? Math.max(...layout.map(k => k.matrix[1])) + 1;
  return {
    name: j.keyboard_name || 'Keyboard',
    vendorId: parseInt(j.usb?.vid, 16), productId: parseInt(j.usb?.pid, 16), rows, cols,
    keys: layout.map(k => ({ r: k.matrix[0], c: k.matrix[1], x: k.x, y: k.y, w: k.w || 1, h: k.h || 1, rot: k.r ? { r: k.r, rx: k.rx || 0, ry: k.ry || 0 } : null })),
    optionKeys: [], labels: [], vendor: null, lighting: j.rgb_matrix ? 3 : j.rgblight ? 2 : j.backlight ? 1 : null,
    custom: [], source: 'file',
  };
}

// Any JSON the user may load: raw VIA (KLE keymap), VIA hosted, or QMK info.json.
function fromFile(j) {
  if (j.layouts?.keys) return fromHosted(j, 'file');
  if (j.layouts?.keymap) {
    const { keys, optionKeys } = parseKLE(j.layouts.keymap);
    if (!keys.length) throw new Error('no keys');
    return {
      name: j.name || 'Keyboard',
      vendorId: parseInt(j.vendorId, 16), productId: parseInt(j.productId, 16),
      rows: j.matrix.rows, cols: j.matrix.cols, keys, optionKeys, labels: j.layouts.labels || [],
      vendor: null, lighting: lightingChannel(j), custom: customFrom(j), source: 'file',
    };
  }
  if (j.layouts && Object.values(j.layouts)[0]?.layout) return fromQmkInfo(j);
  throw new Error('unknown format');
}

// Layout options packed by VIA: the last option occupies the lowest bits.
function decodeOptions(value, labels) {
  const widths = labels.map(l => (Array.isArray(l) ? Math.max(1, Math.ceil(Math.log2(l.length - 1))) : 1));
  const out = new Array(labels.length).fill(0);
  for (let i = labels.length - 1; i >= 0; i--) {
    out[i] = value & ((1 << widths[i]) - 1);
    value >>>= widths[i];
  }
  return out;
}

// Final key list for chosen layout options, positions shifted so the layout starts at 0,0.
function layoutKeys(board, choices) {
  const keys = board.keys.concat(board.optionKeys.filter(o => (choices[o.g] ?? 0) === o.ch).map(o => o.key));
  const minX = Math.min(...keys.map(k => k.x));
  const minY = Math.min(...keys.map(k => k.y));
  const out = keys.map(k => ({
    ...k, x: k.x - minX, y: k.y - minY,
    rot: k.rot && { r: k.rot.r, rx: k.rot.rx - minX, ry: k.rot.ry - minY },
  }));
  return {
    keys: out,
    width: Math.max(...out.map(k => k.x + k.w)),
    height: Math.max(...out.map(k => k.y + k.h)),
  };
}

const cacheKey = id => 'def:' + id;
function cacheGet(id) {
  try { const s = localStorage.getItem(cacheKey(id)); return s ? JSON.parse(s) : null; } catch { return null; }
}
function cacheSet(id, board) {
  try { localStorage.setItem(cacheKey(id), JSON.stringify(board)); } catch { /* storage full or unavailable */ }
}

async function fetchVia(id) {
  for (const ver of ['v3', 'v2']) {
    try {
      const res = await fetch(`${VIA_DEFS}/${ver}/${id}.json`, { cache: 'no-cache' });
      if (res.ok) return fromHosted(await res.json(), 'via');
    } catch { /* offline or not found */ }
  }
  return null;
}

// builtin → cache (VIA download or loaded file) → VIA database
async function resolve(vid, pid, productName) {
  const builtin = window.BUILTIN_BOARDS.find(b => b.vendorId === vid &&
    (b.pids.includes(pid) || (productName || '').toLowerCase().includes(b.match.toLowerCase())));
  if (builtin) return fromBuiltin(builtin);
  const id = vpid(vid, pid);
  const cached = cacheGet(id);
  if (cached) return cached;
  const via = await fetchVia(id);
  if (via) cacheSet(id, via);
  return via;
}

function remember(vid, pid, board) { cacheSet(vpid(vid, pid), board); }
function forget(vid, pid) { try { localStorage.removeItem(cacheKey(vpid(vid, pid))); } catch { /* ignore */ } }

window.Definitions = { resolve, fromFile, remember, forget, decodeOptions, layoutKeys, fromBuiltin };
