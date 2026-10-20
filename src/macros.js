// VIA macro buffer <-> editable steps.
// Buffer: macros separated by 0x00. Text is raw ASCII; actions are
// [0x01 prefix (protocol >= 11)] + 0x01 tap | 0x02 down | 0x03 up + keycode byte,
// 0x04 delay + ascii digits + '|', 0x05/0x06/0x07 = tap/down/up with 16-bit keycode.

const SS = { TAP: 1, DOWN: 2, UP: 3, DELAY: 4, TAP16: 5, DOWN16: 6, UP16: 7 };
const MOD_KEYS = [0xe0, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7];

function splitMacros(buf, count, proto) {
  const out = [];
  let cur = [];
  for (let i = 0; i < buf.length && out.length < count; i++) {
    const b = buf[i];
    if (b === 0) { out.push(cur); cur = []; continue; }
    cur.push(b);
    // keycode bytes may legitimately be any value; copy them verbatim so the 0x00 split stays correct
    if (proto >= 11 && b === 1 && buf[i + 1] >= SS.TAP && buf[i + 1] <= SS.UP16) {
      const op = buf[++i]; cur.push(op);
      if (op === SS.DELAY) { while (i + 1 < buf.length && buf[i + 1] !== 0x7c) cur.push(buf[++i]); cur.push(buf[++i]); }
      else if (op >= SS.TAP16) { cur.push(buf[++i], buf[++i]); }
      else cur.push(buf[++i]);
    }
  }
  while (out.length < count) out.push([]);
  return out;
}

// bytes of one macro -> raw actions
function decode(bytes, proto) {
  const acts = [];
  let text = '';
  const flush = () => { if (text) { acts.push({ t: 'text', text }); text = ''; } };
  for (let i = 0; i < bytes.length; i++) {
    let b = bytes[i];
    const prefixed = proto >= 11 ? b === 1 : b >= SS.TAP && b <= SS.DELAY;
    if (!prefixed) { text += String.fromCharCode(b); continue; }
    flush();
    const op = proto >= 11 ? bytes[++i] : b;
    if (op === SS.DELAY) {
      let d = '';
      while (i + 1 < bytes.length && bytes[i + 1] !== 0x7c) d += String.fromCharCode(bytes[++i]);
      i++;
      acts.push({ t: 'delay', ms: parseInt(d, 10) || 0 });
    } else if (op >= SS.TAP16) {
      const code = (bytes[++i] << 8) | bytes[++i];
      acts.push({ t: ['tap', 'down', 'up'][op - SS.TAP16], code });
    } else {
      acts.push({ t: ['tap', 'down', 'up'][op - SS.TAP], code: bytes[++i] });
    }
  }
  flush();
  return acts;
}

// raw actions -> friendly steps (combo grouping)
function toSteps(acts) {
  const steps = [];
  for (let i = 0; i < acts.length; i++) {
    const a = acts[i];
    if (a.t === 'text') { steps.push({ type: 'text', text: a.text }); continue; }
    if (a.t === 'delay') { steps.push({ type: 'delay', ms: a.ms }); continue; }
    if (a.t === 'tap') { steps.push({ type: 'combo', mods: [], key: a.code }); continue; }
    if (a.t === 'down' && MOD_KEYS.includes(a.code)) {
      // collect down-mods, then a tap (or down/up of a key), then matching ups
      let j = i; const mods = [];
      while (j < acts.length && acts[j].t === 'down' && MOD_KEYS.includes(acts[j].code)) mods.push(acts[j++].code);
      let key = null;
      if (acts[j]?.t === 'tap') key = acts[j++].code;
      else if (acts[j]?.t === 'down' && acts[j + 1]?.t === 'up' && acts[j + 1].code === acts[j].code) { key = acts[j].code; j += 2; }
      const ups = [];
      while (j < acts.length && acts[j].t === 'up' && mods.includes(acts[j].code)) ups.push(acts[j++].code);
      if (ups.length === mods.length) {
        steps.push({ type: 'combo', mods, key: key ?? 0 });
        i = j - 1; continue;
      }
    }
    steps.push({ type: a.t, code: a.code });
  }
  return steps;
}

function encodeSteps(steps, proto) {
  const out = [];
  const op = (o, code) => {
    if (proto >= 11) out.push(1);
    if (code > 0xff) {
      if (proto < 11) return; // not representable
      out.push(o + 4, code >> 8, code & 0xff);
    } else out.push(o, code);
  };
  for (const s of steps) {
    if (s.type === 'text') {
      for (const ch of s.text) { const c = ch.charCodeAt(0); if (c >= 0x20 && c < 0x7f) out.push(c); }
    } else if (s.type === 'delay') {
      if (proto < 11) continue;
      out.push(1, SS.DELAY, ...String(Math.max(0, s.ms | 0)).split('').map(c => c.charCodeAt(0)), 0x7c);
    } else if (s.type === 'combo') {
      s.mods.forEach(m => op(SS.DOWN, m));
      if (s.key) op(SS.TAP, s.key);
      [...s.mods].reverse().forEach(m => op(SS.UP, m));
    } else if (s.type === 'down') op(SS.DOWN, s.code);
    else if (s.type === 'up') op(SS.UP, s.code);
    else if (s.type === 'tap') op(SS.TAP, s.code);
  }
  return out;
}

function buildBuffer(allSteps, proto) {
  const out = [];
  allSteps.forEach(steps => { out.push(...encodeSteps(steps, proto), 0); });
  return Uint8Array.from(out);
}

window.Macros = { splitMacros, decode, toSteps, encodeSteps, buildBuffer, MOD_KEYS };
