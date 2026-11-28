/**
 * Les alertes du tableau de bord : ce qui réclame une action et qui n'est pas une simple
 * demande à traiter. Chaque alerte porte un compteur et le lien vers la liste filtrée
 * correspondante ; elle n'est montrée qu'aux agents qui ont le droit de voir le domaine.
 */
import { parseYmdUtc } from "@/lib/date-utc";
import { libelleARepondre } from "@/lib/messages";
import { STATUTS_OPTION } from "@/lib/options";
import { addParisDays, parisMidnight, todayParisISO } from "@/lib/paris-time";
import { etatValidite, type PieceJugee } from "@/lib/pieces";
import { nbPropositions } from "@/server/affectation";
import type { AppSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { allFlagsIn } from "@/server/features";
import type { CurrentUser } from "@/server/guards";
import { controlesEnRetard } from "@/server/materiel-stock";
import { compterARepondre } from "@/server/messages-attente";
import { usagersAValider } from "@/server/nav";
import { nbCreneauxACouvrir } from "@/server/personnel";
import { organisationsSansConvention } from "@/server/valorisation";

export type Alerte = {
  cle: string;
  niveau: "danger" | "warning" | "info";
  icone: string;
  titre: string;
  detail: string;
  nb: number;
  href: string;
};

/** Les documents datés des organisations actives, pour juger leurs pièces. */
export async function piecesDatees(): Promise<(PieceJugee & { organisationId: number })[]> {
  const rows = await prisma.document.findMany({
    where: {
      organisationId: { not: null },
      validUntil: { not: null },
      organisation: { isActive: true },
    },
    select: { kind: true, validUntil: true, organisationId: true },
  });
  return rows.map((r) => ({
    kind: r.kind,
    validUntil: r.validUntil,
    organisationId: r.organisationId as number,
  }));
}

/** Les organisations (ids) ayant au moins une pièce expirée, et celles qui expirent bientôt. */
export function organisationsParEtat(
  pieces: (PieceJugee & { organisationId: number })[],
  today: string,
  seuil: number,
): { expirees: Set<number>; bientot: Set<number> } {
  const expirees = new Set<number>();
  const bientot = new Set<number>();
  for (const p of pieces) {
    const e = etatValidite(p.validUntil, today, seuil);
    if (e === "expiree") expirees.add(p.organisationId);
    else if (e === "bientot") bientot.add(p.organisationId);
  }
  for (const id of expirees) bientot.delete(id);
  return { expirees, bientot };
}

const pluriel = (n: number, s: string, p: string) => (n > 1 ? p : s);

/** Rappel permanent, pour l'administrateur : il reste tant qu'aucun texte n'est saisi. */
function alerteConditions(user: CurrentUser, cfg: AppSettings): Alerte[] {
  if (!user.isAdmin || cfg.PORTAIL_CONDITIONS.trim()) return [];
  const ouvert = allFlagsIn(cfg).portail;
  return [
    {
      cle: "conditions_manquantes",
      niveau: ouvert ? "danger" : "warning",
      icone: "file-text",
      titre: "Aucune condition d'utilisation n'est saisie",
      detail: ouvert
        ? "Le portail est ouvert sans conditions : les usagers n'ont rien à lire ni à accepter. À saisir dans Paramètres › Portail."
        : "À saisir dans Paramètres › Portail avant d'ouvrir le portail : les usagers les accepteront à leur première connexion.",
      nb: 1,
      href: "/parametres#portail",
    },
  ];
}

/** Pièces datées des usagers : expirées (urgent) et bientôt expirées. */
async function alertesPieces(
  user: CurrentUser,
  cfg: AppSettings,
  today: string,
): Promise<Alerte[]> {
  if (!allFlagsIn(cfg).documents || !user.canView("usagers")) return [];
  const seuil = cfg.ALERTE_PIECES_JOURS ?? 30;
  const { expirees, bientot } = organisationsParEtat(await piecesDatees(), today, seuil);
  const out: Alerte[] = [];
  if (expirees.size)
    out.push({
      cle: "pieces_expirees",
      niveau: "danger",
      icone: "triangle-alert",
      titre: `${expirees.size} ${pluriel(expirees.size, "usager a une pièce expirée", "usagers ont une pièce expirée")}`,
      detail: "Attestation d'assurance ou autre pièce datée à renouveler.",
      nb: expirees.size,
      href: "/usagers?type=pieces",
    });
  if (bientot.size)
    out.push({
      cle: "pieces_bientot",
      niveau: "warning",
      icone: "clock",
      titre: `${bientot.size} ${pluriel(bientot.size, "pièce expire", "pièces expirent")} dans moins de ${seuil} jours`,
      detail: "Les usagers concernés sont prévenus par courriel.",
      nb: bientot.size,
      href: "/usagers?type=pieces",
    });
  return out;
}

/** Factures dont l'échéance est dépassée. */
async function alerteFactures(
  user: CurrentUser,
  cfg: AppSettings,
  today: string,
): Promise<Alerte[]> {
  if (!allFlagsIn(cfg).paiements || !user.canView("paiements")) return [];
  const n = await prisma.facture.count({
    where: { status: "a_payer", dueAt: { lt: parseYmdUtc(today) } },
  });
  if (!n) return [];
  return [
    {
      cle: "factures_echues",
      niveau: "danger",
      icone: "receipt",
      titre: `${n} facture${n > 1 ? "s" : ""} échue${n > 1 ? "s" : ""} non réglée${n > 1 ? "s" : ""}`,
      detail: "Échéance dépassée : relance ou encaissement à saisir.",
      nb: n,
      href: "/paiements?statut=retard",
    },
  ];
}

/**
 * Le nombre d'alertes URGENTES (rouges) de l'agent : celles que le menu signale par une icône
 * sur « Tableau de bord ». Ne calcule que les alertes qui peuvent être rouges, pour rester léger
 * (appelé à chaque page) ; ce sont les mêmes fonctions que le bloc Alertes, donc les mêmes règles.
 */
export async function nbAlertesUrgentes(
  user: CurrentUser,
  cfg: AppSettings,
  now = new Date(),
): Promise<number> {
  const today = todayParisISO(now);
  const toutes = [
    ...alerteConditions(user, cfg),
    ...(await alertesPieces(user, cfg, today)),
    ...(await alerteFactures(user, cfg, today)),
  ];
  return toutes.filter((a) => a.niveau === "danger").length;
}

export async function alertes(
  user: CurrentUser,
  cfg: AppSettings,
  now = new Date(),
): Promise<Alerte[]> {
  const features = allFlagsIn(cfg);
  const today = todayParisISO(now);
  const minuit = parisMidnight(today);
  const out: Alerte[] = [];

  out.push(...alerteConditions(user, cfg));
  out.push(...(await alertesPieces(user, cfg, today)));

  if (features.subventions && user.canView("subventions")) {
    const n = await organisationsSansConvention(cfg).catch(() => 0);
    if (n)
      out.push({
        cle: "valorisation_convention",
        niveau: "warning",
        icone: "handshake",
        titre: `${n} association${n > 1 ? "s" : ""} dépasse${n > 1 ? "nt" : ""} ${Math.round(cfg.VALORISATION_SEUIL_CONVENTION).toLocaleString("fr-FR")} € d'aides sans convention`,
        detail:
          "Avantages en nature et subventions de l'exercice : une convention d'objectifs est obligatoire.",
        nb: n,
        href: "/valorisation",
      });
  }

  if (features.personnel && user.canView("personnel")) {
    const propositions = await nbPropositions(user).catch(() => 0);
    if (propositions)
      out.push({
        cle: "personnel_propositions",
        niveau: "warning",
        icone: "hourglass",
        titre: `${propositions} proposition${propositions > 1 ? "s" : ""} d'affectation du personnel à valider`,
        detail: "Une personne disponible est proposée sur un créneau réservé : validez ou écartez.",
        nb: propositions,
        href: "/personnel?onglet=propositions",
      });
    const n = await nbCreneauxACouvrir(user, minuit, addParisDays(minuit, 7));
    if (n)
      out.push({
        cle: "personnel_a_couvrir",
        niveau: "warning",
        icone: "personnel-service",
        titre: `${n} créneau${n > 1 ? "x" : ""} réservé${n > 1 ? "s" : ""} sans personne de service dans les 7 jours`,
        detail:
          "Aucune vacation ne couvre entièrement le créneau : ajoutez une vacation ou épinglez quelqu'un.",
        nb: n,
        href: `/personnel?onglet=a_couvrir&date=${today}`,
      });
  }

  if (features.materiel && user.canView("materiel")) {
    const n = (await controlesEnRetard(now)).length;
    if (n)
      out.push({
        cle: "materiel_controles",
        niveau: "warning",
        icone: "clipboard-check",
        titre: `${n} matériel${n > 1 ? "s" : ""} à contrôler`,
        detail: "Contrôle périodique échu : à enregistrer depuis la fiche du matériel.",
        nb: n,
        href: "/materiel?etat=controle",
      });
  }

  out.push(...(await alerteFactures(user, cfg, today)));

  if (features.signature && user.canView("reservations")) {
    const limite = addParisDays(minuit, -(cfg.RELANCE_SIGNATURE_JOURS || 3));
    const n = await prisma.reservation.count({
      where: { status: "acceptee", signedAt: null, signatureSentAt: { lt: limite } },
    });
    if (n)
      out.push({
        cle: "signatures_retard",
        niveau: "warning",
        icone: "file-signature",
        titre: `${n} convention${n > 1 ? "s" : ""} en attente de signature depuis plus de ${cfg.RELANCE_SIGNATURE_JOURS || 3} jours`,
        detail: "L'usager n'a pas signé malgré la relance.",
        nb: n,
        href: "/reservations?statut=acceptee",
      });
  }

  if (user.canView("reservations")) {
    const horizon = addParisDays(minuit, (cfg.OPTION_RELANCE_JOURS || 3) + 1);
    const options = await prisma.reservation.count({
      where: {
        optionExpiresAt: { lte: horizon },
        status: { in: [...STATUTS_OPTION] },
        ...(user.espacesGeres.length ? { espaceId: { in: user.espacesGeres } } : {}),
      },
    });
    if (options)
      out.push({
        cle: "options_echeance",
        niveau: "warning",
        icone: "hourglass",
        titre: `${options} option${options > 1 ? "s" : ""} arrive${options > 1 ? "nt" : ""} à échéance`,
        detail: "Sans confirmation à la date limite, le créneau est libéré d'office.",
        nb: options,
        href: "/reservations?statut=a_traiter",
      });
  }

  if (user.canView("reservations")) {
    const delai = cfg.CAUTION_DELAI_RESTITUTION_JOURS || 30;
    const retard = await prisma.reservation.count({
      where: {
        cautionStatus: "encaissee",
        endAt: { lt: addParisDays(minuit, -delai) },
        ...(user.espacesGeres.length ? { espaceId: { in: user.espacesGeres } } : {}),
      },
    });
    if (retard)
      out.push({
        cle: "cautions_retard",
        niveau: "warning",
        icone: "piggy-bank",
        titre: `${retard} caution${retard > 1 ? "s" : ""} à restituer ou retenir depuis plus de ${delai} jours`,
        detail: "État des lieux de sortie, puis restitution ou retenue motivée.",
        nb: retard,
        href: "/reservations?caution=retard",
      });
    if (user.isAdmin) {
      const aValider = await prisma.reservation.count({
        where: { cautionStatus: "retenue_a_valider" },
      });
      if (aValider)
        out.push({
          cle: "cautions_a_valider",
          niveau: "warning",
          icone: "shield-check",
          titre: `${aValider} retenue${aValider > 1 ? "s" : ""} sur caution à valider`,
          detail:
            "Au-delà du seuil, un administrateur confirme la retenue avant l'envoi à l'usager.",
          nb: aValider,
          href: "/reservations?caution=a_valider",
        });
    }
  }

  if (user.canView("reservations")) {
    const n = await prisma.reservation.count({
      where: {
        status: { in: ["a_traiter", "en_traitement"] },
        createdAt: { lt: addParisDays(minuit, -7) },
        ...(user.espacesGeres.length ? { espaceId: { in: user.espacesGeres } } : {}),
      },
    });
    if (n)
      out.push({
        cle: "demandes_anciennes",
        niveau: "warning",
        icone: "clock",
        titre: `${n} demande${n > 1 ? "s" : ""} sans réponse depuis plus de 7 jours`,
        detail: "Les usagers attendent une décision.",
        nb: n,
        href: "/reservations?statut=a_traiter",
      });
  }

  if (features.processus) {
    const { etapesEnAttente } = await import("@/server/circuits");
    const maintenant = Date.now();
    const { avisAttendus } = await import("@/server/circuits-subvention");
    const enRetard = (e: { echeanceAt: Date | null }) =>
      Boolean(e.echeanceAt && e.echeanceAt.getTime() < maintenant);
    const n =
      (await etapesEnAttente(user).catch(() => [])).filter(enRetard).length +
      (features.subventions
        ? (await avisAttendus(user).catch(() => [])).filter(enRetard).length
        : 0);
    if (n)
      out.push({
        cle: "etapes_en_retard",
        niveau: "warning",
        icone: "list-checks",
        titre: `${n} étape${n > 1 ? "s" : ""} de circuit en retard`,
        detail: "Un service attend votre relecture, votre avis ou votre visa.",
        nb: n,
        href: "/etapes",
      });
  }

  if (user.canView("usagers")) {
    const n = user.fileDeTravail
      ? await usagersAValider(user)
      : await prisma.organisation.count({ where: { validatedAt: null, isActive: true } });
    if (n)
      out.push({
        cle: "usagers_a_valider",
        niveau: "info",
        icone: "badge-check",
        titre: `${n} fiche${n > 1 ? "s" : ""} d'usager à valider`,
        detail: "Sans validation, l'usager n'accède pas aux tarifs de son profil.",
        nb: n,
        href: "/usagers?type=a_valider",
      });
  }

  if (user.canView("messages")) {
    const n = await compterARepondre();
    if (n)
      out.push({
        cle: "messages",
        niveau: "info",
        icone: "message-circle",
        titre: libelleARepondre(n),
        detail: "L'usager a écrit en dernier : un agent doit lui répondre.",
        nb: n,
        href: "/messages",
      });
  }

  const ordre = { danger: 0, warning: 1, info: 2 };
  return out.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
}
