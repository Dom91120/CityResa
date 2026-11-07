/**
 * Le cœur métier des réservations : disponibilité, création d'un dossier (créneaux,
 * récurrence, options, matériel, devis), transitions de statut avec notifications et
 * courriels, fil de discussion, historique.
 */
import type { Prisma } from "@/generated/prisma/client";
import { fraisPrevus, lireBareme } from "@/lib/annulation";
import {
  RESERVATION_STATUS,
  type ReservationStatus,
  STATUTS_FERMES,
  STATUTS_OCCUPANTS,
  TRANSITIONS,
} from "@/lib/constantes";
import {
  bornes,
  conflits,
  conflitsCapacite,
  developperRecurrence,
  type Intervalle,
  type Recurrence,
  reglesAuCreneau,
  utiliseCalendrier,
  verifierRegles,
} from "@/lib/creneaux";
import { manquesDossier, nomRepresentant, phraseManques } from "@/lib/dossier-usager";
import { dateHeure, dateMoyenne, montant, plage } from "@/lib/libelles";
import { STATUTS_OPTION } from "@/lib/options";
import { calculerDevis, type Devis } from "@/lib/tarification";
import { auditRecord } from "@/server/audit";
import { joursExclus } from "@/server/calendrier";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { enabledIn } from "@/server/features";
import type { CurrentUser } from "@/server/guards";
import { horairesSaisonDe } from "@/server/horaires";
import { type Attachment, envoyerDepuisModele } from "@/server/mailer";
import { invalidateNavCounts } from "@/server/nav";
import { notifier, notifierAgents } from "@/server/notifications";
import { prochainNumero } from "@/server/numerotation";
import { verifierPieces } from "@/server/pieces";

export const INCLUDE_RESERVATION = {
  espace: { include: { site: true, parent: true, enfants: true } },
  organisation: { include: { profil: true } },
  user: true,
  agent: true,
  nature: true,
  creneaux: { orderBy: { startAt: "asc" as const }, include: { personnel: true } },
  options: { include: { option: true } },
  materiels: { include: { materiel: true } },
  factures: { include: { paiements: true }, orderBy: { createdAt: "asc" as const } },
  avenants: { orderBy: { numero: "asc" as const } },
  etatsDesLieux: {
    include: { documents: { orderBy: { position: "asc" as const } } },
    orderBy: { kind: "asc" as const },
  },
} satisfies Prisma.ReservationInclude;

export type ReservationComplete = Prisma.ReservationGetPayload<{
  include: typeof INCLUDE_RESERVATION;
}>;

export async function chargerReservation(id: number): Promise<ReservationComplete | null> {
  return prisma.reservation.findUnique({ where: { id }, include: INCLUDE_RESERVATION });
}

/** L'espace, son parent et ses enfants : réserver l'un bloque les autres. */
export async function familleEspace(espaceId: number): Promise<number[]> {
  const e = await prisma.espace.findUnique({
    where: { id: espaceId },
    select: { id: true, parentId: true, enfants: { select: { id: true } } },
  });
  if (!e) return [espaceId];
  const ids = new Set<number>([e.id, ...e.enfants.map((x) => x.id)]);
  if (e.parentId) {
    ids.add(e.parentId);
    const freres = await prisma.espace.findMany({
      where: { parentId: e.parentId },
      select: { id: true },
    });
    // Les frères d'un sous-espace ne sont PAS bloqués : seul le parent l'est.
    for (const f of freres) ids.delete(f.id);
    ids.add(e.id);
  }
  return [...ids];
}

export type Occupant = Intervalle & {
  id: number;
  reservationId: number | null;
  libelle: string;
  genre: "reservation" | "blocage";
  espaceId: number;
};

/** Tout ce qui occupe un espace (et sa famille) sur une période : créneaux vivants et blocages. */
export async function occupants(
  espaceId: number,
  de: Date,
  a: Date,
  excludeReservationId: number | null = null,
): Promise<Occupant[]> {
  const ids = await familleEspace(espaceId);
  const [creneaux, blocages] = await Promise.all([
    prisma.creneau.findMany({
      where: {
        espaceId: { in: ids },
        status: "prevu",
        startAt: { lt: a },
        endAt: { gt: de },
        reservation: {
          status: { in: STATUTS_OCCUPANTS },
          ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
        },
      },
      include: { reservation: { select: { numero: true, title: true, status: true } } },
    }),
    prisma.indisponibilite.findMany({
      where: { espaceId: { in: ids }, startAt: { lt: a }, endAt: { gt: de } },
    }),
  ]);
  return [
    ...creneaux.map((c) => ({
      id: c.id,
      reservationId: c.reservationId,
      espaceId: c.espaceId,
      startAt: c.startAt,
      endAt: c.endAt,
      libelle: `${c.reservation.numero} · ${c.reservation.title}`,
      genre: "reservation" as const,
    })),
    ...blocages.map((b) => ({
      id: b.id,
      reservationId: null,
      espaceId: b.espaceId,
      startAt: b.startAt,
      endAt: b.endAt,
      libelle: b.motif ? `Bloqué · ${b.motif}` : "Bloqué",
      genre: "blocage" as const,
    })),
  ];
}

export type Conflit = { demande: Intervalle; existant: Occupant };

/**
 * Les conflits d'une liste de créneaux demandés sur un espace. Un blocage bloque toujours ;
 * les réservations en place ne bloquent qu'à partir de la capacité simultanée de l'espace.
 */
export async function verifierDisponibilite(
  espace: {
    id: number;
    bufferBeforeMin: number;
    bufferAfterMin: number;
    capaciteSimultanee?: number;
  },
  creneaux: Intervalle[],
  excludeReservationId: number | null = null,
): Promise<Conflit[]> {
  if (!creneaux.length) return [];
  const b = bornes(creneaux);
  const marge = Math.max(espace.bufferBeforeMin, espace.bufferAfterMin) * 60_000 + 1;
  const exist = await occupants(
    espace.id,
    new Date(b.startAt.getTime() - marge),
    new Date(b.endAt.getTime() + marge),
    excludeReservationId,
  );
  const marges = { avantMin: espace.bufferBeforeMin, apresMin: espace.bufferAfterMin };
  return [
    ...conflits(
      creneaux,
      exist.filter((o) => o.genre === "blocage"),
      marges,
    ),
    ...conflitsCapacite(
      creneaux,
      exist.filter((o) => o.genre === "reservation"),
      marges,
      espace.capaciteSimultanee ?? 1,
    ),
  ];
}

export type DemandeEntree = {
  espaceId: number;
  title: string;
  natureId: number | null;
  description: string | null;
  participants: number | null;
  isPublicEvent: boolean;
  premier: Intervalle;
  recurrence: Recurrence | null;
  options: { optionId: number; quantite: number }[];
  materiels: { materielId: number; quantite: number }[];
  organisationId: number | null;
  userId: string | null;
  source: "portail" | "backoffice";
  gratuit?: boolean;
  /** Fondement de la gratuité, obligatoire quand elle est accordée. */
  gratuitMotif?: string | null;
  /** Un agent peut passer outre délai et horizon. */
  ignorerDelai?: boolean;
  statutInitial?: ReservationStatus;
  /** Création en lot (campagne) : ni courriel ni notification, l'appelant prévient groupé. */
  sansCourriel?: boolean;
  /** Option : date limite au-delà de laquelle un dossier non acquis est libéré d'office. */
  optionExpiresAt?: Date | null;
};

/** Le devis d'une demande (pur calcul, sans écriture). */
export async function deviser(
  espaceId: number,
  profilId: number | null,
  creneaux: Intervalle[],
  options: { optionId: number; quantite: number }[],
  materiels: { materielId: number; quantite: number }[],
  gratuit = false,
): Promise<Devis> {
  const cfg = await getSettings();
  const [espace, tarifs, opts, mats] = await Promise.all([
    prisma.espace.findUniqueOrThrow({ where: { id: espaceId } }),
    prisma.tarif.findMany({ where: { espaceId } }),
    options.length
      ? prisma.option.findMany({ where: { id: { in: options.map((o) => o.optionId) } } })
      : [],
    materiels.length
      ? prisma.materiel.findMany({ where: { id: { in: materiels.map((m) => m.materielId) } } })
      : [],
  ]);
  return calculerDevis({
    tarifs,
    profilId,
    creneaux,
    options: opts.map((o) => ({
      label: o.label,
      montant: o.montant,
      unite: o.unite,
      quantite: options.find((x) => x.optionId === o.id)?.quantite ?? 1,
    })),
    materiels: mats.map((m) => ({
      label: m.name,
      montant: m.montant,
      unite: m.unite,
      quantite: materiels.find((x) => x.materielId === m.id)?.quantite ?? 1,
    })),
    tvaTaux: cfg.TVA_TAUX,
    caution: espace.cautionAmount,
    gratuit,
    acomptePct: cfg.ACOMPTE_PCT,
  });
}

/** Le stock de matériel disponible sur une période (stock total − mobilisé par les dossiers vivants). */
export async function stockDisponible(
  materielId: number,
  de: Date,
  a: Date,
  excludeReservationId: number | null = null,
): Promise<number> {
  const m = await prisma.materiel.findUnique({ where: { id: materielId } });
  if (!m) return 0;
  const mobilise = await prisma.reservationMateriel.findMany({
    where: {
      materielId,
      reservation: {
        status: { in: STATUTS_OCCUPANTS },
        startAt: { lt: a },
        endAt: { gt: de },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
    },
  });
  return m.stockTotal - m.horsService - mobilise.reduce((s, x) => s + x.quantite, 0);
}

/** Crée un dossier complet. Lève une UserFacingError sur toute règle non respectée. */
export async function creerReservation(
  e: DemandeEntree,
  acteur: string,
): Promise<ReservationComplete> {
  const espace = await prisma.espace.findUnique({
    where: { id: e.espaceId },
    include: { site: true },
  });
  if (!espace?.isActive) throw new UserFacingError("Cet espace n'est pas disponible.");
  if (!e.title.trim()) throw new UserFacingError("Indiquez l'objet de la réservation.");
  if (e.gratuit && !e.gratuitMotif?.trim())
    throw new UserFacingError(
      "Indiquez le fondement de la gratuité (délibération, convention, intérêt général…).",
    );
  const now = new Date();
  const creneaux = developperRecurrence(
    e.premier,
    e.recurrence,
    await joursExclus(e.premier, e.recurrence),
  );
  if (!creneaux.length)
    throw new UserFacingError(
      utiliseCalendrier(e.recurrence)
        ? "Aucun créneau à réserver : toutes les dates tombent pendant les vacances ou un jour férié."
        : "Aucun créneau à réserver.",
    );
  const periodes = await horairesSaisonDe(espace.id);
  for (const c of creneaux) {
    const erreurs = verifierRegles(reglesAuCreneau(espace, periodes, c), c, now, {
      ignorerDelai: e.ignorerDelai,
    });
    if (erreurs.length)
      throw new UserFacingError(`${dateMoyenne(c.startAt)} : ${erreurs.join(" ")}`);
  }
  const conflitsTrouves = await verifierDisponibilite(espace, creneaux);
  if (conflitsTrouves.length) {
    const c = conflitsTrouves[0];
    throw new UserFacingError(
      `Créneau indisponible : ${plage(c.demande.startAt, c.demande.endAt)} chevauche « ${c.existant.libelle} »${conflitsTrouves.length > 1 ? ` (${conflitsTrouves.length} conflits)` : ""}.`,
    );
  }
  const b = bornes(creneaux);
  for (const m of e.materiels) {
    const dispo = await stockDisponible(m.materielId, b.startAt, b.endAt);
    if (m.quantite > dispo) {
      const mat = await prisma.materiel.findUnique({ where: { id: m.materielId } });
      throw new UserFacingError(
        `Stock insuffisant pour « ${mat?.name ?? "matériel"} » : ${dispo} disponible(s).`,
      );
    }
  }
  const org = e.organisationId
    ? await prisma.organisation.findUnique({
        where: { id: e.organisationId },
        include: { profil: true },
      })
    : null;
  if (e.source === "portail") {
    const cfg0 = await getSettings();
    if (cfg0.VALIDATION_COMPTE_USAGER && org && !org.validatedAt)
      throw new UserFacingError(
        "Votre organisation doit d'abord être validée par la collectivité avant de déposer une demande.",
      );
    if (espace.allowedProfiles.length) {
      const code = org?.profil?.code ?? null;
      if (!code || !espace.allowedProfiles.includes(code))
        throw new UserFacingError(
          "Cet espace n'est pas ouvert à la réservation pour votre profil.",
        );
    }
    // Les données exigées (siège, président et AG pour une association, contact joignable…).
    if (org) {
      const contact = e.userId
        ? await prisma.user.findUnique({
            where: { id: e.userId },
            select: { firstName: true, lastName: true, email: true, phone: true },
          })
        : null;
      const manques = manquesDossier(org, contact);
      if (manques.length)
        throw new UserFacingError(
          `Votre dossier est incomplet pour déposer une demande. ${phraseManques(manques)}`,
        );
      await verifierPieces(org, "depot", cfg0);
    }
    if (!e.participants) throw new UserFacingError("Indiquez le nombre de participants prévus.");
  }
  const devis = await deviser(
    espace.id,
    org?.profilId ?? null,
    creneaux,
    e.options,
    e.materiels,
    e.gratuit ?? false,
  );
  // Le demandeur est toujours l'usager : une saisie au back-office rattache le dossier au
  // premier compte actif de l'organisation (les courriels et la cloche lui parviennent),
  // l'agent n'apparaissant que dans l'historique.
  let demandeurId = e.userId;
  if (e.source === "backoffice") {
    const membre = org
      ? await prisma.user.findFirst({
          where: { organisationId: org.id, kind: "usager", isActive: true },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        })
      : null;
    demandeurId = membre?.id ?? null;
  }
  const cfg = await getSettings();
  const numero = await prochainNumero("RES");
  const statut: ReservationStatus =
    e.statutInitial ?? (espace.requiresValidation ? "a_traiter" : "confirmee");
  // Un dossier acquis d'emblée (saisie d'un agent, espace sans validation) obéit à la règle des pièces.
  if (org && e.source === "backoffice" && STATUTS_FERMES.includes(statut))
    await verifierPieces(org, "acceptation", cfg);
  const [opts, mats] = await Promise.all([
    e.options.length
      ? prisma.option.findMany({ where: { id: { in: e.options.map((o) => o.optionId) } } })
      : [],
    e.materiels.length
      ? prisma.materiel.findMany({ where: { id: { in: e.materiels.map((m) => m.materielId) } } })
      : [],
  ]);
  const r = await prisma.reservation.create({
    data: {
      numero,
      espaceId: espace.id,
      organisationId: e.organisationId,
      userId: demandeurId,
      title: e.title.trim().slice(0, 160),
      natureId: e.natureId,
      description: e.description,
      participants: e.participants,
      isPublicEvent: e.isPublicEvent,
      status: statut,
      startAt: b.startAt,
      endAt: b.endAt,
      recurrence: e.recurrence ? (e.recurrence as object) : undefined,
      setupMin: espace.bufferBeforeMin,
      teardownMin: espace.bufferAfterMin,
      montantHt: devis.ht,
      montantTtc: devis.ttc,
      acompte: devis.acompte,
      caution: devis.caution,
      gratuit: devis.gratuit,
      gratuitMotif: devis.gratuit ? (e.gratuitMotif?.trim().slice(0, 300) ?? null) : null,
      optionExpiresAt:
        e.optionExpiresAt && (STATUTS_OPTION as readonly string[]).includes(statut)
          ? e.optionExpiresAt
          : null,
      source: e.source,
      decisionAt: statut === "confirmee" ? now : null,
      decisionBy: statut === "confirmee" ? "automatique" : null,
      creneaux: {
        create: creneaux.map((c) => ({ espaceId: espace.id, startAt: c.startAt, endAt: c.endAt })),
      },
      options: {
        create: e.options
          .filter((o) => opts.some((x) => x.id === o.optionId))
          .map((o) => ({
            optionId: o.optionId,
            quantite: o.quantite,
            montant:
              devis.lignes.find(
                (l) =>
                  l.type === "option" && l.libelle === opts.find((x) => x.id === o.optionId)?.label,
              )?.montant ?? 0,
          })),
      },
      materiels: {
        create: e.materiels
          .filter((m) => mats.some((x) => x.id === m.materielId))
          .map((m) => ({
            materielId: m.materielId,
            quantite: m.quantite,
            montant:
              devis.lignes.find(
                (l) =>
                  l.type === "materiel" &&
                  l.libelle === mats.find((x) => x.id === m.materielId)?.name,
              )?.montant ?? 0,
          })),
      },
      histories: {
        create: {
          action: "Demande déposée",
          comment: `${creneaux.length} créneau(x) · ${RESERVATION_STATUS[statut].label}`,
          performedBy: acteur,
        },
      },
    },
    include: INCLUDE_RESERVATION,
  });
  invalidateNavCounts();
  await auditRecord("creation reservation", `${r.numero} · ${r.title}`, "reservations", acteur);
  if (STATUTS_FERMES.includes(statut) && enabledIn(cfg, "personnel")) {
    const { affecterDossier } = await import("@/server/affectation");
    await affecterDossier(r.id, acteur).catch((err) => console.error("[affectation]", err));
  }
  if (e.sansCourriel) return r;
  const lienBo = `${cfg.APP_BASE_URL}/reservations/${r.id}`;
  const dates =
    plage(r.startAt, r.endAt) + (creneaux.length > 1 ? ` (${creneaux.length} créneaux)` : "");
  const demandeur = r.user ? `${r.user.firstName} ${r.user.lastName}`.trim() : acteur;
  if (statut === "a_traiter") {
    const emails = await notifierAgents(
      espace.id,
      "reservation",
      `Nouvelle demande ${r.numero}`,
      `${espace.name} · ${dates} · ${demandeur}`,
      `/reservations/${r.id}`,
    );
    await envoyerDepuisModele(
      "reservation_nouvelle_agent",
      emails,
      {
        numero: r.numero,
        espace: espace.name,
        dates,
        demandeur,
        organisation: r.organisation?.name ?? "—",
        titre: r.title,
        lien: lienBo,
      },
      { reservationId: r.id },
    );
  }
  await courrielUsager(r, statut === "confirmee" ? "reservation_confirmee" : "reservation_recue", {
    consignes: espace.instructions ?? "—",
  });
  return r;
}

/** Les variables communes aux courriels d'un dossier. */
export async function variablesDossier(r: ReservationComplete): Promise<Record<string, string>> {
  const cfg = await getSettings();
  const n = r.creneaux.filter((c) => c.status === "prevu").length;
  return {
    numero: r.numero,
    titre: r.title,
    espace: r.espace.name,
    site: r.espace.site.name,
    dates: plage(r.startAt, r.endAt) + (n > 1 ? ` (${n} créneaux)` : ""),
    prenom: r.user?.firstName || r.organisation?.legalFirstName || "Madame, Monsieur",
    demandeur: r.user
      ? `${r.user.firstName} ${r.user.lastName}`.trim()
      : ((r.organisation ? nomRepresentant(r.organisation) : null) ?? ""),
    organisation: r.organisation?.name ?? "",
    lien: `${cfg.APP_BASE_URL}/portail/mes-reservations/${r.id}`,
    lien_bo: `${cfg.APP_BASE_URL}/reservations/${r.id}`,
    consignes: r.espace.instructions ?? "—",
  };
}

/** Envoie un courriel au demandeur (et notifie son compte). */
export async function courrielUsager(
  r: ReservationComplete,
  key: string,
  extra: Record<string, string> = {},
  attachments?: Attachment[],
): Promise<void> {
  const to = r.user?.email ?? r.organisation?.email;
  if (!to) return;
  if (r.user && r.user.notifEmail === false && !["signature_code"].includes(key)) {
    // Courriels coupés par l'usager : la cloche reste.
  } else {
    await envoyerDepuisModele(
      key,
      to,
      { ...(await variablesDossier(r)), ...extra },
      { reservationId: r.id, attachments },
    );
  }
  if (r.userId) {
    const titres: Record<string, string> = {
      reservation_recue: `Demande ${r.numero} enregistrée`,
      reservation_acceptee: `Demande ${r.numero} acceptée`,
      convention_a_signer: `Convention ${r.numero} à signer`,
      reservation_confirmee: `Réservation ${r.numero} confirmée`,
      reservation_refusee: `Demande ${r.numero} refusée`,
      reservation_annulee: `Réservation ${r.numero} annulée`,
      reservation_infos: `Précisions demandées sur ${r.numero}`,
      reservation_signee: `Convention ${r.numero} signée`,
      fermeture_exceptionnelle: `Fermeture de ${r.espace.name} : ${r.numero} concerné`,
      creneaux_modifies: `Réservation ${r.numero} : nouveaux horaires`,
      priorite_municipale: `Réservation ${r.numero} : créneau réquisitionné par la Ville`,
      avenant_a_signer: `Avenant à signer pour ${r.numero}`,
      avenant_signe: `Avenant de ${r.numero} signé`,
      caution_restituee: `Caution de ${r.numero} restituée`,
      caution_retenue: `Caution de ${r.numero} : retenue`,
      option_relance: `Option ${r.numero} : échéance proche`,
    };
    if (titres[key])
      await notifier(
        r.userId,
        "reservation",
        titres[key],
        r.espace.name,
        `/portail/mes-reservations/${r.id}`,
      );
  }
}

/** Pose (ou déplace) l'échéance d'une option sur un dossier non acquis. */
export async function poserOption(
  r: ReservationComplete,
  expiresAt: Date,
  acteur: string,
): Promise<void> {
  if (!(STATUTS_OPTION as readonly string[]).includes(r.status))
    throw new UserFacingError(
      "Une option se pose sur un dossier à traiter, en traitement ou accepté.",
    );
  if (expiresAt <= new Date()) throw new UserFacingError("L'échéance de l'option est déjà passée.");
  if (expiresAt > r.startAt)
    throw new UserFacingError("L'échéance de l'option doit précéder le début de la réservation.");
  await prisma.reservation.update({
    where: { id: r.id },
    data: { optionExpiresAt: expiresAt, optionRelanceAt: null },
  });
  await historiser(r.id, "Option posée", `jusqu'au ${dateHeure(expiresAt)}`, acteur);
}

export async function leverOption(r: ReservationComplete, acteur: string): Promise<void> {
  if (!r.optionExpiresAt) throw new UserFacingError("Ce dossier n'est pas en option.");
  await prisma.reservation.update({
    where: { id: r.id },
    data: { optionExpiresAt: null, optionRelanceAt: null },
  });
  await historiser(r.id, "Option levée", null, acteur);
}

/** Remet les bornes du dossier sur ses créneaux vivants. */
export async function majBornes(id: number): Promise<void> {
  const prevus = await prisma.creneau.findMany({ where: { reservationId: id, status: "prevu" } });
  if (!prevus.length) return;
  const b = bornes(prevus);
  await prisma.reservation.update({ where: { id }, data: { startAt: b.startAt, endAt: b.endAt } });
}

export async function historiser(
  reservationId: number,
  action: string,
  comment: string | null,
  acteur: string,
): Promise<void> {
  await prisma.reservationHistory.create({
    data: { reservationId, action, comment, performedBy: acteur },
  });
}

/** Les statuts atteignables depuis l'actuel, avec les modules actifs. */
export function transitionsPossibles(
  r: { status: string },
  settings: { SIGNATURE_ENABLED: boolean },
): ReservationStatus[] {
  const t = TRANSITIONS[r.status as ReservationStatus] ?? [];
  return t.filter((s) => s !== "signee" || settings.SIGNATURE_ENABLED);
}

/**
 * Change le statut d'un dossier : vérifie la transition, enregistre la décision, envoie
 * les courriels, pose les notifications. `motif` pour un refus ou une annulation,
 * `message` pour une demande d'informations.
 */
export async function changerStatut(
  id: number,
  nouveau: ReservationStatus,
  acteur: CurrentUser | { name: string; isAgent: boolean },
  opts: {
    motif?: string;
    message?: string;
    parSysteme?: boolean;
    sansFrais?: boolean;
    /** L'appelant prévient lui-même l'usager (réquisition municipale) : pas de courriel d'annulation. */
    sansCourriel?: boolean;
  } = {},
): Promise<ReservationComplete> {
  const r = await chargerReservation(id);
  if (!r) throw new UserFacingError("Réservation introuvable.");
  const cfg = await getSettings();
  const admis = opts.parSysteme ? Object.keys(RESERVATION_STATUS) : transitionsPossibles(r, cfg);
  if (!admis.includes(nouveau))
    throw new UserFacingError(
      `Passage de « ${RESERVATION_STATUS[r.status as ReservationStatus].label} » à « ${RESERVATION_STATUS[nouveau].label} » impossible.`,
    );
  const now = new Date();
  // Une acceptation (re)vérifie la disponibilité : un autre dossier a pu être confirmé entre-temps.
  if (
    ["acceptee", "confirmee", "signee"].includes(nouveau) &&
    !["acceptee", "confirmee", "signee"].includes(r.status)
  ) {
    const c = await verifierDisponibilite(
      r.espace,
      r.creneaux.filter((x) => x.status === "prevu"),
      r.id,
    );
    if (c.length)
      throw new UserFacingError(
        `Impossible d'accepter : ${plage(c[0].demande.startAt, c[0].demande.endAt)} est déjà occupé par « ${c[0].existant.libelle} ».`,
      );
    if (r.organisation && !opts.parSysteme)
      await verifierPieces(r.organisation, "acceptation", cfg);
  }
  // Acceptée sans signature électronique ni paiement attendu → directement confirmée.
  let effectif = nouveau;
  if (nouveau === "acceptee" && !enabledIn(cfg, "signature")) effectif = "confirmee";
  const data: Prisma.ReservationUpdateInput = { status: effectif };
  if (["acceptee", "confirmee", "refusee"].includes(effectif) && !r.decisionAt) {
    data.decisionAt = now;
    data.decisionBy = acteur.name;
  }
  if (effectif === "refusee") data.refusalReason = opts.motif ?? null;
  if (effectif === "annulee") data.cancelReason = opts.motif ?? null;
  if (effectif === "archivee") data.archivedAt = now;
  if (effectif === "annulee" || effectif === "refusee")
    data.creneaux = { updateMany: { where: {}, data: { status: "annule" } } };
  // Un dossier acquis n'est plus une option.
  if (["signee", "confirmee"].includes(effectif) && r.optionExpiresAt) data.optionExpiresAt = null;
  // Une caution demandée entre dans son cycle dès que le dossier est acquis.
  if (
    ["acceptee", "signee", "confirmee"].includes(effectif) &&
    r.caution > 0 &&
    r.cautionStatus === "aucune"
  )
    data.cautionStatus = "attendue";
  // Frais d'annulation selon le barème, pour un dossier acquis ; l'agent peut y renoncer.
  const frais =
    effectif === "annulee" && !opts.sansFrais && enabledIn(cfg, "paiements")
      ? fraisPrevus(r, lireBareme(cfg.ANNULATION_BAREME), now)
      : null;
  await prisma.reservation.update({ where: { id }, data });
  const libelle = RESERVATION_STATUS[effectif].label;
  await historiser(id, libelle, opts.motif ?? opts.message ?? null, acteur.name);
  // Les créneaux libérés intéressent la liste d'attente de l'espace.
  if (effectif === "annulee" || effectif === "refusee") {
    const { notifierLiberation } = await import("@/server/liste-attente");
    await notifierLiberation(
      r.espaceId,
      r.creneaux.filter((c) => c.status === "prevu"),
    ).catch((e) => console.error("[liste d'attente]", e));
  }
  await auditRecord(`reservation ${effectif}`, r.numero, "reservations", acteur.name);
  invalidateNavCounts();
  // Un dossier qui devient ferme : le personnel de service est affecté ou proposé.
  if (
    STATUTS_FERMES.includes(effectif) &&
    !STATUTS_FERMES.includes(r.status as ReservationStatus) &&
    enabledIn(cfg, "personnel")
  ) {
    const { affecterDossier } = await import("@/server/affectation");
    await affecterDossier(id, acteur.name).catch((e) => console.error("[affectation]", e));
  }
  const maj = (await chargerReservation(id)) as ReservationComplete;

  if (effectif === "acceptee") {
    const { genererConvention } = await import("@/server/convention");
    await genererConvention(maj, acteur.name);
    const apres = (await chargerReservation(id)) as ReservationComplete;
    await courrielUsager(apres, "reservation_acceptee", {
      suite: "Il vous reste à signer la convention de mise à disposition depuis votre espace.",
    });
    await courrielUsager(apres, "convention_a_signer");
    return apres;
  }
  if (effectif === "confirmee") {
    if (!r.conventionDocumentId) {
      const { genererConvention } = await import("@/server/convention");
      await genererConvention(maj, acteur.name).catch((e) => console.error("[convention]", e));
    }
    const apres = (await chargerReservation(id)) as ReservationComplete;
    if (enabledIn(cfg, "paiements") && apres.montantTtc > 0 && !apres.factures.length) {
      const { creerFacture } = await import("@/server/factures");
      await creerFacture(apres, apres.acompte > 0 ? "acompte" : "solde", acteur.name).catch((e) =>
        console.error("[facture]", e),
      );
    }
    await courrielUsager(apres, "reservation_confirmee");
    return (await chargerReservation(id)) as ReservationComplete;
  }
  if (effectif === "signee") {
    // Convention signée, acompte attendu : la facture d'acompte part tout de suite.
    const dejaAcompte = maj.factures.some((f) => f.type === "acompte" && f.status !== "annulee");
    if (enabledIn(cfg, "paiements") && maj.acompte > 0 && !dejaAcompte) {
      const { creerFacture } = await import("@/server/factures");
      await creerFacture(maj, "acompte", acteur.name).catch((e) => console.error("[facture]", e));
      return (await chargerReservation(id)) as ReservationComplete;
    }
  }
  if (effectif === "refusee")
    await courrielUsager(maj, "reservation_refusee", { motif: opts.motif ?? "non précisé" });
  if (effectif === "annulee") {
    // Les factures encore dues tombent avec la réservation ; les frais font l'objet d'une facture propre.
    for (const f of maj.factures.filter((x) => x.status === "a_payer")) {
      const { annulerFacture } = await import("@/server/factures");
      await annulerFacture(f.id, acteur.name);
    }
    let texteFrais = "";
    if (frais) {
      const { creerFacture } = await import("@/server/factures");
      const f = await creerFacture(maj, "frais", acteur.name, 30, frais.montant).catch((e) => {
        console.error("[frais annulation]", e);
        return null;
      });
      if (f) {
        texteFrais = `Annulation à ${frais.jours} jour(s) du début : des frais de ${montant(frais.montant)} (${frais.taux} % du montant) vous sont facturés (facture ${f.numero}).`;
        await historiser(
          id,
          "Frais d'annulation facturés",
          `${montant(frais.montant)} (${frais.taux} %, à ${frais.jours} jour(s))`,
          acteur.name,
        );
      }
    }
    if (!opts.sansCourriel)
      await courrielUsager(maj, "reservation_annulee", {
        motif: opts.motif ?? "non précisé",
        frais: texteFrais,
      });
    if (!acteur.isAgent)
      await notifierAgents(
        r.espaceId,
        "reservation",
        `Annulation de ${r.numero}`,
        `${r.espace.name} · ${plage(r.startAt, r.endAt)}`,
        `/reservations/${r.id}`,
      );
  }
  if (effectif === "en_traitement" && opts.message) {
    await ajouterMessage(id, acteur, opts.message, false);
    await courrielUsager(maj, "reservation_infos", { message: opts.message });
  }
  return maj;
}

/** Ajoute un message au fil (et prévient l'autre partie). */
export async function ajouterMessage(
  reservationId: number,
  auteur: CurrentUser | { id?: string; name: string; isAgent: boolean },
  body: string,
  isInternal: boolean,
): Promise<void> {
  const texte = body.trim();
  if (!texte) throw new UserFacingError("Le message est vide.");
  const r = await chargerReservation(reservationId);
  if (!r) throw new UserFacingError("Réservation introuvable.");
  await prisma.message.create({
    data: {
      reservationId,
      authorId: "id" in auteur ? (auteur.id ?? null) : null,
      authorKind: auteur.isAgent ? "agent" : "usager",
      body: texte,
      isInternal: auteur.isAgent && isInternal,
    },
  });
  invalidateNavCounts();
  if (isInternal && auteur.isAgent) return;
  const extrait = texte.length > 300 ? `${texte.slice(0, 300)}…` : texte;
  if (auteur.isAgent) {
    await courrielUsager(r, "message_recu", { auteur: auteur.name, message: extrait });
    if (r.userId)
      await notifier(
        r.userId,
        "message",
        `Nouveau message sur ${r.numero}`,
        extrait,
        `/portail/mes-reservations/${r.id}`,
      );
  } else {
    const cfg = await getSettings();
    const emails = await notifierAgents(
      r.espaceId,
      "message",
      `Message de ${auteur.name} sur ${r.numero}`,
      extrait,
      `/reservations/${r.id}`,
    );
    await envoyerDepuisModele(
      "message_recu",
      emails,
      {
        ...(await variablesDossier(r)),
        prenom: "",
        auteur: auteur.name,
        message: extrait,
        lien: `${cfg.APP_BASE_URL}/reservations/${r.id}`,
      },
      { reservationId: r.id },
    );
  }
}

/** Recalcule les montants d'un dossier (après modification des options, du matériel ou du profil). */
export async function recalculerMontants(
  id: number,
  gratuit?: boolean,
  gratuitMotif?: string | null,
): Promise<Devis> {
  const r = await chargerReservation(id);
  if (!r) throw new UserFacingError("Réservation introuvable.");
  const devis = await deviser(
    r.espaceId,
    r.organisation?.profilId ?? null,
    r.creneaux.filter((c) => c.status === "prevu"),
    r.options.map((o) => ({ optionId: o.optionId, quantite: o.quantite })),
    r.materiels.map((m) => ({ materielId: m.materielId, quantite: m.quantite })),
    gratuit ?? r.gratuit,
  );
  await prisma.reservation.update({
    where: { id },
    data: {
      montantHt: devis.ht,
      montantTtc: devis.ttc,
      acompte: devis.acompte,
      caution: devis.caution,
      gratuit: devis.gratuit,
      ...(gratuit !== undefined
        ? {
            gratuitMotif: devis.gratuit
              ? (gratuitMotif?.trim().slice(0, 300) ?? r.gratuitMotif)
              : null,
          }
        : {}),
    },
  });
  return devis;
}

/** Les dossiers visibles par un usager : les siens et ceux de son organisation. */
export function whereUsager(user: CurrentUser): Prisma.ReservationWhereInput {
  return user.organisationId
    ? { OR: [{ userId: user.id }, { organisationId: user.organisationId }] }
    : { userId: user.id };
}

/** L'usager peut-il annuler lui-même (statut vivant et délai respecté) ? */
export function annulableParUsager(
  r: { status: string; startAt: Date },
  delaiJours: number,
  now = new Date(),
): boolean {
  if (!STATUTS_OCCUPANTS.includes(r.status as ReservationStatus)) return false;
  return r.startAt.getTime() - now.getTime() >= delaiJours * 86_400_000;
}
