/**
 * Modules débrayables depuis Paramètres. Désactivé, un module disparaît des écrans et
 * ses routes d'écriture répondent 404 ; les données déjà saisies restent en base.
 */
import { notFound } from "next/navigation";
import type { PermissionCategory } from "@/lib/constantes";
import { type AppSettings, getSettings } from "@/server/config-store";

export type FeatureName =
  | "portail"
  | "inscription"
  | "paiements"
  | "signature"
  | "materiel"
  | "subventions"
  | "documents"
  | "campagnes"
  | "personnel";

/** nom court → (clé de configuration, libellé, aide) */
export const FEATURES: Record<FeatureName, [string, string, string]> = {
  portail: [
    "PORTAIL_ENABLED",
    "Portail public",
    "Le catalogue des espaces et le dépôt de demandes en ligne par les usagers.",
  ],
  inscription: [
    "INSCRIPTION_ENABLED",
    "Inscription des usagers",
    "Les usagers créent eux-mêmes leur compte sur le portail (sinon, les agents les créent).",
  ],
  paiements: [
    "PAIEMENTS_ENABLED",
    "Facturation et paiements",
    "Factures d'acompte, de solde et de caution, suivi des règlements.",
  ],
  signature: [
    "SIGNATURE_ENABLED",
    "Signature électronique des conventions",
    "La convention est signée en ligne par un code reçu par SMS ou par courriel.",
  ],
  materiel: [
    "MATERIEL_ENABLED",
    "Matériel",
    "Mobilisation de matériel (tables, chaises, sono…) avec une réservation, stocks suivis.",
  ],
  subventions: [
    "SUBVENTIONS_ENABLED",
    "Demandes de subvention (module ASSO)",
    "Les associations déposent leurs demandes de subvention ; les élus donnent un avis.",
  ],
  documents: [
    "DOCUMENTS_ENABLED",
    "Pièces jointes",
    "Dépôt de pièces (attestation d'assurance, statuts, programme) sur les dossiers.",
  ],
  campagnes: [
    "CAMPAGNES_ENABLED",
    "Campagnes annuelles de créneaux",
    "Les usagers déposent leurs vœux de créneaux hebdomadaires sur une saison ; la Ville arbitre par priorité et attribue en lot.",
  ],
  personnel: [
    "PERSONNEL_ENABLED",
    "Planning du personnel de service",
    "Gardiens, agents d'accueil et vacataires planifiés par vacations sur les sites ; créneaux réservés sans personne de service signalés.",
  ],
};

/** Un module qui est un ÉCRAN ENTIER se coupe par sa catégorie de droit. */
export const MODULE_CATEGORIES: Record<string, PermissionCategory> = {
  materiel: "materiel",
  paiements: "paiements",
  subventions: "subventions",
  personnel: "personnel",
};

export type FeatureFlags = Record<FeatureName, boolean>;

export function enabledIn(settings: AppSettings, name: FeatureName): boolean {
  const key = FEATURES[name][0];
  const v = settings[key];
  return v === undefined ? true : Boolean(v);
}

export async function enabled(name: FeatureName): Promise<boolean> {
  return enabledIn(await getSettings(), name);
}

/** La catégorie de droit relève-t-elle d'un module actif ? */
export function categoryEnabledIn(settings: AppSettings, category: string): boolean {
  return Object.entries(MODULE_CATEGORIES).every(
    ([name, cat]) => cat !== category || enabledIn(settings, name as FeatureName),
  );
}

/** À poser en tête d'une route d'écriture : un module coupé n'accepte plus rien. */
export async function require(name: FeatureName): Promise<void> {
  if (!(await enabled(name))) notFound();
}

export function allFlagsIn(settings: AppSettings): FeatureFlags {
  return Object.fromEntries(
    (Object.keys(FEATURES) as FeatureName[]).map((n) => [n, enabledIn(settings, n)]),
  ) as FeatureFlags;
}

export async function allFlags(): Promise<FeatureFlags> {
  return allFlagsIn(await getSettings());
}
