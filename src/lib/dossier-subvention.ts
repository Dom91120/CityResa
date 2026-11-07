/**
 * Le dossier de demande de subvention de la Ville, fiche par fiche : type du contenu, lecture
 * tolérante du JSON, fiches à afficher, pré-remplissage, complétude (champs et pièces manquants).
 * Logique PURE : testée dans dossier-subvention.test.ts.
 */

import { type ContextePieces, type Piece, piecesManquantes } from "@/lib/pieces-subvention";
import { type Montants, nettoyerMontants, planDe, totaux } from "@/lib/plan-budget";

// ── Types ──

export type Contact = {
  nom: string;
  prenom: string;
  adresse: string;
  codePostal: string;
  commune: string;
  telephone: string;
  courriel: string;
};

export type Agrement = { type: string; par: string; date: string };

export type Effectifs = {
  total: number | null;
  chatillonnais: number | null;
  exterieurs: number | null;
  majeurs: number | null;
  mineurs: number | null;
  hommes: number | null;
  femmes: number | null;
  /** Associations sportives. */
  licencies: number | null;
};

export type Cotisation = { libelle: string; montant: number | null; nombre: number | null };

export type Moyen = { designation: string; heures: number | null; par: string };

export type Action = {
  intitule: string;
  descriptif: string;
  date: string;
  lieu: string;
  public: string;
  beneficiaires: number | null;
  cout: number | null;
  recettes: string;
};

export type DossierSubvention = {
  presentation: {
    sigle: string;
    dateJo: string;
    affiliation: string;
    adherentsPersonnesMorales: boolean;
    adherentsPersonnesMoralesLesquelles: string;
    agrements: Agrement[];
    labelNom: string;
    labelOrganisme: string;
    utilitePublique: boolean;
    utilitePubliqueDateJo: string;
    commissaireAuxComptes: boolean;
    changementDepuisDerniereDemande: boolean;
  };
  bureau: {
    president: Contact;
    tresorier: Contact;
    vicePresident: Contact;
    secretaire: Contact;
    autresMembres: string;
    chargeDossier: {
      nom: string;
      fonction: string;
      adresse: string;
      telephone: string;
      courriel: string;
    };
  };
  effectifs: {
    benevoles: number | null;
    volontaires: number | null;
    salaries: number | null;
    etpt: number | null;
    adherents: number | null;
    exercicePrecedent: Effectifs;
    previsionnel: Effectifs;
    cotisations: Cotisation[];
  };
  rayonnement: {
    orientations: string;
    participation: {
      forum: boolean;
      feteDuSport: boolean;
      reunionAssociationsSportives: boolean;
      solidarite: string;
      inclusion: string;
      handicap: string;
      culturel: string;
      autres: string;
    };
    moyens: { locaux: Moyen[]; personnel: Moyen[]; transport: Moyen[]; documents: Moyen[] };
  };
  budget: {
    exerciceDebut: string;
    exerciceFin: string;
    charges: Montants;
    produits: Montants;
    contributions: Montants;
    financeurs: string;
  };
  motivation: {
    justification: string;
    explicationsPostes: string;
    actions: Action[];
  };
  tresorerie: {
    soldeDebut: number | null;
    resultat: number | null;
    soldeFin: number | null;
    compteCourant: number | null;
    epargne: number | null;
    caisse: number | null;
    recettesNonEncaissees: number | null;
    depensesNonDecaissees: number | null;
    encaissementsAvance: number | null;
    decaissementsAvance: number | null;
    natures: string;
  };
  bilan: {
    subventionPrecedente: number | null;
    justification: string;
    actions: Action[];
    exerciceDebut: string;
    exerciceFin: string;
    budget: Montants;
    realise: Montants;
    contributionsBudget: Montants;
    contributionsRealise: Montants;
    synthese: string;
  };
  attestation: {
    obligationsAJour: boolean;
    informationsSinceres: boolean;
    cumulAides: "" | "inf" | "sup";
    engagementRepublicain: boolean;
    mandataire: boolean;
    signataireNom: string;
    signataireQualite: string;
  };
};

// ── Fiches ──

export type FicheCle =
  | "presentation"
  | "bureau"
  | "effectifs"
  | "rayonnement"
  | "budget"
  | "motivation"
  | "tresorerie"
  | "bilan"
  | "pieces"
  | "attestation";

export type Fiche = { cle: FicheCle; titre: string; icone: string; aide: string };

export const FICHES: Fiche[] = [
  {
    cle: "presentation",
    titre: "Présentation",
    icone: "building-2",
    aide: "Identification, agréments, label.",
  },
  {
    cle: "bureau",
    titre: "Bureau",
    icone: "users",
    aide: "Dirigeants et personne chargée du dossier.",
  },
  {
    cle: "effectifs",
    titre: "Effectifs",
    icone: "contact-round",
    aide: "Ressources humaines et adhérents.",
  },
  {
    cle: "rayonnement",
    titre: "Rayonnement",
    icone: "map-pin",
    aide: "Publics, vie locale, moyens mis à disposition.",
  },
  {
    cle: "budget",
    titre: "Budget prévisionnel",
    icone: "euro",
    aide: "Charges et produits de l'exercice à venir.",
  },
  {
    cle: "motivation",
    titre: "Demande et actions",
    icone: "hand-coins",
    aide: "Montant, justification, actions prévues.",
  },
  {
    cle: "tresorerie",
    titre: "Trésorerie",
    icone: "piggy-bank",
    aide: "Soldes et rapprochement bancaire.",
  },
  {
    cle: "bilan",
    titre: "Bilan N-1",
    icone: "chart-column",
    aide: "Actions réalisées et compte de résultat.",
  },
  { cle: "pieces", titre: "Pièces", icone: "paperclip", aide: "Les documents à joindre." },
  {
    cle: "attestation",
    titre: "Attestation",
    icone: "pen-line",
    aide: "Attestation sur l'honneur, engagement républicain, signature.",
  },
];

export function ficheSuivante(cle: FicheCle): FicheCle | null {
  const i = FICHES.findIndex((f) => f.cle === cle);
  return i >= 0 && i < FICHES.length - 1 ? FICHES[i + 1].cle : null;
}

export function estFiche(v: string): v is FicheCle {
  return FICHES.some((f) => f.cle === v);
}

// ── Lecture tolérante ──

const CONTACT_VIDE: Contact = {
  nom: "",
  prenom: "",
  adresse: "",
  codePostal: "",
  commune: "",
  telephone: "",
  courriel: "",
};

const EFFECTIFS_VIDES: Effectifs = {
  total: null,
  chatillonnais: null,
  exterieurs: null,
  majeurs: null,
  mineurs: null,
  hommes: null,
  femmes: null,
  licencies: null,
};

type Brut = Record<string, unknown>;

function obj(v: unknown): Brut {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Brut) : {};
}
function str(v: unknown, max = 2000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function bool(v: unknown): boolean {
  return v === true || v === "true" || v === "on" || v === 1;
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
function entier(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.max(0, Math.round(n));
}
function contact(v: unknown): Contact {
  const b = obj(v);
  return {
    nom: str(b.nom, 80),
    prenom: str(b.prenom, 80),
    adresse: str(b.adresse, 200),
    codePostal: str(b.codePostal, 10),
    commune: str(b.commune, 80),
    telephone: str(b.telephone, 40),
    courriel: str(b.courriel, 160),
  };
}
function effectifs(v: unknown): Effectifs {
  const b = obj(v);
  return {
    total: entier(b.total),
    chatillonnais: entier(b.chatillonnais),
    exterieurs: entier(b.exterieurs),
    majeurs: entier(b.majeurs),
    mineurs: entier(b.mineurs),
    hommes: entier(b.hommes),
    femmes: entier(b.femmes),
    licencies: entier(b.licencies),
  };
}
function liste<T>(v: unknown, lire: (x: unknown) => T, garder: (t: T) => boolean): T[] {
  return Array.isArray(v) ? v.map(lire).filter(garder).slice(0, 50) : [];
}
function moyen(v: unknown): Moyen {
  const b = obj(v);
  return { designation: str(b.designation, 160), heures: num(b.heures), par: str(b.par, 80) };
}
function action(v: unknown): Action {
  const b = obj(v);
  return {
    intitule: str(b.intitule, 160),
    descriptif: str(b.descriptif),
    date: str(b.date, 80),
    lieu: str(b.lieu, 160),
    public: str(b.public, 200),
    beneficiaires: entier(b.beneficiaires),
    cout: num(b.cout),
    recettes: str(b.recettes, 300),
  };
}
function montants(v: unknown, sportive: boolean): Montants {
  return nettoyerMontants(planDe(sportive), obj(v));
}

/** Lit un dossier depuis le JSON stocké (ou un formulaire aplati) : jamais d'exception. */
export function lireDossier(json: unknown, sportive = false): DossierSubvention {
  const b = obj(json);
  const pres = obj(b.presentation);
  const bur = obj(b.bureau);
  const charge = obj(bur.chargeDossier);
  const eff = obj(b.effectifs);
  const ray = obj(b.rayonnement);
  const part = obj(ray.participation);
  const moy = obj(ray.moyens);
  const bud = obj(b.budget);
  const mot = obj(b.motivation);
  const tre = obj(b.tresorerie);
  const bil = obj(b.bilan);
  const att = obj(b.attestation);
  const cumul = str(att.cumulAides, 3);
  return {
    presentation: {
      sigle: str(pres.sigle, 40),
      dateJo: str(pres.dateJo, 10),
      affiliation: str(pres.affiliation, 200),
      adherentsPersonnesMorales: bool(pres.adherentsPersonnesMorales),
      adherentsPersonnesMoralesLesquelles: str(pres.adherentsPersonnesMoralesLesquelles, 300),
      agrements: liste(
        pres.agrements,
        (x) => {
          const a = obj(x);
          return { type: str(a.type, 120), par: str(a.par, 120), date: str(a.date, 10) };
        },
        (a) => Boolean(a.type || a.par || a.date),
      ),
      labelNom: str(pres.labelNom, 120),
      labelOrganisme: str(pres.labelOrganisme, 120),
      utilitePublique: bool(pres.utilitePublique),
      utilitePubliqueDateJo: str(pres.utilitePubliqueDateJo, 10),
      commissaireAuxComptes: bool(pres.commissaireAuxComptes),
      changementDepuisDerniereDemande: bool(pres.changementDepuisDerniereDemande),
    },
    bureau: {
      president: contact(bur.president),
      tresorier: contact(bur.tresorier),
      vicePresident: contact(bur.vicePresident),
      secretaire: contact(bur.secretaire),
      autresMembres: str(bur.autresMembres),
      chargeDossier: {
        nom: str(charge.nom, 160),
        fonction: str(charge.fonction, 80),
        adresse: str(charge.adresse, 200),
        telephone: str(charge.telephone, 40),
        courriel: str(charge.courriel, 160),
      },
    },
    effectifs: {
      benevoles: entier(eff.benevoles),
      volontaires: entier(eff.volontaires),
      salaries: entier(eff.salaries),
      etpt: num(eff.etpt),
      adherents: entier(eff.adherents),
      exercicePrecedent: effectifs(eff.exercicePrecedent),
      previsionnel: effectifs(eff.previsionnel),
      cotisations: liste(
        eff.cotisations,
        (x) => {
          const c = obj(x);
          return {
            libelle: str(c.libelle, 120),
            montant: num(c.montant),
            nombre: entier(c.nombre),
          };
        },
        (c) => Boolean(c.libelle || c.montant !== null || c.nombre !== null),
      ),
    },
    rayonnement: {
      orientations: str(ray.orientations, 4000),
      participation: {
        forum: bool(part.forum),
        feteDuSport: bool(part.feteDuSport),
        reunionAssociationsSportives: bool(part.reunionAssociationsSportives),
        solidarite: str(part.solidarite, 300),
        inclusion: str(part.inclusion, 300),
        handicap: str(part.handicap, 300),
        culturel: str(part.culturel, 300),
        autres: str(part.autres, 300),
      },
      moyens: {
        locaux: liste(moy.locaux, moyen, (m) => Boolean(m.designation)),
        personnel: liste(moy.personnel, moyen, (m) => Boolean(m.designation)),
        transport: liste(moy.transport, moyen, (m) => Boolean(m.designation)),
        documents: liste(moy.documents, moyen, (m) => Boolean(m.designation)),
      },
    },
    budget: {
      exerciceDebut: str(bud.exerciceDebut, 10),
      exerciceFin: str(bud.exerciceFin, 10),
      charges: montants(bud.charges, sportive),
      produits: montants(bud.produits, sportive),
      contributions: montants(bud.contributions, sportive),
      financeurs: str(bud.financeurs, 1000),
    },
    motivation: {
      justification: str(mot.justification, 4000),
      explicationsPostes: str(mot.explicationsPostes, 4000),
      actions: liste(mot.actions, action, (a) => Boolean(a.intitule)),
    },
    tresorerie: {
      soldeDebut: num(tre.soldeDebut),
      resultat: num(tre.resultat),
      soldeFin: num(tre.soldeFin),
      compteCourant: num(tre.compteCourant),
      epargne: num(tre.epargne),
      caisse: num(tre.caisse),
      recettesNonEncaissees: num(tre.recettesNonEncaissees),
      depensesNonDecaissees: num(tre.depensesNonDecaissees),
      encaissementsAvance: num(tre.encaissementsAvance),
      decaissementsAvance: num(tre.decaissementsAvance),
      natures: str(tre.natures, 1000),
    },
    bilan: {
      subventionPrecedente: num(bil.subventionPrecedente),
      justification: str(bil.justification, 4000),
      actions: liste(bil.actions, action, (a) => Boolean(a.intitule)),
      exerciceDebut: str(bil.exerciceDebut, 10),
      exerciceFin: str(bil.exerciceFin, 10),
      budget: montants(bil.budget, sportive),
      realise: montants(bil.realise, sportive),
      contributionsBudget: montants(bil.contributionsBudget, sportive),
      contributionsRealise: montants(bil.contributionsRealise, sportive),
      synthese: str(bil.synthese, 4000),
    },
    attestation: {
      obligationsAJour: bool(att.obligationsAJour),
      informationsSinceres: bool(att.informationsSinceres),
      cumulAides: cumul === "inf" || cumul === "sup" ? cumul : "",
      engagementRepublicain: bool(att.engagementRepublicain),
      mandataire: bool(att.mandataire),
      signataireNom: str(att.signataireNom, 160),
      signataireQualite: str(att.signataireQualite, 80),
    },
  };
}

export function dossierVide(sportive = false): DossierSubvention {
  return lireDossier({}, sportive);
}

/** Remplace une fiche dans le dossier (le reste est conservé). */
export function avecFiche(
  dossier: DossierSubvention,
  cle: Exclude<FicheCle, "pieces">,
  valeur: unknown,
  sportive: boolean,
): DossierSubvention {
  return lireDossier({ ...dossier, [cle]: valeur }, sportive);
}

// ── Pré-remplissage ──

export type OrganisationSource = {
  legalFirstName: string | null;
  legalLastName: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
};

export type ValorisationSource = { espace: string; heures: number }[];

/**
 * Un dossier de départ : le président depuis la fiche de l'organisation, les fiches de
 * présentation du dossier précédent (renouvellement), la subvention perçue, et les locaux mis à
 * disposition par la commune d'après la valorisation de l'exercice écoulé.
 */
export function preRemplir(
  org: OrganisationSource,
  precedent: DossierSubvention | null,
  subventionPrecedente: number | null,
  valorisation: ValorisationSource,
  sportive: boolean,
): DossierSubvention {
  const base = precedent
    ? lireDossier(
        {
          presentation: precedent.presentation,
          bureau: precedent.bureau,
          effectifs: {
            ...precedent.effectifs,
            exercicePrecedent: precedent.effectifs.previsionnel,
            previsionnel: EFFECTIFS_VIDES,
          },
          rayonnement: { ...precedent.rayonnement, moyens: {} },
          bilan: {
            subventionPrecedente,
            actions: precedent.motivation.actions,
            budget:
              precedent.budget.charges && precedent.budget.produits
                ? { ...precedent.budget.charges, ...precedent.budget.produits }
                : {},
            contributionsBudget: precedent.budget.contributions,
            exerciceDebut: precedent.budget.exerciceDebut,
            exerciceFin: precedent.budget.exerciceFin,
          },
        },
        sportive,
      )
    : dossierVide(sportive);
  if (!base.bureau.president.nom && (org.legalLastName || org.legalFirstName)) {
    base.bureau.president = {
      ...CONTACT_VIDE,
      nom: org.legalLastName ?? "",
      prenom: org.legalFirstName ?? "",
      adresse: org.address ?? "",
      codePostal: org.postalCode ?? "",
      commune: org.city ?? "",
      telephone: org.phone ?? "",
      courriel: org.email ?? "",
    };
  }
  if (subventionPrecedente !== null) base.bilan.subventionPrecedente = subventionPrecedente;
  if (valorisation.length)
    base.rayonnement.moyens.locaux = valorisation.map((v) => ({
      designation: v.espace,
      heures: Math.round(v.heures * 10) / 10,
      par: "La commune",
    }));
  return base;
}

// ── Complétude ──

export type Manque = { fiche: FicheCle; libelle: string };

export type SubventionPourManques = {
  nature: "premiere" | "renouvellement";
  montantDemande: number;
  sportive: boolean;
  signeAt: Date | null;
  dossier: DossierSubvention;
};

export function contextePieces(s: SubventionPourManques): ContextePieces {
  return {
    nature: s.nature,
    commissaireAuxComptes: s.dossier.presentation.commissaireAuxComptes,
    mandataire: s.dossier.attestation.mandataire,
    changement: s.dossier.presentation.changementDepuisDerniereDemande,
    actions: s.dossier.motivation.actions.length > 0,
  };
}

/** Ce qui manque pour déposer : champs obligatoires par fiche, pièces, signature. */
export function manquesDossier(
  s: SubventionPourManques,
  kindsFournis: readonly string[],
  opts: { signatureRequise?: boolean } = {},
): Manque[] {
  const d = s.dossier;
  const out: Manque[] = [];
  const m = (fiche: FicheCle, libelle: string) => out.push({ fiche, libelle });
  if (!d.bureau.president.nom || !d.bureau.president.prenom)
    m("bureau", "Nom et prénom du président");
  if (!d.bureau.tresorier.nom) m("bureau", "Nom du trésorier");
  if (!d.bureau.chargeDossier.nom) m("bureau", "Personne chargée du dossier");
  if (!d.bureau.chargeDossier.courriel && !d.bureau.chargeDossier.telephone)
    m("bureau", "Un moyen de joindre la personne chargée du dossier");
  if (d.effectifs.benevoles === null) m("effectifs", "Nombre de bénévoles");
  if (d.effectifs.exercicePrecedent.total === null)
    m("effectifs", "Nombre d'adhérents de l'exercice écoulé");
  if (s.sportive && d.effectifs.exercicePrecedent.licencies === null)
    m("effectifs", "Nombre de licenciés");
  if (!d.rayonnement.orientations.trim())
    m("rayonnement", "Orientations et actions vis-à-vis des publics");
  const t = totaux(planDe(s.sportive), { ...d.budget.charges, ...d.budget.produits });
  if (!(t.produitsDirects > 0)) m("budget", "Au moins un produit prévisionnel");
  if (!(t.chargesDirectes > 0)) m("budget", "Au moins une charge prévisionnelle");
  if (!(s.montantDemande > 0)) m("motivation", "Montant de subvention demandé");
  else if (t.produitsDirects > 0 && s.montantDemande > t.produitsDirects)
    m("motivation", "Le montant demandé dépasse le total des produits");
  if (!d.motivation.justification.trim()) m("motivation", "Justification du montant demandé");
  if (d.tresorerie.soldeFin === null) m("tresorerie", "Solde de trésorerie en fin d'exercice");
  if (s.nature === "renouvellement") {
    if (d.bilan.subventionPrecedente === null) m("bilan", "Subvention perçue l'an dernier");
    if (!d.bilan.synthese.trim()) m("bilan", "Synthèse des rapports de l'année écoulée");
    const r = totaux(planDe(s.sportive), { ...d.bilan.realise });
    if (!(r.produitsDirects > 0)) m("bilan", "Compte de résultat réalisé (produits)");
  }
  for (const piece of piecesManquantes(contextePieces(s), kindsFournis)) m("pieces", piece.libelle);
  const a = d.attestation;
  if (!a.obligationsAJour || !a.informationsSinceres || !a.cumulAides)
    m("attestation", "Attestation sur l'honneur complète");
  if (!a.engagementRepublicain) m("attestation", "Contrat d'engagement républicain accepté");
  if (!s.signeAt && opts.signatureRequise !== false)
    m("attestation", "Signature du représentant (code reçu par SMS ou courriel)");
  return out;
}

/** Les fiches avec au moins un manque. */
export function fichesIncompletes(manques: readonly Manque[]): Set<FicheCle> {
  return new Set(manques.map((x) => x.fiche));
}

/** Les pièces attendues, avec leur état. */
export function etatPieces(
  s: SubventionPourManques,
  kindsFournis: readonly string[],
): { piece: Piece; fournie: boolean }[] {
  const fournis = new Set(kindsFournis);
  return piecesManquantes(contextePieces(s), []).map((piece) => ({
    piece,
    fournie: fournis.has(piece.kind),
  }));
}

// ── Formulaire aplati ──

/**
 * Reconstitue un objet depuis des champs nommés « bureau.president.nom »,
 * « agrements[0].type » ou « charges.locations » (les cases non cochées sont absentes :
 * `lireDossier` les lit comme fausses).
 */
export function deplierFormulaire(entrees: Iterable<[string, unknown]>): Record<string, unknown> {
  const racine: Record<string, unknown> = {};
  for (const [nom, valeur] of entrees) {
    if (typeof valeur !== "string") continue;
    const chemin = nom
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .filter(Boolean);
    if (!chemin.length) continue;
    let courant: Record<string, unknown> | unknown[] = racine;
    for (let i = 0; i < chemin.length; i++) {
      const cle = chemin[i];
      const dernier = i === chemin.length - 1;
      const suivantIndex = !dernier && /^\d+$/.test(chemin[i + 1]);
      const lire = (c: typeof courant, k: string) => (Array.isArray(c) ? c[Number(k)] : c[k]);
      const ecrire = (c: typeof courant, k: string, v: unknown) => {
        if (Array.isArray(c)) c[Number(k)] = v;
        else c[k] = v;
      };
      if (dernier) {
        ecrire(courant, cle, valeur);
      } else {
        let enfant = lire(courant, cle);
        if (!enfant || typeof enfant !== "object") {
          enfant = suivantIndex ? [] : {};
          ecrire(courant, cle, enfant);
        }
        courant = enfant as Record<string, unknown> | unknown[];
      }
    }
  }
  return racine;
}
