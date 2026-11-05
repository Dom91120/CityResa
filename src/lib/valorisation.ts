/**
 * Valorisation des avantages en nature : pour chaque organisation et chaque exercice (année
 * civile), les heures mises à disposition, leur valeur de référence, la redevance réellement
 * due, l'avantage qui en résulte, les subventions en numéraire et le total soumis aux seuils
 * réglementaires (convention obligatoire au-delà de 23 000 €, comptes certifiés au-delà de
 * 153 000 €). Logique PURE : testée dans valorisation.test.ts.
 */
import type { Intervalle } from "@/lib/creneaux";
import { dureeMinutes } from "@/lib/creneaux";
import { parisParts } from "@/lib/paris-time";

const arrondi = (n: number) => Math.round(n * 100) / 100;

/** L'exercice (année civile de Paris) d'un instant. */
export function exerciceDe(d: Date): number {
  return Number(parisParts(d).dateKey.slice(0, 4));
}

/** Les créneaux d'un dossier qui tombent dans l'exercice, et la part d'heures que cela représente. */
export function partExercice(
  creneaux: readonly Intervalle[],
  exercice: number,
): { dedans: Intervalle[]; heures: number; part: number } {
  const dedans = creneaux.filter((c) => exerciceDe(c.startAt) === exercice);
  const heures = dedans.reduce((s, c) => s + dureeMinutes(c) / 60, 0);
  const total = creneaux.reduce((s, c) => s + dureeMinutes(c) / 60, 0);
  return { dedans, heures: arrondi(heures), part: total > 0 ? heures / total : 0 };
}

/**
 * La valeur de référence des heures d'un espace : sa valeur horaire de valorisation si elle
 * est fixée, sinon le devis « tous profils » fourni par l'appelant.
 */
export function valeurReference(
  heures: number,
  valorisationHoraire: number | null | undefined,
  devisReference: number,
): number {
  if (valorisationHoraire !== null && valorisationHoraire !== undefined && valorisationHoraire >= 0)
    return arrondi(heures * valorisationHoraire);
  return arrondi(devisReference);
}

/** L'avantage en nature : la valeur de référence moins ce qui est réellement dû, jamais négatif. */
export function avantage(valeurRef: number, redevance: number): number {
  return arrondi(Math.max(0, valeurRef - redevance));
}

export type DossierValorise = {
  reservationId: number;
  numero: string;
  titre: string;
  espace: string;
  heures: number;
  valeurReference: number;
  redevance: number;
  avantage: number;
};

export type LigneValorisation = {
  organisationId: number;
  nom: string;
  type: string;
  conventionnee: boolean;
  nbDossiers: number;
  heures: number;
  valeurReference: number;
  redevance: number;
  avantage: number;
  subventions: number;
  total: number;
  dossiers: DossierValorise[];
};

/** Regroupe les dossiers valorisés par organisation et ajoute les subventions en numéraire. */
export function cumuler(
  dossiers: readonly (DossierValorise & {
    organisation: { id: number; name: string; type: string; conventionnee: boolean };
  })[],
  subventions: ReadonlyMap<number, number>,
  organisations: readonly { id: number; name: string; type: string; conventionnee: boolean }[] = [],
): LigneValorisation[] {
  const parOrg = new Map<number, LigneValorisation>();
  const ligne = (o: { id: number; name: string; type: string; conventionnee: boolean }) => {
    let l = parOrg.get(o.id);
    if (!l) {
      l = {
        organisationId: o.id,
        nom: o.name,
        type: o.type,
        conventionnee: o.conventionnee,
        nbDossiers: 0,
        heures: 0,
        valeurReference: 0,
        redevance: 0,
        avantage: 0,
        subventions: subventions.get(o.id) ?? 0,
        total: 0,
        dossiers: [],
      };
      parOrg.set(o.id, l);
    }
    return l;
  };
  for (const d of dossiers) {
    const l = ligne(d.organisation);
    l.nbDossiers += 1;
    l.heures += d.heures;
    l.valeurReference += d.valeurReference;
    l.redevance += d.redevance;
    l.avantage += d.avantage;
    l.dossiers.push(d);
  }
  // Les organisations subventionnées sans mise à disposition comptent aussi pour les seuils.
  for (const o of organisations) if ((subventions.get(o.id) ?? 0) > 0) ligne(o);
  return [...parOrg.values()]
    .map((l) => ({
      ...l,
      heures: arrondi(l.heures),
      valeurReference: arrondi(l.valeurReference),
      redevance: arrondi(l.redevance),
      avantage: arrondi(l.avantage),
      subventions: arrondi(l.subventions),
      total: arrondi(l.avantage + l.subventions),
    }))
    .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, "fr"));
}

export type Seuils = { convention: number; certification: number };

/** Les seuils franchis par un total d'aides (avantages en nature + subventions). */
export function seuilsFranchis(
  total: number,
  s: Seuils,
): { convention: boolean; certification: boolean } {
  return {
    convention: s.convention > 0 && total >= s.convention,
    certification: s.certification > 0 && total >= s.certification,
  };
}

/** Les organisations au-delà du seuil de convention qui n'en ont pas. */
export function sansConvention(
  lignes: readonly LigneValorisation[],
  s: Seuils,
): LigneValorisation[] {
  return lignes.filter((l) => seuilsFranchis(l.total, s).convention && !l.conventionnee);
}

/** Les totaux d'un exercice. */
export function totaux(lignes: readonly LigneValorisation[]) {
  const t = {
    organisations: lignes.length,
    heures: 0,
    valeurReference: 0,
    redevance: 0,
    avantage: 0,
    subventions: 0,
    total: 0,
  };
  for (const l of lignes) {
    t.heures += l.heures;
    t.valeurReference += l.valeurReference;
    t.redevance += l.redevance;
    t.avantage += l.avantage;
    t.subventions += l.subventions;
    t.total += l.total;
  }
  return {
    ...t,
    heures: arrondi(t.heures),
    valeurReference: arrondi(t.valeurReference),
    redevance: arrondi(t.redevance),
    avantage: arrondi(t.avantage),
    subventions: arrondi(t.subventions),
    total: arrondi(t.total),
  };
}

/** Les lignes de l'annexe du compte administratif (CSV). */
export function lignesAnnexe(
  exercice: number,
  lignes: readonly LigneValorisation[],
  s: Seuils,
): (string | number)[][] {
  const tete = [
    "Exercice",
    "Organisation",
    "Type",
    "Conventionnée",
    "Dossiers",
    "Heures",
    "Valeur de référence (€)",
    "Redevance due (€)",
    "Avantage en nature (€)",
    "Subventions (€)",
    "Total des aides (€)",
    `Seuil convention (${s.convention} €)`,
    `Seuil certification (${s.certification} €)`,
  ];
  return [
    tete,
    ...lignes.map((l) => {
      const f = seuilsFranchis(l.total, s);
      return [
        exercice,
        l.nom,
        l.type,
        l.conventionnee ? "oui" : "non",
        l.nbDossiers,
        l.heures,
        l.valeurReference,
        l.redevance,
        l.avantage,
        l.subventions,
        l.total,
        f.convention ? "dépassé" : "",
        f.certification ? "dépassé" : "",
      ];
    }),
  ];
}
