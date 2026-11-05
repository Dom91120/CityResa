/**
 * La connexion : blocage par couple (adresse, IP) après LOGIN_MAX_ATTEMPTS échecs ;
 * second facteur : la session n'est ouverte qu'après le code. La session elle-même
 * est ouverte par Better Auth (`signInEmail`).
 */
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { auditRecord } from "@/server/audit";
import { auth } from "@/server/auth";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { verifyPassword } from "@/server/password";
import { setPending2fa } from "@/server/session-2fa";

export type Connexion =
  | { ok: true; twoFactor: false; isAgent: boolean }
  | { ok: true; twoFactor: true; isAgent: boolean }
  | { ok: false; message: string };

/** Ne garde `next` que s'il s'agit d'un chemin interne (pas de redirection ouverte). */
export function safeNext(value: string | null | undefined): string | null {
  if (value?.startsWith("/") && !value.startsWith("//")) return value;
  return null;
}

async function ouvrirSession(email: string, password: string): Promise<"ok" | "2fa"> {
  const res = await auth.api.signInEmail({
    body: { email, password },
    headers: await headers(),
  });
  if (
    res &&
    "twoFactorRedirect" in (res as object) &&
    (res as { twoFactorRedirect?: boolean }).twoFactorRedirect
  )
    return "2fa";
  return "ok";
}

export async function seConnecter(
  emailBrut: string,
  password: string,
  ip: string,
  next: string | null,
): Promise<Connexion> {
  const email = emailBrut.trim().toLowerCase();
  const cfg = await getSettings();
  const now = new Date();
  const maxAttempts = cfg.LOGIN_MAX_ATTEMPTS;
  const lockoutMin = cfg.LOGIN_LOCKOUT_MINUTES;

  const throttle = await prisma.loginThrottle.findUnique({
    where: { identifier_ip: { identifier: email, ip } },
  });
  if (throttle?.lockedUntil && throttle.lockedUntil > now) {
    const mins = Math.floor((throttle.lockedUntil.getTime() - now.getTime()) / 60000) + 1;
    return { ok: false, message: `Trop de tentatives. Réessayez dans ${mins} minute(s).` };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  let authed = false;
  if (user?.isActive) {
    const cred = await prisma.authAccount.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });
    authed = Boolean(cred?.password && (await verifyPassword(cred.password, password)));
  }

  if (authed && user) {
    if (throttle) await prisma.loginThrottle.delete({ where: { id: throttle.id } }).catch(() => {});
    let resultat: "ok" | "2fa";
    try {
      resultat = await ouvrirSession(email, password);
    } catch (e) {
      if (e instanceof APIError) return { ok: false, message: e.message || "Connexion refusée." };
      throw e;
    }
    const isAgent = user.kind === "agent";
    if (resultat === "2fa") {
      await setPending2fa(user.id, next);
      return { ok: true, twoFactor: true, isAgent };
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now, inactivitePreavisAt: null },
    });
    await auditRecord("connexion", "", "securite", user.email);
    return { ok: true, twoFactor: false, isAgent };
  }

  const rows = await prisma.$queryRaw<{ failures: number }[]>`
    INSERT INTO login_throttle ("identifier", "ip", "failures", "updated_at")
    VALUES (${email}, ${ip}, 1, now())
    ON CONFLICT ("identifier", "ip") DO UPDATE SET
      "failures" = COALESCE(login_throttle."failures", 0) + 1,
      "updated_at" = now()
    RETURNING "failures"`;
  const failed = Number(rows[0]?.failures ?? 1);
  if (failed >= maxAttempts) {
    await prisma.loginThrottle.update({
      where: { identifier_ip: { identifier: email, ip } },
      data: { lockedUntil: new Date(now.getTime() + lockoutMin * 60000), failures: 0 },
    });
    await auditRecord("compte bloqué", `identifiant : ${email}`, "securite", "anonyme");
    return { ok: false, message: `Trop de tentatives. Compte bloqué ${lockoutMin} minute(s).` };
  }
  await auditRecord("échec connexion", `identifiant : ${email}`, "securite", "anonyme");
  const restantes = maxAttempts - failed;
  return { ok: false, message: `Identifiants incorrects (${restantes} tentative(s) restante(s)).` };
}
