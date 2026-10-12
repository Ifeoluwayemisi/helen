import crypto from 'crypto';

const KEY_LENGTH = 64;

/**
 * Hashes a plaintext password or PIN using scrypt with a unique cryptographically random salt.
 * Format: scrypt$<hex_salt>$<hex_derived_key>
 */
export async function hashCredential(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(plain, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verifies a plaintext password or PIN against the stored scrypt hash using timingSafeEqual.
 */
export async function verifyCredential(plain: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const salt = parts[1];
  const expectedKey = Buffer.from(parts[2], 'hex');

  return new Promise((resolve) => {
    crypto.scrypt(plain, salt, expectedKey.length, (err, derivedKey) => {
      if (err) return resolve(false);
      try {
        const matches = crypto.timingSafeEqual(expectedKey, derivedKey);
        resolve(matches);
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * Generates an unguessable 256-bit cryptographically secure session token.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a session token using SHA-256 for secure database storage.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
