/**
 * Notifications internes (cloche) et destinataires côté collectivité.
 */

import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";

export type NotifType =
  | "reservation"
  | "message"
  | "signature"
  | "paiement"
  | "usager"
  | "subvention"
  | "rappel"
  | "personnel"
  | "systeme";

/** Pose une notification pour un utilisateur. */
export async function notifier(
  userId: string,
  type: NotifType,
  title: string,
  body: string | null = null,
  link: string | null = null,
): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, type, title, body, link } });
  } catch (e) {
    console.error("[notifications] écriture impossible :", e);
  }
}

/** Les agents à prévenir pour un espace : ses gestionnaires, sinon tous les gestionnaires et admins. */
export async function agentsPour(
  espaceId: number | null,
): Promise<{ id: string; email: string; name: string }[]> {
  if (espaceId) {
    const lies = await prisma.espaceGestionnaire.findMany({
      where: { espaceId, role: { in: ["gestionnaire", "notifie"] }, user: { isActive: true } },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    if (lies.length)
      return lies.map((l) => ({
        id: l.user.id,
        email: l.user.email,
        name: `${l.user.firstName} ${l.user.lastName}`.trim(),
      }));
  }
  const tous = await prisma.user.findMany({
    where: { kind: "agent", isActive: true, role: { in: ["admin", "gestionnaire"] } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  return tous.map((u) => ({
    id: u.id,
    email: u.email,
    name: `${u.firstName} ${u.lastName}`.trim(),
  }));
}

/** Notifie tous les agents concernés par un espace (cloche). Renvoie leurs adresses. */
export async function notifierAgents(
  espaceId: number | null,
  type: NotifType,
  title: string,
  body: string | null,
  link: string | null,
): Promise<string[]> {
  const agents = await agentsPour(espaceId);
  await Promise.all(agents.map((a) => notifier(a.id, type, title, body, link)));
  const cfg = await getSettings();
  const extra = cfg.AGENTS_NOTIFIES.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...agents.map((a) => a.email), ...extra])];
}

/** Marque lues les notifications d'un utilisateur (toutes, ou une seule). */
export async function marquerLues(userId: string, id?: number): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(id ? { id } : {}) },
    data: { readAt: new Date() },
  });
}
