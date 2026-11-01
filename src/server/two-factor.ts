/**
 * Second facteur TOTP : enrôlement depuis le profil (QR code + clé), confirmation par un
 * premier code, verrouillage après LOGIN_MAX_ATTEMPTS échecs à la connexion. Le stockage
 * et la vérification des codes sont ceux du plugin `twoFactor` de Better Auth.
 */
import { createOTP } from "@better-auth/utils/otp";
import { generateRandomString, symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";

export type Enrolement = { secret: string; uri: string; cleManuelle: string };

export async function initTwoFactor(userId: string, email: string): Promise<Enrolement> {
  const ctx = await auth.$context;
  const secret = generateRandomString(32);
  const encrypted = await symmetricEncrypt({ key: ctx.secretConfig, data: secret });
  const backup = await symmetricEncrypt({ key: ctx.secretConfig, data: JSON.stringify([]) });
  const existing = await prisma.twoFactor.findFirst({ where: { userId } });
  const data = {
    secret: encrypted,
    backupCodes: backup,
    verified: false,
    failedVerificationCount: 0,
    lockedUntil: null,
  };
  if (existing) await prisma.twoFactor.update({ where: { id: existing.id }, data });
  else await prisma.twoFactor.create({ data: { ...data, userId } });
  const uri = createOTP(secret, { digits: 6, period: 30 }).url("CityResa", email);
  const cleManuelle = new URL(uri).searchParams.get("secret") ?? "";
  return { secret, uri, cleManuelle };
}

export async function pendingEnrolement(userId: string, email: string): Promise<Enrolement | null> {
  const ctx = await auth.$context;
  const row = await prisma.twoFactor.findFirst({ where: { userId, verified: false } });
  if (!row) return null;
  const secret = await symmetricDecrypt({ key: ctx.secretConfig, data: row.secret });
  const uri = createOTP(secret, { digits: 6, period: 30 }).url("CityResa", email);
  return { secret, uri, cleManuelle: new URL(uri).searchParams.get("secret") ?? "" };
}

export async function cancelEnrolement(userId: string): Promise<void> {
  await prisma.twoFactor.deleteMany({ where: { userId, verified: false } });
}

export async function resetTwoFactor(userId: string): Promise<void> {
  await prisma.twoFactor.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, totpFailedCount: 0, totpLockedUntil: null },
  });
}

export function normaliserCode(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "");
}
