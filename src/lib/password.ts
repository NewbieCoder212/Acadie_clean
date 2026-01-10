import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password using bcrypt
 * @param password - The plain-text password to hash
 * @returns The hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return hash;
}

/**
 * Verify a plain-text password against a hashed password
 * @param password - The plain-text password to verify
 * @param hashedPassword - The hashed password to compare against
 * @returns True if the password matches, false otherwise
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch (error) {
    console.error('[Password] Verification error:', error);
    return false;
  }
}

/**
 * Check if a string is already a bcrypt hash
 * Bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 characters long
 */
export function isBcryptHash(str: string): boolean {
  return /^\$2[aby]\$\d{2}\$.{53}$/.test(str);
}
