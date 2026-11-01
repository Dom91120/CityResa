/**
 * Mots de passe : hachage et vérification (scrypt de Better Auth, format `sel:hex`).
 */
import { hashPassword as baHash, verifyPassword as baVerify } from "better-auth/crypto";

export async function hashPassword(password: string): Promise<string> {
  return baHash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await baVerify({ hash, password });
  } catch {
    return false;
  }
}

/** Les règles d'un mot de passe acceptable ; null si tout va bien, sinon le reproche. */
export function reprocheMotDePasse(password: string, min: number): string | null {
  if (password.length < min) return `Le mot de passe doit contenir au moins ${min} caractères.`;
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password))
    return "Le mot de passe doit mêler lettres et chiffres.";
  return null;
}
