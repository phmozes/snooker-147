// SHA-256 and HMAC-SHA256 (FIPS 180-4, RFC 2104), own small implementation: synchronous, no dependencies, the same
// result in the browser and in Node. Checked against published test vectors (tests/sha256.test.ts).
// Used by the outcome generator v2 (round.ts streamValue, docs/FAIRNESS.md). Pure: no Math.random.

const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const W = new Int32Array(64);
const BUF = new Uint8Array(64);
const S = new Int32Array(8);

/** One compression: state (8 words) is updated in place with the 64-byte block at `off` of `b`. */
function compress(state: Int32Array, b: Uint8Array, off: number): void {
  for (let i = 0; i < 16; i++) {
    const j = off + i * 4;
    W[i] = (b[j]! << 24) | (b[j + 1]! << 16) | (b[j + 2]! << 8) | b[j + 3]!;
  }
  for (let i = 16; i < 64; i++) {
    const x = W[i - 15]!, y = W[i - 2]!;
    const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
    const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
    W[i] = (W[i - 16]! + s0 + W[i - 7]! + s1) | 0;
  }
  let a = state[0]!, bb = state[1]!, c = state[2]!, d = state[3]!, e = state[4]!, f = state[5]!, g = state[6]!, h = state[7]!;
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (h + S1 + ch + K[i]! + W[i]!) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & bb) ^ (a & c) ^ (bb & c);
    const t2 = (S0 + maj) | 0;
    h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
  }
  state[0] = (state[0]! + a) | 0; state[1] = (state[1]! + bb) | 0; state[2] = (state[2]! + c) | 0; state[3] = (state[3]! + d) | 0;
  state[4] = (state[4]! + e) | 0; state[5] = (state[5]! + f) | 0; state[6] = (state[6]! + g) | 0; state[7] = (state[7]! + h) | 0;
}

/** Hash `msg` continuing from `state` that has already absorbed `prefixLen` bytes (a multiple of 64). Returns 8 words. */
function finish(state: Int32Array, msg: Uint8Array, prefixLen: number): Int32Array {
  const s = new Int32Array(state);
  const full = msg.length - (msg.length % 64);
  for (let off = 0; off < full; off += 64) compress(s, msg, off);
  const rest = msg.length - full;
  const tail = new Uint8Array(rest < 56 ? 64 : 128);
  tail.set(msg.subarray(full));
  tail[rest] = 0x80;
  const bits = (prefixLen + msg.length) * 8; // fits in 2^53
  const hi = Math.floor(bits / 2 ** 32), lo = bits >>> 0;
  const n = tail.length;
  tail[n - 8] = hi >>> 24; tail[n - 7] = hi >>> 16; tail[n - 6] = hi >>> 8; tail[n - 5] = hi;
  tail[n - 4] = lo >>> 24; tail[n - 3] = lo >>> 16; tail[n - 2] = lo >>> 8; tail[n - 1] = lo;
  for (let off = 0; off < n; off += 64) compress(s, tail, off);
  return s;
}

const wordsToBytes = (w: Int32Array): Uint8Array => {
  const out = new Uint8Array(w.length * 4);
  for (let i = 0; i < w.length; i++) { out[i * 4] = w[i]! >>> 24; out[i * 4 + 1] = w[i]! >>> 16; out[i * 4 + 2] = w[i]! >>> 8; out[i * 4 + 3] = w[i]!; }
  return out;
};

export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
export const toHex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

export function sha256(msg: Uint8Array): Uint8Array {
  return wordsToBytes(finish(new Int32Array(IV), msg, 0));
}

/** HMAC with the key's inner and outer pad states precomputed (reuse it for many messages with one key). */
export class HmacSha256 {
  private inner = new Int32Array(IV);
  private outer = new Int32Array(IV);
  constructor(key: Uint8Array) {
    const k = new Uint8Array(64);
    k.set(key.length > 64 ? sha256(key) : key);
    const ip = new Uint8Array(64), op = new Uint8Array(64);
    for (let i = 0; i < 64; i++) { ip[i] = k[i]! ^ 0x36; op[i] = k[i]! ^ 0x5c; }
    compress(this.inner, ip, 0);
    compress(this.outer, op, 0);
  }
  /** The MAC as 8 big-endian 32-bit words (signed Int32). */
  words(msg: Uint8Array): Int32Array {
    return finish(this.outer, wordsToBytes(finish(this.inner, msg, 64)), 64);
  }
  /** Fast path for a message of at most 55 bytes (two compressions, no allocation): the first two words of the MAC. */
  first2(msg: Uint8Array): [number, number] {
    const b = BUF, n = msg.length;
    if (n > 55) { const w = this.words(msg); return [w[0]!, w[1]!]; }
    b.fill(0); b.set(msg); b[n] = 0x80;
    const bits = (64 + n) * 8; b[62] = bits >>> 8; b[63] = bits;
    S.set(this.inner); compress(S, b, 0);
    b.fill(0);
    for (let i = 0; i < 8; i++) { b[i * 4] = S[i]! >>> 24; b[i * 4 + 1] = S[i]! >>> 16; b[i * 4 + 2] = S[i]! >>> 8; b[i * 4 + 3] = S[i]!; }
    b[32] = 0x80; b[62] = (96 * 8) >>> 8; b[63] = 96 * 8;
    S.set(this.outer); compress(S, b, 0);
    return [S[0]!, S[1]!];
  }
  digest(msg: Uint8Array): Uint8Array {
    return wordsToBytes(this.words(msg));
  }
}

export const hmacSha256 = (key: Uint8Array, msg: Uint8Array): Uint8Array => new HmacSha256(key).digest(msg);
