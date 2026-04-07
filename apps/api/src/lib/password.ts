const ITERATIONS = 120000;
const KEY_LENGTH = 32;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveHash(password: string, salt: Uint8Array, iterations = ITERATIONS): Promise<Uint8Array> {
  const saltBuffer = Uint8Array.from(salt).buffer;
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations },
    keyMaterial,
    KEY_LENGTH * 8
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, salt);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, iterStr, saltB64, hashB64] = stored.split("$");
  if (algo !== "pbkdf2" || !iterStr || !saltB64 || !hashB64) return false;
  const iterations = Number(iterStr);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;

  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  const calculated = await deriveHash(password, salt, iterations);
  return timingSafeEqual(calculated, expected);
}
