/**
 * The desktop app's local master password. Stored only as a salted SHA-256
 * hash ("sha256$<salt>$<hash>"), never as the password itself. Installs that
 * saved the old plaintext value keep working and are upgraded to a hash on
 * their next successful unlock.
 */

const KEY = 'kamai_master_password';
const PREFIX = 'sha256$';

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function digest(salt: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function hasMasterPassword(): boolean {
  try {
    return Boolean(localStorage.getItem(KEY));
  } catch {
    return false;
  }
}

export async function setMasterPassword(password: string): Promise<void> {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  localStorage.setItem(KEY, `${PREFIX}${salt}$${await digest(salt, password)}`);
}

export async function verifyMasterPassword(password: string): Promise<boolean> {
  const stored = localStorage.getItem(KEY) || '';
  if (!stored) return false;
  if (stored.startsWith(PREFIX)) {
    const [, salt, hash] = stored.split('$');
    return constantTimeEqual(await digest(salt || '', password), hash || '');
  }
  // Legacy plaintext value: accept once, then store it hashed.
  const ok = constantTimeEqual(stored, password);
  if (ok) await setMasterPassword(password);
  return ok;
}
