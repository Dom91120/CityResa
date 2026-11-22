/**
 * Processus et circuits : la partie PURE.
 *
 * Un circuit décrit, pour un type de dossier, à quel service il revient (règle
 * d'aiguillage) et quelles étapes de contrôle s'ajoutent au cycle de fond (relecture,
 * avis, visa), à quelles conditions et par qui. Rien ici ne touche la base : les
 * conditions s'évaluent sur des « faits » calculés ailleurs (src/server/circuits.ts).
 *
 * Tout est en listes fermées (critères, natures, intervenants) : la Ville compose, elle
 * ne programme pas.
 */

// ── Critères ──

export type TypeCritere = "bool" | "liste" | "nombre";

/** Les types de dossier qui suivent un circuit. */
export const OBJETS = {
  reservation: "Réservations",
  subvention: "Subventions",
  campagne: "Campagnes de créneaux",
} as const;
export type Objet = keyof typeof OBJETS;

export function lireObjet(v: unknown): Objet {
  return v === "subvention" || v === "campagne" ? v : "reservation";
}

export type Critere = {
  cle: string;
  label: string;
  type: TypeCritere;
  groupe: "Espace" | "Demandeur" | "Dossier";
  /** Pour une liste : ses valeurs fixes, ou la source à charger (espaces, sites, profils). */
  options?: readonly (readonly [string, string])[];
  source?: "espaces" | "sites" | "profils" | "secteurs";
  /** Les types de dossier auxquels le critère s'applique ; absent = les réservations. */
  objets?: readonly Objet[];
  /** Pour un nombre : unité affichée. */
  unite?: string;
  aide?: string;
  /** Une aide propre à un type de dossier : elle remplace `aide` pour ce type. */
  aides?: Partial<Record<Objet, string>>;
};

export const CRITERES: readonly Critere[] = [
  {
    cle: "secteur",
    label: "Secteur de l'espace",
    type: "liste",
    groupe: "Espace",
    objets: ["reservation", "campagne"],
    aides: { campagne: "Le secteur des espaces de la campagne, s'ils sont tous du même." },
    options: [
      ["salle", "Salles"],
      ["sport", "Sports"],
    ],
  },
  { cle: "site", label: "Site", type: "liste", groupe: "Espace", source: "sites" },
  { cle: "espace", label: "Espace", type: "liste", groupe: "Espace", source: "espaces" },
  {
    cle: "type_demandeur",
    label: "Type de demandeur",
    type: "liste",
    groupe: "Demandeur",
    options: [
      ["association", "Association"],
      ["entreprise", "Entreprise"],
      ["particulier", "Particulier"],
      ["service_interne", "Service de la Ville"],
      ["collectivite", "Autre collectivité"],
      ["autre", "Autre"],
    ],
  },
  {
    cle: "profil",
    label: "Profil tarifaire",
    type: "liste",
    groupe: "Demandeur",
    source: "profils",
  },
  {
    cle: "sportive",
    label: "Association sportive",
    type: "bool",
    groupe: "Demandeur",
    objets: ["reservation", "subvention"],
  },
  {
    cle: "conventionnee",
    label: "Association conventionnée",
    type: "bool",
    groupe: "Demandeur",
    objets: ["reservation", "subvention"],
  },
  {
    cle: "type_subvention",
    label: "Type de subvention",
    type: "liste",
    groupe: "Dossier",
    objets: ["subvention"],
    options: [
      ["fonctionnement", "Fonctionnement"],
      ["projet", "Projet"],
      ["exceptionnelle", "Exceptionnelle"],
      ["investissement", "Investissement"],
    ],
  },
  {
    cle: "nature_demande",
    label: "Nature de la demande",
    type: "liste",
    groupe: "Dossier",
    objets: ["subvention"],
    options: [
      ["premiere", "Première demande"],
      ["renouvellement", "Renouvellement"],
    ],
  },
  {
    cle: "secteur_instruction",
    label: "Secteur d'instruction",
    type: "liste",
    groupe: "Dossier",
    source: "secteurs",
    objets: ["subvention"],
    aide: "Renseigné par l'agent après le dépôt : le dossier est alors aiguillé de nouveau.",
  },
  {
    cle: "montant_demande",
    label: "Montant demandé",
    type: "nombre",
    groupe: "Dossier",
    unite: "€",
    objets: ["subvention"],
  },
  {
    cle: "fiche_validee",
    label: "Fiche de l'usager validée",
    type: "bool",
    groupe: "Demandeur",
  },
  {
    cle: "gratuite_accordee",
    label: "Gratuité accordée à la main",
    type: "bool",
    groupe: "Dossier",
    aide: "La gratuité décidée par un agent, avec son fondement ; pas le tarif nul de la grille.",
  },
  {
    cle: "derogation_delai",
    label: "Demande hors du délai de l'espace",
    type: "bool",
    groupe: "Dossier",
    aide: "L'événement commence avant le délai minimal de réservation de l'espace.",
  },
  { cle: "public", label: "Événement ouvert au public", type: "bool", groupe: "Dossier" },
  { cle: "recurrent", label: "Réservation récurrente", type: "bool", groupe: "Dossier" },
  { cle: "materiel", label: "Matériel demandé", type: "bool", groupe: "Dossier" },
  {
    cle: "origine",
    label: "Origine de la demande",
    type: "liste",
    groupe: "Dossier",
    options: [
      ["portail", "Portail"],
      ["backoffice", "Back-office"],
    ],
  },
  { cle: "montant", label: "Montant TTC", type: "nombre", groupe: "Dossier", unite: "€" },
  {
    cle: "participants",
    label: "Participants",
    type: "nombre",
    groupe: "Dossier",
    unite: "pers.",
  },
  {
    cle: "jours_avant",
    label: "Jours avant l'événement",
    type: "nombre",
    groupe: "Dossier",
    unite: "j",
  },
];

const PAR_CLE = new Map(CRITERES.map((c) => [c.cle, c]));

/** Les critères proposés pour un type de dossier. */
export function criteresDe(objet: Objet): Critere[] {
  return CRITERES.filter((c) => (c.objets ?? ["reservation"]).includes(objet)).map((c) =>
    c.aides?.[objet] ? { ...c, aide: c.aides[objet] } : c,
  );
}

export function critere(cle: string): Critere | undefined {
  return PAR_CLE.get(cle);
}

/** Ce que l'on sait d'un dossier au moment d'évaluer une règle. */
export type Faits = Record<string, string | number | boolean | null>;

/** Un test : `valeur` est un booléen, une liste de valeurs admises, ou une borne. */
export type Test =
  | { champ: string; op: "est"; valeur: boolean }
  | { champ: string; op: "parmi"; valeur: string[] }
  | { champ: string; op: "min" | "max"; valeur: number };

/** Des tests réunis par « et » (tous) ou par « ou » (au moins un). */
export type Condition = { mode: "tous" | "un"; tests: Test[] };

export function testVrai(t: Test, faits: Faits): boolean {
  const v = faits[t.champ];
  if (v === null || v === undefined) return false;
  if (t.op === "est") return Boolean(v) === t.valeur;
  if (t.op === "parmi") return t.valeur.includes(String(v));
  const n = Number(v);
  if (!Number.isFinite(n)) return false;
  return t.op === "min" ? n >= t.valeur : n <= t.valeur;
}

/** Une condition absente ou vide est toujours vraie. */
export function conditionVraie(c: Condition | null | undefined, faits: Faits): boolean {
  if (!c?.tests.length) return true;
  return c.mode === "un"
    ? c.tests.some((t) => testVrai(t, faits))
    : c.tests.every((t) => testVrai(t, faits));
}

/** Nettoie une condition lue d'un formulaire ou de la base : critères connus, valeurs typées. */
export function lireCondition(brut: unknown): Condition | null {
  if (!brut || typeof brut !== "object") return null;
  const b = brut as { mode?: unknown; tests?: unknown };
  if (!Array.isArray(b.tests)) return null;
  const tests: Test[] = [];
  for (const x of b.tests as { champ?: unknown; op?: unknown; valeur?: unknown }[]) {
    const c = critere(String(x?.champ ?? ""));
    if (!c) continue;
    if (c.type === "bool" && x.op === "est" && typeof x.valeur === "boolean")
      tests.push({ champ: c.cle, op: "est", valeur: x.valeur });
    else if (c.type === "liste" && x.op === "parmi" && Array.isArray(x.valeur)) {
      const valeur = [...new Set(x.valeur.map(String).filter(Boolean))];
      if (valeur.length) tests.push({ champ: c.cle, op: "parmi", valeur });
    } else if (c.type === "nombre" && (x.op === "min" || x.op === "max")) {
      const n = Number(x.valeur);
      if (Number.isFinite(n)) tests.push({ champ: c.cle, op: x.op, valeur: n });
    }
  }
  return tests.length ? { mode: b.mode === "un" ? "un" : "tous", tests } : null;
}

/** Libellés des valeurs de liste chargées en base (espaces, sites, profils). */
export type Libelles = Partial<Record<string, Record<string, string>>>;

function libelleValeur(c: Critere, v: string, libelles: Libelles): string {
  const fixe = c.options?.find(([k]) => k === v)?.[1];
  return fixe ?? libelles[c.cle]?.[v] ?? `#${v}`;
}

export function decrireTest(t: Test, libelles: Libelles = {}): string {
  const c = critere(t.champ);
  if (!c) return t.champ;
  if (t.op === "est") return t.valeur ? c.label : `${c.label} : non`;
  if (t.op === "parmi")
    return `${c.label} : ${t.valeur.map((v) => libelleValeur(c, v, libelles)).join(" ou ")}`;
  return `${c.label} ${t.op === "min" ? "≥" : "≤"} ${t.valeur}${c.unite ? ` ${c.unite}` : ""}`;
}

/** « Type de demandeur : Association et Secteur de l'espace : Salles ». */
export function decrireCondition(
  c: Condition | null | undefined,
  libelles: Libelles = {},
  siVide = "Toujours",
): string {
  if (!c?.tests.length) return siVide;
  return c.tests.map((t) => decrireTest(t, libelles)).join(c.mode === "un" ? " ou " : " et ");
}

// ── Étapes ──

export const NATURES = {
  relecture: {
    label: "Relecture",
    bloquante: true,
    icone: "eye",
    teinte: "sky",
    aide: "Un second regard avant que la décision parte à l'usager.",
    issues: ["Relu, bon pour envoi", "À revoir"],
  },
  avis: {
    label: "Avis",
    bloquante: false,
    icone: "message-circle",
    teinte: "violet",
    aide: "Un avis consultatif : il éclaire la décision sans la retenir.",
    issues: ["Avis favorable", "Avis défavorable"],
  },
  visa: {
    label: "Visa",
    bloquante: true,
    icone: "stamp",
    teinte: "amber",
    aide: "Un accord préalable : sans lui, le dossier ne peut pas être accepté.",
    issues: ["Visa accordé", "Visa refusé"],
  },
} as const;

export type Nature = keyof typeof NATURES;

/** Le moment du cycle de fond où l'étape s'insère. */
export const MOMENTS = {
  avant_acceptation: "Avant l'acceptation de la demande",
  avant_refus: "Avant le refus de la demande",
  avant_annulation: "Avant une annulation par la collectivité",
  avant_requisition: "Avant une réquisition pour la Ville",
  avant_retenue: "Avant une retenue sur caution",
  avis_elus: "À l'avis des élus",
  avant_vote: "Avant le vote de la subvention",
  avant_versement: "Avant le versement de la subvention",
  avant_notification: "Avant de prévenir les demandeurs",
} as const;
export type Moment = keyof typeof MOMENTS;

/** Ce qu'une étape bloquante retient, selon son moment (« retient l'acceptation »). */
export const RETENU: Record<Moment, string> = {
  avant_acceptation: "l'acceptation",
  avant_refus: "le refus",
  avant_annulation: "l'annulation",
  avant_requisition: "la réquisition",
  avant_retenue: "la retenue sur caution",
  avis_elus: "le vote",
  avant_vote: "le vote",
  avant_versement: "le versement",
  avant_notification: "l'envoi des décisions",
};

/**
 * Les statuts d'une réservation pendant lesquels une étape de ce moment a un sens : on
 * n'attend plus un visa de refus sur un dossier accepté, ni un visa d'annulation sur un
 * dossier clos.
 */
export const STATUTS_DU_MOMENT: Record<Moment, readonly string[]> = {
  avant_acceptation: ["a_traiter", "en_traitement"],
  avant_refus: ["a_traiter", "en_traitement"],
  avant_annulation: ["a_traiter", "en_traitement", "acceptee", "signee", "confirmee"],
  avant_requisition: ["acceptee", "signee", "confirmee"],
  // La caution se retient après l'événement, tant que le dossier n'est pas archivé.
  avant_retenue: ["confirmee", "terminee"],
  avis_elus: [],
  avant_vote: ["deposee", "instruction", "avis"],
  avant_versement: ["votee"],
  // Une campagne se nomme « instruction » pendant l'arbitrage ; les décisions partent ensuite.
  avant_notification: ["instruction"],
};

export function lireMoment(v: unknown, objet: Objet = "reservation"): Moment {
  const moments = INSERTION[objet].moments;
  return moments.includes(v as Moment) ? (v as Moment) : moments[0];
}

/** Le moment où s'insèrent les étapes d'un type de dossier, et les natures qu'il admet. */
export const INSERTION: Record<
  Objet,
  { moments: readonly Moment[]; natures: readonly Nature[]; titre: string }
> = {
  reservation: {
    moments: [
      "avant_acceptation",
      "avant_refus",
      "avant_annulation",
      "avant_requisition",
      "avant_retenue",
    ],
    natures: ["relecture", "avis", "visa"],
    titre: "Étapes du circuit",
  },
  subvention: {
    moments: ["avis_elus", "avant_vote", "avant_versement"],
    natures: ["avis", "relecture", "visa"],
    titre: "Avis des élus, étapes avant le vote et avant le versement",
  },
  campagne: {
    moments: ["avant_notification"],
    natures: ["relecture", "avis", "visa"],
    titre: "Étapes avant de prévenir les demandeurs",
  },
};

export type Intervenant =
  | { type: "service"; id: number }
  | { type: "service_dossier" }
  | { type: "responsable_dossier" }
  | { type: "delegation"; id: number }
  | { type: "role"; role: string };

export const TYPES_INTERVENANT: Record<Intervenant["type"], string> = {
  service: "Un service",
  service_dossier: "Le service du dossier",
  responsable_dossier: "Le responsable du service du dossier",
  delegation: "L'élu d'une délégation",
  role: "Les comptes d'un rôle",
};

// ── Règle de réunion : quand plusieurs personnes sont attendues ──

export const REUNIONS = {
  un: {
    label: "Une réponse suffit",
    court: "une réponse suffit",
    aide: "La première personne qui répond clôt l'étape.",
  },
  tous: {
    label: "Tous doivent répondre",
    court: "accord de tous",
    aide: "L'étape est validée quand chacun a donné son accord ; un seul refus la refuse.",
  },
  majorite: {
    label: "La majorité",
    court: "à la majorité",
    aide: "L'étape est validée dès que plus de la moitié a donné son accord ; elle est refusée quand cette majorité n'est plus atteignable.",
  },
} as const;
export type Reunion = keyof typeof REUNIONS;

export function lireReunion(v: unknown): Reunion {
  return v === "tous" || v === "majorite" ? v : "un";
}

/**
 * L'issue d'une étape d'après les réponses reçues : validée, refusée, ou `null` tant qu'il en
 * manque. Une personne qui a répondu compte, même si elle n'est plus attendue depuis.
 */
export function issueReunion(
  regle: Reunion,
  attendus: readonly string[],
  reponses: readonly { userId: string; accord: boolean }[],
): "validee" | "refusee" | null {
  if (!reponses.length) return null;
  if (regle === "un") return reponses[0].accord ? "validee" : "refusee";
  const accords = new Set(reponses.filter((r) => r.accord).map((r) => r.userId));
  const refus = reponses.filter((r) => !r.accord).length;
  if (regle === "tous") {
    if (refus) return "refusee";
    return attendus.length && attendus.every((id) => accords.has(id)) ? "validee" : null;
  }
  const n = new Set([...attendus, ...reponses.map((r) => r.userId)]).size;
  if (accords.size * 2 > n) return "validee";
  return refus * 2 >= n ? "refusee" : null;
}

/** L'échéance indicative d'une étape demandée à `depuis` ; null sans délai. */
export function echeanceDe(depuis: Date, delaiJours: number): Date | null {
  return delaiJours > 0 ? new Date(depuis.getTime() + delaiJours * 86_400_000) : null;
}

/** Ceux dont la réponse est encore attendue. */
export function restantARepondre<T extends { id: string }>(
  attendus: readonly T[],
  reponses: readonly { userId: string }[],
): T[] {
  return attendus.filter((a) => !reponses.some((r) => r.userId === a.id));
}

export type Etape = {
  cle: string;
  libelle: string;
  /** Ce que l'usager lit pendant l'étape ; vide = étape invisible de l'usager. */
  libelleUsager: string;
  nature: Nature;
  moment: Moment;
  intervenant: Intervenant;
  condition: Condition | null;
  /** Délai indicatif, en jours ; 0 = sans échéance. */
  delaiJours: number;
  /** Combien de réponses closent l'étape quand elle s'adresse à plusieurs personnes. */
  reunion: Reunion;
};

export type Definition = {
  /** Règle d'aiguillage : le circuit prend les dossiers qui la vérifient. */
  condition: Condition | null;
  /** Service auquel le dossier est confié. */
  serviceId: number | null;
  etapes: Etape[];
};

export const DEFINITION_VIDE: Definition = { condition: null, serviceId: null, etapes: [] };

function lireIntervenant(brut: unknown): Intervenant | null {
  const b = (brut ?? {}) as { type?: unknown; id?: unknown; role?: unknown };
  const id = Number(b.id);
  switch (b.type) {
    case "service":
      return Number.isInteger(id) && id > 0 ? { type: "service", id } : null;
    case "delegation":
      return Number.isInteger(id) && id > 0 ? { type: "delegation", id } : null;
    case "service_dossier":
      return { type: "service_dossier" };
    case "responsable_dossier":
      return { type: "responsable_dossier" };
    case "role":
      return typeof b.role === "string" && b.role ? { type: "role", role: b.role } : null;
    default:
      return null;
  }
}

/** Clé d'étape : minuscules, chiffres et tirets. */
export function cleEtape(libelle: string, prises: readonly string[] = []): string {
  const base =
    libelle
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "etape";
  let cle = base;
  for (let i = 2; prises.includes(cle); i++) cle = `${base}-${i}`;
  return cle;
}

/** Nettoie une définition lue de la base : ce qui est illisible est écarté, jamais deviné. */
export function lireDefinition(brut: unknown): Definition {
  const b = (brut ?? {}) as { condition?: unknown; serviceId?: unknown; etapes?: unknown };
  const etapes: Etape[] = [];
  for (const x of Array.isArray(b.etapes) ? (b.etapes as Record<string, unknown>[]) : []) {
    const intervenant = lireIntervenant(x?.intervenant);
    const nature = String(x?.nature ?? "");
    const cle = String(x?.cle ?? "");
    if (!intervenant || !(nature in NATURES) || !/^[a-z0-9-]{1,40}$/.test(cle)) continue;
    if (etapes.some((e) => e.cle === cle)) continue;
    // L'avis des élus sur une subvention est un avis, quoi que dise la donnée.
    const moment: Moment =
      typeof x.moment === "string" && x.moment in MOMENTS
        ? (x.moment as Moment)
        : "avant_acceptation";
    if (moment === "avis_elus" && nature !== "avis") continue;
    etapes.push({
      cle,
      libelle: String(x.libelle ?? "").slice(0, 120),
      libelleUsager: String(x.libelleUsager ?? "").slice(0, 160),
      nature: nature as Nature,
      moment,
      intervenant,
      condition: lireCondition(x.condition),
      delaiJours: Math.max(0, Math.min(365, Math.trunc(Number(x.delaiJours) || 0))),
      reunion: lireReunion(x.reunion),
    });
  }
  const serviceId = Number(b.serviceId);
  return {
    condition: lireCondition(b.condition),
    serviceId: Number.isInteger(serviceId) && serviceId > 0 ? serviceId : null,
    etapes,
  };
}

/** Les étapes d'un circuit qui s'appliquent à un dossier, dans l'ordre du circuit. */
export function etapesApplicables(def: Definition, faits: Faits, moment?: Moment): Etape[] {
  return def.etapes.filter(
    (e) => (!moment || e.moment === moment) && conditionVraie(e.condition, faits),
  );
}

// ── Aiguillage ──

export type CircuitPublie = {
  id: number;
  versionId: number;
  name: string;
  position: number;
  parDefaut: boolean;
  definition: Definition;
};

export type Aiguillage = {
  retenu: CircuitPublie | null;
  /** Chaque circuit examiné, dans l'ordre, avec la raison de son sort. */
  examen: { circuit: CircuitPublie; retenu: boolean; raison: string }[];
};

/**
 * Choisit le circuit d'un dossier : les circuits à règle dans l'ordre de leur position, le
 * premier dont la règle est vraie l'emporte ; à défaut, le circuit par défaut.
 */
export function aiguiller(
  circuits: readonly CircuitPublie[],
  faits: Faits,
  libelles: Libelles = {},
): Aiguillage {
  const ordonnes = [...circuits].sort(
    (a, b) => Number(a.parDefaut) - Number(b.parDefaut) || a.position - b.position || a.id - b.id,
  );
  const examen: Aiguillage["examen"] = [];
  let retenu: CircuitPublie | null = null;
  for (const c of ordonnes) {
    if (retenu) {
      examen.push({ circuit: c, retenu: false, raison: "Non examiné : un circuit précède." });
      continue;
    }
    if (c.parDefaut) {
      retenu = c;
      examen.push({ circuit: c, retenu: true, raison: "Circuit par défaut." });
      continue;
    }
    const regle = c.definition.condition;
    if (!regle?.tests.length) {
      examen.push({ circuit: c, retenu: false, raison: "Aucune règle d'aiguillage." });
      continue;
    }
    if (conditionVraie(regle, faits)) {
      retenu = c;
      examen.push({ circuit: c, retenu: true, raison: decrireCondition(regle, libelles) });
    } else {
      const faux = regle.tests.filter((t) => !testVrai(t, faits));
      examen.push({
        circuit: c,
        retenu: false,
        raison: `Règle non vérifiée : ${faux.map((t) => decrireTest(t, libelles)).join(" ; ")}`,
      });
    }
  }
  return { retenu, examen };
}

// ── Contrôles avant publication ──

export type Referentiel = {
  /** Services actifs : identifiant → nombre de personnes qui peuvent agir pour lui. */
  services: Map<number, { name: string; personnes: number; responsable: boolean }>;
  /** Délégations actives : identifiant → nombre d'élus (titulaire et suppléant). */
  delegations: Map<number, { label: string; personnes: number }>;
  /** Rôles du back-office : nom → nombre de comptes actifs. */
  roles: Map<string, { label: string; personnes: number }>;
};

/** « Vie associative », « Élu · Sports », « Rôle Gestionnaire »… */
export function libelleIntervenant(i: Intervenant, ref: Referentiel): string {
  switch (i.type) {
    case "service":
      return ref.services.get(i.id)?.name ?? "Service supprimé";
    case "delegation": {
      const d = ref.delegations.get(i.id);
      return d ? `Élu · ${d.label}` : "Délégation supprimée";
    }
    case "service_dossier":
      return "Service du dossier";
    case "responsable_dossier":
      return "Responsable du service du dossier";
    case "role":
      return `Rôle ${ref.roles.get(i.role)?.label ?? i.role}`;
  }
}

/**
 * Ce qui empêche de publier une version. `autres` : les autres circuits du même type de
 * dossier (pour l'unicité du circuit par défaut).
 */
export function controler(
  circuit: { parDefaut: boolean; name: string },
  def: Definition,
  ref: Referentiel,
  autres: readonly { name: string; parDefaut: boolean }[] = [],
): string[] {
  const erreurs: string[] = [];
  if (circuit.parDefaut) {
    if (def.condition?.tests.length)
      erreurs.push(
        "Le circuit par défaut ne porte pas de règle d'aiguillage : il reçoit le reste.",
      );
    const autre = autres.find((a) => a.parDefaut);
    if (autre) erreurs.push(`Un autre circuit est déjà le circuit par défaut : « ${autre.name} ».`);
  } else if (!def.condition?.tests.length) {
    erreurs.push(
      "Indiquez la règle d'aiguillage : sans elle, ce circuit ne recevrait aucun dossier.",
    );
  }
  if (def.serviceId && !ref.services.has(def.serviceId))
    erreurs.push("Le service désigné n'existe plus ou n'est plus actif.");
  const dependDuService = def.etapes.some(
    (e) => e.intervenant.type === "service_dossier" || e.intervenant.type === "responsable_dossier",
  );
  if (dependDuService && !def.serviceId)
    erreurs.push(
      "Une étape s'adresse au service du dossier : désignez le service auquel ce circuit confie les dossiers.",
    );
  const service = def.serviceId ? ref.services.get(def.serviceId) : undefined;
  for (const e of def.etapes) {
    const nom = `Étape « ${e.libelle || e.cle} »`;
    if (!e.libelle.trim()) erreurs.push(`${nom} : donnez-lui un libellé.`);
    const i = e.intervenant;
    if (i.type === "service") {
      const s = ref.services.get(i.id);
      if (!s) erreurs.push(`${nom} : le service attendu n'existe plus.`);
      else if (!s.personnes) erreurs.push(`${nom} : le service « ${s.name} » n'a aucun membre.`);
    } else if (i.type === "delegation") {
      const d = ref.delegations.get(i.id);
      if (!d) erreurs.push(`${nom} : la délégation attendue n'existe plus.`);
      else if (!d.personnes)
        erreurs.push(`${nom} : aucun élu n'est désigné pour la délégation « ${d.label} ».`);
    } else if (i.type === "role") {
      const r = ref.roles.get(i.role);
      if (!r) erreurs.push(`${nom} : le rôle attendu n'existe plus.`);
      else if (!r.personnes)
        erreurs.push(`${nom} : aucun compte actif n'a le rôle « ${r.label} ».`);
    } else if (service) {
      if (i.type === "service_dossier" && !service.personnes)
        erreurs.push(`${nom} : le service « ${service.name} » n'a aucun membre.`);
      if (i.type === "responsable_dossier" && !service.responsable)
        erreurs.push(`${nom} : le service « ${service.name} » n'a pas de responsable.`);
    }
  }
  return erreurs;
}

// ── État des étapes d'un dossier ──

export type EtatEtape = "a_demander" | "ouverte" | "validee" | "refusee";

/** L'état d'une étape applicable, d'après sa dernière ouverture sur le dossier. */
export function etatEtape(derniere: { status: string } | null | undefined): EtatEtape {
  if (!derniere || derniere.status === "annulee") return "a_demander";
  if (derniere.status === "validee") return "validee";
  if (derniere.status === "refusee") return "refusee";
  return "ouverte";
}

/**
 * Les étapes qui retiennent encore la décision : bloquantes, applicables, et pas validées.
 * Un avis ne retient jamais rien.
 */
export function etapesRetenant<T extends { nature: Nature }>(
  etapes: readonly (T & { etat: EtatEtape })[],
): (T & { etat: EtatEtape })[] {
  return etapes.filter((e) => NATURES[e.nature].bloquante && e.etat !== "validee");
}

/** Deux versions d'un circuit : ce qui a changé, en clair. */
export function comparer(avant: Definition, apres: Definition, ref: Referentiel): string[] {
  const out: string[] = [];
  if (decrireCondition(avant.condition) !== decrireCondition(apres.condition))
    out.push("Règle d'aiguillage modifiée.");
  if (avant.serviceId !== apres.serviceId) out.push("Service du circuit modifié.");
  const cles = (d: Definition) => d.etapes.map((e) => e.cle);
  for (const e of apres.etapes) {
    const a = avant.etapes.find((x) => x.cle === e.cle);
    if (!a) out.push(`Étape ajoutée : ${e.libelle} (${libelleIntervenant(e.intervenant, ref)}).`);
    else if (JSON.stringify(a) !== JSON.stringify(e)) out.push(`Étape modifiée : ${e.libelle}.`);
  }
  for (const a of avant.etapes)
    if (!apres.etapes.some((e) => e.cle === a.cle)) out.push(`Étape retirée : ${a.libelle}.`);
  if (
    !out.some((l) => l.startsWith("Étape")) &&
    cles(avant).join() !== cles(apres).join() &&
    cles(avant).length === cles(apres).length
  )
    out.push("Ordre des étapes modifié.");
  return out;
}

// ── Le cycle de fond de chaque type de dossier, en clair ──

/**
 * Les libellés propres à chaque type de dossier : le cycle fixe autour duquel un circuit
 * insère ses étapes (logigramme), et les phrases de l'éditeur.
 */
export const CYCLES: Record<
  Objet,
  {
    sousTitre: string;
    /** Qui instruit quand le circuit ne désigne aucun service. */
    sansService: string;
    sansEtape: string;
    depart: { titre: string; texte: string };
    decision: { titre: string; texte: string };
    fin: { titre: string; texte: string };
  }
> = {
  reservation: {
    sousTitre: "Circuit des demandes de réservation",
    sansService: "les agents chargés de l'espace",
    sansEtape: "Aucune étape : une demande se traite sans relecture, avis ni visa.",
    depart: {
      titre: "Demande reçue · À traiter",
      texte: "échanges avec l'usager, demande d'informations",
    },
    decision: {
      titre: "Acceptée",
      texte: "Disponibilité revérifiée, convention générée, usager prévenu",
    },
    fin: {
      titre: "Signée · Confirmée · Terminée",
      texte: "Signature, acompte, événement, clôture : cycle de fond, non paramétrable",
    },
  },
  subvention: {
    sousTitre: "Circuit des demandes de subvention",
    sansService: "les agents qui ont l'écriture sur les subventions",
    sansEtape:
      "Aucun élu nommé : tout compte qui a l'écriture sur les subventions peut donner un avis.",
    depart: {
      titre: "Dossier déposé · Instruction",
      texte: "pièces, renvoi comme incomplet, soumission aux élus",
    },
    decision: {
      titre: "Votée ou refusée",
      texte: "Décision enregistrée par le service instructeur, association prévenue",
    },
    fin: { titre: "Versée", texte: "Versement daté : cycle de fond, non paramétrable" },
  },
  campagne: {
    sousTitre: "Circuit des campagnes de créneaux",
    sansService: "le service qui conduit la campagne",
    sansEtape: "Aucune étape : les demandeurs sont prévenus dès que les vœux sont arbitrés.",
    depart: {
      titre: "Dépôt clos · Instruction",
      texte: "arbitrage des vœux, attribution des créneaux",
    },
    decision: {
      titre: "Demandeurs prévenus",
      texte: "Un courriel par organisation : créneaux attribués et vœux refusés",
    },
    fin: { titre: "Clôturée", texte: "Cycle de fond, non paramétrable" },
  },
};
