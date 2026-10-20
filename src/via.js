// Minimal VIA raw-HID client over WebHID (32-byte reports, usage page 0xFF60 / usage 0x61).

const CMD = {
  GET_PROTOCOL_VERSION: 0x01,
  GET_KEYBOARD_VALUE: 0x02,
  GET_KEYCODE: 0x04,
  SET_KEYCODE: 0x05,
  RESET_KEYMAP: 0x06,
  CUSTOM_SET: 0x07,
  CUSTOM_GET: 0x08,
  CUSTOM_SAVE: 0x09,
  MACRO_COUNT: 0x0c,
  MACRO_BUFFER_SIZE: 0x0d,
  MACRO_GET_BUFFER: 0x0e,
  MACRO_SET_BUFFER: 0x0f,
  MACRO_RESET: 0x10,
  LAYER_COUNT: 0x11,
  KEYMAP_GET_BUFFER: 0x12,
  UNHANDLED: 0xff,
};

const LAYOUT_OPTIONS = 0x02;
const SWITCH_MATRIX_STATE = 0x03;
const RGB = { BRIGHTNESS: 1, EFFECT: 2, SPEED: 3, COLOR: 4 };

class ViaDevice {
  constructor(hid) {
    this.hid = hid;
    this.queue = Promise.resolve();
    this.pending = null;
    this.onReport = e => {
      if (!this.pending) return;
      const { resolve } = this.pending;
      this.pending = null;
      resolve(new Uint8Array(e.data.buffer));
    };
  }

  // Any QMK keyboard with VIA enabled exposes this raw-HID interface.
  static filters = [{ usagePage: 0xff60, usage: 0x61 }];

  static async pick() {
    const [dev] = await navigator.hid.requestDevice({ filters: ViaDevice.filters });
    return dev ? new ViaDevice(dev) : null;
  }

  static async known() {
    const devs = await navigator.hid.getDevices();
    const dev = devs.find(d => d.collections.some(c => c.usagePage === 0xff60));
    return dev ? new ViaDevice(dev) : null;
  }

  get name() { return this.hid.productName; }
  get pid() { return this.hid.productId; }
  get vid() { return this.hid.vendorId; }

  async open() {
    if (!this.hid.opened) await this.hid.open();
    this.hid.addEventListener('inputreport', this.onReport);
  }

  async close() {
    this.hid.removeEventListener('inputreport', this.onReport);
    if (this.hid.opened) await this.hid.close();
  }

  // Serialised request/response; one report in flight at a time.
  send(bytes) {
    const run = () => new Promise((resolve, reject) => {
      const buf = new Uint8Array(32);
      buf.set(bytes);
      const timer = setTimeout(() => { this.pending = null; reject(new Error(window.t('via.timeout'))); }, 1500);
      this.pending = { resolve: r => { clearTimeout(timer); resolve(r); } };
      this.hid.sendReport(0, buf).catch(err => { clearTimeout(timer); this.pending = null; reject(err); });
    });
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  async protocolVersion() {
    const r = await this.send([CMD.GET_PROTOCOL_VERSION]);
    return (r[1] << 8) | r[2];
  }

  async layerCount() {
    const r = await this.send([CMD.LAYER_COUNT]);
    return r[1];
  }

  // Reads the whole dynamic keymap: returns Uint16Array indexed [layer][row][col].
  async readKeymap(layers, rows, cols, onProgress) {
    const total = layers * rows * cols * 2;
    const bytes = new Uint8Array(total);
    for (let off = 0; off < total; off += 28) {
      const size = Math.min(28, total - off);
      const r = await this.send([CMD.KEYMAP_GET_BUFFER, off >> 8, off & 0xff, size]);
      bytes.set(r.slice(4, 4 + size), off);
      onProgress?.(off / total);
    }
    const out = new Uint16Array(total / 2);
    for (let i = 0; i < out.length; i++) out[i] = (bytes[i * 2] << 8) | bytes[i * 2 + 1];
    return out;
  }

  async setKeycode(layer, row, col, code) {
    const r = await this.send([CMD.SET_KEYCODE, layer, row, col, code >> 8, code & 0xff]);
    if (r[0] === CMD.UNHANDLED) throw new Error(window.t('via.rejected'));
  }

  async resetKeymap() { await this.send([CMD.RESET_KEYMAP]); }

  // Physical switch state (VIA "key tester"): returns Set of "row,col" currently pressed.
  async matrixState(rows, cols) {
    // Request: [cmd, value_id, row_offset]; reply echoes those 3 bytes, row data starts at byte 3.
    // Big matrices don't fit into one report, so rows are fetched in chunks.
    const per = Math.ceil(cols / 8);
    const perReport = Math.floor(28 / per);
    const down = new Set();
    for (let first = 0; first < rows; first += perReport) {
      const r = await this.send([CMD.GET_KEYBOARD_VALUE, SWITCH_MATRIX_STATE, first]);
      if (r[0] === CMD.UNHANDLED) throw new Error('unsupported');
      for (let row = first; row < Math.min(rows, first + perReport); row++) {
        let v = 0;
        for (let b = 0; b < per; b++) v = v * 256 + r[3 + (row - first) * per + b];
        for (let col = 0; col < cols; col++) if (Math.floor(v / 2 ** col) % 2) down.add(row + ',' + col);
      }
    }
    return down;
  }

  async macroCount() { return (await this.send([CMD.MACRO_COUNT]))[1]; }
  async macroBufferSize() { const r = await this.send([CMD.MACRO_BUFFER_SIZE]); return (r[1] << 8) | r[2]; }

  async readMacroBuffer(size) {
    const out = new Uint8Array(size);
    for (let off = 0; off < size; off += 28) {
      const n = Math.min(28, size - off);
      const r = await this.send([CMD.MACRO_GET_BUFFER, off >> 8, off & 0xff, n]);
      out.set(r.slice(4, 4 + n), off);
      // Stop early once we're past all data (two zero runs are enough to be safe).
    }
    return out;
  }

  async writeMacroBuffer(data) {
    await this.send([CMD.MACRO_RESET]);
    for (let off = 0; off < data.length; off += 28) {
      const chunk = data.slice(off, off + 28);
      await this.send([CMD.MACRO_SET_BUFFER, off >> 8, off & 0xff, chunk.length, ...chunk]);
    }
  }

  // Lighting. Protocol >= 12: custom-value channel (1 backlight, 2 rgblight, 3 rgb matrix) + value id.
  // Older firmware: flat lighting ids (backlight 0x09/0x0A, rgblight 0x80–0x83).
  setLighting(channel, proto) { this.channel = channel; this.legacy = proto < 12; }

  legacyId(id) {
    if (this.channel === 1) return { 1: 0x09, 2: 0x0a }[id];
    return { 1: 0x80, 2: 0x81, 3: 0x82, 4: 0x83 }[id];
  }

  async rgbGet(id) {
    if (this.legacy) {
      const lid = this.legacyId(id);
      if (lid == null) throw new Error('unsupported');
      const r = await this.send([CMD.CUSTOM_GET, lid]);
      if (r[0] === CMD.UNHANDLED) throw new Error('unsupported');
      return [r[2], r[3]];
    }
    const r = await this.send([CMD.CUSTOM_GET, this.channel, id]);
    if (r[0] === CMD.UNHANDLED) throw new Error('unsupported');
    return [r[3], r[4]];
  }

  async rgbSet(id, ...vals) {
    if (this.legacy) await this.send([CMD.CUSTOM_SET, this.legacyId(id), ...vals]);
    else await this.send([CMD.CUSTOM_SET, this.channel, id, ...vals]);
  }

  async rgbSave() { await this.send(this.legacy ? [CMD.CUSTOM_SAVE] : [CMD.CUSTOM_SAVE, this.channel]); }

  // Layout options (split backspace, ISO enter, …) as stored in the keyboard.
  async layoutOptions() {
    const r = await this.send([CMD.GET_KEYBOARD_VALUE, LAYOUT_OPTIONS]);
    if (r[0] === CMD.UNHANDLED) return 0;
    return ((r[2] << 24) | (r[3] << 16) | (r[4] << 8) | r[5]) >>> 0;
  }
}

window.ViaDevice = ViaDevice;
window.RGB = RGB;
