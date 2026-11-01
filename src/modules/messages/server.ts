/**
 * La boîte de réception des agents : les fils de discussion groupés par dossier, dans le
 * périmètre de l'agent, avec le dernier message et le nombre de messages non lus.
 */
import type { Prisma } from "@/generated/prisma/client";
import { perimetre } from "@/modules/reservations/requetes";
import { prisma } from "@/server/db";
import type { CurrentUser } from "@/server/guards";
import { normaliser } from "@/server/paging";

const INCLUDE_MESSAGE = {
  author: { select: { firstName: true, lastName: true, email: true } },
  reservation: {
    select: {
      id: true,
      numero: true,
      title: true,
      status: true,
      startAt: true,
      espace: { select: { name: true, shortName: true, color: true } },
      organisation: { select: { name: true, type: true } },
      user: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.MessageInclude;

export type MessageBoite = Prisma.MessageGetPayload<{ include: typeof INCLUDE_MESSAGE }>;

export type Conversation = {
  reservation: MessageBoite["reservation"];
  dernier: MessageBoite;
  nonLus: number;
  total: number;
};

/** Le WHERE des messages visibles par l'agent (hors notes internes). */
export function whereMessages(user: CurrentUser): Prisma.MessageWhereInput {
  const per = perimetre(user);
  return { isInternal: false, ...(Object.keys(per).length ? { reservation: per } : {}) };
}

export function auteurDe(m: MessageBoite): string {
  if (m.authorKind === "systeme") return "CityRésa";
  if (m.author) return `${m.author.firstName} ${m.author.lastName}`.trim() || m.author.email;
  if (m.authorKind === "usager")
    return (
      m.reservation.organisation?.name ??
      (m.reservation.user
        ? `${m.reservation.user.firstName} ${m.reservation.user.lastName}`.trim()
        : "Usager")
    );
  return "Un agent";
}

/** Les conversations, la plus récente en tête ; `nonLus` compte les messages de l'usager non lus. */
export async function conversations(user: CurrentUser, q = ""): Promise<Conversation[]> {
  const messages = await prisma.message.findMany({
    where: whereMessages(user),
    include: INCLUDE_MESSAGE,
    orderBy: { createdAt: "desc" },
    take: 3000,
  });
  const map = new Map<number, Conversation>();
  for (const m of messages) {
    const c = map.get(m.reservationId);
    const nonLu = m.authorKind === "usager" && !m.readAt ? 1 : 0;
    if (!c)
      map.set(m.reservationId, { reservation: m.reservation, dernier: m, nonLus: nonLu, total: 1 });
    else {
      c.nonLus += nonLu;
      c.total += 1;
    }
  }
  let out = [...map.values()];
  const ql = normaliser(q);
  if (ql)
    out = out.filter((c) =>
      normaliser(
        [
          c.reservation.numero,
          c.reservation.title,
          c.reservation.organisation?.name,
          c.reservation.espace.name,
          c.dernier.body,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(ql),
    );
  return out;
}

/** Marque lus tous les messages d'usagers du périmètre. Renvoie le nombre traité. */
export async function toutMarquerLu(user: CurrentUser): Promise<number> {
  const r = await prisma.message.updateMany({
    where: { ...whereMessages(user), authorKind: "usager", readAt: null },
    data: { readAt: new Date() },
  });
  return r.count;
}
