/**
 * Affectation du personnel de service aux créneaux réservés : lecture du contexte (personnes,
 * contrats, absences, rattachements, occupations), affectation automatique ou proposition selon
 * le site, validation et rejet des propositions, réaffectation après une absence ou un retrait.
 * Règles pures dans src/lib/affectation.ts.
 */
import type { Prisma } from "@/generated/prisma/client";
import {
  type AbsenceRef,
  type CreneauAffectable,
  candidats,
  controleManuel,
  decisionAffectation,
  disponible,
  type Ecarte,
  fenetreSemaines,
  horsAbsences,
  MOTIFS_INDISPONIBLE,
  type OccupationRef,
  type PersonneAffectable,
} from "@/lib/affectation";
import { STATUTS_FERMES } from "@/lib/constantes";
import type { Intervalle } from "@/lib/creneaux";
import { plage } from "@/lib/libelles";
import { addParisDays } from "@/lib/paris-time";
import { etatsCouverture, nomPersonne } from "@/lib/personnel";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import type { CurrentUser } from "@/server/guards";
import { invalidateNavCounts } from "@/server/nav";
import { notifierAgents } from "@/server/notifications";
import {
  absencesEntre,
  INCLUDE_PERSONNE_AFFECTABLE,
  type Issue,
  texteAvertissements,
  vacationsEntre,
  versPersonneAffectable,
  versVacationDatee,
} from "@/server/personnel";

export { absencesEntre, versPersonneAffectable };

export type SiteAffectation = { id: number; name: string; affectationAuto: boolean };

export type ContexteAffectation = {
  personnes: PersonneAffectable[];
  absences: AbsenceRef[];
  occupations: OccupationRef[];
  sites: Map<number, SiteAffectation>;
};

/**
 * Tout ce qu'il faut pour décider sur une fenêtre : lu une fois pour un lot. La lecture
 * s'élargit aux semaines entières touchées, sans quoi la charge hebdomadaire d'un candidat ne
 * compterait que ce qui chevauche les créneaux traités.
 */
export async function contexteAffectation(debut: Date, fin: Date): Promise<ContexteAffectation> {
  const { startAt: de, endAt: a } = fenetreSemaines(debut, fin);
  const [personnes, absences, creneaux, vacations, sites] = await Promise.all([
    prisma.personnel.findMany({ where: { isActive: true }, include: INCLUDE_PERSONNE_AFFECTABLE }),
    absencesEntre(de, a),
    prisma.creneau.findMany({
      where: {
        status: "prevu",
        startAt: { lt: a },
        endAt: { gt: de },
        OR: [{ personnelId: { not: null } }, { proposeAt: { not: null } }],
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        personnelId: true,
        personnelProposeId: true,
        proposeAt: true,
        espace: { select: { siteId: true } },
      },
    }),
    vacationsEntre(de, a),
    prisma.site.findMany({ select: { id: true, name: true, affectationAuto: true } }),
  ]);
  const occupations: OccupationRef[] = [];
  for (const c of creneaux) {
    const qui = c.personnelId ?? (c.proposeAt ? c.personnelProposeId : null);
    if (!qui) continue;
    occupations.push({
      personnelId: qui,
      siteId: c.espace.siteId,
      startAt: c.startAt,
      endAt: c.endAt,
      creneauId: c.id,
    });
  }
  for (const v of vacations)
    occupations.push({
      personnelId: v.personnelId,
      siteId: v.siteId,
      startAt: v.startAt,
      endAt: v.endAt,
    });
  return {
    personnes: personnes.map(versPersonneAffectable),
    absences,
    occupations,
    sites: new Map(sites.map((s) => [s.id, s])),
  };
}

export type Bilan = {
  affectes: number;
  proposes: number;
  conserves: number;
  sansCandidat: number;
  details: string[];
};

const BILAN_VIDE: Bilan = { affectes: 0, proposes: 0, conserves: 0, sansCandidat: 0, details: [] };

type CreneauCible = Prisma.CreneauGetPayload<{
  include: {
    espace: { select: { id: true; name: true; siteId: true } };
    reservation: { select: { id: true; numero: true; title: true } };
  };
}>;

async function creneauxCibles(
  selection: { ids: number[] } | { de: Date; a: Date; siteIds?: number[] },
): Promise<CreneauCible[]> {
  const now = new Date();
  return prisma.creneau.findMany({
    where: {
      status: "prevu",
      personnelId: null,
      endAt: { gt: now },
      reservation: { status: { in: STATUTS_FERMES } },
      ...("ids" in selection
        ? { id: { in: selection.ids } }
        : {
            startAt: { lt: selection.a },
            // Jamais un créneau déjà terminé, même si la fenêtre affichée commence avant.
            endAt: { gt: selection.de > now ? selection.de : now },
            ...(selection.siteIds ? { espace: { siteId: { in: selection.siteIds } } } : {}),
          }),
    },
    include: {
      espace: { select: { id: true, name: true, siteId: true } },
      reservation: { select: { id: true, numero: true, title: true } },
    },
    orderBy: { startAt: "asc" },
  });
}

function resumerEcartes(ecartes: readonly Ecarte[]): string {
  const parMotif = new Map<string, number>();
  for (const e of ecartes) parMotif.set(e.motif, (parMotif.get(e.motif) ?? 0) + 1);
  return [...parMotif]
    .map(([m, n]) => `${n} ${MOTIFS_INDISPONIBLE[m as keyof typeof MOTIFS_INDISPONIBLE]}`)
    .join(", ");
}

/**
 * Traite les créneaux fermes à venir sans personne épinglée : affectation directe sur un site
 * en automatique, proposition sinon. Une proposition encore valable est conservée ; une
 * proposition écartée (proposeAt null) exclut la personne écartée.
 */
export async function affecterCreneaux(
  selection: { ids: number[] } | { de: Date; a: Date; siteIds?: number[] },
  acteur: string,
  opts: { forcerProposition?: boolean } = {},
): Promise<Bilan> {
  const cfg = await getSettings();
  if (!cfg.PERSONNEL_ENABLED) return { ...BILAN_VIDE };
  const cibles = await creneauxCibles(selection);
  if (!cibles.length) return { ...BILAN_VIDE };
  const de = new Date(Math.min(...cibles.map((c) => c.startAt.getTime())));
  const a = new Date(Math.max(...cibles.map((c) => c.endAt.getTime())));
  const ctx = await contexteAffectation(de, a);
  // Les créneaux déjà couverts par des vacations n'ont pas besoin d'une personne épinglée ;
  // une personne absente ne couvre rien.
  const vacations = horsAbsences(
    (await vacationsEntre(de, a)).map(versVacationDatee),
    ctx.absences,
  );
  const couverts = new Set(
    etatsCouverture(
      cibles.map((c) => ({
        id: c.id,
        reservationId: c.reservationId,
        numero: c.reservation.numero,
        titre: c.reservation.title,
        espaceId: c.espaceId,
        espaceNom: c.espace.name,
        siteId: c.espace.siteId,
        siteNom: "",
        startAt: c.startAt,
        endAt: c.endAt,
        personnelId: c.personnelId,
      })),
      vacations,
    )
      .filter((e) => e.couverture.etat === "couvert")
      .map((e) => e.creneau.id),
  );
  const bilan: Bilan = { ...BILAN_VIDE, details: [] };
  const aNotifier = new Map<number, { espaceId: number; affectes: number; proposes: number }>();
  for (const c of cibles) {
    if (couverts.has(c.id)) continue;
    const site = ctx.sites.get(c.espace.siteId);
    if (!site) continue;
    const cible: CreneauAffectable = {
      id: c.id,
      reservationId: c.reservationId,
      siteId: c.espace.siteId,
      startAt: c.startAt,
      endAt: c.endAt,
    };
    const ecarteId = c.personnelProposeId && !c.proposeAt ? c.personnelProposeId : null;
    const { retenus, ecartes } = candidats(
      cible,
      ctx.personnes.filter((p) => p.id !== ecarteId),
      ctx,
    );
    // Une proposition en attente dont la personne reste disponible est conservée.
    if (
      c.proposeAt &&
      c.personnelProposeId &&
      retenus.some((r) => r.personne.id === c.personnelProposeId) &&
      !(site.affectationAuto && !opts.forcerProposition)
    ) {
      bilan.conserves += 1;
      continue;
    }
    const decision = decisionAffectation(site, retenus, opts.forcerProposition);
    const libelle = `${c.reservation.numero} · ${plage(c.startAt, c.endAt)} · ${c.espace.name}`;
    if (decision.action === "aucun") {
      bilan.sansCandidat += 1;
      bilan.details.push(`${libelle} : aucune personne disponible (${resumerEcartes(ecartes)})`);
      continue;
    }
    const personne = ctx.personnes.find((p) => p.id === decision.personnelId);
    const nom = personne ? nomPersonne(personne) : `#${decision.personnelId}`;
    if (decision.action === "affecter") {
      await prisma.creneau.update({
        where: { id: c.id },
        data: { personnelId: decision.personnelId, personnelProposeId: null, proposeAt: null },
      });
      await prisma.reservationHistory.create({
        data: {
          reservationId: c.reservationId,
          action: "Personne de service affectée",
          comment: `${nom} · ${plage(c.startAt, c.endAt)}`,
          performedBy: acteur,
        },
      });
      bilan.affectes += 1;
      bilan.details.push(`${libelle} : ${nom} affecté(e)`);
    } else {
      await prisma.creneau.update({
        where: { id: c.id },
        data: { personnelProposeId: decision.personnelId, proposeAt: new Date() },
      });
      bilan.proposes += 1;
      bilan.details.push(`${libelle} : ${nom} proposé(e)`);
    }
    ctx.occupations.push({
      personnelId: decision.personnelId,
      siteId: c.espace.siteId,
      startAt: c.startAt,
      endAt: c.endAt,
      creneauId: c.id,
    });
    const n = aNotifier.get(site.id) ?? { espaceId: c.espaceId, affectes: 0, proposes: 0 };
    if (decision.action === "affecter") n.affectes += 1;
    else n.proposes += 1;
    aNotifier.set(site.id, n);
  }
  for (const [siteId, n] of aNotifier) {
    const site = ctx.sites.get(siteId);
    if (!site) continue;
    if (n.proposes)
      await notifierAgents(
        n.espaceId,
        "personnel",
        `${n.proposes} proposition${n.proposes > 1 ? "s" : ""} d'affectation à valider · ${site.name}`,
        "Le personnel de service proposé sur les créneaux réservés attend votre validation.",
        "/personnel?onglet=propositions",
      ).catch((e) => console.error("[affectation]", e));
    if (n.affectes)
      await notifierAgents(
        n.espaceId,
        "personnel",
        `${n.affectes} créneau${n.affectes > 1 ? "x" : ""} affecté${n.affectes > 1 ? "s" : ""} au personnel de service · ${site.name}`,
        "Affectation automatique : vous pouvez la modifier depuis la fiche de la réservation.",
        "/personnel",
      ).catch((e) => console.error("[affectation]", e));
  }
  if (bilan.affectes || bilan.proposes) invalidateNavCounts();
  return bilan;
}

/** Les créneaux à venir d'un dossier qui vient de devenir ferme. */
export async function affecterDossier(reservationId: number, acteur = "système"): Promise<Bilan> {
  const ids = (
    await prisma.creneau.findMany({
      where: { reservationId, status: "prevu", personnelId: null, endAt: { gt: new Date() } },
      select: { id: true },
    })
  ).map((c) => c.id);
  if (!ids.length) return { ...BILAN_VIDE };
  return affecterCreneaux({ ids }, acteur);
}

/** Tâche quotidienne : les 30 prochains jours. */
export async function affecterProchainsJours(now = new Date(), jours = 30): Promise<string> {
  const b = await affecterCreneaux({ de: now, a: addParisDays(now, jours) }, "système");
  return `${b.affectes} affecté(s), ${b.proposes} proposé(s), ${b.conserves} conservé(s), ${b.sansCandidat} sans candidat`;
}

/** Le résumé d'un bilan pour un message flash. */
export function resumeBilan(b: Bilan): string {
  const parts = [
    b.affectes ? `${b.affectes} affecté${b.affectes > 1 ? "s" : ""}` : null,
    b.proposes ? `${b.proposes} proposé${b.proposes > 1 ? "s" : ""}` : null,
    b.conserves
      ? `${b.conserves} proposition${b.conserves > 1 ? "s" : ""} conservée${b.conserves > 1 ? "s" : ""}`
      : null,
    b.sansCandidat ? `${b.sansCandidat} sans personne disponible` : null,
  ].filter(Boolean);
  return parts.length ? `Créneaux traités : ${parts.join(", ")}.` : "Aucun créneau à affecter.";
}

// ── Propositions ──

export const INCLUDE_PROPOSITION = {
  personnelPropose: true,
  espace: { select: { id: true, name: true, shortName: true, siteId: true, site: true } },
  reservation: { select: { id: true, numero: true, title: true } },
} satisfies Prisma.CreneauInclude;

export type PropositionRow = Prisma.CreneauGetPayload<{ include: typeof INCLUDE_PROPOSITION }>;

/** Les propositions en attente, à venir, dans le périmètre de l'agent. */
export async function propositionsEnAttente(
  user: CurrentUser,
  fenetre?: Intervalle,
): Promise<PropositionRow[]> {
  return prisma.creneau.findMany({
    where: {
      status: "prevu",
      personnelId: null,
      proposeAt: { not: null },
      endAt: { gt: fenetre?.startAt ?? new Date() },
      ...(fenetre ? { startAt: { lt: fenetre.endAt } } : {}),
      reservation: { status: { in: STATUTS_FERMES } },
      ...(user.espacesGeres.length ? { espaceId: { in: user.espacesGeres } } : {}),
    },
    include: INCLUDE_PROPOSITION,
    orderBy: { startAt: "asc" },
  });
}

export async function nbPropositions(user: CurrentUser): Promise<number> {
  return prisma.creneau.count({
    where: {
      status: "prevu",
      personnelId: null,
      proposeAt: { not: null },
      endAt: { gt: new Date() },
      reservation: { status: { in: STATUTS_FERMES } },
      ...(user.espacesGeres.length ? { espaceId: { in: user.espacesGeres } } : {}),
    },
  });
}

/** Les candidats d'un créneau pour l'écran de choix (disponibles triés, écartés avec motif). */
export async function candidatsDuCreneau(creneauId: number) {
  const c = await prisma.creneau.findUnique({
    where: { id: creneauId },
    include: { espace: { select: { siteId: true } } },
  });
  if (!c) return null;
  const ctx = await contexteAffectation(c.startAt, c.endAt);
  const cible: CreneauAffectable = {
    id: c.id,
    reservationId: c.reservationId,
    siteId: c.espace.siteId,
    startAt: c.startAt,
    endAt: c.endAt,
  };
  return candidats(cible, ctx.personnes, ctx);
}

/**
 * Contrôle d'une affectation décidée à la main : refusée si la personne n'est pas là (hors
 * service, hors contrat, absente) ou déjà sur un autre site ; hors de ses sites ou de ses
 * horaires de travail, l'agent garde la main et reçoit un avertissement (texte renvoyé).
 */
async function controlerAffectationManuelle(
  c: { id: number; reservationId: number; startAt: Date; endAt: Date; siteId: number },
  personnelId: number,
): Promise<{ nom: string; avertissement: string }> {
  const row = await prisma.personnel.findUnique({
    where: { id: personnelId },
    include: INCLUDE_PERSONNE_AFFECTABLE,
  });
  if (!row) throw new UserFacingError("Personne introuvable.");
  const nom = nomPersonne(row);
  const ctx = await contexteAffectation(c.startAt, c.endAt);
  const controle = controleManuel(versPersonneAffectable(row), c, ctx);
  if (controle.bloquant)
    throw new UserFacingError(
      `Impossible d'affecter ${nom} sur le créneau du ${plage(c.startAt, c.endAt)} : personne ${MOTIFS_INDISPONIBLE[controle.bloquant]}.`,
    );
  return { nom, avertissement: texteAvertissements(controle.avertissements) };
}

/** Épingle une personne de service sur un créneau, ou la retire. */
export async function epingler(creneauId: number, personnelId: number | null): Promise<Issue> {
  if (!personnelId) {
    await prisma.creneau.update({ where: { id: creneauId }, data: { personnelId: null } });
    return { message: "Personne de service retirée du créneau.", niveau: "success" };
  }
  const c = await prisma.creneau.findUnique({
    where: { id: creneauId },
    include: { espace: { select: { siteId: true } } },
  });
  if (!c) throw new UserFacingError("Créneau introuvable.");
  const { nom, avertissement } = await controlerAffectationManuelle(
    { ...c, siteId: c.espace.siteId },
    personnelId,
  );
  await prisma.creneau.update({ where: { id: creneauId }, data: { personnelId } });
  return {
    message: `${nom} de service sur ce créneau.${avertissement}`,
    niveau: avertissement ? "warning" : "success",
  };
}

/** Valide la proposition d'un créneau, avec la personne proposée ou une autre. */
export async function validerProposition(
  creneauId: number,
  personnelId: number | null,
  acteur: string,
): Promise<Issue> {
  const c = await prisma.creneau.findUnique({
    where: { id: creneauId },
    include: {
      personnelPropose: true,
      reservation: { select: { numero: true } },
      espace: { select: { siteId: true } },
    },
  });
  if (!c) throw new UserFacingError("Créneau introuvable.");
  const choisi = personnelId ?? c.personnelProposeId;
  if (!choisi) throw new UserFacingError("Aucune personne à affecter sur ce créneau.");
  const { avertissement } = await controlerAffectationManuelle(
    { ...c, siteId: c.espace.siteId },
    choisi,
  );
  const p = await prisma.personnel.findUnique({ where: { id: choisi } });
  if (!p) throw new UserFacingError("Personne introuvable.");
  await prisma.creneau.update({
    where: { id: creneauId },
    data: { personnelId: choisi, personnelProposeId: null, proposeAt: null },
  });
  await prisma.reservationHistory.create({
    data: {
      reservationId: c.reservationId,
      action: "Personne de service affectée",
      comment: `${nomPersonne(p)} · ${plage(c.startAt, c.endAt)}`,
      performedBy: acteur,
    },
  });
  invalidateNavCounts();
  return {
    message: `${nomPersonne(p)} affecté(e) sur le créneau du ${plage(c.startAt, c.endAt)} (${c.reservation.numero}).${avertissement}`,
    niveau: avertissement ? "warning" : "success",
  };
}

/** Écarte la proposition : la personne écartée n'est plus reproposée sur ce créneau. */
export async function ecarterProposition(creneauId: number, acteur: string): Promise<string> {
  const c = await prisma.creneau.findUnique({
    where: { id: creneauId },
    include: { personnelPropose: true, reservation: { select: { numero: true } } },
  });
  if (!c?.personnelPropose) throw new UserFacingError("Aucune proposition sur ce créneau.");
  await prisma.creneau.update({ where: { id: creneauId }, data: { proposeAt: null } });
  await prisma.reservationHistory.create({
    data: {
      reservationId: c.reservationId,
      action: "Proposition d'affectation écartée",
      comment: `${nomPersonne(c.personnelPropose)} · ${plage(c.startAt, c.endAt)}`,
      performedBy: acteur,
    },
  });
  invalidateNavCounts();
  return `Proposition écartée : ${nomPersonne(c.personnelPropose)} ne sera plus proposé(e) sur ce créneau.`;
}

// ── Réaffectation après un changement sur une personne ──

/**
 * Revérifie les affectations et propositions à venir d'une personne (absence posée, horaires
 * ou sites modifiés, mise hors service) : celles qui ne tiennent plus sont retirées et les
 * créneaux repassent par l'affectation. Renvoie le nombre de créneaux retirés.
 */
export async function reverifierAffectations(personnelId: number, acteur: string): Promise<number> {
  const now = new Date();
  const touches = await prisma.creneau.findMany({
    where: {
      status: "prevu",
      endAt: { gt: now },
      OR: [{ personnelId }, { personnelProposeId: personnelId, proposeAt: { not: null } }],
    },
    include: { espace: { select: { siteId: true } } },
    orderBy: { startAt: "asc" },
  });
  if (!touches.length) return 0;
  const de = new Date(Math.min(...touches.map((c) => c.startAt.getTime())));
  const a = new Date(Math.max(...touches.map((c) => c.endAt.getTime())));
  const ctx = await contexteAffectation(de, a);
  const row = await prisma.personnel.findUnique({
    where: { id: personnelId },
    include: INCLUDE_PERSONNE_AFFECTABLE,
  });
  if (!row) return 0;
  const p = versPersonneAffectable(row);
  const retires = touches.filter(
    (c) =>
      !disponible(
        p,
        {
          id: c.id,
          reservationId: c.reservationId,
          siteId: c.espace.siteId,
          startAt: c.startAt,
          endAt: c.endAt,
        },
        ctx,
      ).ok,
  );
  if (!retires.length) return 0;
  await prisma.creneau.updateMany({
    where: { id: { in: retires.map((c) => c.id) } },
    data: { personnelId: null, personnelProposeId: null, proposeAt: null },
  });
  for (const c of retires.filter((x) => x.personnelId === personnelId)) {
    await prisma.reservationHistory.create({
      data: {
        reservationId: c.reservationId,
        action: "Personne de service retirée",
        comment: `${nomPersonne(p)} · ${plage(c.startAt, c.endAt)} (plus disponible)`,
        performedBy: acteur,
      },
    });
  }
  await affecterCreneaux({ ids: retires.map((c) => c.id) }, acteur).catch((e) =>
    console.error("[affectation]", e),
  );
  return retires.length;
}

// ── Lecture pour le planning de service ──

export const INCLUDE_AFFECTATION = {
  personnel: true,
  personnelPropose: true,
  espace: { select: { id: true, name: true, shortName: true, siteId: true } },
  reservation: { select: { id: true, numero: true, title: true } },
} satisfies Prisma.CreneauInclude;

export type AffectationRow = Prisma.CreneauGetPayload<{ include: typeof INCLUDE_AFFECTATION }>;

/** Les créneaux affectés ou proposés sur une fenêtre (pour la grille et les propositions). */
export async function affectationsEntre(
  de: Date,
  a: Date,
  siteIds?: number[],
): Promise<AffectationRow[]> {
  return prisma.creneau.findMany({
    where: {
      status: "prevu",
      startAt: { lt: a },
      endAt: { gt: de },
      OR: [{ personnelId: { not: null } }, { proposeAt: { not: null } }],
      ...(siteIds ? { espace: { siteId: { in: siteIds } } } : {}),
    },
    include: INCLUDE_AFFECTATION,
    orderBy: { startAt: "asc" },
  });
}

/**
 * Après une absence : les vacations de la personne sur la période ne couvrent plus rien, donc les
 * créneaux réservés de leurs sites repassent par l'affectation. Renvoie le nombre de vacations
 * touchées (elles restent au planning, à supprimer ou à confier à quelqu'un d'autre).
 */
export async function recouvrirApresAbsence(
  personnelId: number,
  i: Intervalle,
  acteur: string,
): Promise<number> {
  const vacations = await vacationsEntre(i.startAt, i.endAt, { personnelId });
  if (!vacations.length) return 0;
  const siteIds = [...new Set(vacations.map((v) => v.siteId))];
  await affecterCreneaux({ de: i.startAt, a: i.endAt, siteIds }, acteur).catch((e) =>
    console.error("[affectation]", e),
  );
  return vacations.length;
}
