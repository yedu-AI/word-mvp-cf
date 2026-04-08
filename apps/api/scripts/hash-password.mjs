import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const ITERATIONS = 120000;
const KEY_LENGTH = 32;

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function deriveHash(password, salt, iterations = ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    KEY_LENGTH * 8
  );
  return new Uint8Array(bits);
}

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error("Usage: node scripts/hash-password.mjs <password>");
    process.exit(1);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, Uint8Array.from(salt).buffer);
  const out = `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
