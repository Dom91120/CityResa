/**
 * Tarification d'une réservation : la grille de l'espace (par profil et par unité), les
 * options, le matériel, la TVA. Logique PURE, testée dans tarification.test.ts.
 *
 * Règle de choix de l'unité pour chaque créneau : parmi les unités applicables, la moins
 * chère pour l'usager (une journée à 150 € vaut mieux que 8 h à 25 €). Un forfait vaut
 * pour toute la réservation, quel que soit le nombre de créneaux.
 */
import type { Intervalle } from "@/lib/creneaux";
import { dureeMinutes } from "@/lib/creneaux";
import { ymdUtc } from "@/lib/date-utc";
import { montant } from "@/lib/libelles";
import { parisParts, toParisWall } from "@/lib/paris-time";

export type LigneTarif = {
  profilId: number | null;
  unite: string;
  montant: number;
  label?: string | null;
  /** Date d'effet (grille votée) ; absente = applicable depuis toujours. */
  validFrom?: Date | null;
};

export type Ligne = {
  libelle: string;
  quantite: number;
  unitaire: number;
  montant: number;
  type: "espace" | "option" | "materiel" | "caution";
};

export type Devis = {
  lignes: Ligne[];
  espace: number;
  options: number;
  materiel: number;
  ht: number;
  tva: number;
  ttc: number;
  caution: number;
  acompte: number;
  gratuit: boolean;
};

function arrondi(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * La grille en vigueur à un instant : pour chaque profil et unité, la ligne la plus récente
 * dont la date d'effet (jour de Paris) est atteinte ; une ligne sans date vaut depuis
 * toujours ; une ligne à date future est ignorée. Permet de voter les tarifs de l'année
 * suivante à l'avance sans toucher aux dossiers en cours.
 */
export function grilleEnVigueur<T extends LigneTarif>(tarifs: T[], instant: Date): T[] {
  const jour = parisParts(instant).dateKey;
  const retenues = new Map<string, T>();
  for (const t of tarifs) {
    const effet = t.validFrom ? ymdUtc(t.validFrom) : "";
    if (effet > jour) continue;
    const cle = `${t.profilId ?? "tous"}|${t.unite}`;
    const actuelle = retenues.get(cle);
    const effetActuel = actuelle?.validFrom ? ymdUtc(actuelle.validFrom) : "";
    if (!actuelle || effet > effetActuel) retenues.set(cle, t);
  }
  return tarifs.filter((t) => retenues.get(`${t.profilId ?? "tous"}|${t.unite}`) === t);
}

/** La grille applicable à un profil : ses lignes propres, sinon celles « tous profils ». */
export function grillePour(tarifs: LigneTarif[], profilId: number | null): LigneTarif[] {
  const propres = profilId ? tarifs.filter((t) => t.profilId === profilId) : [];
  if (propres.length) return propres;
  return tarifs.filter((t) => t.profilId === null);
}

function estWeekend(i: Intervalle): boolean {
  const a = toParisWall(i.startAt);
  const dow = new Date(Date.UTC(a.y, a.mo - 1, a.da)).getUTCDay();
  return dow === 6 || dow === 0;
}

function estSoiree(i: Intervalle): boolean {
  return toParisWall(i.startAt).min >= 18 * 60;
}

/** Le prix d'UN créneau selon la grille, et l'unité retenue. */
export function prixCreneau(
  grille: LigneTarif[],
  i: Intervalle,
): { montant: number; unite: string; quantite: number; unitaire: number } | null {
  const minutes = dureeMinutes(i);
  const heures = minutes / 60;
  const candidats: { montant: number; unite: string; quantite: number; unitaire: number }[] = [];
  for (const t of grille) {
    switch (t.unite) {
      case "heure": {
        const q = Math.ceil(heures * 2) / 2; // facturé à la demi-heure
        candidats.push({
          montant: t.montant * q,
          unite: "heure",
          quantite: q,
          unitaire: t.montant,
        });
        break;
      }
      case "demi_journee":
        if (heures <= 5)
          candidats.push({
            montant: t.montant,
            unite: "demi_journee",
            quantite: 1,
            unitaire: t.montant,
          });
        break;
      case "journee": {
        const jours = Math.max(1, Math.ceil(heures / 24));
        candidats.push({
          montant: t.montant * jours,
          unite: "journee",
          quantite: jours,
          unitaire: t.montant,
        });
        break;
      }
      case "soiree":
        if (estSoiree(i) && heures <= 8)
          candidats.push({ montant: t.montant, unite: "soiree", quantite: 1, unitaire: t.montant });
        break;
      case "weekend":
        if (estWeekend(i))
          candidats.push({
            montant: t.montant,
            unite: "weekend",
            quantite: 1,
            unitaire: t.montant,
          });
        break;
      default:
        break;
    }
  }
  if (!candidats.length) return null;
  candidats.sort((a, b) => a.montant - b.montant);
  return candidats[0];
}

export const UNITE_LIBELLES: Record<string, string> = {
  heure: "h",
  demi_journee: "demi-journée",
  journee: "journée",
  soiree: "soirée",
  weekend: "week-end",
  forfait: "forfait",
};

export type EntreeDevis = {
  tarifs: LigneTarif[];
  profilId: number | null;
  creneaux: Intervalle[];
  options: { label: string; montant: number; unite: string; quantite: number }[];
  materiels: { label: string; montant: number; unite: string; quantite: number; jours?: number }[];
  tvaTaux: number;
  caution: number;
  gratuit: boolean;
  acomptePct?: number;
};

/** Le devis complet d'une demande. */
export function calculerDevis(e: EntreeDevis): Devis {
  const lignes: Ligne[] = [];
  // Chaque créneau est tarifé à la grille en vigueur à sa date d'occupation.
  const grilleA = (instant: Date) => grillePour(grilleEnVigueur(e.tarifs, instant), e.profilId);
  const grille = grilleA(e.creneaux[0]?.startAt ?? new Date());
  let espace = 0;
  const forfait = grille.find((t) => t.unite === "forfait");
  const horaires = grille.filter((t) => t.unite !== "forfait");
  if (!e.gratuit) {
    if (horaires.length) {
      let i = 0;
      for (const c of e.creneaux) {
        i += 1;
        const p = prixCreneau(
          grilleA(c.startAt).filter((t) => t.unite !== "forfait"),
          c,
        );
        if (!p) continue;
        lignes.push({
          libelle: `Créneau ${e.creneaux.length > 1 ? `${i} ` : ""}· ${p.unite === "heure" ? `${p.quantite} h` : UNITE_LIBELLES[p.unite]}`,
          quantite: p.quantite,
          unitaire: p.unitaire,
          montant: arrondi(p.montant),
          type: "espace",
        });
        espace += p.montant;
      }
      if (forfait && e.creneaux.length && forfait.montant < espace) {
        lignes.splice(0, lignes.length);
        lignes.push({
          libelle: forfait.label || "Forfait",
          quantite: 1,
          unitaire: forfait.montant,
          montant: forfait.montant,
          type: "espace",
        });
        espace = forfait.montant;
      }
    } else if (forfait && e.creneaux.length) {
      lignes.push({
        libelle: forfait.label || "Forfait",
        quantite: 1,
        unitaire: forfait.montant,
        montant: forfait.montant,
        type: "espace",
      });
      espace = forfait.montant;
    }
  }
  const heuresTotales = e.creneaux.reduce((s, c) => s + dureeMinutes(c) / 60, 0);
  let options = 0;
  for (const o of e.options) {
    const q = o.unite === "heure" ? Math.ceil(heuresTotales * 2) / 2 : Math.max(1, o.quantite);
    const m = e.gratuit ? 0 : o.montant * (o.unite === "forfait" ? 1 : q);
    lignes.push({
      libelle: o.label,
      quantite: o.unite === "forfait" ? 1 : q,
      unitaire: o.montant,
      montant: arrondi(m),
      type: "option",
    });
    options += m;
  }
  let materiel = 0;
  for (const m of e.materiels) {
    let montant = 0;
    if (m.unite === "forfait") montant = m.montant;
    else if (m.unite === "unite") montant = m.montant * m.quantite;
    else if (m.unite === "jour")
      montant = m.montant * m.quantite * Math.max(1, m.jours ?? e.creneaux.length);
    if (e.gratuit) montant = 0;
    lignes.push({
      libelle: m.label,
      quantite: m.quantite,
      unitaire: m.montant,
      montant: arrondi(montant),
      type: "materiel",
    });
    materiel += montant;
  }
  const ht = arrondi(espace + options + materiel);
  const tva = arrondi((ht * (e.tvaTaux || 0)) / 100);
  const ttc = arrondi(ht + tva);
  const acompte = e.acomptePct ? arrondi((ttc * e.acomptePct) / 100) : 0;
  return {
    lignes,
    espace: arrondi(espace),
    options: arrondi(options),
    materiel: arrondi(materiel),
    ht,
    tva,
    ttc,
    caution: e.gratuit ? 0 : arrondi(e.caution || 0),
    acompte,
    gratuit: e.gratuit,
  };
}

/** « À partir de 25 €/h », « Gratuit », pour la vignette d'un espace sur le portail. */
export function aPartirDe(
  tarifs: LigneTarif[],
  profilId: number | null = null,
  a: Date = new Date(),
): string {
  const grille = grillePour(grilleEnVigueur(tarifs, a), profilId);
  if (!grille.length) return "Sur demande";
  const min = grille.reduce((m, t) => (t.montant < m.montant ? t : m), grille[0]);
  if (min.montant === 0) return "Gratuit";
  const unite = UNITE_LIBELLES[min.unite] ?? min.unite;
  const m = Number.isInteger(min.montant)
    ? String(min.montant)
    : min.montant.toFixed(2).replace(".", ",");
  return `À partir de ${m} €${min.unite === "heure" ? "/h" : ` / ${unite}`}`;
}

/**
 * Le prix d'un matériel, mode compris : « 0,50 € par unité », « 2 € par unité et par
 * jour », « 30 € (forfait) », « Gratuit ». Il se suffit : ne pas y ajouter le mode.
 */
export function tarifMateriel(m: { montant: number; unite: string }): string {
  if (m.unite === "gratuit" || !m.montant) return "Gratuit";
  const prix = montant(m.montant);
  if (m.unite === "forfait") return `${prix} (forfait)`;
  if (m.unite === "jour") return `${prix} par unité et par jour`;
  if (m.unite === "unite") return `${prix} par unité`;
  return `${prix} / ${m.unite}`;
}
