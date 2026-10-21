// ===== Codecs for saves and maps: typed arrays as run-length bytes in base64 =====
// Loaded before map.js. Plain functions with no game state, so tests and tools can use them on their own.
// - rleEncode / rleDecode: PackBits run-length bytes. A control byte c below 128 is followed by c + 1 literal bytes;
//   c of 128 or more repeats the next byte c - 125 times (3 to 130). Map layers, fog and occupancy are long runs.
// - b64Encode / b64Decode: standard base64 with padding, in plain JS (the node test harness has no btoa).
// - packArray / unpackArray: a typed array as { t, n, d }: its type name, length and base64 run-length bytes
//   (little-endian, as every browser and node store them).
'use strict';
const CODEC = { cap: 256 * 1024 * 1024 };   // sanity cap on any save or map text, file or inflated file: 256 MB
const CODEC_TYPES = { Uint8Array, Int16Array, Int32Array, Uint32Array, Float32Array };   // the typed arrays a save may hold (as in v1)
function rleEncode(src) {
  const n = src.length, out = new Uint8Array(n + Math.ceil(n / 128) + 2);
  let o = 0, i = 0;
  while (i < n) {
    let r = 1; const v = src[i];
    while (i + r < n && r < 130 && src[i + r] === v) r++;
    if (r >= 3) { out[o++] = r + 125; out[o++] = v; i += r; continue; }
    let j = i;   // a literal run: up to 128 bytes, ending where a run of 3 equal bytes starts
    while (j < n && j - i < 128 && !(j + 2 < n && src[j] === src[j + 1] && src[j] === src[j + 2])) j++;
    out[o++] = j - i - 1; out.set(src.subarray(i, j), o); o += j - i; i = j;
  }
  return out.slice(0, o);
}
function rleDecode(src, len) {
  const out = new Uint8Array(len);
  let o = 0, i = 0;
  while (i < src.length) {
    const c = src[i++];
    if (c < 128) {
      const L = c + 1; if (i + L > src.length || o + L > len) throw new Error('Invalid run-length data.');
      out.set(src.subarray(i, i + L), o); i += L; o += L;
    } else {
      const L = c - 125; if (i >= src.length || o + L > len) throw new Error('Invalid run-length data.');
      out.fill(src[i++], o, o + L); o += L;
    }
  }
  if (o !== len) throw new Error('Invalid run-length data.');
  return out;
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_CODE = Uint8Array.from(B64, c => c.charCodeAt(0));
const B64_REV = (() => { const r = new Int16Array(128).fill(-1); for (let i = 0; i < 64; i++) r[B64.charCodeAt(i)] = i; return r; })();
function b64Encode(b) {
  const n = b.length, CH = 3 * 4096, codes = new Uint16Array(4 * 4096), out = [];
  for (let s = 0; s < n; s += CH) {
    const e = Math.min(n, s + CH); let k = 0, i = s;
    for (; i + 2 < e; i += 3) { const v = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2]; codes[k++] = B64_CODE[v >> 18]; codes[k++] = B64_CODE[(v >> 12) & 63]; codes[k++] = B64_CODE[(v >> 6) & 63]; codes[k++] = B64_CODE[v & 63]; }
    if (i < e) {   // the last 1 or 2 bytes (only in the last chunk: CH is a multiple of 3)
      const two = i + 1 < e, v = (b[i] << 16) | (two ? b[i + 1] << 8 : 0);
      codes[k++] = B64_CODE[v >> 18]; codes[k++] = B64_CODE[(v >> 12) & 63]; codes[k++] = two ? B64_CODE[(v >> 6) & 63] : 61; codes[k++] = 61;
    }
    out.push(String.fromCharCode.apply(null, codes.subarray(0, k)));
  }
  return out.join('');
}
function b64Decode(s) {
  if (typeof s !== 'string' || s.length % 4) throw new Error('Invalid base64 data.');
  const L = s.length, pad = L && s.charCodeAt(L - 1) === 61 ? (s.charCodeAt(L - 2) === 61 ? 2 : 1) : 0, n = L / 4 * 3 - pad, out = new Uint8Array(n);
  const at = i => { const c = s.charCodeAt(i), v = c < 128 ? B64_REV[c] : -1; if (v < 0) throw new Error('Invalid base64 data.'); return v; };
  let o = 0;
  for (let i = 0; i < L; i += 4) {
    const last = i + 4 === L, c3 = last && pad === 2 ? 0 : at(i + 2), c4 = last && pad ? 0 : at(i + 3);
    const v = (at(i) << 18) | (at(i + 1) << 12) | (c3 << 6) | c4;
    out[o++] = v >> 16; if (o < n) out[o++] = (v >> 8) & 255; if (o < n) out[o++] = v & 255;
  }
  return out;
}
function packArray(a) {
  const t = a.constructor.name;
  if (!Object.prototype.hasOwnProperty.call(CODEC_TYPES, t)) throw new Error('Cannot save a ' + t + '.');
  return { t, n: a.length, d: b64Encode(rleEncode(new Uint8Array(a.buffer, a.byteOffset, a.byteLength))) };
}
function unpackArray(p, maxLen) {
  if (!p || typeof p !== 'object' || !Object.prototype.hasOwnProperty.call(CODEC_TYPES, p.t) || !Number.isInteger(p.n) || p.n < 0 || p.n > maxLen || typeof p.d !== 'string') throw new Error('Invalid numeric layer.');
  const Type = CODEC_TYPES[p.t], a = new Type(rleDecode(b64Decode(p.d), p.n * Type.BYTES_PER_ELEMENT).buffer);
  if (Type === Float32Array) for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) throw new Error('Invalid numeric layer.');
  return a;
}
