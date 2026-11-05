/**
 * Priorité municipale : la Ville a besoin d'un espace déjà réservé pour un événement qu'elle
 * organise. L'agent réquisitionne le créneau d'un dossier acquis : il est déplacé sur un
 * créneau libre (avec l'accord présumé de l'usager, qui est prévenu) ou annulé sans frais.
 * Logique PURE : testée dans priorite.test.ts.
 */
import { type ReservationStatus, STATUTS_FERMES } from "@/lib/constantes";
import type { Intervalle } from "@/lib/creneaux";
import { isoParis, plage } from "@/lib/libelles";
import { parisDateTimeToInstant } from "@/lib/paris-time";

export type ChoixRequisition = { mode: "deplacer"; nouveau: Intervalle } | { mode: "annuler" };

/** Pourquoi ce créneau ne peut pas être réquisitionné (null = il peut l'être). */
export function obstacleRequisition(
  r: { status: string },
  c: { status: string; startAt: Date },
  now = new Date(),
): string | null {
  if (!STATUTS_FERMES.includes(r.status as ReservationStatus))
    return "Seul un dossier accepté, signé ou confirmé se réquisitionne ; refusez ou annulez les autres.";
  if (c.status !== "prevu") return "Ce créneau est déjà annulé.";
  if (c.startAt <= now) return "Ce créneau est passé.";
  return null;
}

/** Le créneau est-il le dernier prévu du dossier ? Son annulation annule alors tout le dossier. */
export function dernierPrevu(
  creneaux: readonly { id: number; status: string }[],
  cid: number,
): boolean {
  return !creneaux.some((c) => c.status === "prevu" && c.id !== cid);
}

/**
 * Lit le choix du formulaire : « alternative » porte « date|début|fin » d'un créneau proposé,
 * sinon les champs date / heures ; « annuler » annule.
 */
export function lireChoixRequisition(v: {
  mode: string;
  alternative: string;
  saisie: Intervalle | null;
}): ChoixRequisition | string {
  if (v.mode === "annuler") return { mode: "annuler" };
  if (v.mode !== "deplacer")
    return "Indiquez la suite à donner au créneau : déplacement ou annulation.";
  const alt = decoderAlternative(v.alternative);
  if (alt) return { mode: "deplacer", nouveau: alt };
  if (v.saisie) return { mode: "deplacer", nouveau: v.saisie };
  return "Choisissez un créneau de remplacement ou saisissez un horaire.";
}

/** « 2026-12-05|10:00|12:00 » ↔ un intervalle, pour les boutons radio des alternatives. */
export function encoderAlternative(i: Intervalle): string {
  const d = isoParis(i.startAt);
  const f = isoParis(i.endAt);
  return `${d.date}|${d.time}|${f.time}`;
}

export function decoderAlternative(code: string): Intervalle | null {
  const m = /^(\d{4}-\d{2}-\d{2})\|(\d{2}:\d{2})\|(\d{2}:\d{2})$/.exec(code.trim());
  if (!m) return null;
  const startAt = parisDateTimeToInstant(m[1], m[2]);
  let endAt = parisDateTimeToInstant(m[1], m[3]);
  if (!startAt || !endAt) return null;
  if (endAt <= startAt) endAt = new Date(endAt.getTime() + 86_400_000);
  return { startAt, endAt };
}

/** Le motif inscrit dans le dossier (annulation) et l'historique. */
export function motifRequisition(evenement: string, motif: string | null): string {
  return `Priorité municipale : ${evenement}${motif ? ` (${motif})` : ""}`;
}

/** La phrase « suite » du courriel à l'usager, selon le sort du créneau. */
export function phraseSuite(
  c: Intervalle,
  choix: ChoixRequisition,
  o: { dossierAnnule: boolean; avenant: boolean; montantChange: boolean },
): string {
  if (choix.mode === "deplacer") {
    const base = `Votre créneau du ${plage(c.startAt, c.endAt)} est déplacé au ${plage(choix.nouveau.startAt, choix.nouveau.endAt)}.`;
    const suite = o.avenant
      ? " Votre convention étant signée, un avenant vous est adressé pour signature."
      : o.montantChange
        ? " Le montant de votre réservation est recalculé en conséquence."
        : "";
    return `${base}${suite} Si ce nouvel horaire ne vous convient pas, répondez-nous depuis votre dossier : nous chercherons une autre solution avec vous.`;
  }
  if (o.dossierAnnule)
    return `Votre réservation est annulée sans aucun frais ; les sommes déjà réglées vous seront remboursées. Nous vous invitons à déposer une nouvelle demande pour un autre créneau, que nous traiterons en priorité.`;
  return `Votre créneau du ${plage(c.startAt, c.endAt)} est annulé sans aucun frais et retiré du montant de votre réservation ; les autres créneaux du dossier sont maintenus.`;
}

/** Le message de confirmation à l'agent. */
export function phraseBilan(
  c: Intervalle,
  choix: ChoixRequisition,
  o: { dossierAnnule: boolean; prevenu: boolean },
): string {
  const usager = o.prevenu ? " L'usager est prévenu par courriel." : "";
  if (choix.mode === "deplacer")
    return `Créneau du ${plage(c.startAt, c.endAt)} déplacé au ${plage(choix.nouveau.startAt, choix.nouveau.endAt)} pour la Ville.${usager}`;
  if (o.dossierAnnule) return `Réservation annulée sans frais pour la Ville.${usager}`;
  return `Créneau du ${plage(c.startAt, c.endAt)} annulé sans frais pour la Ville.${usager}`;
}

/** Le lien de saisie de la réservation de la Ville sur le créneau libéré. */
export function lienSaisieVille(espaceId: number, c: Intervalle, evenement: string): string {
  const d = isoParis(c.startAt);
  const f = isoParis(c.endAt);
  const p = new URLSearchParams({
    espace: String(espaceId),
    date: d.date,
    heure_debut: d.time,
    heure_fin: f.time,
    title: evenement,
  });
  return `/reservations/nouvelle?${p}`;
}
