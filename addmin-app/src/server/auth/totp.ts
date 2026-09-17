import crypto from "node:crypto";

// Hand-rolled RFC 6238 TOTP (HMAC-SHA1, 30s step, 6 digits) using only
// Node's stdlib crypto. otplib v13's TOTP class and functional verify() both
// throw ("Cannot read properties of undefined (reading 'length')") when run
// through this project's rollup-bundled server -- reproducible even via its
// plugin-free functional API, works fine unbundled. Rather than fight a
// third-party bundling incompatibility, this is ~50 lines of well-specified,
// dependency-free crypto.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

export function generateBase32Secret(byteLength = 20): string {
  const bytes = crypto.randomBytes(byteLength);
  return base32Encode(bytes);
}

function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue; // skip non-alphabet chars defensively
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secretBytes: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", secretBytes).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binaryCode % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export function generateTotp(base32Secret: string, timeMs: number = Date.now()): string {
  const counter = Math.floor(timeMs / 1000 / STEP_SECONDS);
  return hotp(base32Decode(base32Secret), counter);
}

/** Accepts the current step and one step on either side, to tolerate clock drift. */
export function verifyTotp(base32Secret: string, token: string, timeMs: number = Date.now()): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const secretBytes = base32Decode(base32Secret);
  const currentCounter = Math.floor(timeMs / 1000 / STEP_SECONDS);

  for (const drift of [0, -1, 1]) {
    const candidate = hotp(secretBytes, currentCounter + drift);
    if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(token))) {
      return true;
    }
  }
  return false;
}

export function getOtpAuthUri(base32Secret: string, accountLabel: string, issuer = "AddMin"): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
