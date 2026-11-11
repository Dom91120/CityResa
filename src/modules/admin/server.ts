/**
 * Administration : contexte d'une page réservée aux administrateurs, pagination en base,
 * variables et valeurs d'exemple des modèles de courriel, icônes des notifications.
 */
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { contextePage, type Page } from "@/server/page";
import type { Pagination, Params } from "@/server/paging";
import { param } from "@/server/paging";

/** Page du back-office réservée aux administrateurs. */
export async function contexteAdmin(): Promise<Page> {
  const page = await contextePage();
  if (!page.user.isAdmin)
    redirigerAvecFlashDepuisRendu("/", "Accès réservé aux administrateurs.", "danger");
  return page;
}

/** skip/take d'une page et l'objet Pagination attendu par la barre. */
export function pageBase(
  params: Params,
  total: number,
  perPage: number | null,
): { skip: number; take: number | undefined; p: Pagination } {
  if (perPage === null || perPage === 0)
    return { skip: 0, take: undefined, p: { page: 1, pages: 1, total, perPage: null } };
  let page = Number.parseInt(param(params, "page") ?? "1", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  const pages = Math.max(1, Math.ceil(total / perPage));
  page = Math.min(page, pages);
  return { skip: (page - 1) * perPage, take: perPage, p: { page, pages, total, perPage } };
}

/** Les {{variables}} d'un sujet et d'un corps, dans l'ordre d'apparition. */
export function variablesDe(...textes: string[]): string[] {
  const out: string[] = [];
  for (const t of textes) {
    for (const m of t.matchAll(/\{\{\{?\s*(\w+)\s*\}?\}\}/g)) {
      if (!out.includes(m[1])) out.push(m[1]);
    }
  }
  return out;
}

/** Des valeurs d'exemple pour l'aperçu et le courriel de test. */
export function exemplesVariables(baseUrl: string, collectivite: string): Record<string, string> {
  return {
    collectivite,
    base_url: baseUrl,
    prenom: "Camille",
    numero: "RES-2026-0042",
    espace: "Salle des fêtes",
    dates: "Sam. 14 mars 2026 · 18h00 – 23h00",
    lien: `${baseUrl}/portail/mes-reservations/42`,
    demandeur: "Camille Martin",
    organisation: "Association des Amis du Quartier",
    titre: "Assemblée générale annuelle",
    message: "Pourriez-vous préciser le nombre de participants attendus ?",
    suite: "Une convention vous sera adressée pour signature.",
    code: "483 921",
    validite: "15 minutes",
    date_signature: "02/03/2026 à 10h15",
    consignes: "Récupérer les clés à l'accueil de la mairie la veille avant 17h.",
    motif: "Créneau déjà attribué à une autre manifestation.",
    auteur: "Service des salles",
    type_facture: "Facture de solde",
    numero_facture: "FAC-2026-0017",
    montant: "240 €",
    echeance: "30/03/2026",
    modalites: "Virement ou paiement en régie à l'accueil de la mairie.",
    objet: "Tournoi inter-quartiers",
    exercice: "2026",
    decision: "Votée",
    montant_accorde: "Montant accordé : 1 500 €.",
    note: "Versement après réception du bilan de l'action.",
    date: "14/03/2026",
    nb_a_traiter: "3",
    nb_messages: "2",
    nb_signatures: "1",
    nb_factures: "4",
    nb_aujourdhui: "2",
  };
}

/** Icône et teinte d'une notification selon son type. */
export const NOTIF_ICONES: Record<string, [string, string]> = {
  reservation: ["clipboard-list", "rose"],
  message: ["message-circle", "sky"],
  signature: ["pen-line", "violet"],
  paiement: ["credit-card", "emerald"],
  usager: ["book-user", "amber"],
  subvention: ["hand-coins", "lime"],
  rappel: ["bell", "amber"],
  systeme: ["info", "slate"],
};

/** Libellés des catégories du journal d'audit. */
export const CATEGORIES_AUDIT: Record<string, string> = {
  reservations: "Réservations",
  planning: "Planning",
  espaces: "Sites et espaces",
  materiel: "Matériel",
  usagers: "Usagers",
  messages: "Messages",
  paiements: "Paiements",
  subventions: "Subventions",
  equipe: "Équipe",
  utilisateurs: "Utilisateurs",
  roles: "Rôles",
  parametres: "Paramètres",
  securite: "Sécurité",
  systeme: "Système",
  profil: "Profil",
};
