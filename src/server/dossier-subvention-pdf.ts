/**
 * Le PDF du dossier de demande de subvention : reprend les fiches du formulaire de la Ville,
 * le cadre réservé à l'administration et les mentions de signature.
 */
import { SUBVENTION_NATURES, SUBVENTION_TYPES } from "@/lib/constantes";
import {
  type Action,
  type Contact,
  type DossierSubvention,
  type Effectifs,
  etatPieces,
  type Moyen,
  type SubventionPourManques,
} from "@/lib/dossier-subvention";
import { dateCourte, dateHeure, montant } from "@/lib/libelles";
import {
  ecartsBudgetRealise,
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
import { CSS_EDITION } from "@/server/pdf";

const p = (s: string | null | undefined) => escapeHtml(s ?? "");
const n = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString("fr-FR");
const eur = (v: number | null | undefined) => (v === null || v === undefined ? "—" : montant(v));
const oui = (b: boolean) => (b ? "Oui" : "Non");

const CSS_DOSSIER = `
.fiche { page-break-before: always; }
.fiche:first-of-type { page-break-before: auto; }
.cadre { border: 1.5px solid #333; padding: 8px 10px; margin: 8px 0 14px; }
.cadre .t { font-weight: 600; text-transform: uppercase; font-size: 9pt; letter-spacing: .04em; }
table.plan td.g { background: #f1f3f2; font-weight: 600; }
table.plan tr.total td { font-weight: 700; border-top: 1.5px solid #333; }
.deux { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.etiq { color: #555; font-size: 9pt; }
.val { white-space: pre-wrap; }
`;

function ligne(etiq: string, val: string): string {
  return `<tr><td class="etiq" style="width:42%">${etiq}</td><td class="val">${val || "—"}</td></tr>`;
}

function tableContact(titre: string, c: Contact): string {
  return `<h3>${titre}</h3><table><tbody>
${ligne("Nom et prénom", p(`${c.nom} ${c.prenom}`.trim()))}
${ligne("Adresse", p([c.adresse, [c.codePostal, c.commune].filter(Boolean).join(" ")].filter(Boolean).join(", ")))}
${ligne("Téléphone", p(c.telephone))}
${ligne("Courriel", p(c.courriel))}
</tbody></table>`;
}

function tableEffectifs(
  a: Effectifs,
  b: Effectifs,
  sportive: boolean,
  exA: string,
  exB: string,
): string {
  const r = (l: string, k: keyof Effectifs) =>
    `<tr><td>${l}</td><td class="num">${n(a[k])}</td><td class="num">${n(b[k])}</td></tr>`;
  return `<table><thead><tr><th>Adhérents</th><th class="num">${exA}</th><th class="num">${exB}</th></tr></thead><tbody>
${r("Total", "total")}${r("dont Châtillonnais", "chatillonnais")}${r("dont extérieurs", "exterieurs")}
${r("dont majeurs", "majeurs")}${r("dont mineurs", "mineurs")}${r("dont hommes", "hommes")}${r("dont femmes", "femmes")}
${sportive ? r("dont licenciés", "licencies") : ""}
</tbody></table>`;
}

function tableMoyens(titre: string, m: Moyen[]): string {
  if (!m.length) return "";
  return `<h3>${titre}</h3><table><thead><tr><th>Désignation</th><th class="num">Heures / an</th><th>Mis à disposition par</th></tr></thead><tbody>
${m.map((x) => `<tr><td>${p(x.designation)}</td><td class="num">${n(x.heures)}</td><td>${p(x.par)}</td></tr>`).join("")}
</tbody></table>`;
}

function tableActions(actions: Action[]): string {
  if (!actions.length) return `<p class="muted">Aucune action spécifique.</p>`;
  return actions
    .map(
      (a, i) => `<h3>Action ${i + 1} · ${p(a.intitule)}</h3><table><tbody>
${ligne("Descriptif", p(a.descriptif))}
${ligne("Date ou période", p(a.date))}
${ligne("Lieu", p(a.lieu))}
${ligne("Public visé", p(a.public))}
${ligne("Bénéficiaires", n(a.beneficiaires))}
${ligne("Coût", eur(a.cout))}
${ligne("Recettes attendues", p(a.recettes))}
</tbody></table>`,
    )
    .join("");
}

function tablePlan(
  titre: string,
  postes: readonly Poste[],
  montants: Montants,
  total: number,
): string {
  return `<table class="plan"><thead><tr><th>${titre}</th><th class="num">Montant</th></tr></thead><tbody>
${groupes(postes)
  .map(
    (g) =>
      `<tr><td class="g" colspan="2">${p(g.groupe)}</td></tr>${g.postes
        .filter((x) => montants[x.code])
        .map(
          (x) =>
            `<tr><td>${p(x.libelle)}</td><td class="num">${montant(montants[x.code])}</td></tr>`,
        )
        .join("")}`,
  )
  .join("")}
<tr class="total"><td>Total</td><td class="num">${montant(total)}</td></tr>
</tbody></table>`;
}

function tablePlanBudgetRealise(
  titre: string,
  postes: readonly Poste[],
  budget: Montants,
  realise: Montants,
): string {
  const ecarts = ecartsBudgetRealise(postes, budget, realise).filter((e) => e.budget || e.realise);
  const tb = ecarts.reduce((s, e) => s + e.budget, 0);
  const tr = ecarts.reduce((s, e) => s + e.realise, 0);
  const lib = new Map(postes.map((x) => [x.code, x.libelle]));
  return `<table class="plan"><thead><tr><th>${titre}</th><th class="num">Budget</th><th class="num">Réalisé</th><th class="num">Écart</th></tr></thead><tbody>
${ecarts.map((e) => `<tr><td>${p(lib.get(e.code))}</td><td class="num">${montant(e.budget)}</td><td class="num">${montant(e.realise)}</td><td class="num">${montant(e.ecart)}</td></tr>`).join("")}
<tr class="total"><td>Total</td><td class="num">${montant(tb)}</td><td class="num">${montant(tr)}</td><td class="num">${montant(tr - tb)}</td></tr>
</tbody></table>`;
}

function budgetHtml(plan: PlanBudget, d: DossierSubvention, montantDemande: number): string {
  const t = totaux(plan, { ...d.budget.charges, ...d.budget.produits, ...d.budget.contributions });
  const ratio = ratioDemande(montantDemande, t.produitsDirects);
  return `<p class="muted">Exercice du ${p(d.budget.exerciceDebut) || "—"} au ${p(d.budget.exerciceFin) || "—"}</p>
<div class="deux">${tablePlan("Charges", plan.charges, d.budget.charges, t.chargesDirectes)}${tablePlan("Produits", plan.produits, d.budget.produits, t.produitsDirects)}</div>
<div class="deux" style="margin-top:10px">${tablePlan("86 · Emplois des contributions volontaires", plan.contributionsCharges, d.budget.contributions, t.contributionsCharges)}${tablePlan("87 · Contributions volontaires en nature", plan.contributionsProduits, d.budget.contributions, t.contributionsProduits)}</div>
<table style="margin-top:10px"><tbody>
${ligne("Total des charges (avec contributions)", montant(t.charges))}
${ligne("Total des produits (avec contributions)", montant(t.produits))}
${ligne("Résultat prévisionnel", montant(t.resultat))}
${ligne("Subvention demandée à la Ville", montant(montantDemande))}
${ligne("Part de la subvention dans les produits", ratio === null ? "—" : `${ratio.toLocaleString("fr-FR")} %`)}
${ligne("Autres financeurs sollicités", p(d.budget.financeurs))}
</tbody></table>`;
}

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
  const pm: SubventionPourManques = {
    nature: s.nature === "premiere" ? "premiere" : "renouvellement",
    montantDemande: s.montantDemande,
    sportive,
    signeAt: s.signeAt,
    dossier: d,
  };
  const pieces = etatPieces(pm, kindsFournis);
  const part = d.rayonnement.participation;
  const signature = s.signeAt
    ? `<div class="signature"><strong>${s.signeMandataire ? "Le mandataire" : "Le représentant légal"}</strong><br><span class="cachet">Signé électroniquement</span><br><small>par ${p(s.signeNom)}, ${p(s.signeQualite)}, le ${dateHeure(s.signeAt)}${s.signeIp ? ` (IP ${p(s.signeIp)})` : ""}</small></div>`
    : `<div class="signature"><strong>Le représentant légal</strong><br><small class="muted">Signature électronique en attente</small></div>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS_EDITION}${CSS_DOSSIER}</style></head><body>
<div class="entete"><div>${cfg.COLLECTIVITE_LOGO ? `<img class="logo" src="${cfg.COLLECTIVITE_LOGO}" alt="">` : ""}<div class="coll">${p(cfg.COLLECTIVITE_NOM)}</div><div class="muted">${p(cfg.COLLECTIVITE_ADRESSE)}</div></div>
<div class="doc"><strong>Dossier de demande de subvention ${s.exercice}</strong><br>${sportive ? "Association sportive" : "Association"}<br>N° ${p(s.numero)}<br>Édité le ${dateCourte(new Date())}</div></div>
<h1>Demande de subvention ${s.exercice}</h1>
<p><strong>${p(org.name)}</strong>${d.presentation.sigle ? ` (${p(d.presentation.sigle)})` : ""} · ${SUBVENTION_NATURES[s.nature] ?? s.nature}${s.campagne ? ` · ${p(s.campagne.label)}` : ""}</p>
<div class="cadre"><div class="t">Cadre réservé à l'administration</div>
<div class="grille"><div><span class="etiq">Dossier reçu le</span><br>${s.recuAt ? dateHeure(s.recuAt) : "—"}</div><div><span class="etiq">Numéro</span><br>${p(s.numero)}</div><div><span class="etiq">Secteur</span><br>${p(s.secteur?.label) || "—"}</div><div><span class="etiq">Montant demandé</span><br>${montant(s.montantDemande)}</div></div></div>

<div class="fiche"><h2>Fiche 1 · Présentation de l'association</h2>
<table><tbody>
${ligne("Nom", p(org.name))}${ligne("Sigle", p(d.presentation.sigle))}
${ligne("Siège social", p([org.address, [org.postalCode, org.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")))}
${ligne("Téléphone / courriel", p([org.phone, org.email].filter(Boolean).join(" · ")))}
${ligne("Site internet", p(org.website))}
${ligne("N° SIRET", p(org.siret))}${ligne("N° RNA", p(org.rna))}
${ligne("Déclaration au Journal officiel", p(d.presentation.dateJo))}
${ligne("Fédération ou réseau d'affiliation", p(d.presentation.affiliation))}
${ligne("Adhérents personnes morales", d.presentation.adherentsPersonnesMorales ? `Oui : ${p(d.presentation.adherentsPersonnesMoralesLesquelles)}` : "Non")}
${ligne("Agréments", d.presentation.agrements.map((a) => p([a.type, a.par, a.date].filter(Boolean).join(" · "))).join("<br>"))}
${ligne("Label", p([d.presentation.labelNom, d.presentation.labelOrganisme].filter(Boolean).join(" · ")))}
${ligne("Reconnue d'utilité publique", d.presentation.utilitePublique ? `Oui (JO du ${p(d.presentation.utilitePubliqueDateJo)})` : "Non")}
${ligne("Commissaire aux comptes", oui(d.presentation.commissaireAuxComptes))}
${ligne("Changement de statuts ou de dirigeants depuis la dernière demande", oui(d.presentation.changementDepuisDerniereDemande))}
</tbody></table></div>

<div class="fiche"><h2>Fiche 2 · Composition du bureau</h2>
<div class="deux">${tableContact("Président(e)", d.bureau.president)}${tableContact("Trésorier(ère)", d.bureau.tresorier)}</div>
<div class="deux">${tableContact("Vice-président(e)", d.bureau.vicePresident)}${tableContact("Secrétaire", d.bureau.secretaire)}</div>
${d.bureau.autresMembres ? `<h3>Autres membres</h3><p class="val">${p(d.bureau.autresMembres)}</p>` : ""}
<h3>Personne chargée du dossier</h3><table><tbody>
${ligne("Nom", p(d.bureau.chargeDossier.nom))}${ligne("Fonction", p(d.bureau.chargeDossier.fonction))}
${ligne("Adresse", p(d.bureau.chargeDossier.adresse))}${ligne("Téléphone", p(d.bureau.chargeDossier.telephone))}${ligne("Courriel", p(d.bureau.chargeDossier.courriel))}
</tbody></table></div>

<div class="fiche"><h2>Fiche 3 · Ressources humaines et adhérents</h2>
<table><tbody>
${ligne("Bénévoles", n(d.effectifs.benevoles))}${ligne("Volontaires (service civique…)", n(d.effectifs.volontaires))}
${ligne("Salariés", n(d.effectifs.salaries))}${ligne("dont en équivalent temps plein travaillé", n(d.effectifs.etpt))}
${ligne("Adhérents (personnes physiques)", n(d.effectifs.adherents))}
</tbody></table>
${tableEffectifs(d.effectifs.exercicePrecedent, d.effectifs.previsionnel, sportive, `Exercice ${exN1}`, `Prévision ${exN}`)}
${d.effectifs.cotisations.length ? `<h3>Cotisations</h3><table><thead><tr><th>Catégorie</th><th class="num">Montant</th><th class="num">Nombre</th></tr></thead><tbody>${d.effectifs.cotisations.map((c) => `<tr><td>${p(c.libelle)}</td><td class="num">${eur(c.montant)}</td><td class="num">${n(c.nombre)}</td></tr>`).join("")}</tbody></table>` : ""}
</div>

<div class="fiche"><h2>Fiche 4 · Rayonnement et moyens</h2>
<h3>Orientations et actions vis-à-vis des publics</h3><p class="val">${p(d.rayonnement.orientations)}</p>
<h3>Participation à la vie locale</h3><table><tbody>
${ligne("Forum des associations", oui(part.forum))}${sportive ? ligne("Fête du sport", oui(part.feteDuSport)) : ""}${sportive ? ligne("Réunion des associations sportives", oui(part.reunionAssociationsSportives)) : ""}
${ligne("Actions de solidarité", p(part.solidarite))}${ligne("Inclusion", p(part.inclusion))}${ligne("Accueil du handicap", p(part.handicap))}
${ligne("Actions culturelles", p(part.culturel))}${ligne("Autres", p(part.autres))}
</tbody></table>
<h3>Moyens mis à disposition par la commune ou d'autres partenaires</h3>
${tableMoyens("Locaux", d.rayonnement.moyens.locaux)}${tableMoyens("Personnel", d.rayonnement.moyens.personnel)}${tableMoyens("Transport", d.rayonnement.moyens.transport)}${tableMoyens("Documents et communication", d.rayonnement.moyens.documents)}
${!d.rayonnement.moyens.locaux.length && !d.rayonnement.moyens.personnel.length && !d.rayonnement.moyens.transport.length && !d.rayonnement.moyens.documents.length ? `<p class="muted">Aucun.</p>` : ""}
</div>

<div class="fiche"><h2>Fiche 5 · Budget prévisionnel ${exN}</h2>
${budgetHtml(plan, d, s.montantDemande)}</div>

<div class="fiche"><h2>Fiche 6 · Demande et actions</h2>
<table><tbody>
${ligne("Objet de la demande", p(s.objet))}${ligne("Type", SUBVENTION_TYPES[s.type] ?? p(s.type))}
${ligne("Montant demandé", montant(s.montantDemande))}
</tbody></table>
<h3>Justification du montant demandé</h3><p class="val">${p(d.motivation.justification)}</p>
${d.motivation.explicationsPostes ? `<h3>Explications sur les postes du budget</h3><p class="val">${p(d.motivation.explicationsPostes)}</p>` : ""}
<h3>Actions spécifiques prévues</h3>${tableActions(d.motivation.actions)}
</div>

<div class="fiche"><h2>Fiche 7 · Trésorerie</h2>
<table><tbody>
${ligne("Solde de trésorerie au début de l'exercice", eur(d.tresorerie.soldeDebut))}${ligne("Résultat de l'exercice", eur(d.tresorerie.resultat))}
${ligne("Solde de trésorerie en fin d'exercice", eur(d.tresorerie.soldeFin))}
${ligne("Compte courant", eur(d.tresorerie.compteCourant))}${ligne("Épargne et placements", eur(d.tresorerie.epargne))}${ligne("Caisse", eur(d.tresorerie.caisse))}
${ligne("Recettes non encaissées", eur(d.tresorerie.recettesNonEncaissees))}${ligne("Dépenses non décaissées", eur(d.tresorerie.depensesNonDecaissees))}
${ligne("Encaissements d'avance", eur(d.tresorerie.encaissementsAvance))}${ligne("Décaissements d'avance", eur(d.tresorerie.decaissementsAvance))}
${ligne("Nature des placements et réserves", p(d.tresorerie.natures))}
</tbody></table></div>

<div class="fiche"><h2>Fiche 8 · Bilan de l'exercice ${exN1}</h2>
<table><tbody>
${ligne(`Subvention perçue en ${exN1}`, eur(d.bilan.subventionPrecedente))}
${ligne("Exercice", `${p(d.bilan.exerciceDebut) || "—"} → ${p(d.bilan.exerciceFin) || "—"}`)}
</tbody></table>
<h3>Justification de l'utilisation</h3><p class="val">${p(d.bilan.justification)}</p>
<h3>Actions réalisées</h3>${tableActions(d.bilan.actions)}
<h3>Compte de résultat</h3>
${tablePlanBudgetRealise("Charges", plan.charges, d.bilan.budget, d.bilan.realise)}
${tablePlanBudgetRealise("Produits", plan.produits, d.bilan.budget, d.bilan.realise)}
${tablePlanBudgetRealise("Contributions volontaires en nature", [...plan.contributionsCharges, ...plan.contributionsProduits], d.bilan.contributionsBudget, d.bilan.contributionsRealise)}
<h3>Synthèse des rapports moral, d'activité et financier</h3><p class="val">${p(d.bilan.synthese)}</p>
</div>

<div class="fiche"><h2>Pièces jointes</h2>
<table><thead><tr><th>Pièce</th><th>État</th></tr></thead><tbody>
${pieces.map((e) => `<tr><td>${p(e.piece.libelle)}</td><td>${e.fournie ? "Fournie" : "Manquante"}</td></tr>`).join("")}
</tbody></table>

<h2>Attestation sur l'honneur</h2>
<p>Je soussigné(e) <strong>${p(d.attestation.signataireNom) || "—"}</strong>, ${p(d.attestation.signataireQualite) || "représentant(e) légal(e)"} de l'association${d.attestation.mandataire ? ", dûment mandaté(e) par le représentant légal" : ""}, certifie :</p>
<ul>
<li>${d.attestation.obligationsAJour ? "☑" : "☐"} que l'association est à jour de ses obligations administratives, comptables, sociales et fiscales ;</li>
<li>${d.attestation.informationsSinceres ? "☑" : "☐"} l'exactitude et la sincérité des informations de la présente demande, notamment la mention de l'ensemble des demandes de subvention déposées auprès d'autres financeurs publics ;</li>
<li>${d.attestation.cumulAides ? "☑" : "☐"} que l'association ${d.attestation.cumulAides === "sup" ? "a perçu un montant total et cumulé d'aides publiques supérieur à 500 000 € sur les trois derniers exercices" : "n'a pas perçu un montant total et cumulé d'aides publiques supérieur à 500 000 € sur les trois derniers exercices"} ;</li>
<li>${d.attestation.engagementRepublicain ? "☑" : "☐"} avoir pris connaissance du contrat d'engagement républicain (décret n° 2021-1947 du 31 décembre 2021) et s'engager à le respecter.</li>
</ul>
<div class="signatures"><div class="signature"><strong>Cadre réservé</strong><br><small class="muted">Reçu le ${s.recuAt ? dateHeure(s.recuAt) : "—"}</small></div>${signature}</div>
</div>
<div class="pied">${p(cfg.COLLECTIVITE_NOM)} · Dossier de demande de subvention ${p(s.numero)} · CityRésa</div>
</body></html>`;
}
