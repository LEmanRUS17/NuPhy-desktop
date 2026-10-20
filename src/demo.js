// Demo devices for trying the UI without a keyboard: `npm run demo` (NuPhy Air75 V2, built-in definition)
// or `electron . --demo=via` (KBD75 rev2, definition downloaded from the VIA database).
const demoKind = new URLSearchParams(location.search).get('demo');
if (demoKind != null) {
  const WIN = `ESC F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 PSCR INS DEL
GRV 1 2 3 4 5 6 7 8 9 0 MINS EQL BSPC PGUP
TAB Q W E R T Y U I O P LBRC RBRC BSLS PGDN
CAPS A S D F G H J K L SCLN QUOT ENT HOME
LSFT Z X C V B N M COMM DOT SLSH RSFT UP END
LCTL LGUI LALT SPC RALT MO3 RCTL LEFT DOWN RGHT`.split(/\s+/);
  const code = n => (n.startsWith('MO') ? 0x5220 + +n[2] : window.Keycodes.KC['KC_' + n]);

  const device = ({ name, vid, pid, rows, cols, layers, fill }) => {
    const map = new Uint16Array(layers * rows * cols).fill(1);
    fill(map, rows, cols);
    let macros = Uint8Array.from([1, 2, 0xe2, 1, 2, 0xe1, 1, 3, 0xe1, 1, 3, 0xe2, 0, ...'hello'.split('').map(c => c.charCodeAt(0)), 0]);
    const rgb = { 1: [128, 0], 2: [12, 0], 3: [128, 0], 4: [140, 255] };
    return {
      name, vid, pid, hid: {},
      open: async () => {}, close: async () => {},
      protocolVersion: async () => 12, layerCount: async () => layers,
      readKeymap: async (_l, _r, _c, p) => { p?.(1); return map.slice(); },
      setKeycode: async (l, r, c, v) => { map[(l * rows + r) * cols + c] = v; },
      resetKeymap: async () => {},
      // set window.demoDown = new Set(['row,col', ...]) from devtools to simulate presses
      matrixState: async () => new Set(window.demoDown || []),
      layoutOptions: async () => 0,
      setLighting: () => {},
      macroCount: async () => 16, macroBufferSize: async () => 1024,
      readMacroBuffer: async size => { const b = new Uint8Array(size); b.set(macros); return b; },
      writeMacroBuffer: async d => { macros = d; },
      rgbGet: async id => rgb[id], rgbSet: async (id, ...v) => { rgb[id] = v; }, rgbSave: async () => {},
    };
  };

  window.DEMO = () => {
    if (demoKind === 'via' || demoKind === 'unknown') {
      const unknown = demoKind === 'unknown'; // not in the VIA database → definition prompt
      return device({
        name: unknown ? 'Unknown Board (демо)' : 'KBD75 rev2 (демо)', vid: unknown ? 0x1234 : 0x4b42, pid: unknown ? 0x5678 : 0x6061,
        rows: 6, cols: 16, layers: 4,
        fill: (map, rows, cols) => { for (let i = 0; i < rows * cols; i++) map[i] = 0x04 + (i % 40); },
      });
    }
    const b = window.BUILTIN_BOARDS[0];
    return device({
      name: 'NuPhy Air75 V2 (демо)', vid: 0x19f5, pid: 0x3245, rows: b.rows, cols: b.cols, layers: 5,
      fill: (map, rows, cols) => {
        const put = (l, names) => b.keys.forEach(([r, c], i) => (map[(l * rows + r) * cols + c] = code(names[i])));
        put(0, WIN.map(n => (n === 'MO3' ? 'MO1' : n)));
        put(2, WIN);
      },
    });
  };
}
