// Own SHA-256 / HMAC-SHA256 against published test vectors (FIPS 180-2 examples, RFC 4231) and Node's crypto.
import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hmacSha256, sha256, toHex, utf8 } from '../src/core/sha256';
import { streamValue, streamValueV1, streamValueV2 } from '../src/core/round';

const fill = (n: number, v: number) => new Uint8Array(n).fill(v);
const hex = (s: string) => new Uint8Array(s.match(/../g)!.map((x) => parseInt(x, 16)));

describe('SHA-256 published vectors', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    ['abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
      'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1'],
  ])('sha256(%j)', (msg, want) => expect(toHex(sha256(utf8(msg)))).toBe(want));
  it('one million "a"', () => expect(toHex(sha256(fill(1_000_000, 0x61)))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'));
});

describe('HMAC-SHA256 RFC 4231', () => {
  it.each([
    ['1', fill(20, 0x0b), utf8('Hi There'), 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'],
    ['2', utf8('Jefe'), utf8('what do ya want for nothing?'), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'],
    ['3', fill(20, 0xaa), fill(50, 0xdd), '773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe'],
    ['4', hex('0102030405060708090a0b0c0d0e0f10111213141516171819'), fill(50, 0xcd), '82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b'],
    ['6', fill(131, 0xaa), utf8('Test Using Larger Than Block-Size Key - Hash Key First'), '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54'],
    ['7', fill(131, 0xaa), utf8('This is a test using a larger than block-size key and a larger than block-size data. The key needs to be hashed before being used by the HMAC algorithm.'),
      '9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2'],
  ])('test case %s', (_n, key, msg, want) => expect(toHex(hmacSha256(key, msg))).toBe(want));
});

it('matches Node crypto on every message length 0..200 and several key lengths', () => {
  for (const kl of [0, 1, 4, 32, 63, 64, 65, 100]) {
    const key = new Uint8Array(kl).map((_, i) => (i * 37 + kl) & 255);
    for (let n = 0; n <= 200; n++) {
      const msg = new Uint8Array(n).map((_, i) => (i * 101 + n) & 255);
      expect(toHex(hmacSha256(key, msg))).toBe(createHmac('sha256', key).update(msg).digest('hex'));
      if (kl === 0) expect(toHex(sha256(msg))).toBe(createHash('sha256').update(msg).digest('hex'));
    }
  }
});

it('generator v2: streamValue = first 52 bits of HMAC-SHA256(key = seed as 4 bytes big-endian, msg = "stream#k") / 2^52', () => {
  for (const seed of [0, 1, 4242, 102978669, 0xffffffff]) for (const stream of ['outcome', 'failureType', 'break', 'variety']) for (const k of [0, 1, 17, 36]) {
    const key = new Uint8Array([seed >>> 24, (seed >>> 16) & 255, (seed >>> 8) & 255, seed & 255]);
    const h = createHmac('sha256', key).update(`${stream}#${k}`).digest('hex');
    const want = parseInt(h.slice(0, 13), 16) / 2 ** 52; // 13 hex digits = 52 bits
    expect(streamValueV2(seed, stream, k)).toBe(want);
    expect(streamValue(seed, stream, k)).toBe(want); // v2 is the default
    expect(streamValue(seed, stream, k, 1)).toBe(streamValueV1(seed, stream, k));
  }
});
