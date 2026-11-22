/**
 * Le PDF du dossier de demande de subvention, présenté comme le formulaire de la Ville : page de
 * garde avec le cadre réservé à l'administration, fiches 1-1 à 8 sous leur bandeau noir, tableaux
 * encadrés, cases cochées, attestation, pièces, contrat d'engagement républicain. Les réponses de
 * l'association y figurent à la place des blancs du formulaire papier.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SUBVENTION_TYPES } from "@/lib/constantes";
import { CONTRAT_ENGAGEMENTS, CONTRAT_PREAMBULE } from "@/lib/contrat-engagement-republicain";
import {
  type Action,
  type Contact,
  type DossierSubvention,
  type Effectifs,
  etatPieces,
  type Moyen,
  type SubventionPourManques,
} from "@/lib/dossier-subvention";
import { dateCourte, dateHeure, dateLongue, montant } from "@/lib/libelles";
import {
  contactService,
  DELAI_BILAN,
  MENTION_FAUSSE_DECLARATION,
  noticeDonnees,
} from "@/lib/mentions-subvention";
import type { ConditionPiece } from "@/lib/pieces-subvention";
import {
  groupes,
  type Montants,
  type PlanBudget,
  type Poste,
  planDe,
  ratioDemande,
  totaux,
} from "@/lib/plan-budget";
import type { SubventionComplete } from "@/modules/subventions/server";
import { getSettings } from "@/server/config-store";
import { escapeHtml } from "@/server/email-templates";

/** Une image du formulaire de la Ville (public/img/subvention), en ligne dans le document. */
function image(nom: string): string | null {
  try {
    const octets = readFileSync(join(process.cwd(), "public", "img", "subvention", nom));
    return `data:image/png;base64,${octets.toString("base64")}`;
  } catch {
    return null;
  }
}

const p = (s: string | null | undefined) => escapeHtml(s ?? "");
/** Une réponse de l'association, à l'encre bleue pour la distinguer du texte du formulaire. */
const v = (s: string | null | undefined) => (s?.trim() ? `<span class="v">${p(s)}</span>` : "");
const nb = (x: number | null | undefined) =>
  x === null || x === undefined ? "" : `<span class="v">${x.toLocaleString("fr-FR")}</span>`;
const eur = (x: number | null | undefined) =>
  x === null || x === undefined ? "" : `<span class="v">${montant(x)}</span>`;
/** Une case du formulaire, cochée ou non. */
const CROIX =
  '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.6 1.6 8.4 8.4M8.4 1.6 1.6 8.4" fill="none" stroke="#1f3a93" stroke-width="1.2" stroke-linecap="round"/></svg>';
const coche = (b: boolean) => `<span class="case">${b ? CROIX : ""}</span>`;
const ouiNon = (b: boolean) => `${coche(b)} OUI &nbsp;&nbsp; ${coche(!b)} NON`;

/**
 * Le style du formulaire de la Ville, relevé dans son fichier Word : Arial 11 pt pour le texte
 * (15 pt gras dans les bandeaux, 8,5 pt dans les tableaux de budget, 7 pt pour les notes), Calibri
 * pour le cadre réservé, la notice et le numéro de page, traits de 0,5 pt, largeurs de colonnes
 * des tableaux. Chaque famille est suivie de son équivalent libre aux mêmes métriques
 * (Liberation Sans, Carlito), installé sur le serveur.
 */
const CSS_DOSSIER = `
* { box-sizing: border-box; }
body { font-family: Arial, "Liberation Sans", Helvetica, sans-serif; font-size: 11pt; color: #000; line-height: 1.15; margin: 0; }
p { margin: 0 0 7px; }
/* Les marges de la feuille (1,24 cm) laissent déborder l'en-tête de la page de garde ; le corps du
   texte retrouve les 2,5 cm du formulaire par ce retrait. */
.page { page-break-before: always; padding: 0 1.26cm; }
.page:first-child { page-break-before: auto; }
.v { color: #1f3a93; font-weight: 400; }
.pre { white-space: pre-wrap; }
.i { font-style: italic; }
.petit { font-size: 8pt; }
.note { font-size: 7pt; margin-top: 14px; }
.note::before { content: ""; display: block; width: 32%; border-top: 1px solid #000; margin-bottom: 4px; }
.bandeau { background: #000; color: #fff; font-weight: 700; font-size: 15pt; padding: 12px 9px; margin: 0 0 16px; display: flex; gap: 14px; }
.titre-gris { background: #bfbfbf; border: 0.5pt solid #000; text-align: center; font-weight: 700; font-size: 15pt; padding: 13px 9px; margin: 0 0 16px; }
.st { font-weight: 700; text-decoration: underline; margin: 16px 0 9px; }
.q { font-weight: 700; margin: 12px 0 2px; }
.ligne { margin: 0 0 9px; }
.deux { display: flex; gap: 40px; }
.case { display: inline-block; width: 11pt; height: 11pt; border: 1px solid #000; vertical-align: -1.5pt; margin-right: 3px; }
/* La croix est un tracé vectoriel : deux traits identiques, sans police de symboles. */
.case svg { display: block; width: 100%; height: 100%; }
table { border-collapse: collapse; width: 100%; margin: 0 0 10px; }
td, th { border: 0.5pt solid #000; padding: 2px 6px; text-align: left; vertical-align: top; font-weight: 400; }
th { background: #f2f2f2; font-weight: 700; }
td.num, th.num { text-align: right; white-space: nowrap; }
td.c, th.c { text-align: center; }
tr.gris td, td.gris { background: #d9d9d9; }
tr.total td { background: #d9d9d9; font-weight: 700; }
td.g { font-weight: 700; }
table.tresorerie { font-size: 10pt; }
table.tresorerie td { height: 0.7cm; vertical-align: middle; }
td.lettre { width: 9%; text-align: center; font-weight: 700; vertical-align: middle; }
td.somme { width: 28.2%; text-align: right; vertical-align: middle; white-space: nowrap; }
table.budget { font-size: 8.5pt; line-height: 1.1; }
table.budget.serre { font-size: 8pt; line-height: 1.05; }
table.budget td, table.budget th { padding: 1px 4px; }
table.budget thead { display: table-row-group; }
table.pointille td { border-style: dotted; }
table.bureau td { width: 50%; padding: 12px 8px 16px; }
table.bureau ul { margin: 0; padding-left: 34px; }
.souligne { font-weight: 700; text-decoration: underline; }
ul.puces { margin: 4px 0 8px; padding-left: 40px; }
.boite { border: 0.6pt solid #000; padding: 10px 8px; margin: 0 1px 12px 0; }
.sollicite { border: 2px solid #000; text-align: center; font-weight: 700; font-size: 12pt; padding: 3px; margin: -10px 1px 0 0; }
.rib { border: 0.5pt solid #000; width: 10.75cm; margin: 18px auto; padding: 26px 10px; text-align: center; font-weight: 700; }
.groupe-pieces { font-weight: 700; font-size: 13pt; text-decoration: underline; margin: 20px 0 12px; }
.piece { margin: 0 0 12px; }
.signatures { display: flex; border: 0.6pt solid #000; margin: 12px 1px 0 0; }
.signatures > div { flex: 1; padding: 10px 8px; min-height: 120px; }
.signatures > div + div { border-left: 0.6pt solid #000; }
.signe { display: inline-block; border: 2px solid #1f3a93; color: #1f3a93; padding: 3px 9px; font-weight: 700; margin: 6px 0; }
.rgpd { font-family: Calibri, Carlito, Arial, sans-serif; font-size: 8pt; margin-top: 10px; }
.rgpd .t { font-weight: 700; font-size: 9pt; text-decoration: underline; margin-bottom: 8px; }
.rgpd p { margin: 0 0 1px; }
/* Page de garde */
/* Comme dans le formulaire, l'en-tête déborde le corps du texte de 1,26 cm de chaque côté : il va
   de 1,24 cm du bord gauche de la feuille à 1,24 cm du bord droit. */
.garde-tete { display: flex; align-items: flex-start; justify-content: space-between; margin: 0.15cm -1.26cm 1.45cm; }
.garde-entete { width: 11.45cm; height: 2.95cm; flex-shrink: 0; }
.contrat-logo { width: 2.69cm; height: 2.61cm; margin-bottom: 8px; }
.garde-marque { display: flex; align-items: center; gap: 18px; }
.garde-marque img { height: 92px; max-width: 110px; object-fit: contain; }
.garde-marque .nom { font-weight: 700; font-size: 13pt; max-width: 110px; }
.garde-marque h1 { font-family: Montserrat, "Arial Black", Arial, sans-serif; font-weight: 800; font-size: 27pt; line-height: 1.02; margin: 0; padding-left: 18px; border-left: 1px solid #000; }
.cadre { border: 0.5pt solid #000; padding: 7px 9px 12px; width: 6.29cm; min-height: 2.95cm; flex-shrink: 0; font-family: Calibri, Carlito, Arial, sans-serif; font-size: 11pt; margin-right: 1px; }
.cadre .t { font-weight: 700; border-bottom: 1.5px solid #000; padding-bottom: 4px; margin-bottom: 18px; }
.cartouche { border: 0.6pt solid #000; text-align: center; font-weight: 700; margin: 0 1px 20px 0; }
.cartouche .haut { background: #f2f2f2; padding: 18px 10px 20px; font-size: 12pt; }
.cartouche .haut .annee { font-size: 18pt; }
.cartouche .bas { background: #d9d9d9; border-top: 0.5pt solid #000; padding: 22px 10px; font-size: 20pt; }
.centre { text-align: center; }
.regle { border: 0; border-top: 1.5px solid #000; margin: 18px 0; }
table.nom-asso td { padding: 1px 8px; font-size: 12pt; }
ul.garde-liste { font-size: 10pt; }
.demande { margin: 12px 0 12px 54px; font-size: 12pt; }
h2.contrat { text-align: center; font-size: 13pt; margin: 0 0 18px; }
.engagement { font-weight: 700; margin: 14px 0 6px; }
.justifie { text-align: justify; }
`;

function bandeau(numero: string, titre: string): string {
  return `<div class="bandeau"><span>${numero}</span><span>${titre}</span></div>`;
}

function dateFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? "");
}

function caseContact(titre: string, c: Contact): string {
  return `<td><span class="souligne">${titre}</span><ul>
<li>Nom : ${v(c.nom)}</li><li>Prénom : ${v(c.prenom)}</li><li>Adresse : ${v(c.adresse)}</li>
<li>Code postal : ${v(c.codePostal)}</li><li>Commune : ${v(c.commune)}</li>
<li>Tel. : ${v(c.telephone)}</li><li>Courriel : ${v(c.courriel)}</li></ul></td>`;
}

function tableAdherents(
  a: Effectifs,
  b: Effectifs,
  sportive: boolean,
  exN1: string,
  exN: string,
): string {
  const r = (dont: string, l: string, k: keyof Effectifs) =>
    `<tr><td style="width:9.3%;border-right:0">${dont}</td><td style="border-left:0">${l}</td><td class="c">${nb(a[k])}</td><td class="c">${nb(b[k])}</td></tr>`;
  return `<table class="pointille"><thead><tr><td colspan="2" style="border:0"></td><th class="c" style="width:25%;border-style:solid">${exN1}</th><th class="c" style="width:24.9%;border-style:solid">${exN}<br>Prévisionnel</th></tr></thead><tbody>
${r("", "<strong>Nombre d'adhérents</strong>", "total")}
${r("Dont :", "Nombre de Châtillonnais", "chatillonnais")}${r("", "Nombre de non-Châtillonnais", "exterieurs")}
${r("Dont :", "Plus de 18 ans", "majeurs")}${r("", "Moins de 18 ans", "mineurs")}
${r("Dont", "Hommes", "hommes")}${r("Dont", "Femmes", "femmes")}
${sportive ? r("Dont :", "Nombre de licenciés", "licencies") : ""}
</tbody></table>`;
}

function tableMoyens(titre: string, col2: string, col3: string, m: Moyen[]): string {
  const lignes = m.length
    ? m
        .map(
          (x) =>
            `<tr><td>${coche(true)} ${v(x.par)}</td><td>${v(x.designation)}</td><td>${nb(x.heures)}</td></tr>`,
        )
        .join("")
    : `<tr><td>${coche(false)} La commune :</td><td></td><td></td></tr>`;
  return `<p class="q">${titre} :</p><table><thead><tr><th style="width:33.4%">Type de disponibilité<br><span class="i" style="font-weight:400">Mis à disposition par :</span></th><th style="width:33.4%">${col2}</th><th>${col3}</th></tr></thead><tbody>${lignes}</tbody></table>`;
}

function tablesActions(actions: Action[], prevision: boolean): string {
  const vides: Action[] = [
    {
      intitule: "",
      descriptif: "",
      date: "",
      lieu: "",
      public: "",
      beneficiaires: null,
      cout: null,
      recettes: "",
    },
  ];
  return (actions.length ? actions : vides)
    .map(
      (a, i) => `<table style="margin-bottom:22px"><tbody>
<tr class="gris"><td colspan="2"><strong>Intitulé de l'action N°${i + 1}</strong> ${v(a.intitule)}</td></tr>
<tr><td style="width:34.3%">Descriptif succinct :</td><td class="pre" style="height:54px">${v(a.descriptif)}</td></tr>
<tr><td>Date :</td><td>${v(a.date)}</td></tr>
<tr><td>Lieu :</td><td>${v(a.lieu)}</td></tr>
<tr><td>Public ciblé et nombre de bénéficiaires de l'action :</td><td style="height:44px">${v(a.public)}${a.beneficiaires !== null ? `${a.public ? " · " : ""}${nb(a.beneficiaires)} <span class="v">bénéficiaires</span>` : ""}</td></tr>
<tr><td>${prevision ? "Coût prévisionnel de l'action :" : "Coût financier de l'action :"}</td><td>${eur(a.cout)}</td></tr>
<tr><td>${prevision ? "Recettes espérées" : "Recettes obtenues"} <span class="i">(montant et provenance)</span> :</td><td>${v(a.recettes)}</td></tr>
</tbody></table>`,
    )
    .join("");
}

type LignePlan = { libelle: string; gras: boolean; cellules: string[] };

/** Les lignes d'une colonne du budget : un intitulé de groupe en gras, puis ses postes. */
function lignesPlan(postes: readonly Poste[], colonnes: readonly Montants[]): LignePlan[] {
  const out: LignePlan[] = [];
  const m = (x: number) => (x ? `<span class="v">${montant(x)}</span>` : "");
  for (const g of groupes(postes)) {
    // Un groupe d'un seul poste tient sur une ligne, comme « 66 – Charges financières ».
    const [code, reste] = g.groupe.split(" · ");
    const seul = g.postes.length === 1 ? g.postes[0] : null;
    const libelle = seul
      ? reste
        ? `${code} – ${seul.libelle}`
        : seul.libelle
      : g.groupe.replace(" · ", " – ");
    out.push({
      libelle: p(libelle),
      gras: true,
      cellules: colonnes.map((c) => m(g.postes.reduce((s, x) => s + (c[x.code] ?? 0), 0))),
    });
    if (seul) continue;
    for (const x of g.postes)
      out.push({
        libelle: p(x.libelle),
        gras: false,
        cellules: colonnes.map((c) => m(c[x.code] ?? 0)),
      });
  }
  return out;
}

/** Charges à gauche, produits à droite, ligne à ligne, comme le tableau du formulaire. */
function lignesFace(gauche: LignePlan[], droite: LignePlan[], nbCol: number): string {
  const vide = `<td></td>${"<td></td>".repeat(nbCol)}`;
  const cote = (l: LignePlan | undefined) =>
    l
      ? `<td${l.gras ? ' class="g"' : ""}>${l.libelle}</td>${l.cellules.map((c) => `<td class="num">${c}</td>`).join("")}`
      : vide;
  const n = Math.max(gauche.length, droite.length);
  return Array.from({ length: n }, (_, i) => `<tr>${cote(gauche[i])}${cote(droite[i])}</tr>`).join(
    "",
  );
}

function ligneTotal(g: string, d: string, tg: number[], td: number[]): string {
  const c = (t: number[]) =>
    t.map((x) => `<td class="num"><span class="v">${montant(x)}</span></td>`).join("");
  return `<tr class="total"><td>${g}</td>${c(tg)}<td>${d}</td>${c(td)}</tr>`;
}

const somme = (postes: readonly Poste[], m: Montants) =>
  postes.reduce((s, x) => s + (m[x.code] ?? 0), 0);

function tableBudget(plan: PlanBudget, d: DossierSubvention): string {
  const t = totaux(plan, { ...d.budget.charges, ...d.budget.produits, ...d.budget.contributions });
  return `<table class="budget${plan.cle === "sportif" ? " serre" : ""}"><thead>
<tr><th class="c" style="width:35.9%">CHARGES</th><th class="c" style="width:13.5%">Montant</th><th class="c" style="width:33.8%">PRODUITS</th><th class="c">Montant</th></tr>
<tr class="gris"><td class="c" colspan="2">CHARGES DIRECTES</td><td class="c" colspan="2">RESSOURCES DIRECTES</td></tr></thead><tbody>
${lignesFace(lignesPlan(plan.charges, [d.budget.charges]), lignesPlan(plan.produits, [d.budget.produits]), 1)}
${ligneTotal("TOTAL DES CHARGES PRÉVISIONNELLES", "TOTAL DES PRODUITS PRÉVISIONNELS", [t.chargesDirectes], [t.produitsDirects])}
<tr class="gris"><td class="c g" colspan="4">CONTRIBUTIONS VOLONTAIRES EN NATURE</td></tr>
${lignesFace(lignesPlan(plan.contributionsCharges, [d.budget.contributions]), lignesPlan(plan.contributionsProduits, [d.budget.contributions]), 1)}
${ligneTotal("TOTAL DES CHARGES", "TOTAL DES PRODUITS", [t.charges], [t.produits])}
</tbody></table>`;
}

function tableCompteResultat(plan: PlanBudget, d: DossierSubvention): string {
  const b = d.bilan;
  const cols = [b.budget, b.realise];
  const contrib = [b.contributionsBudget, b.contributionsRealise];
  const tot = (postes: readonly Poste[], c: readonly Montants[]) => c.map((m) => somme(postes, m));
  const plus = (x: number[], y: number[]) => x.map((a, i) => a + y[i]);
  const tc = tot(plan.charges, cols);
  const tp = tot(plan.produits, cols);
  return `<table class="budget${plan.cle === "sportif" ? " serre" : ""}"><thead>
<tr><th class="c" style="width:29.4%">CHARGES</th><th class="c" style="width:11.9%">Budget</th><th class="c" style="width:11.2%">Réalisé</th><th class="c" style="width:26.6%">PRODUITS</th><th class="c" style="width:11.9%">Budget</th><th class="c">Réalisé</th></tr>
<tr class="gris"><td class="c" colspan="3">CHARGES DIRECTES</td><td class="c" colspan="3">RESSOURCES DIRECTES</td></tr></thead><tbody>
${lignesFace(lignesPlan(plan.charges, cols), lignesPlan(plan.produits, cols), 2)}
${ligneTotal("TOTAL DES CHARGES", "TOTAL DES PRODUITS", tc, tp)}
<tr class="gris"><td class="c g" colspan="6">CONTRIBUTIONS VOLONTAIRES EN NATURE</td></tr>
${lignesFace(lignesPlan(plan.contributionsCharges, contrib), lignesPlan(plan.contributionsProduits, contrib), 2)}
${ligneTotal("TOTAL DES CHARGES", "TOTAL DES PRODUITS", plus(tc, tot(plan.contributionsCharges, contrib)), plus(tp, tot(plan.contributionsProduits, contrib)))}
</tbody></table>`;
}

const GROUPES_PIECES: [string, ConditionPiece[]][] = [
  ["Pour toutes les associations :", ["toutes", "mandataire"]],
  ["Dans le cas d'un renouvellement de dossier :", ["renouvellement", "commissaire"]],
  ["Uniquement si changement depuis la dernière demande :", ["changement"]],
  ["Pièces supplémentaires pour une première demande :", ["premiere"]],
  ["Pour une demande portant sur des actions spécifiques :", ["action"]],
];

export type SubventionPourPdf = SubventionComplete & { dossierLu: DossierSubvention };

/** Le HTML complet du dossier d'une demande. */
export async function htmlDossierSubvention(
  s: SubventionPourPdf,
  kindsFournis: readonly string[],
): Promise<string> {
  const cfg = await getSettings();
  const d = s.dossierLu;
  const org = s.organisation;
  const sportive = org.sportive;
  const plan = planDe(sportive);
  const exN1 = `${s.exercice - 1}`;
  const exN = `${s.exercice}`;
  const saisonN1 = `${s.exercice - 1} ou ${s.exercice - 2}/${s.exercice - 1}`;
  const saisonN = `${s.exercice} ou ${s.exercice - 1}/${s.exercice}`;
  const pm: SubventionPourManques = {
    nature: s.nature === "premiere" ? "premiere" : "renouvellement",
    montantDemande: s.montantDemande,
    sportive,
    signeAt: s.signeAt,
    dossier: d,
  };
  const pieces = etatPieces(pm, kindsFournis);
  const part = d.rayonnement.participation;
  const pr = d.presentation;
  const tr = d.tresorerie;
  const att = d.attestation;
  const service = contactService(cfg, s.service);
  const entete = image("entete-ville.png");
  const logo = image("logo-ville.png");
  const t = totaux(plan, { ...d.budget.charges, ...d.budget.produits, ...d.budget.contributions });
  const ratio = ratioDemande(s.montantDemande, t.produitsDirects);
  const premiere = s.nature === "premiere";
  const enBanque =
    tr.compteCourant === null && tr.epargne === null && tr.caisse === null
      ? null
      : (tr.compteCourant ?? 0) + (tr.epargne ?? 0) + (tr.caisse ?? 0);
  const rapprochement =
    enBanque === null
      ? null
      : enBanque +
        (tr.recettesNonEncaissees ?? 0) -
        (tr.depensesNonDecaissees ?? 0) -
        (tr.encaissementsAvance ?? 0) +
        (tr.decaissementsAvance ?? 0);
  const echeance = s.recuAt
    ? `Déposé le ${dateLongue(s.recuAt)}`
    : s.campagne
      ? `À retourner avant le ${dateLongue(s.campagne.clotureDate)}`
      : "Dossier en cours de rédaction";
  const signature = s.signeAt
    ? `<span class="signe">Signé électroniquement</span><br><span class="v">${p(s.signeNom)}${s.signeQualite ? `, ${p(s.signeQualite)}` : ""}<br>le ${dateHeure(s.signeAt)}${s.signeIp ? ` (IP ${p(s.signeIp)})` : ""}</span>`
    : `<span class="i">Signature électronique en attente</span>`;
  // Les fiches 1-3 à 1-5 : le dossier sportif ajoute les cotisations et décale le rayonnement.
  const adherents = `<p class="st">Renseignements concernant les adhérents</p>
<p><strong>Nombre d'adhérents de l'association</strong> (à jour de la cotisation statutaire) <strong>:</strong></p>
${tableAdherents(d.effectifs.exercicePrecedent, d.effectifs.previsionnel, sportive, saisonN1, saisonN)}`;
  const cotisations = `<p class="q">Somme des cotisations de l'association (prévisionnel ${saisonN}) :</p>
<table><thead><tr><th>Libellé des cotisations</th><th class="c">Montant de la cotisation individuelle</th><th class="c">Nombre d'adhérents</th><th class="c">Montant total</th></tr></thead><tbody>
${
  d.effectifs.cotisations.length
    ? d.effectifs.cotisations
        .map(
          (c) =>
            `<tr><td>${v(c.libelle)}</td><td class="num">${eur(c.montant)}</td><td class="c">${nb(c.nombre)}</td><td class="num">${c.montant !== null && c.nombre !== null ? eur(c.montant * c.nombre) : ""}</td></tr>`,
        )
        .join("")
    : "<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>"
}</tbody></table>`;
  const rayonnement = `<p class="st">Rayonnement de l'association sur la saison ${s.exercice - 2} – ${exN1} ou l'année ${exN1}</p>
<p><strong>Quelles sont les orientations et les actions de votre association vis-à-vis des différents publics</strong> <span class="i">(jeunes, scolaires, seniors, publics fragilisés, etc.)</span> ?</p>
<p class="pre" style="margin:8px 0 18px 26px">${v(d.rayonnement.orientations)}</p>
<p style="margin-bottom:14px"><strong>Participation à la vie locale de votre association.</strong><br>Cocher les cases correspondantes :</p>
<p class="piece">${coche(part.forum)} Forum des associations</p>
${sportive ? `<p class="piece">${coche(part.feteDuSport)} Fête du sport</p><p class="piece">${coche(part.reunionAssociationsSportives)} Réunion des associations sportives</p>` : ""}
<p class="piece">${coche(Boolean(part.solidarite))} Solidarité. Précisez : ${v(part.solidarite)}</p>
<p class="piece">${coche(Boolean(part.inclusion))} Inclusion. Précisez : ${v(part.inclusion)}</p>
<p class="piece">${coche(Boolean(part.handicap))} Handicap. Précisez : ${v(part.handicap)}</p>
<p class="piece">${coche(Boolean(part.culturel))} Culturel, artistique. Précisez : ${v(part.culturel)}</p>
<p class="piece">${coche(Boolean(part.autres))} Autres évènements communaux. Précisez : ${v(part.autres)}</p>`;
  const moyens = `<p class="st">Moyens mis à disposition de l'association sur l'année ou la saison écoulée</p>
${tableMoyens("Locaux utilisés", "Désignation", "Nombre annuel d'heures d'utilisation", d.rayonnement.moyens.locaux)}
${tableMoyens("Personnel", "Nature", "Nombre annuel d'heures", d.rayonnement.moyens.personnel)}
${tableMoyens(sportive ? "Matériel et matériel de transport" : "Matériel de transport", "Nature", "Nombre annuel d'heures", d.rayonnement.moyens.transport)}
${tableMoyens("Documents (reprographie – affiches …)", "Nature des documents", "Nombre annuel d'heures", d.rayonnement.moyens.documents)}`;
  const suite = "Présentation de votre association (suite)";
  const fichesSuite = sportive
    ? [
        `${bandeau("1-3", suite)}${adherents}${cotisations}`,
        `${bandeau("1-4", suite)}${rayonnement}`,
        `${bandeau("1-5", suite)}${moyens}`,
      ]
    : [`${bandeau("1-3", suite)}${adherents}${rayonnement}`, `${bandeau("1-4", suite)}${moyens}`];
  const contratPiece = `<p class="piece">${coche(att.engagementRepublicain)} <strong>Contrat d'engagement républicain des associations bénéficiant de subventions publiques</strong> <span class="petit">(en annexe, accepté dans l'attestation)</span></p>`;
  const groupesPieces = GROUPES_PIECES.map(([titre, conditions]) => ({
    titre,
    pieces: pieces.filter((e) => conditions.includes(e.piece.condition)),
  })).filter((g) => g.pieces.length);

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS_DOSSIER}</style></head><body>

<div class="page">
<div class="garde-tete">
${entete ? `<img class="garde-entete" src="${entete}" alt="${p(cfg.COLLECTIVITE_NOM)} – Demande de subvention communale">` : `<div class="garde-marque">${cfg.COLLECTIVITE_LOGO ? `<img src="${cfg.COLLECTIVITE_LOGO}" alt="">` : `<div class="nom">${p(cfg.COLLECTIVITE_NOM)}</div>`}<h1>Demande<br>de subvention<br>communale</h1></div>`}
<div class="cadre"><div class="t">Cadre réservé à l'administration</div>
Numéro de dossier : ${v(s.numero)}<br>Date de réception : ${v(s.recuAt ? dateCourte(s.recuAt) : "")}<br>Secteur : ${v(s.secteur?.label)}</div>
</div>
<div class="cartouche">
<div class="haut">Dossier de demande de subvention communale au titre de l'année <span class="annee">${exN}</span><br><br><span style="text-decoration:underline">${sportive ? "ASSOCIATIONS SPORTIVES" : "ASSOCIATIONS"}</span>${sportive ? "" : "<br>(Hors associations sportives)"}</div>
<div class="bas">${echeance}</div>
</div>
<p class="centre" style="font-size:12pt;margin-bottom:14px">Votre association sollicite une subvention.<br>Ce dossier précise le type de demande.</p>
<table class="nom-asso"><tbody><tr><td style="width:31.2%"><strong>Nom de l'association :</strong></td><td>${v(org.name)}</td></tr></tbody></table>
<p class="demande">${coche(premiere)} <strong>Première demande</strong> | Montant souhaité : ${premiere ? eur(s.montantDemande) : "€"}</p>
<p class="demande">${coche(!premiere)} <strong>Renouvellement</strong> | Montant souhaité : ${premiere ? "€" : eur(s.montantDemande)}</p>
<hr class="regle">
<p style="font-size:10pt">Vous trouverez dans ce dossier :</p>
<ul class="puces garde-liste">
<li>La présentation de l'association <span class="i">(Fiches 1-1 à ${sportive ? "1-5" : "1-4"})</span> ;</li>
<li>La demande de subvention avec le budget prévisionnel <span class="i">(Fiches 2 à 4)</span> ;</li>
<li>L'attestation sur l'honneur <span class="i">(Fiche 5)</span> ;</li>
<li>La liste des pièces jointes au dossier <span class="i">(Fiche 6)</span> ;</li>
<li>Le bilan des actions réalisées avec le compte de résultat <span class="i">(Fiches 7 et 8)</span>.</li>
</ul>
<hr class="regle">
<p style="font-size:12pt">Ce dossier a été ${s.recuAt ? "déposé" : "préparé"} en ligne sur le portail des associations${s.campagne ? ` (${p(s.campagne.label)})` : ""}.</p>
<hr class="regle">
<p style="font-size:9pt">Pour toute question sur ce dossier et pour être accompagné dans sa rédaction : ${p(service.nom)}${service.email || service.telephone ? `, ${[service.email ? `par courriel (${p(service.email)})` : "", service.telephone ? `par téléphone (${p(service.telephone)})` : ""].filter(Boolean).join(" ou ")}` : ""}.</p>
</div>

<div class="page">${bandeau("1-1", "Présentation de votre association")}
<p class="st" style="margin-top:0">Identification de l'association</p>
<p class="ligne">Nom de votre association : ${v(org.name)}</p>
<p class="ligne">Sigle : ${v(pr.sigle)}</p>
<p class="ligne">Numéro Siret : ${v(org.siret)}</p>
<p class="ligne">Numéro RNA ou à défaut celui du récépissé en préfecture : ${v(org.rna)}</p>
<p class="ligne">Date de publication de la création au Journal Officiel : ${v(dateFr(pr.dateJo))}</p>
<p class="ligne">Adresse du siège social : ${v(org.address)}</p>
<p class="ligne deux"><span>Code postal : ${v(org.postalCode)}</span><span>Commune : ${v(org.city)}</span></p>
<p class="ligne deux"><span>Téléphone : ${v(org.phone)}</span><span>Courriel : ${v(org.email)}</span></p>
<p class="ligne">Adresse site internet : ${v(org.website)}</p>
<p class="ligne" style="margin-top:20px">Union, fédération ou réseau auquel est affiliée votre association (indiquer le nom complet, ne pas utiliser de sigle) : ${v(pr.affiliation)}</p>
<p class="ligne" style="margin-top:16px">Votre association a-t-elle des adhérents personnes morales : ${coche(pr.adherentsPersonnesMorales)} OUI (lesquelles ?) &nbsp; ${coche(!pr.adherentsPersonnesMorales)} NON</p>
${pr.adherentsPersonnesMorales ? `<ul class="puces"><li>${v(pr.adherentsPersonnesMoralesLesquelles)}</li></ul>` : ""}
<p class="q">Votre association dispose-t-elle d'agrément(s) administratif(s) ? <span style="font-weight:400">${ouiNon(pr.agrements.length > 0)}</span></p>
<p>Si oui, vous préciserez le(s)quel(s) :</p>
<table class="pointille"><thead><tr><td class="g" style="width:34.3%">Type d'agrément :</td><td class="g" style="width:33.1%">Attribué par :</td><td class="g">En date du :</td></tr></thead><tbody>
${pr.agrements.length ? pr.agrements.map((a) => `<tr><td>${v(a.type)}</td><td>${v(a.par)}</td><td>${v(dateFr(a.date))}</td></tr>`).join("") : '<tr><td style="height:34px"></td><td></td><td></td></tr>'}
</tbody></table>
<p class="q">Votre association bénéficie-t-elle d'un label ? <span style="font-weight:400">${ouiNon(Boolean(pr.labelNom))}</span></p>
<p style="margin:0">Si oui merci de communiquer les noms :</p>
<ul class="puces" style="margin-top:0"><li>du label : ${v(pr.labelNom)}</li><li>de l'organisme qui l'a délivré : ${v(pr.labelOrganisme)}</li></ul>
<p class="q">Votre association est-elle reconnue d'utilité publique ? <span style="font-weight:400">${ouiNon(pr.utilitePublique)}</span></p>
<p style="margin-left:26px">Date de publication au Journal Officiel : ${v(dateFr(pr.utilitePubliqueDateJo))}</p>
<p class="q">Votre association a-t-elle recours à un commissaire aux comptes ? <span style="font-weight:400">${ouiNon(pr.commissaireAuxComptes)}</span></p>
<p class="q">Statuts ou dirigeants modifiés depuis la dernière demande ? <span style="font-weight:400">${ouiNon(pr.changementDepuisDerniereDemande)}</span></p>
<p class="note">Le recours à un commissaire aux comptes est une obligation notamment pour toute association qui reçoit annuellement plus de 153 000 euros de dons ou de subventions (article L 612-4 du code de commerce, décret n°2006-335 du 21 mars 2006).</p>
</div>

<div class="page">${bandeau("1-2", suite)}
<table class="bureau"><tbody>
<tr>${caseContact("Président", d.bureau.president)}${caseContact("Trésorier", d.bureau.tresorier)}</tr>
<tr>${caseContact("Vice-Président", d.bureau.vicePresident)}${caseContact("Secrétaire", d.bureau.secretaire)}</tr>
</tbody></table>
<p><strong>Autres membres du bureau ou du Conseil d'administration</strong> :</p>
<p class="pre" style="margin-left:26px">${v(d.bureau.autresMembres)}</p>
<p style="margin-top:14px"><strong>Identification de la personne chargée du dossier de subvention</strong> <span class="i">(c'est à cette personne que le dossier sera retourné s'il est incomplet ou s'il manque des documents)</span> :</p>
<ul class="puces"><li>Nom / Prénom : ${v(d.bureau.chargeDossier.nom)}</li><li>Fonction au sein de l'association : ${v(d.bureau.chargeDossier.fonction)}</li><li>Adresse : ${v(d.bureau.chargeDossier.adresse)}</li><li>Téléphone : ${v(d.bureau.chargeDossier.telephone)} &nbsp;&nbsp;&nbsp; Courriel : ${v(d.bureau.chargeDossier.courriel)}</li></ul>
<p class="st" style="margin-left:26px">Renseignements concernant les ressources humaines</p>
<table><tbody>
<tr><td>Nombre de bénévoles :<br><span class="i petit">Bénévole : personne contribuant régulièrement à l'activité de l'association, de manière non rémunérée.</span></td><td class="c" style="width:18.8%">${nb(d.effectifs.benevoles)}</td></tr>
<tr><td>Nombre de volontaires :<br><span class="i petit">Volontaire : personne engagée pour une mission d'intérêt général par un contrat spécifique (par ex. service civique)</span></td><td class="c">${nb(d.effectifs.volontaires)}</td></tr>
<tr><td>Nombre de salariés :</td><td class="c">${nb(d.effectifs.salaries)}</td></tr>
<tr><td>Dont salarié(s) en équivalent temps plein travaillé (ETPT) :</td><td class="c">${nb(d.effectifs.etpt)}</td></tr>
<tr><td>Nombre d'adhérents :<br><span class="i petit">Adhérent : personne ayant marqué formellement son adhésion aux statuts de l'association.</span></td><td class="c">${nb(d.effectifs.adherents)}</td></tr>
</tbody></table>
<p class="note">Les ETPT correspondent aux effectifs physiques pondérés par la quotité de travail. À titre d'exemple, un salarié en CDI dont la quotité de travail est de 80 % sur toute l'année correspond à 0,8 ETPT. Les volontaires ne sont pas pris en compte.</p>
</div>

${fichesSuite.map((f) => `<div class="page">${f}</div>`).join("\n")}

<div class="page">${bandeau("2", "Budget prévisionnel de l'association")}
<p class="i petit" style="font-size:8.5pt">Dans le cas où l'exercice de l'association est différent de l'année civile, il vous appartient de préciser les dates de début et de fin d'exercice.</p>
<p style="font-size:11pt;font-weight:700">Exercice ${s.exercice - 1}/${exN} ou ${exN} &nbsp; Date de début : ${v(dateFr(d.budget.exerciceDebut))} &nbsp; Date de fin : ${v(dateFr(d.budget.exerciceFin))}</p>
${tableBudget(plan, d)}
<div class="sollicite">L'association sollicite une subvention de ${eur(s.montantDemande)}</div>
${d.budget.financeurs ? `<p style="margin-top:10px"><strong>Autres financeurs publics sollicités :</strong> ${v(d.budget.financeurs)}</p>` : ""}
<p class="note">Les indications sur les financements demandés auprès d'autres financeurs publics valent déclaration sur l'honneur et tiennent lieu de justificatifs. Le plan comptable des associations prévoit a minima une information sur les contributions volontaires en nature dans l'annexe.</p>
</div>

<div class="page">${bandeau("3", `Motivation de la demande et descriptions des principales actions prévues pour la période ${s.exercice - 1} / ${exN} ou ${exN}`)}
<p class="justifie"><strong>L'association sollicite auprès de la commune de Châtillon une subvention de ${p((SUBVENTION_TYPES[s.type] ?? s.type).toLowerCase())} de ${eur(s.montantDemande)} qui représente ${ratio === null ? "…" : `<span class="v">${ratio.toLocaleString("fr-FR")}</span>`} % du total des produits = (montant demandé / total des produits) x 100</strong></p>
<p>Objet de la demande : ${v(s.objet)}</p>
<p class="st">Expliquez et justifiez le montant demandé</p>
<p class="pre">${v(d.motivation.justification)}</p>
<div class="boite" style="min-height:150px;margin-top:16px"><p><strong>Explications des principaux postes de dépenses inscrits au budget</strong> <span class="i">(et éventuellement de leurs variations par rapport à l'année précédente)</span> <strong>:</strong></p>
<p class="pre" style="margin-left:26px">${v(d.motivation.explicationsPostes)}</p></div>
<p class="st" style="margin-top:22px">Descriptions des principales actions prévues pour la période ${s.exercice - 1}/${exN} ou ${exN}</p>
${tablesActions(d.motivation.actions, true)}
</div>

<div class="page">${bandeau("4", "Ressources financières de l'association")}
<p class="q" style="margin-bottom:10px">Résultat et soldes de trésorerie :</p>
<table class="tresorerie"><tbody>
<tr><td class="lettre">A</td><td>Rappel du solde de trésorerie au début de l'exercice ${saisonN1} :</td><td class="somme">${eur(tr.soldeDebut) || "€"}</td></tr>
<tr><td class="lettre">B</td><td>Résultat de l'exercice ${saisonN1} :</td><td class="somme">${eur(tr.resultat) || "€"}</td></tr>
<tr><td class="lettre">C</td><td>Solde de trésorerie à la fin de l'exercice ${saisonN1} : <strong>A+B</strong></td><td class="somme">${eur(tr.soldeFin) || "€"}</td></tr>
</tbody></table>
<p class="q" style="margin-bottom:10px">Somme en banque :</p>
<table class="tresorerie"><tbody>
<tr><td class="lettre">D</td><td>Compte courant / chèque :</td><td class="somme">${eur(tr.compteCourant) || "€"}</td></tr>
<tr><td class="lettre">E</td><td>Compte épargne :</td><td class="somme">${eur(tr.epargne) || "€"}</td></tr>
<tr><td class="lettre">F</td><td>Caisse :</td><td class="somme">${eur(tr.caisse) || "€"}</td></tr>
<tr><td class="lettre">G</td><td>TOTAL EN BANQUE à la fin de l'exercice ${saisonN1} : <strong>D+E+F</strong></td><td class="somme"><strong>${eur(enBanque) || "€"}</strong></td></tr>
</tbody></table>
<p class="q" style="margin-bottom:10px">Rapprochement bancaire :</p>
<table class="tresorerie"><tbody>
<tr class="gris"><td colspan="3" class="g">Sommes enregistrées sur la situation trésorerie mais non tombées en banque :</td></tr>
<tr><td class="lettre">H</td><td>Recettes ${saisonN1} non encaissées :</td><td class="somme">${eur(tr.recettesNonEncaissees) || "€"}</td></tr>
<tr><td class="lettre">I</td><td>Dépenses ${saisonN1} non décaissées :</td><td class="somme">${eur(tr.depensesNonDecaissees) || "€"}</td></tr>
<tr class="gris"><td colspan="3" class="g">Sommes tombées en banque mais non enregistrées sur la situation de trésorerie :</td></tr>
<tr><td class="lettre">J</td><td>Montant des encaissements d'avance ${saisonN1} :</td><td class="somme">${eur(tr.encaissementsAvance) || "€"}</td></tr>
<tr><td class="lettre">K</td><td>Montant des décaissements d'avance ${saisonN1} :</td><td class="somme">${eur(tr.decaissementsAvance) || "€"}</td></tr>
<tr><td colspan="3"><strong>Nature :</strong> ${v(tr.natures)}</td></tr>
<tr><td class="lettre"></td><td><strong>Rapprochement du solde de trésorerie : G+H-I-J+K=C</strong></td><td class="somme">${eur(rapprochement) || "€"}</td></tr>
</tbody></table>
</div>

<div class="page">${bandeau("5", "Attestation sur l'honneur")}
<p class="justifie">Si le signataire n'est pas le représentant statutaire ou légal de l'association, joindre le pouvoir ou mandat (portant les deux signatures : celles du représentant légal et celle de la personne qui va le représenter) lui permettant d'engager celle-ci.</p>
<p style="margin-top:14px">Je soussigné·e <span class="i">(nom et prénom)</span> ${v(att.signataireNom)},<br>${att.mandataire ? "mandataire du" : ""} représentant·e légal·e de l'association ${v(org.name)}${att.signataireQualite ? ` (${v(att.signataireQualite)})` : ""}</p>
<p style="margin:14px 0 0"><strong>Déclare :</strong></p>
<ul class="puces justifie" style="margin-top:0">
<li>${coche(att.obligationsAJour)} que l'association est à jour de ses obligations administratives, comptables, sociales et fiscales (déclarations et paiements correspondants) ;</li>
<li>${coche(att.informationsSinceres)} exactes et sincères les informations du présent dossier, notamment la mention de l'ensemble des demandes de subventions introduites auprès d'autres financeurs publics ainsi que l'approbation du budget par les instances statutaires ;</li>
<li>que l'association a perçu un montant total cumulé d'aides publiques (subventions financières et en nature), sur les 3 derniers exercices (dont l'exercice en cours) :</li>
</ul>
<p style="margin-left:86px">${coche(att.cumulAides === "inf")} Inférieur ou égal à 500 000 €<br>${coche(att.cumulAides === "sup")} Supérieur à 500 000 €</p>
<p style="margin-top:14px"><strong>Demande une subvention de :</strong> ${eur(s.montantDemande)}</p>
<p style="margin-top:14px">Précise que cette subvention, si elle est accordée, devra être versée <strong>au compte bancaire de l'association</strong> :</p>
<div class="rib">${kindsFournis.includes("rib") ? `RIB / IBAN JOINT AU DOSSIER` : `JOINDRE UN RIB / IBAN`}</div>
<p>Fait le ${v(s.signeAt ? dateCourte(s.signeAt) : "")}, en ligne sur le portail des associations</p>
<p style="margin-top:14px">Signature : ${signature}</p>
<p style="margin:26px 0 0"><span class="souligne">Attention</span></p>
<p class="justifie">${p(MENTION_FAUSSE_DECLARATION)}<br>Le droit d'accès aux informations prévues par la loi n° 78-17 du 6 janvier 1978 relative à l'informatique, aux fichiers et aux libertés s'exerce auprès du service auprès duquel vous avez déposé votre dossier.</p>
<p class="note">Le montant total et cumulé d'aides publiques sur 3 ans ne conditionne pas l'attribution ou non d'une subvention. Cette attestation n'a pas d'autre objet que de permettre aux pouvoirs publics d'adapter le formalisme de leur éventuelle décision d'attribution.</p>
</div>

<div class="page">${bandeau("6", "Pièces à joindre à votre dossier")}
${groupesPieces
  .map(
    (g, i) =>
      `<p class="groupe-pieces">${g.titre}</p>${g.pieces.map((e) => `<p class="piece">${coche(e.fournie)} <strong>${p(e.piece.libelle)}</strong>${e.piece.aide ? ` <span class="petit">(${p(e.piece.aide.replace(/\.$/, ""))})</span>` : ""}</p>`).join("")}${i === 0 ? contratPiece : ""}`,
  )
  .join("")}
</div>

<div class="page">${bandeau("7", `Bilan des principales actions réalisées lors de la période ${s.exercice - 2}/${exN1} ou ${exN1}`)}
<p class="justifie"><strong>L'association a perçu de la commune de Châtillon une subvention de fonctionnement pour l'année ${saisonN1} de</strong> ${eur(d.bilan.subventionPrecedente) || "€"}</p>
<p style="margin-top:12px">Expliquez et justifiez le montant perçu (le cas échéant, justifiez de son évolution) :</p>
<p class="pre" style="margin:0 0 20px 26px">${v(d.bilan.justification)}</p>
${tablesActions(d.bilan.actions, false)}
<p class="note">${p(DELAI_BILAN)}</p>
</div>

<div class="page">${bandeau("8", "Compte de résultat")}
<p class="i petit" style="font-size:8.5pt">Dans le cas où l'exercice de l'association est différent de l'année civile, il vous appartient de préciser les dates de début et de fin d'exercice.</p>
<p style="font-size:11pt;font-weight:700">Exercice ${s.exercice - 2}/${exN1} ou ${exN1} &nbsp; Date de début : ${v(dateFr(d.bilan.exerciceDebut))} &nbsp; Date de fin : ${v(dateFr(d.bilan.exerciceFin))}</p>
${tableCompteResultat(plan, d)}
</div>

<div class="page">
<div class="boite" style="min-height:230px"><p><strong>Synthèse des rapports d'activités, de gestion et des résultats financiers de l'année écoulée</strong> (y incluant les explications des écarts entre le « Budget » et le « Réalisé ») <strong>:</strong></p>
<p class="pre" style="margin-left:26px">${v(d.bilan.synthese)}</p></div>
<div class="rgpd"><p class="t">Information concernant la collecte et le traitement des données à caractère personnel dans le cadre de la campagne de subvention ${exN} (${p(cfg.COLLECTIVITE_NOM)}), conformément au règlement européen n°2016/679/UE sur la protection des données personnelles du 27/04/2016 et à la loi « informatique et libertés » n°78-17 du 06/01/1978 modifiée</p>
${noticeDonnees(cfg, s.service)
  .map(
    (n) =>
      `<p>• <strong style="text-decoration:underline">${p(n.titre)}</strong> : ${p(n.texte)}</p>`,
  )
  .join("")}
<p>Ma responsabilité civile et pénale peut être engagée en cas de fausse déclaration.</p></div>
<div class="signatures">
<div><span class="souligne">${s.signeMandataire ? "Le mandataire" : "Le représentant légal"}</span><br><br>${signature}</div>
<div><span class="petit">CADRE RÉSERVÉ À L'ADMINISTRATION</span><br><br>Dossier ${v(s.numero)}<br>Reçu le ${v(s.recuAt ? dateHeure(s.recuAt) : "")}</div>
</div>
</div>

<div class="page">
${logo ? `<p class="centre"><img class="contrat-logo" src="${logo}" alt=""></p>` : ""}
<h2 class="contrat">CONTRAT D'ENGAGEMENT RÉPUBLICAIN<br>DES ASSOCIATIONS ET FONDATIONS BÉNÉFICIANT<br>DE SUBVENTIONS PUBLIQUES OU D'UN AGRÉMENT DE L'ÉTAT</h2>
<p class="justifie">L'Association ${v(org.name)}, ${org.rna ? `déclarée sous le numéro ${v(org.rna)}, ` : ""}dont le siège social est situé à ${v([org.address, [org.postalCode, org.city].filter(Boolean).join(" ")].filter(Boolean).join(", "))} et représentée par ${v(att.signataireNom)}${att.signataireQualite ? `, ${v(att.signataireQualite)}` : ""}, s'engage à respecter les termes de ce contrat d'engagement républicain.</p>
${CONTRAT_PREAMBULE.map((x) => `<p class="justifie" style="margin-top:10px">${p(x)}</p>`).join("")}
${CONTRAT_ENGAGEMENTS.map((e) => `<p class="engagement">${p(e.titre)}</p>${e.paragraphes.map((x) => `<p class="justifie">${p(x)}</p>`).join("")}`).join("")}
<p style="margin-top:22px">${coche(att.engagementRepublicain)} Contrat accepté par l'association ${v(org.name)}${s.signeAt ? `, signé électroniquement par ${v(s.signeNom)} le ${v(dateHeure(s.signeAt))}` : ""}.</p>
</div>
</body></html>`;
}
