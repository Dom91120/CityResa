/**
 * Recherche globale (Ctrl K) : réservations, espaces, sites, organisations, usagers,
 * matériel, subventions. Sans casse ni accents, sur les champs texte principaux.
 */

import { RESERVATION_STATUS, type ReservationStatus } from "@/lib/constantes";
import { nomRepresentant } from "@/lib/dossier-usager";
import { dateMoyenne } from "@/lib/libelles";
import { prisma } from "@/server/db";
import type { CurrentUser } from "@/server/guards";
import { normaliser } from "@/server/paging";

export type Resultat = {
  type: string;
  typeLabel: string;
  icone: string;
  titre: string;
  sousTitre: string;
  url: string;
  teinte?: string;
  badge?: string;
};

function contient(q: string, ...champs: (string | null | undefined)[]): boolean {
  return champs.some((c) => c && normaliser(c).includes(q));
}

export async function rechercher(
  user: CurrentUser,
  texte: string,
  limite = 60,
): Promise<Resultat[]> {
  const q = normaliser(texte.trim());
  if (q.length < 2) return [];
  const out: Resultat[] = [];
  const num = Number.parseInt(q.replace(/\D/g, ""), 10);

  if (user.canView("reservations")) {
    const rows = await prisma.reservation.findMany({
      include: {
        espace: { select: { name: true } },
        organisation: { select: { name: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { startAt: "desc" },
      take: 2000,
    });
    for (const r of rows) {
      const nom = r.user ? `${r.user.firstName} ${r.user.lastName}` : "";
      if (
        contient(
          q,
          r.numero,
          r.title,
          r.description,
          r.espace.name,
          r.organisation?.name,
          nom,
          r.user?.email,
        ) ||
        (num && r.numero.endsWith(String(num).padStart(4, "0")))
      ) {
        const st = RESERVATION_STATUS[r.status as ReservationStatus];
        out.push({
          type: "reservation",
          typeLabel: "Réservation",
          icone: "clipboard-list",
          titre: `${r.numero} · ${r.title}`,
          sousTitre: `${r.espace.name} · ${dateMoyenne(r.startAt)}${r.organisation ? ` · ${r.organisation.name}` : nom ? ` · ${nom}` : ""}`,
          url: `/reservations/${r.id}`,
          badge: st?.label,
          teinte: st?.teinte,
        });
      }
      if (out.length >= limite) return out;
    }
  }
  if (user.canView("espaces")) {
    const espaces = await prisma.espace.findMany({ include: { site: { select: { name: true } } } });
    for (const e of espaces)
      if (contient(q, e.name, e.description, e.site.name))
        out.push({
          type: "espace",
          typeLabel: "Espace",
          icone: "door-open",
          titre: e.name,
          sousTitre: e.site.name,
          url: `/espaces/${e.id}`,
        });
    const sites = await prisma.site.findMany();
    for (const s of sites)
      if (contient(q, s.name, s.address, s.city))
        out.push({
          type: "site",
          typeLabel: "Site",
          icone: "map-pin",
          titre: s.name,
          sousTitre: [s.address, s.city].filter(Boolean).join(", "),
          url: `/sites/${s.id}`,
        });
  }
  if (user.canView("usagers")) {
    const orgs = await prisma.organisation.findMany({
      include: { _count: { select: { reservations: true } } },
    });
    for (const o of orgs)
      if (contient(q, o.name, o.email, nomRepresentant(o), o.city, o.siret, o.rna))
        out.push({
          type: "organisation",
          typeLabel: "Usager",
          icone: "book-user",
          titre: o.name,
          sousTitre: `${nomRepresentant(o) ?? ""}${o.email ? ` · ${o.email}` : ""}`,
          url: `/usagers/${o.id}`,
        });
    const users = await prisma.user.findMany({
      where: { kind: "usager" },
      include: { organisation: { select: { name: true } } },
    });
    for (const u of users)
      if (contient(q, u.email, u.firstName, u.lastName, u.phone))
        out.push({
          type: "usager",
          typeLabel: "Compte usager",
          icone: "circle-user",
          titre: `${u.firstName} ${u.lastName}`.trim() || u.email,
          sousTitre: `${u.email}${u.organisation ? ` · ${u.organisation.name}` : ""}`,
          url: u.organisationId ? `/usagers/${u.organisationId}` : "/usagers",
        });
  }
  if (user.canView("materiel")) {
    const mats = await prisma.materiel.findMany({ include: { categorie: true } });
    for (const m of mats)
      if (contient(q, m.name, m.description))
        out.push({
          type: "materiel",
          typeLabel: "Matériel",
          icone: "boxes",
          titre: m.name,
          sousTitre: m.categorie?.label ?? "",
          url: `/materiel/${m.id}`,
        });
  }
  if (user.canView("subventions")) {
    const subs = await prisma.subvention.findMany({
      include: { organisation: { select: { name: true } } },
    });
    for (const s of subs)
      if (contient(q, s.numero, s.objet, s.organisation.name))
        out.push({
          type: "subvention",
          typeLabel: "Subvention",
          icone: "hand-coins",
          titre: `${s.numero} · ${s.objet}`,
          sousTitre: `${s.organisation.name} · ${s.exercice}`,
          url: `/subventions/${s.id}`,
        });
  }
  if (user.isAdmin) {
    const agents = await prisma.user.findMany({ where: { kind: "agent" } });
    for (const u of agents)
      if (contient(q, u.email, u.firstName, u.lastName, u.fonction))
        out.push({
          type: "agent",
          typeLabel: "Membre de l'équipe",
          icone: "contact-round",
          titre: `${u.firstName} ${u.lastName}`.trim() || u.email,
          sousTitre: u.fonction ?? u.email,
          url: `/utilisateurs/${u.id}`,
        });
  }
  return out.slice(0, limite);
}
