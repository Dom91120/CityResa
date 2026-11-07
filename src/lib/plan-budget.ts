/**
 * Les plans de budget du dossier de demande de subvention : le plan associatif (comptes 60 à
 * 78, contributions volontaires 86 / 87) et le plan sportif (postes du dossier des associations
 * sportives). Totaux, ratio demandé / produits, écarts budget / réalisé.
 * Logique PURE : testée dans plan-budget.test.ts.
 */

export type Poste = { code: string; libelle: string; groupe: string };

export type PlanBudget = {
  cle: "associatif" | "sportif";
  charges: Poste[];
  produits: Poste[];
  /** 86 : emplois des contributions volontaires en nature. */
  contributionsCharges: Poste[];
  /** 87 : contributions volontaires en nature. */
  contributionsProduits: Poste[];
};

const p = (code: string, libelle: string, groupe: string): Poste => ({ code, libelle, groupe });

const CONTRIBUTIONS_CHARGES: Poste[] = [
  p("secours_nature", "Secours en nature", "86 · Emplois des contributions volontaires en nature"),
  p(
    "mise_dispo_biens",
    "Mise à disposition gratuite de biens et prestations",
    "86 · Emplois des contributions volontaires en nature",
  ),
  p(
    "personnel_benevole",
    "Personnel bénévole",
    "86 · Emplois des contributions volontaires en nature",
  ),
];

const CONTRIBUTIONS_PRODUITS: Poste[] = [
  p("benevolat", "Bénévolat", "87 · Contributions volontaires en nature"),
  p("prestations_nature", "Prestations en nature", "87 · Contributions volontaires en nature"),
  p("dons_nature", "Dons en nature", "87 · Contributions volontaires en nature"),
];

export const PLAN_ASSOCIATIF: PlanBudget = {
  cle: "associatif",
  charges: [
    p("achats_etudes", "Achats d'études et de prestations de services", "60 · Achats"),
    p("achats_matieres", "Achats de matières et de fournitures", "60 · Achats"),
    p("autres_fournitures", "Autres fournitures", "60 · Achats"),
    p("locations", "Locations", "61 · Services extérieurs"),
    p("entretien", "Entretien et réparation", "61 · Services extérieurs"),
    p("assurance", "Assurance", "61 · Services extérieurs"),
    p("documentation", "Documentation", "61 · Services extérieurs"),
    p(
      "honoraires",
      "Rémunérations intermédiaires et honoraires",
      "62 · Autres services extérieurs",
    ),
    p("publicite", "Publicité, publication", "62 · Autres services extérieurs"),
    p("deplacements", "Déplacements, missions", "62 · Autres services extérieurs"),
    p("services_bancaires", "Services bancaires, autres", "62 · Autres services extérieurs"),
    p("impots_remuneration", "Impôts et taxes sur rémunération", "63 · Impôts et taxes"),
    p("autres_impots", "Autres impôts et taxes", "63 · Impôts et taxes"),
    p("remuneration", "Rémunération des personnels", "64 · Charges de personnel"),
    p("charges_sociales", "Charges sociales", "64 · Charges de personnel"),
    p("autres_charges_personnel", "Autres charges de personnel", "64 · Charges de personnel"),
    p(
      "gestion_courante",
      "Autres charges de gestion courante (vie associative)",
      "65 · Autres charges de gestion courante",
    ),
    p("charges_financieres", "Charges financières", "66 · Charges financières"),
    p("charges_exceptionnelles", "Charges exceptionnelles", "67 · Charges exceptionnelles"),
    p("amortissements", "Dotation aux amortissements, provisions", "68 · Dotations"),
  ],
  produits: [
    p("ventes", "Vente de produits finis, de marchandises, prestations de services", "70 · Ventes"),
    p("tarification", "Dotations et produits de tarification", "73 · Tarification"),
    p("subv_etat", "État (ministères sollicités)", "74 · Subventions d'exploitation"),
    p("subv_region", "Région(s)", "74 · Subventions d'exploitation"),
    p("subv_departement", "Département(s)", "74 · Subventions d'exploitation"),
    p("subv_intercommunalite", "Intercommunalité(s)", "74 · Subventions d'exploitation"),
    p("subv_commune", "Commune de Châtillon", "74 · Subventions d'exploitation"),
    p("subv_autres_communes", "Autres communes", "74 · Subventions d'exploitation"),
    p("subv_organismes_sociaux", "Organismes sociaux", "74 · Subventions d'exploitation"),
    p("subv_fonds_europeens", "Fonds européens (FSE, FEDER)", "74 · Subventions d'exploitation"),
    p(
      "subv_asp",
      "Agence de services et de paiement (emplois aidés)",
      "74 · Subventions d'exploitation",
    ),
    p("subv_autres", "Autres recettes", "74 · Subventions d'exploitation"),
    p("cotisations", "Cotisations", "75 · Autres produits de gestion courante"),
    p(
      "autres_produits_gestion",
      "Autres produits de gestion courante",
      "75 · Autres produits de gestion courante",
    ),
    p("produits_financiers", "Produits financiers", "76 · Produits financiers"),
    p("produits_exceptionnels", "Produits exceptionnels", "77 · Produits exceptionnels"),
    p("reprises", "Reprises sur amortissements et provisions", "78 · Reprises"),
  ],
  contributionsCharges: CONTRIBUTIONS_CHARGES,
  contributionsProduits: CONTRIBUTIONS_PRODUITS,
};

export const PLAN_SPORTIF: PlanBudget = {
  cle: "sportif",
  charges: [
    p("licences", "Licences", "Fédérations"),
    p("engagements", "Engagements", "Fédérations"),
    p("arbitrage", "Arbitrage", "Fédérations"),
    p("penalites", "Pénalités", "Fédérations"),
    p("assurances", "Assurances", "Fédérations"),
    p("achat_materiel", "Achat de matériel", "Matériel"),
    p("achat_survetement", "Achat de survêtements", "Matériel"),
    p("entretien_reparation", "Entretien et réparation", "Matériel"),
    p("locations", "Locations", "Matériel"),
    p("champ_organisation", "Organisation", "Manifestations · championnats"),
    p("champ_engagements", "Engagements", "Manifestations · championnats"),
    p("champ_deplacements", "Déplacements", "Manifestations · championnats"),
    p("champ_hebergement", "Hébergement", "Manifestations · championnats"),
    p("champ_buvette", "Buvette", "Manifestations · championnats"),
    p("hors_festivites", "Festivités", "Manifestations · hors championnats"),
    p("hors_jumelage", "Frais de jumelage", "Manifestations · hors championnats"),
    p("hors_buvette", "Buvette", "Manifestations · hors championnats"),
    p("stages_adherents", "Stages des adhérents", "Stages sportifs"),
    p("stages_autres", "Autres frais de stages", "Stages sportifs"),
    p("indemnites", "Indemnités", "Encadrement"),
    p("remboursement_frais", "Remboursements de frais", "Encadrement"),
    p("formations", "Formations", "Encadrement"),
    p("salaire_entraineur", "Salaire net entraîneur", "Salaires"),
    p("salaire_administratif", "Salaire net administratif", "Salaires"),
    p("charges_salariales", "Charges", "Salaires"),
    p("secretariat", "Secrétariat", "Divers"),
    p("publicite", "Publicité", "Divers"),
    p("divers", "Divers", "Divers"),
  ],
  produits: [
    p("subv_etat", "État (ministères sollicités)", "Subventions"),
    p("subv_region_departement", "Région(s) / Département(s)", "Subventions"),
    p("subv_commune", "Commune de Châtillon", "Subventions"),
    p("subv_federations", "Fédérations", "Subventions"),
    p("subv_omeps", "OMEPS", "Subventions"),
    p("subv_autres", "Autres subventions", "Subventions"),
    p("remboursements_assurances", "Remboursements d'assurances", "Assurances"),
    p("vente_materiel", "Vente de matériel", "Matériel"),
    p("vente_survetement", "Vente de survêtements", "Matériel"),
    p("location_materiel", "Location", "Matériel"),
    p("champ_organisation", "Organisation", "Manifestations · championnats"),
    p("champ_engagements", "Engagements", "Manifestations · championnats"),
    p("champ_deplacements", "Déplacements", "Manifestations · championnats"),
    p("champ_hebergement", "Hébergement", "Manifestations · championnats"),
    p("champ_buvette", "Buvette", "Manifestations · championnats"),
    p("hors_festivites", "Festivités", "Manifestations · hors championnats"),
    p("hors_buvette", "Buvette", "Manifestations · hors championnats"),
    p("stages_adherents", "Stages des adhérents", "Stages sportifs"),
    p("stages_autres", "Autres recettes de stages", "Stages sportifs"),
    p("parrainage", "Parrainage (sponsors)", "Publicité"),
    p("publicite_divers", "Divers", "Publicité"),
    p("cotisations_adherents", "Cotisations des adhérents", "Cotisations"),
    p("cotisations_libres", "Cotisations libres / forfait", "Cotisations"),
    p("cotisations_divers", "Divers", "Cotisations"),
  ],
  contributionsCharges: CONTRIBUTIONS_CHARGES,
  contributionsProduits: CONTRIBUTIONS_PRODUITS,
};

export function planDe(sportive: boolean): PlanBudget {
  return sportive ? PLAN_SPORTIF : PLAN_ASSOCIATIF;
}

export type Montants = Record<string, number>;

/** Les postes d'un plan regroupés par groupe, dans l'ordre. */
export function groupes(postes: readonly Poste[]): { groupe: string; postes: Poste[] }[] {
  const out: { groupe: string; postes: Poste[] }[] = [];
  for (const poste of postes) {
    const dernier = out[out.length - 1];
    if (dernier && dernier.groupe === poste.groupe) dernier.postes.push(poste);
    else out.push({ groupe: poste.groupe, postes: [poste] });
  }
  return out;
}

function somme(postes: readonly Poste[], montants: Montants): number {
  let total = 0;
  for (const poste of postes) total += montants[poste.code] ?? 0;
  return Math.round(total * 100) / 100;
}

export type Totaux = {
  chargesDirectes: number;
  produitsDirects: number;
  contributionsCharges: number;
  contributionsProduits: number;
  charges: number;
  produits: number;
  /** Produits − charges (directs). */
  resultat: number;
};

export function totaux(plan: PlanBudget, montants: Montants): Totaux {
  const chargesDirectes = somme(plan.charges, montants);
  const produitsDirects = somme(plan.produits, montants);
  const contributionsCharges = somme(plan.contributionsCharges, montants);
  const contributionsProduits = somme(plan.contributionsProduits, montants);
  return {
    chargesDirectes,
    produitsDirects,
    contributionsCharges,
    contributionsProduits,
    charges: Math.round((chargesDirectes + contributionsCharges) * 100) / 100,
    produits: Math.round((produitsDirects + contributionsProduits) * 100) / 100,
    resultat: Math.round((produitsDirects - chargesDirectes) * 100) / 100,
  };
}

/** La part du montant demandé dans le total des produits, en pourcentage (null sans produits). */
export function ratioDemande(montant: number, totalProduits: number): number | null {
  if (!(totalProduits > 0)) return null;
  return Math.round((montant / totalProduits) * 1000) / 10;
}

export type Ecart = { code: string; budget: number; realise: number; ecart: number };

/** Pour chaque poste, budget, réalisé et écart (réalisé − budget). */
export function ecartsBudgetRealise(
  postes: readonly Poste[],
  budget: Montants,
  realise: Montants,
): Ecart[] {
  return postes.map((poste) => {
    const b = budget[poste.code] ?? 0;
    const r = realise[poste.code] ?? 0;
    return { code: poste.code, budget: b, realise: r, ecart: Math.round((r - b) * 100) / 100 };
  });
}

/** Ne garde que les montants connus du plan, positifs ou nuls, arrondis au centime. */
export function nettoyerMontants(
  plan: PlanBudget,
  brut: Record<string, unknown> | null | undefined,
): Montants {
  const codes = new Set(
    [
      ...plan.charges,
      ...plan.produits,
      ...plan.contributionsCharges,
      ...plan.contributionsProduits,
    ].map((x) => x.code),
  );
  const out: Montants = {};
  if (!brut || typeof brut !== "object") return out;
  for (const [code, v] of Object.entries(brut)) {
    if (!codes.has(code)) continue;
    const n =
      typeof v === "number"
        ? v
        : Number(
            String(v)
              .replace(/[\s\u00a0\u202f]/g, "")
              .replace(",", "."),
          );
    if (Number.isFinite(n) && n >= 0) out[code] = Math.round(n * 100) / 100;
  }
  return out;
}
