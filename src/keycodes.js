// QMK keycodes in the modern numbering (VIA protocol >= 12, QMK >= 0.19).
// Older firmware is translated with fromDevice/toDevice at the HID boundary.

const KC = {};
const LABEL = {};
const DESC = {};

function def(name, code, label, desc) {
  KC[name] = code;
  LABEL[code] = label ?? name;
  if (desc) DESC[code] = desc;
}

def('KC_NO', 0x00, '', { ru: 'Ничего (клавиша отключена)', en: 'Nothing (key disabled)' });
def('KC_TRNS', 0x01, '▽', { ru: 'Прозрачная — берётся со слоя ниже', en: 'Transparent — falls through to the layer below' });
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((c, i) => def('KC_' + c, 0x04 + i, c));
'1234567890'.split('').forEach((c, i) => def('KC_' + c, 0x1e + i, c));
[
  ['KC_ENT', 0x28, 'Enter'], ['KC_ESC', 0x29, 'Esc'], ['KC_BSPC', 0x2a, 'Bksp'], ['KC_TAB', 0x2b, 'Tab'],
  ['KC_SPC', 0x2c, 'Space'], ['KC_MINS', 0x2d, '-'], ['KC_EQL', 0x2e, '='], ['KC_LBRC', 0x2f, '['],
  ['KC_RBRC', 0x30, ']'], ['KC_BSLS', 0x31, '\\'], ['KC_NUHS', 0x32, '#'], ['KC_SCLN', 0x33, ';'],
  ['KC_QUOT', 0x34, "'"], ['KC_GRV', 0x35, '`'], ['KC_COMM', 0x36, ','], ['KC_DOT', 0x37, '.'],
  ['KC_SLSH', 0x38, '/'], ['KC_CAPS', 0x39, 'Caps'],
].forEach(a => def(...a));
for (let i = 1; i <= 12; i++) def('KC_F' + i, 0x39 + i, 'F' + i);
[
  ['KC_PSCR', 0x46, 'PrtSc'], ['KC_SCRL', 0x47, 'ScrLk'], ['KC_PAUS', 0x48, 'Pause'], ['KC_INS', 0x49, 'Ins'],
  ['KC_HOME', 0x4a, 'Home'], ['KC_PGUP', 0x4b, 'PgUp'], ['KC_DEL', 0x4c, 'Del'], ['KC_END', 0x4d, 'End'],
  ['KC_PGDN', 0x4e, 'PgDn'], ['KC_RGHT', 0x4f, '→'], ['KC_LEFT', 0x50, '←'], ['KC_DOWN', 0x51, '↓'],
  ['KC_UP', 0x52, '↑'], ['KC_NUM', 0x53, 'NumLk'], ['KC_PSLS', 0x54, 'Num /'], ['KC_PAST', 0x55, 'Num *'],
  ['KC_PMNS', 0x56, 'Num -'], ['KC_PPLS', 0x57, 'Num +'], ['KC_PENT', 0x58, 'Num Ent'],
].forEach(a => def(...a));
'123456789'.split('').forEach((c, i) => def('KC_P' + c, 0x59 + i, 'Num ' + c));
def('KC_P0', 0x62, 'Num 0'); def('KC_PDOT', 0x63, 'Num .'); def('KC_NUBS', 0x64, 'ISO \\');
def('KC_APP', 0x65, 'Menu'); def('KC_PEQL', 0x67, 'Num =');
for (let i = 13; i <= 24; i++) def('KC_F' + i, 0x68 + i - 13, 'F' + i);
[
  ['KC_PWR', 0xa5, 'Power'], ['KC_SLEP', 0xa6, 'Sleep'], ['KC_WAKE', 0xa7, 'Wake'],
  ['KC_MUTE', 0xa8, 'Mute'], ['KC_VOLU', 0xa9, 'Vol +'], ['KC_VOLD', 0xaa, 'Vol −'],
  ['KC_MNXT', 0xab, 'Next', { ru: 'Следующий трек', en: 'Next track' }],
  ['KC_MPRV', 0xac, 'Prev', { ru: 'Предыдущий трек', en: 'Previous track' }],
  ['KC_MSTP', 0xad, 'Stop', { ru: 'Стоп', en: 'Stop' }],
  ['KC_MPLY', 0xae, 'Play', { ru: 'Воспроизведение / пауза', en: 'Play / pause' }],
  ['KC_MAIL', 0xb1, 'Mail'], ['KC_CALC', 0xb2, 'Calc'], ['KC_MYCM', 0xb3, 'My PC'],
  ['KC_WSCH', 0xb4, 'Web Search'], ['KC_WHOM', 0xb5, 'Web Home'], ['KC_WBAK', 0xb6, 'Web ←'],
  ['KC_WFWD', 0xb7, 'Web →'], ['KC_WREF', 0xb9, 'Web ⟳'],
  ['KC_BRIU', 0xbd, 'Bright +'], ['KC_BRID', 0xbe, 'Bright −'],
  ['KC_MS_U', 0xcd, 'Mouse ↑'], ['KC_MS_D', 0xce, 'Mouse ↓'], ['KC_MS_L', 0xcf, 'Mouse ←'], ['KC_MS_R', 0xd0, 'Mouse →'],
  ['KC_BTN1', 0xd1, 'Click L'], ['KC_BTN2', 0xd2, 'Click R'], ['KC_BTN3', 0xd3, 'Click M'],
  ['KC_BTN4', 0xd4, 'Click 4'], ['KC_BTN5', 0xd5, 'Click 5'],
  ['KC_WH_U', 0xd9, 'Wheel ↑'], ['KC_WH_D', 0xda, 'Wheel ↓'], ['KC_WH_L', 0xdb, 'Wheel ←'], ['KC_WH_R', 0xdc, 'Wheel →'],
  ['KC_LCTL', 0xe0, 'Ctrl'], ['KC_LSFT', 0xe1, 'Shift'], ['KC_LALT', 0xe2, 'Alt'], ['KC_LGUI', 0xe3, 'Win'],
  ['KC_RCTL', 0xe4, 'R Ctrl'], ['KC_RSFT', 0xe5, 'R Shift'], ['KC_RALT', 0xe6, 'R Alt'], ['KC_RGUI', 0xe7, 'R Win'],
].forEach(a => def(...a));

// RGB matrix
[
  ['RGB_TOG', 0x7820, 'RGB On', 'Подсветка вкл/выкл', 'Lighting on/off'],
  ['RGB_MOD', 0x7821, 'RGB ▶', 'Следующий эффект', 'Next effect'],
  ['RGB_RMOD', 0x7822, 'RGB ◀', 'Предыдущий эффект', 'Previous effect'],
  ['RGB_HUI', 0x7823, 'Hue +', 'Оттенок +', 'Hue +'], ['RGB_HUD', 0x7824, 'Hue −', 'Оттенок −', 'Hue −'],
  ['RGB_SAI', 0x7825, 'Sat +', 'Насыщенность +', 'Saturation +'], ['RGB_SAD', 0x7826, 'Sat −', 'Насыщенность −', 'Saturation −'],
  ['RGB_VAI', 0x7827, 'Bri +', 'Яркость +', 'Brightness +'], ['RGB_VAD', 0x7828, 'Bri −', 'Яркость −', 'Brightness −'],
  ['RGB_SPI', 0x7829, 'Spd +', 'Скорость эффекта +', 'Effect speed +'], ['RGB_SPD', 0x782a, 'Spd −', 'Скорость эффекта −', 'Effect speed −'],
].forEach(([n, c, l, ru, en]) => def(n, c, l, { ru, en }));

def('QK_BOOT', 0x7c00, 'Boot', { ru: 'Перевести в режим прошивки (DFU)', en: 'Enter firmware update mode (DFU)' });

// Keyboard-specific keycodes (QK_KB_0 + n) come from the connected board's definition, see setCustom().
const QK_KB_0 = 0x7e00;
const HIDDEN_CUSTOM = ['RF_DFU', 'RGB_TEST']; // firmware-update / factory-test codes: shown, never offered

const MOD_NAMES = { 0x01: 'Ctrl', 0x02: 'Shift', 0x04: 'Alt', 0x08: 'Win' };

function modsLabel(m) {
  const right = m & 0x10 ? 'R' : '';
  return Object.entries(MOD_NAMES).filter(([b]) => m & b).map(([, n]) => right + n).join('+');
}

// Returns { main, sub } for drawing a keycap.
function describe(code) {
  if (code in LABEL) return { main: LABEL[code], sub: '' };
  if (code >= 0x0100 && code <= 0x1fff) {
    return { main: modsLabel(code >> 8) + '+' + (LABEL[code & 0xff] ?? hex(code & 0xff)), sub: '' };
  }
  const t = window.t;
  if (code >= 0x2000 && code <= 0x3fff) return { main: LABEL[code & 0xff] ?? hex(code & 0xff), sub: t('kc.hold', { x: modsLabel((code >> 8) & 0x1f) }) };
  if (code >= 0x4000 && code <= 0x4fff) return { main: LABEL[code & 0xff] ?? hex(code & 0xff), sub: t('kc.holdLayer', { n: (code >> 8) & 0xf }) };
  if (code >= 0x5200 && code <= 0x521f) return { main: 'TO ' + (code & 0x1f), sub: t('kc.layer') };
  if (code >= 0x5220 && code <= 0x523f) return { main: 'Fn ' + (code & 0x1f), sub: 'MO' };
  if (code >= 0x5240 && code <= 0x525f) return { main: 'DF ' + (code & 0x1f), sub: t('kc.layer') };
  if (code >= 0x5260 && code <= 0x527f) return { main: 'TG ' + (code & 0x1f), sub: t('kc.layer') };
  if (code >= 0x5280 && code <= 0x529f) return { main: 'OSL ' + (code & 0x1f), sub: t('kc.layer') };
  if (code >= 0x7700 && code <= 0x777f) return { main: 'M' + (code - 0x7700), sub: t('kc.macro') };
  return { main: hex(code), sub: '' };
}

function describeLong(code) {
  if (DESC[code]) return window.I18N.pick(DESC[code]);
  const d = describe(code);
  return d.sub ? `${d.main} (${d.sub})` : d.main;
}

function hex(n) { return '0x' + n.toString(16).toUpperCase().padStart(4, '0'); }

const layer = {
  MO: l => 0x5220 | l, TG: l => 0x5260 | l, TO: l => 0x5200 | l,
  DF: l => 0x5240 | l, OSL: l => 0x5280 | l, LT: (l, kc) => 0x4000 | (l << 8) | kc,
};
const MACRO = n => 0x7700 + n;
const withMods = (mods, kc) => (mods << 8) | kc;
const modTap = (mods, kc) => 0x2000 | (mods << 8) | kc;

// ---- translation for pre-v12 VIA firmware ----
const OLD_MOUSE = [0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xfb, 0xfc];
const NEW_MOUSE = [0xcd, 0xce, 0xcf, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd9, 0xda, 0xdb, 0xdc];

function fromDevice(c, proto) {
  if (proto >= 12) return c;
  if (c <= 0xff) { const i = OLD_MOUSE.indexOf(c); return i >= 0 ? NEW_MOUSE[i] : c; }
  if (c < 0x5000) return c;
  const hi = c & 0xff00, l = c & 0xf;
  if (hi === 0x5000) return 0x5200 | l;
  if (hi === 0x5100) return 0x5220 | l;
  if (hi === 0x5200) return 0x5240 | l;
  if (hi === 0x5300) return 0x5260 | l;
  if (hi === 0x5400) return 0x5280 | l;
  if (c >= 0x6000) return c - 0x4000;
  if (c >= 0x5cc2 && c <= 0x5ccc) return 0x7820 + (c - 0x5cc2);
  if (c === 0x5c00) return 0x7c00;
  if (c >= 0x5f12 && c <= 0x5f21) return 0x7700 + (c - 0x5f12);
  if (c >= 0x5f80 && c <= 0x5f9f) return QK_KB_0 + (c - 0x5f80);
  return c;
}

function toDevice(c, proto) {
  if (proto >= 12) return c;
  if (c <= 0xff) { const i = NEW_MOUSE.indexOf(c); return i >= 0 ? OLD_MOUSE[i] : c; }
  if (c >= 0x2000 && c <= 0x3fff) return c + 0x4000;
  if (c < 0x5000) return c;
  const l = c & 0x1f;
  if (c >= 0x5200 && c <= 0x521f) return 0x5010 | l;
  if (c >= 0x5220 && c <= 0x523f) return 0x5100 | l;
  if (c >= 0x5240 && c <= 0x525f) return 0x5200 | l;
  if (c >= 0x5260 && c <= 0x527f) return 0x5300 | l;
  if (c >= 0x5280 && c <= 0x529f) return 0x5400 | l;
  if (c >= 0x7820 && c <= 0x782a) return 0x5cc2 + (c - 0x7820);
  if (c === 0x7c00) return 0x5c00;
  if (c >= 0x7700 && c <= 0x770f) return 0x5f12 + (c - 0x7700);
  if (c >= QK_KB_0 && c <= QK_KB_0 + 0x1f) return 0x5f80 + (c - QK_KB_0);
  return c;
}

// Picker groups
const GROUPS = [
  { id: 'basic', title: 'Основные', keys: [
    'KC_ESC', ...Array.from({ length: 12 }, (_, i) => 'KC_F' + (i + 1)), 'KC_PSCR', 'KC_SCRL', 'KC_PAUS',
    'KC_GRV', ...'1234567890'.split('').map(c => 'KC_' + c), 'KC_MINS', 'KC_EQL', 'KC_BSPC',
    'KC_TAB', ...'QWERTYUIOP'.split('').map(c => 'KC_' + c), 'KC_LBRC', 'KC_RBRC', 'KC_BSLS',
    'KC_CAPS', ...'ASDFGHJKL'.split('').map(c => 'KC_' + c), 'KC_SCLN', 'KC_QUOT', 'KC_ENT',
    'KC_LSFT', ...'ZXCVBNM'.split('').map(c => 'KC_' + c), 'KC_COMM', 'KC_DOT', 'KC_SLSH', 'KC_RSFT',
    'KC_LCTL', 'KC_LGUI', 'KC_LALT', 'KC_SPC', 'KC_RALT', 'KC_RGUI', 'KC_APP', 'KC_RCTL',
    'KC_INS', 'KC_HOME', 'KC_PGUP', 'KC_DEL', 'KC_END', 'KC_PGDN', 'KC_UP', 'KC_LEFT', 'KC_DOWN', 'KC_RGHT',
    'KC_NO', 'KC_TRNS',
  ] },
  { id: 'media', title: 'Медиа', keys: [
    'KC_MUTE', 'KC_VOLD', 'KC_VOLU', 'KC_MPRV', 'KC_MPLY', 'KC_MNXT', 'KC_MSTP', 'KC_BRID', 'KC_BRIU',
    'KC_CALC', 'KC_MAIL', 'KC_MYCM', 'KC_WSCH', 'KC_WHOM', 'KC_WBAK', 'KC_WFWD', 'KC_WREF', 'KC_SLEP', 'KC_PWR',
  ] },
  { id: 'nav', title: 'Мышь и Num', keys: [
    'KC_MS_U', 'KC_MS_D', 'KC_MS_L', 'KC_MS_R', 'KC_BTN1', 'KC_BTN2', 'KC_BTN3', 'KC_BTN4', 'KC_BTN5',
    'KC_WH_U', 'KC_WH_D', 'KC_WH_L', 'KC_WH_R',
    'KC_NUM', 'KC_PSLS', 'KC_PAST', 'KC_PMNS', 'KC_PPLS', 'KC_PENT', 'KC_PDOT', 'KC_PEQL',
    'KC_P0', 'KC_P1', 'KC_P2', 'KC_P3', 'KC_P4', 'KC_P5', 'KC_P6', 'KC_P7', 'KC_P8', 'KC_P9',
    ...Array.from({ length: 12 }, (_, i) => 'KC_F' + (i + 13)), 'KC_NUBS', 'KC_NUHS',
  ] },
  { id: 'light', title: 'Подсветка', keys: [
    'RGB_TOG', 'RGB_MOD', 'RGB_RMOD', 'RGB_HUI', 'RGB_HUD', 'RGB_SAI', 'RGB_SAD', 'RGB_VAI', 'RGB_VAD', 'RGB_SPI', 'RGB_SPD',
  ] },
  { id: 'custom', keys: [] }, // filled by setCustom(); hidden when the board has none
  { id: 'special', keys: [] },
  { id: 'macro', keys: [] },
];

// Install the connected board's own keycodes: list of { name, label, desc } in QK_KB_0 order.
function setCustom(list) {
  for (const [name, code] of Object.entries(KC)) {
    if (code >= QK_KB_0 && code <= QK_KB_0 + 0x3f) { delete KC[name]; delete LABEL[code]; delete DESC[code]; }
  }
  list.forEach((k, i) => def(k.name, QK_KB_0 + i, k.label, k.desc));
  GROUPS.find(g => g.id === 'custom').keys = list.map(k => k.name).filter(n => !HIDDEN_CUSTOM.includes(n));
}

// Keys selectable as the "base" of a combo / layer-tap / mod-tap
const BASIC_FOR_COMBO = GROUPS[0].keys.filter(k => KC[k] > 1 && KC[k] < 0xe0)
  .concat(GROUPS[1].keys.slice(0, 9));

window.Keycodes = { KC, LABEL, describe, describeLong, hex, layer, MACRO, withMods, modTap, fromDevice, toDevice, GROUPS, BASIC_FOR_COMBO, setCustom, QK_KB_0 };
