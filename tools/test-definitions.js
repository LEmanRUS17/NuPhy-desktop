// Checks definitions.js parsers: node tools/test-definitions.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.window = {};
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
require('../src/boards.js');
require('../src/definitions.js');
const D = window.Definitions;

// 1. raw VIA JSON with KLE keymap: 2 rows, a 2u key, a layout option (split backspace), a decal and an ISO-ish tall key
const raw = {
  name: 'Test 4x', vendorId: '0xFEED', productId: '0x0001', matrix: { rows: 2, cols: 4 },
  menus: ['qmk_rgblight'], customKeycodes: [{ name: 'MY_KEY', title: 'My key', shortName: 'MyK' }],
  layouts: {
    labels: ['Split Backspace'],
    keymap: [
      [{ name: 'meta' }],
      ['0,0', '0,1', { w: 2 }, '0,2\n\n\n\n\n\n\n\n0,0', { x: -2 }, '0,2\n\n\n\n\n\n\n\n0,1', '0,3\n\n\n\n\n\n\n\n0,1'],
      [{ d: true }, 'decal', '1,0', { h: 2 }, '1,1', { r: 15, rx: 3, ry: 1 }, '1,2'],
    ].slice(1),
  },
};
const b = D.fromFile(raw);
assert.strictEqual(b.vendorId, 0xfeed);
assert.strictEqual(b.keys.length, 5, 'base keys (decal skipped)');
assert.strictEqual(b.optionKeys.length, 3);
assert.strictEqual(b.lighting, 2);
assert.deepStrictEqual(b.custom, [{ name: 'MY_KEY', label: 'MyK', desc: 'My key' }]);
const tall = b.keys.find(k => k.r === 1 && k.c === 1);
assert.strictEqual(tall.h, 2);
const rotated = b.keys.find(k => k.r === 1 && k.c === 2);
assert.deepStrictEqual(rotated.rot, { r: 15, rx: 3, ry: 1 });
assert.strictEqual(rotated.x, 3);

const def0 = D.layoutKeys(b, [0]);
assert.strictEqual(def0.keys.length, 6, 'option 0: one 2u backspace');
assert.strictEqual(def0.width, 4);
const def1 = D.layoutKeys(b, [1]);
assert.strictEqual(def1.keys.length, 7, 'option 1: split backspace');

// 2. option bit packing: [toggle, 3-choice list] -> widths [1, 1]? (3 choices need 2 bits)
assert.deepStrictEqual(D.decodeOptions(0b110, ['Split', ['Enter', 'ANSI', 'ISO', 'Big']]), [1, 2]);
assert.deepStrictEqual(D.decodeOptions(0, ['Split']), [0]);

// 3. QMK keyboard.json (NuPhy file used to build boards.js)
const qmk = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ref', 'halo65_v2_ansi.json'), 'utf8'));
const h = D.fromFile(qmk);
assert.strictEqual(h.rows, 5);
assert.strictEqual(h.cols, 17);
assert.strictEqual(h.keys.length, 67);

// 4. VIA hosted definition shape
const hosted = {
  name: 'Hosted', vendorProductId: 0x12345678, matrix: { rows: 1, cols: 2 }, menus: ['qmk_backlight'],
  layouts: { labels: [], keys: [{ row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: -3, ry: -3 }, { row: 0, col: 1, x: 1, y: 0, w: 1, h: 1, r: 0 }], optionKeys: {} },
};
const v = D.fromFile(hosted);
assert.strictEqual(v.vendorId, 0x1234);
assert.strictEqual(v.productId, 0x5678);
assert.strictEqual(v.lighting, 1);
assert.strictEqual(v.keys[0].rot, null);

// 5. built-in boards resolve by name / pid
(async () => {
  const air = await D.resolve(0x19f5, 0x3245, 'NuPhy Air75 V2');
  assert.strictEqual(air.name, 'NuPhy Air75 V2');
  assert.strictEqual(air.custom[0].name, 'RF_DFU');
  const halo = await D.resolve(0x19f5, 0x9999, 'NuPhy Halo75 V2');
  assert.strictEqual(halo.name, 'NuPhy Halo75 V2');
  assert.ok(halo.custom.some(k => k.name === 'SIDE_MOD_A'));
  console.log('definitions: all checks passed');
})().catch(e => { console.error(e); process.exit(1); });
