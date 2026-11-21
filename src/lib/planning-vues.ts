/**
 * Planning : couleur des créneaux (par espace, par statut ou par type d'usager), filtres des
 * créneaux (statut, type d'usager, recherche) et secteur des espaces, vues
 * enregistrées par agent (nom + filtres), dépôt d'un créneau glissé sur une autre case
 * (même espace, autre jour ou autre heure) et lignes de la vue liste.
 * Logique PURE : testée dans planning-vues.test.ts.
 */
import {
  ORGANISATION_TYPE_TEINTES,
  ORGANISATION_TYPES,
  RESERVATION_STATUS,
  type ReservationStatus,
  SECTEURS,
  STATUTS_OCCUPANTS,
} from "@/lib/constantes";
import type { Intervalle } from "@/lib/creneaux";
import { hm, parisParts, toParisWall } from "@/lib/paris-time";

// ── Couleur ──

export const COULEURS: Record<string, string> = {
  espace: "Par espace",
  statut: "Par statut du dossier",
  usager: "Par type d'usager",
};

export type Couleur = keyof typeof COULEURS;

export function lireCouleur(v: string | undefined): Couleur {
  return v && v in COULEURS ? (v as Couleur) : "espace";
}

/** La couleur CSS du liseré d'un créneau selon le mode : couleur de l'espace, ou variable de teinte. */
export function couleurEvt(
  mode: Couleur,
  e: { status: string; typeUsager: string | null },
  espace: { color: string } | undefined,
): string | undefined {
  if (mode === "statut") {
    const s = RESERVATION_STATUS[e.status as ReservationStatus];
    return s ? `var(--${s.teinte}-text)` : undefined;
  }
  if (mode === "usager") {
    const teinte = ORGANISATION_TYPE_TEINTES[e.typeUsager ?? "particulier"] ?? "slate";
    return `var(--${teinte}-text)`;
  }
  return espace?.color;
}

/** La légende du mode : libellé → couleur CSS. */
export function legende(mode: Couleur): [string, string][] {
  if (mode === "statut")
    return (
      Object.entries(RESERVATION_STATUS) as [
        ReservationStatus,
        { label: string; teinte: string; actif: boolean },
      ][]
    )
      .filter(([k]) =>
        ["a_traiter", "en_traitement", "acceptee", "signee", "confirmee"].includes(k),
      )
      .map(([, v]) => [v.label, `var(--${v.teinte}-text)`]);
  if (mode === "usager")
    return Object.entries(ORGANISATION_TYPE_TEINTES).map(([k, t]) => [
      LIBELLES_TYPES[k] ?? k,
      `var(--${t}-text)`,
    ]);
  return [];
}

const LIBELLES_TYPES: Record<string, string> = {
  association: "Association",
  entreprise: "Entreprise",
  particulier: "Particulier",
  service_interne: "Service de la collectivité",
  collectivite: "Autre collectivité",
  autre: "Autre",
};

// ── Filtres des créneaux ──

/**
 * Les filtres qui masquent des créneaux sans toucher à la grille : statut du dossier, type
 * d'usager, recherche sur l'usager, le titre ou le numéro. Aucun choix = tout est affiché ;
 * les blocages restent toujours visibles.
 */
export type FiltresEvts = { statuts: ReservationStatus[]; types: string[]; q: string };

function valeurs(brut: string | string[] | undefined): string[] {
  const liste = Array.isArray(brut) ? brut : brut ? [brut] : [];
  return [...new Set(liste.map((v) => v.trim()).filter(Boolean))];
}

function premiere(brut: string | string[] | undefined): string {
  return ((Array.isArray(brut) ? brut[0] : brut) ?? "").trim();
}

/** Les filtres lus dans l'URL (?statut=…&type=…&q=…), valeurs inconnues écartées. */
export function lireFiltresEvts(params: {
  statut?: string | string[];
  type?: string | string[];
  q?: string | string[];
}): FiltresEvts {
  return {
    statuts: STATUTS_OCCUPANTS.filter((s) => valeurs(params.statut).includes(s)),
    types: valeurs(params.type).filter((t) => t in ORGANISATION_TYPES),
    q: premiere(params.q).slice(0, 80),
  };
}

/** Le secteur demandé (?secteur=sport) ; « » = tous. */
export function lireSecteur(brut: string | string[] | undefined): string {
  const s = premiere(brut);
  return s in SECTEURS ? s : "";
}

export function nbFiltresEvts(f: FiltresEvts): number {
  return (f.statuts.length ? 1 : 0) + (f.types.length ? 1 : 0) + (f.q ? 1 : 0);
}

const sansAccent = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Les créneaux retenus par les filtres. Un dossier sans organisation est celui d'un particulier ;
 * la recherche ignore la casse et les accents, tous ses mots doivent être trouvés.
 */
export function filtrerEvts<
  T extends {
    status: string;
    typeUsager: string | null;
    qui: string;
    titre: string;
    numero: string;
  },
>(evts: readonly T[], f: FiltresEvts): T[] {
  const mots = sansAccent(f.q).split(/\s+/).filter(Boolean);
  return evts.filter((e) => {
    if (f.statuts.length && !f.statuts.includes(e.status as ReservationStatus)) return false;
    if (f.types.length && !f.types.includes(e.typeUsager ?? "particulier")) return false;
    if (mots.length) {
      const texte = sansAccent(`${e.qui} ${e.titre} ${e.numero}`);
      if (!mots.every((m) => texte.includes(m))) return false;
    }
    return true;
  });
}

/** Les filtres en clair, pour l'écran et le sous-titre du PDF ; « » sans filtre. */
export function resumeFiltres(f: FiltresEvts, secteur = ""): string {
  const parts: string[] = [];
  if (secteur && SECTEURS[secteur]) parts.push(`Secteur : ${SECTEURS[secteur].label}`);
  if (f.statuts.length)
    parts.push(`Statut : ${f.statuts.map((s) => RESERVATION_STATUS[s].label).join(", ")}`);
  if (f.types.length)
    parts.push(`Usagers : ${f.types.map((t) => ORGANISATION_TYPES[t] ?? t).join(", ")}`);
  if (f.q) parts.push(`Recherche : « ${f.q} »`);
  return parts.join(" · ");
}

// ── Vues enregistrées ──

export type VueEnregistree = { nom: string; qs: string };

export const MAX_VUES = 12;
const CLE_PREFS = "planning_vues";

/** Les vues de l'agent, lues dans ses préférences de listes (JSON). */
export function lireVuesEnregistrees(listPrefs: string | null): VueEnregistree[] {
  try {
    const prefs = listPrefs ? (JSON.parse(listPrefs) as Record<string, unknown>) : {};
    const brut = prefs[CLE_PREFS];
    const liste = typeof brut === "string" ? (JSON.parse(brut) as unknown) : brut;
    if (!Array.isArray(liste)) return [];
    return liste
      .filter(
        (v): v is VueEnregistree =>
          Boolean(v) && typeof v.nom === "string" && typeof v.qs === "string",
      )
      .map((v) => ({ nom: v.nom.slice(0, 60), qs: v.qs.slice(0, 1000) }));
  } catch {
    return [];
  }
}

/** Ajoute (ou remplace, à nom égal) une vue ; au plus MAX_VUES. */
export function ajouterVue(
  vues: readonly VueEnregistree[],
  nom: string,
  qs: string,
): VueEnregistree[] | string {
  const n = nom.trim().slice(0, 60);
  if (!n) return "Donnez un nom à la vue.";
  const sans = vues.filter((v) => v.nom.toLowerCase() !== n.toLowerCase());
  if (sans.length >= MAX_VUES)
    return `Au plus ${MAX_VUES} vues enregistrées : supprimez-en une d'abord.`;
  return [...sans, { nom: n, qs: qs.replace(/^\?/, "").slice(0, 1000) }].sort((a, b) =>
    a.nom.localeCompare(b.nom, "fr"),
  );
}

export function retirerVue(vues: readonly VueEnregistree[], nom: string): VueEnregistree[] {
  return vues.filter((v) => v.nom.toLowerCase() !== nom.trim().toLowerCase());
}

/** Les préférences de listes mises à jour avec ces vues (les autres clés sont gardées). */
export function ecrireVuesEnregistrees(
  listPrefs: string | null,
  vues: readonly VueEnregistree[],
): string {
  let prefs: Record<string, unknown> = {};
  try {
    prefs = listPrefs ? (JSON.parse(listPrefs) as Record<string, unknown>) : {};
  } catch {
    prefs = {};
  }
  if (vues.length) prefs[CLE_PREFS] = vues;
  else delete prefs[CLE_PREFS];
  return JSON.stringify(prefs);
}

/** Les filtres de la vue courante à mémoriser : tout sauf la date, pour que la vue reste « d'aujourd'hui ». */
export function qsVue(search: URLSearchParams): string {
  const p = new URLSearchParams();
  for (const [k, v] of search) if (k !== "date" && v !== "") p.append(k, v);
  return p.toString();
}

// ── Glisser-déposer ──

export type Depot = { jour: string; espaceId: number; heure?: string | null };

/**
 * Le nouvel horaire d'un créneau déposé sur une case : même espace obligatoire ; sur une case
 * jour, les heures murales sont conservées ; sur une case heure (vue jour), le début prend
 * l'heure de la case et la durée est conservée. null = dépôt refusé ou sans effet.
 */
export function deplacementDepuisDepot(
  e: Intervalle & { espaceId: number },
  cible: Depot,
): { date: string; heure_debut: string; heure_fin: string } | null {
  if (cible.espaceId !== e.espaceId) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cible.jour)) return null;
  const debut = toParisWall(e.startAt);
  const dureeMin = Math.round((e.endAt.getTime() - e.startAt.getTime()) / 60_000);
  let debutMin = debut.min;
  if (cible.heure) {
    const m = /^(\d{2}):(\d{2})$/.exec(cible.heure);
    if (!m) return null;
    debutMin = Number(m[1]) * 60 + Number(m[2]);
  }
  const finMin = debutMin + dureeMin;
  const jourActuel = parisParts(e.startAt).dateKey;
  if (jourActuel === cible.jour && debutMin === debut.min) return null;
  return { date: cible.jour, heure_debut: hm(debutMin), heure_fin: hm(finMin % 1440) };
}

// ── Vue liste ──

export type LigneListe = {
  cle: string;
  startAt: Date;
  endAt: Date;
  espaceId: number;
  genre: "reservation" | "blocage";
  titre: string;
  qui: string;
  status: string | null;
  reservationId: number | null;
  numero: string | null;
};

/** Créneaux et blocages fondus en une liste chronologique. */
export function lignesListe(
  creneaux: readonly {
    id: number;
    reservationId: number;
    numero: string;
    titre: string;
    status: string;
    qui: string;
    espaceId: number;
    startAt: Date;
    endAt: Date;
  }[],
  blocages: readonly {
    id: number;
    espaceId: number;
    startAt: Date;
    endAt: Date;
    motif: string | null;
  }[],
): LigneListe[] {
  const l: LigneListe[] = [
    ...creneaux.map((c) => ({
      cle: `c${c.id}`,
      startAt: c.startAt,
      endAt: c.endAt,
      espaceId: c.espaceId,
      genre: "reservation" as const,
      titre: c.titre,
      qui: c.qui,
      status: c.status,
      reservationId: c.reservationId,
      numero: c.numero,
    })),
    ...blocages.map((b) => ({
      cle: `b${b.id}`,
      startAt: b.startAt,
      endAt: b.endAt,
      espaceId: b.espaceId,
      genre: "blocage" as const,
      titre: b.motif || "Indisponible",
      qui: "",
      status: null,
      reservationId: null,
      numero: null,
    })),
  ];
  return l.sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.espaceId - b.espaceId);
}
