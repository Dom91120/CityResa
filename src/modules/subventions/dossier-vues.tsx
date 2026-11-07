/**
 * Le dossier de demande de subvention à l'écran, fiche par fiche : navigation entre fiches,
 * formulaire de saisie de chaque fiche (noms de champs « a.b[0].c » dépliés côté serveur),
 * lecture seule, tableaux de budget par postes, carte de campagne, liste des manques.
 */

import { Lu, Lus } from "@/components/fiche";
import { Champ, Grille, Interrupteur, SectionForm, Select, Zone } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import type { CampagneSubvention } from "@/generated/prisma/client";
import { type EtatDepot, etatDepot } from "@/lib/campagne-subvention";
import { CAMPAGNE_SUBVENTION_STATUS, SUBVENTION_NATURES, SUBVENTION_TYPES } from "@/lib/constantes";
import {
  type Action,
  type Contact,
  type DossierSubvention,
  type Effectifs,
  FICHES,
  type FicheCle,
  type Manque,
  type Moyen,
} from "@/lib/dossier-subvention";
import { dateCourte, montant, pluriel } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import type { Piece } from "@/lib/pieces-subvention";
import {
  ecartsBudgetRealise,
  groupes,
  type Montants,
  type PlanBudget,
  type Poste,
  ratioDemande,
  totaux,
} from "@/lib/plan-budget";
import { refCampagne } from "@/server/campagnes-subvention";

// ── Campagne ──

export function ChipCampagne({ c }: { c: CampagneSubvention }) {
  const etat = etatDepot(refCampagne(c), todayParisISO());
  const LIB: Record<EtatDepot, [string, string]> = {
    ouvert: ["Dépôt ouvert", "emerald"],
    a_venir: ["Ouvre bientôt", "sky"],
    ferme: ["Dépôt clos", "amber"],
    inactive: [CAMPAGNE_SUBVENTION_STATUS[c.status]?.label ?? c.status, "slate"],
  };
  const [label, teinte] = LIB[etat];
  return <Chip teinte={teinte}>{label}</Chip>;
}

/** La carte de la campagne en cours (portail et back-office). */
export function CarteCampagne({
  c,
  depotOuvert,
  actions,
  compteurs,
}: {
  c: CampagneSubvention | null;
  depotOuvert: boolean;
  actions?: React.ReactNode;
  compteurs?: React.ReactNode;
}) {
  if (!c)
    return (
      <div className="data-card p-4 mb-3">
        <div className="d-flex align-items-center gap-2 mb-1">
          <Icone nom="calendar" taille={18} classes="text-muted" />
          <strong>Aucune campagne de subventions ouverte</strong>
        </div>
        <p className="text-muted small mb-0">
          Les dossiers se déposent pendant la campagne annuelle, en général du 1er octobre au 20
          novembre pour l'exercice suivant.
        </p>
        {actions ? <div className="mt-3 d-flex gap-2 flex-wrap">{actions}</div> : null}
      </div>
    );
  const etat = etatDepot(refCampagne(c), todayParisISO());
  return (
    <div className="data-card p-4 mb-3">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <Icone nom="calendar" taille={18} classes="text-muted" />
          <strong>{c.label}</strong>
          <ChipCampagne c={c} />
        </div>
        {compteurs}
      </div>
      <p className="text-muted small mb-0 mt-1">
        Dépôt des dossiers du {dateCourte(c.ouvertureDate)} au {dateCourte(c.clotureDate)} inclus.
        {etat === "ferme"
          ? " La campagne est close : un dossier déposé hors délai n'est pas instruit."
          : ""}
        {etat === "a_venir" ? " Le dépôt n'est pas encore ouvert." : ""}
        {depotOuvert ? " Un dossier incomplet ou déposé hors délai n'est pas instruit." : ""}
      </p>
      {c.consignes ? (
        <p className="small mb-0 mt-2" style={{ whiteSpace: "pre-wrap" }}>
          {c.consignes}
        </p>
      ) : null}
      {actions ? <div className="mt-3 d-flex gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
}

// ── Navigation entre fiches ──

export function NavFiches({
  base,
  courante,
  incompletes,
  lecture = false,
}: {
  base: string;
  courante: FicheCle | null;
  incompletes: Set<FicheCle>;
  lecture?: boolean;
}) {
  return (
    <nav className="fiches-nav" aria-label="Fiches du dossier">
      {FICHES.map((f, i) => {
        const manque = incompletes.has(f.cle);
        return (
          <a
            key={f.cle}
            href={`${base}/${f.cle}`}
            className={`fiche-onglet${courante === f.cle ? " active" : ""}${manque ? " manque" : lecture ? "" : " ok"}`}
            title={f.aide}
            aria-current={courante === f.cle ? "page" : undefined}
          >
            <span className="num">{i + 1}</span>
            <Icone nom={f.icone} taille={14} />
            <span className="lib">{f.titre}</span>
            {!lecture ? (
              <Icone nom={manque ? "circle-alert" : "circle-check"} taille={14} classes="etat" />
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}

export function ListeManques({ manques, base }: { manques: Manque[]; base: string }) {
  if (!manques.length)
    return (
      <div className="alert alert-success small mb-0">
        <Icone nom="circle-check" taille={14} /> Le dossier est complet : il peut être déposé.
      </div>
    );
  const parFiche = new Map<FicheCle, string[]>();
  for (const m of manques) parFiche.set(m.fiche, [...(parFiche.get(m.fiche) ?? []), m.libelle]);
  return (
    <div className="alert alert-warning small mb-0">
      <div className="fw-medium mb-1">
        <Icone nom="circle-alert" taille={14} />{" "}
        {pluriel(manques.length, "élément manquant", "éléments manquants")} avant le dépôt
      </div>
      <ul className="mb-0 ps-3">
        {[...parFiche.entries()].map(([fiche, libs]) => (
          <li key={fiche}>
            <a href={`${base}/${fiche}`}>{FICHES.find((f) => f.cle === fiche)?.titre}</a> :{" "}
            {libs.join(" · ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Saisie : briques ──

function Num({
  label,
  name,
  valeur,
  argent = false,
  aide,
  pleine,
}: {
  label: string;
  name: string;
  valeur: number | null;
  argent?: boolean;
  aide?: string;
  pleine?: boolean;
}) {
  return (
    <Champ
      label={argent ? `${label} (€)` : label}
      name={name}
      type="number"
      min={0}
      step={argent ? "0.01" : "1"}
      valeur={valeur ?? ""}
      aide={aide}
      pleine={pleine}
    />
  );
}

function ChampsContact({ prefixe, c }: { prefixe: string; c: Contact }) {
  return (
    <Grille colonnes={4}>
      <Champ label="Nom" name={`${prefixe}.nom`} valeur={c.nom} />
      <Champ label="Prénom" name={`${prefixe}.prenom`} valeur={c.prenom} />
      <Champ label="Téléphone" name={`${prefixe}.telephone`} valeur={c.telephone} type="tel" />
      <Champ label="Courriel" name={`${prefixe}.courriel`} valeur={c.courriel} type="email" />
      <Champ label="Adresse" name={`${prefixe}.adresse`} valeur={c.adresse} pleine />
      <Champ label="Code postal" name={`${prefixe}.codePostal`} valeur={c.codePostal} />
      <Champ label="Commune" name={`${prefixe}.commune`} valeur={c.commune} />
    </Grille>
  );
}

type Colonne = {
  cle: string;
  label: string;
  type?: "text" | "number" | "date" | "money";
  large?: boolean;
};

/** Une liste de lignes saisies dans un tableau : les existantes puis `vides` lignes vierges. */
function Lignes<T extends Record<string, unknown>>({
  prefixe,
  lignes,
  colonnes,
  vides = 2,
}: {
  prefixe: string;
  lignes: T[];
  colonnes: Colonne[];
  vides?: number;
}) {
  const total = lignes.length + vides;
  return (
    <div className="table-responsive">
      <table className="table table-sm table-saisie mb-0">
        <thead>
          <tr>
            {colonnes.map((c) => (
              <th
                key={c.cle}
                className={c.type === "number" || c.type === "money" ? "text-end" : undefined}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: total }, (_, i) => {
            const l = lignes[i];
            return (
              <tr key={`${prefixe}-${i}`}>
                {colonnes.map((c) => {
                  const v = l ? l[c.cle] : "";
                  const nombre = c.type === "number" || c.type === "money";
                  return (
                    <td key={c.cle} style={c.large ? { minWidth: 220 } : undefined}>
                      <input
                        type={nombre ? "number" : c.type === "date" ? "date" : "text"}
                        name={`${prefixe}[${i}].${c.cle}`}
                        className={`form-control form-control-sm${nombre ? " text-end" : ""}`}
                        defaultValue={v === null || v === undefined ? "" : String(v)}
                        step={c.type === "money" ? "0.01" : nombre ? "1" : undefined}
                        min={nombre ? 0 : undefined}
                        aria-label={`${c.label} ${i + 1}`}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Un plan de budget à saisir : un montant par poste, groupés. */
export function TableauPlanSaisie({
  titre,
  prefixe,
  postes,
  montants,
}: {
  titre: string;
  prefixe: string;
  postes: readonly Poste[];
  montants: Montants;
}) {
  return (
    <div className="table-responsive">
      <table className="table table-sm table-saisie table-plan mb-0">
        <thead>
          <tr>
            <th>{titre}</th>
            <th className="text-end" style={{ width: 140 }}>
              Montant (€)
            </th>
          </tr>
        </thead>
        <tbody>
          {groupes(postes).map((g) => (
            <Fragment key={g.groupe}>
              <tr className="groupe">
                <td colSpan={2}>{g.groupe}</td>
              </tr>
              {g.postes.map((x) => (
                <tr key={x.code}>
                  <td>{x.libelle}</td>
                  <td>
                    <input
                      type="number"
                      name={`${prefixe}.${x.code}`}
                      className="form-control form-control-sm text-end"
                      defaultValue={montants[x.code] ?? ""}
                      step="0.01"
                      min={0}
                      aria-label={x.libelle}
                    />
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Budget et réalisé côte à côte (compte de résultat N-1). */
export function TableauBudgetRealiseSaisie({
  titre,
  prefixeBudget,
  prefixeRealise,
  postes,
  budget,
  realise,
}: {
  titre: string;
  prefixeBudget: string;
  prefixeRealise: string;
  postes: readonly Poste[];
  budget: Montants;
  realise: Montants;
}) {
  return (
    <div className="table-responsive">
      <table className="table table-sm table-saisie table-plan mb-0">
        <thead>
          <tr>
            <th>{titre}</th>
            <th className="text-end" style={{ width: 130 }}>
              Budget (€)
            </th>
            <th className="text-end" style={{ width: 130 }}>
              Réalisé (€)
            </th>
          </tr>
        </thead>
        <tbody>
          {groupes(postes).map((g) => (
            <Fragment key={g.groupe}>
              <tr className="groupe">
                <td colSpan={3}>{g.groupe}</td>
              </tr>
              {g.postes.map((x) => (
                <tr key={x.code}>
                  <td>{x.libelle}</td>
                  <td>
                    <input
                      type="number"
                      name={`${prefixeBudget}.${x.code}`}
                      className="form-control form-control-sm text-end"
                      defaultValue={budget[x.code] ?? ""}
                      step="0.01"
                      min={0}
                      aria-label={`${x.libelle} · budget`}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      name={`${prefixeRealise}.${x.code}`}
                      className="form-control form-control-sm text-end"
                      defaultValue={realise[x.code] ?? ""}
                      step="0.01"
                      min={0}
                      aria-label={`${x.libelle} · réalisé`}
                    />
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { Fragment } from "react";

// ── Saisie : les fiches ──

export type ContexteFiche = {
  s: { nature: string; objet: string; type: string; montantDemande: number; exercice: number };
  d: DossierSubvention;
  sportive: boolean;
  plan: PlanBudget;
};

function FichePresentation({ s, d }: ContexteFiche) {
  const p = d.presentation;
  return (
    <>
      <SectionForm
        titre="Identification"
        icone="building-2"
        aide="Le nom, l'adresse, le SIRET et le RNA viennent de la fiche de l'organisation."
      >
        <Grille colonnes={3}>
          <Select
            label="Nature de la demande"
            name="nature"
            options={Object.entries(SUBVENTION_NATURES)}
            valeur={s.nature}
            requis
          />
          <Champ label="Sigle" name="sigle" valeur={p.sigle} />
          <Champ
            label="Déclaration au Journal officiel"
            name="dateJo"
            type="date"
            valeur={p.dateJo}
          />
          <Champ
            label="Fédération ou réseau d'affiliation"
            name="affiliation"
            valeur={p.affiliation}
            pleine
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <Interrupteur
              label="L'association compte des personnes morales parmi ses adhérents"
              name="adherentsPersonnesMorales"
              coche={p.adherentsPersonnesMorales}
            />
          </div>
          <Champ
            label="Lesquelles ?"
            name="adherentsPersonnesMoralesLesquelles"
            valeur={p.adherentsPersonnesMoralesLesquelles}
            pleine
          />
        </Grille>
      </SectionForm>
      <SectionForm titre="Agréments et label" icone="award">
        <Lignes
          prefixe="agrements"
          lignes={p.agrements}
          colonnes={[
            { cle: "type", label: "Type d'agrément", large: true },
            { cle: "par", label: "Attribué par", large: true },
            { cle: "date", label: "Date", type: "date" },
          ]}
        />
        <Grille colonnes={2}>
          <Champ label="Label" name="labelNom" valeur={p.labelNom} />
          <Champ
            label="Organisme ayant délivré le label"
            name="labelOrganisme"
            valeur={p.labelOrganisme}
          />
        </Grille>
      </SectionForm>
      <SectionForm titre="Situation" icone="scale">
        <Grille colonnes={2}>
          <div>
            <Interrupteur
              label="Reconnue d'utilité publique"
              name="utilitePublique"
              coche={p.utilitePublique}
            />
          </div>
          <Champ
            label="Date de publication au JO"
            name="utilitePubliqueDateJo"
            type="date"
            valeur={p.utilitePubliqueDateJo}
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <Interrupteur
              label="L'association dispose d'un commissaire aux comptes"
              name="commissaireAuxComptes"
              coche={p.commissaireAuxComptes}
              aide="Obligatoire au-delà de 153 000 € de dons ou de subventions par an : son rapport est alors à joindre."
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Interrupteur
              label="Les statuts ou la composition du conseil d'administration ont changé depuis la dernière demande"
              name="changementDepuisDerniereDemande"
              coche={p.changementDepuisDerniereDemande}
              aide="Les nouveaux statuts et la nouvelle composition sont alors à joindre."
            />
          </div>
        </Grille>
      </SectionForm>
    </>
  );
}

function FicheBureau({ d }: ContexteFiche) {
  const b = d.bureau;
  return (
    <>
      <SectionForm titre="Président(e)" icone="user-round">
        <ChampsContact prefixe="president" c={b.president} />
      </SectionForm>
      <SectionForm titre="Trésorier(ère)" icone="user-round">
        <ChampsContact prefixe="tresorier" c={b.tresorier} />
      </SectionForm>
      <SectionForm titre="Vice-président(e)" icone="user-round">
        <ChampsContact prefixe="vicePresident" c={b.vicePresident} />
      </SectionForm>
      <SectionForm titre="Secrétaire" icone="user-round">
        <ChampsContact prefixe="secretaire" c={b.secretaire} />
      </SectionForm>
      <SectionForm titre="Autres membres du bureau" icone="users">
        <Grille colonnes={2}>
          <Zone
            label="Nom, prénom et fonction"
            name="autresMembres"
            valeur={b.autresMembres}
            rows={3}
          />
        </Grille>
      </SectionForm>
      <SectionForm
        titre="Personne chargée du dossier"
        icone="contact-round"
        aide="La Ville s'adresse à elle pour toute question sur le dossier."
      >
        <Grille colonnes={3}>
          <Champ
            label="Nom et prénom"
            name="chargeDossier.nom"
            valeur={b.chargeDossier.nom}
            requis
          />
          <Champ label="Fonction" name="chargeDossier.fonction" valeur={b.chargeDossier.fonction} />
          <Champ
            label="Téléphone"
            name="chargeDossier.telephone"
            valeur={b.chargeDossier.telephone}
            type="tel"
          />
          <Champ
            label="Courriel"
            name="chargeDossier.courriel"
            valeur={b.chargeDossier.courriel}
            type="email"
          />
          <Champ
            label="Adresse"
            name="chargeDossier.adresse"
            valeur={b.chargeDossier.adresse}
            pleine
          />
        </Grille>
      </SectionForm>
    </>
  );
}

function ChampsEffectifs({
  prefixe,
  e,
  sportive,
}: {
  prefixe: string;
  e: Effectifs;
  sportive: boolean;
}) {
  return (
    <Grille colonnes={4}>
      <Num label="Total" name={`${prefixe}.total`} valeur={e.total} />
      <Num label="dont Châtillonnais" name={`${prefixe}.chatillonnais`} valeur={e.chatillonnais} />
      <Num label="dont extérieurs" name={`${prefixe}.exterieurs`} valeur={e.exterieurs} />
      {sportive ? (
        <Num label="dont licenciés" name={`${prefixe}.licencies`} valeur={e.licencies} />
      ) : (
        <div />
      )}
      <Num label="dont majeurs" name={`${prefixe}.majeurs`} valeur={e.majeurs} />
      <Num label="dont mineurs" name={`${prefixe}.mineurs`} valeur={e.mineurs} />
      <Num label="dont hommes" name={`${prefixe}.hommes`} valeur={e.hommes} />
      <Num label="dont femmes" name={`${prefixe}.femmes`} valeur={e.femmes} />
    </Grille>
  );
}

function FicheEffectifs({ s, d, sportive }: ContexteFiche) {
  const e = d.effectifs;
  return (
    <>
      <SectionForm titre="Ressources humaines" icone="users">
        <Grille colonnes={4}>
          <Num
            label="Bénévoles"
            name="benevoles"
            valeur={e.benevoles}
            aide="Membres actifs non rémunérés."
          />
          <Num
            label="Volontaires"
            name="volontaires"
            valeur={e.volontaires}
            aide="Service civique, volontariat associatif…"
          />
          <Num label="Salariés" name="salaries" valeur={e.salaries} />
          <Champ
            label="dont ETPT"
            name="etpt"
            type="number"
            step="0.1"
            min={0}
            valeur={e.etpt ?? ""}
            aide="Équivalents temps plein travaillé."
          />
          <Num label="Adhérents (personnes physiques)" name="adherents" valeur={e.adherents} />
        </Grille>
      </SectionForm>
      <SectionForm titre={`Adhérents de l'exercice ${s.exercice - 1}`} icone="contact-round">
        <ChampsEffectifs prefixe="exercicePrecedent" e={e.exercicePrecedent} sportive={sportive} />
      </SectionForm>
      <SectionForm titre={`Prévision ${s.exercice}`} icone="trending-up">
        <ChampsEffectifs prefixe="previsionnel" e={e.previsionnel} sportive={sportive} />
      </SectionForm>
      <SectionForm
        titre="Cotisations"
        icone="ticket"
        aide="Par catégorie d'adhérents (jeunes, adultes, familles, licence comprise…)."
      >
        <Lignes
          prefixe="cotisations"
          lignes={e.cotisations}
          colonnes={[
            { cle: "libelle", label: "Catégorie", large: true },
            { cle: "montant", label: "Montant (€)", type: "money" },
            { cle: "nombre", label: "Nombre d'adhérents", type: "number" },
          ]}
        />
      </SectionForm>
    </>
  );
}

function FicheRayonnement({ d, sportive }: ContexteFiche) {
  const r = d.rayonnement;
  const col: Colonne[] = [
    { cle: "designation", label: "Désignation", large: true },
    { cle: "heures", label: "Heures par an", type: "number" },
    { cle: "par", label: "Mis à disposition par", large: true },
  ];
  return (
    <>
      <SectionForm
        titre="Orientations"
        icone="compass"
        aide="Les actions et publics prioritaires de l'association."
      >
        <Grille colonnes={2}>
          <Zone
            label="Orientations et actions vis-à-vis des publics"
            name="orientations"
            valeur={r.orientations}
            rows={6}
            requis
          />
        </Grille>
      </SectionForm>
      <SectionForm titre="Participation à la vie locale" icone="map-pin">
        <Grille colonnes={2}>
          <div>
            <Interrupteur
              label="Forum des associations"
              name="participation.forum"
              coche={r.participation.forum}
            />
          </div>
          {sportive ? (
            <div>
              <Interrupteur
                label="Fête du sport"
                name="participation.feteDuSport"
                coche={r.participation.feteDuSport}
              />
            </div>
          ) : (
            <div />
          )}
          {sportive ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <Interrupteur
                label="Réunion des associations sportives"
                name="participation.reunionAssociationsSportives"
                coche={r.participation.reunionAssociationsSportives}
              />
            </div>
          ) : null}
          <Champ
            label="Actions de solidarité"
            name="participation.solidarite"
            valeur={r.participation.solidarite}
          />
          <Champ
            label="Inclusion"
            name="participation.inclusion"
            valeur={r.participation.inclusion}
          />
          <Champ
            label="Accueil du handicap"
            name="participation.handicap"
            valeur={r.participation.handicap}
          />
          <Champ
            label="Actions culturelles"
            name="participation.culturel"
            valeur={r.participation.culturel}
          />
          <Champ
            label="Autres"
            name="participation.autres"
            valeur={r.participation.autres}
            pleine
          />
        </Grille>
      </SectionForm>
      <SectionForm
        titre="Locaux mis à disposition"
        icone="door-open"
        aide="Pré-rempli d'après vos réservations d'espaces municipaux de l'an passé."
      >
        <Lignes prefixe="moyens.locaux" lignes={r.moyens.locaux} colonnes={col} />
      </SectionForm>
      <SectionForm titre="Personnel mis à disposition" icone="users">
        <Lignes prefixe="moyens.personnel" lignes={r.moyens.personnel} colonnes={col} vides={1} />
      </SectionForm>
      <SectionForm titre="Transport" icone="bus">
        <Lignes prefixe="moyens.transport" lignes={r.moyens.transport} colonnes={col} vides={1} />
      </SectionForm>
      <SectionForm titre="Documents et communication" icone="printer">
        <Lignes prefixe="moyens.documents" lignes={r.moyens.documents} colonnes={col} vides={1} />
      </SectionForm>
    </>
  );
}

function FicheBudget({ s, d, plan }: ContexteFiche) {
  const b = d.budget;
  return (
    <>
      <SectionForm titre={`Exercice ${s.exercice}`} icone="calendar">
        <Grille colonnes={2}>
          <Champ
            label="Début de l'exercice"
            name="exerciceDebut"
            type="date"
            valeur={b.exerciceDebut}
          />
          <Champ label="Fin de l'exercice" name="exerciceFin" type="date" valeur={b.exerciceFin} />
        </Grille>
      </SectionForm>
      <div className="grille grille-2 align-items-start">
        <SectionForm titre="Charges" icone="arrow-down-right">
          <TableauPlanSaisie
            titre="Postes de charges"
            prefixe="charges"
            postes={plan.charges}
            montants={b.charges}
          />
        </SectionForm>
        <SectionForm titre="Produits" icone="arrow-up-right">
          <TableauPlanSaisie
            titre="Postes de produits"
            prefixe="produits"
            postes={plan.produits}
            montants={b.produits}
          />
        </SectionForm>
      </div>
      <SectionForm
        titre="Contributions volontaires en nature"
        icone="handshake"
        aide="Bénévolat, prestations et dons en nature (86 / 87) : à l'équilibre."
      >
        <div className="grille grille-2 align-items-start">
          <TableauPlanSaisie
            titre="86 · Emplois"
            prefixe="contributions"
            postes={plan.contributionsCharges}
            montants={b.contributions}
          />
          <TableauPlanSaisie
            titre="87 · Ressources"
            prefixe="contributions"
            postes={plan.contributionsProduits}
            montants={b.contributions}
          />
        </div>
      </SectionForm>
      <SectionForm titre="Autres financeurs" icone="landmark">
        <Grille colonnes={2}>
          <Zone
            label="Autres financeurs publics sollicités (montants demandés)"
            name="financeurs"
            valeur={b.financeurs}
            rows={3}
          />
        </Grille>
      </SectionForm>
    </>
  );
}

const COLONNES_ACTION: Colonne[] = [
  { cle: "intitule", label: "Intitulé", large: true },
  { cle: "date", label: "Date / période" },
  { cle: "lieu", label: "Lieu" },
  { cle: "public", label: "Public visé" },
  { cle: "beneficiaires", label: "Bénéficiaires", type: "number" },
  { cle: "cout", label: "Coût (€)", type: "money" },
  { cle: "recettes", label: "Recettes attendues" },
];

function FicheMotivation({ s, d }: ContexteFiche) {
  const m = d.motivation;
  return (
    <>
      <SectionForm titre="Demande" icone="hand-coins">
        <Grille colonnes={3}>
          <Select
            label="Type"
            name="type"
            options={Object.entries(SUBVENTION_TYPES)}
            valeur={s.type}
            requis
          />
          <Champ
            label="Montant demandé"
            name="montant_demande"
            type="number"
            step="0.01"
            min={0}
            valeur={s.montantDemande || ""}
            requis
            aide="En euros."
          />
          <Champ
            label="Objet"
            name="objet"
            valeur={s.objet}
            requis
            placeholder="Fonctionnement général, tournoi annuel…"
          />
          <Zone
            label="Justification du montant demandé"
            name="justification"
            valeur={m.justification}
            rows={5}
            requis
          />
          <Zone
            label="Explications sur certains postes du budget"
            name="explicationsPostes"
            valeur={m.explicationsPostes}
            rows={4}
          />
        </Grille>
      </SectionForm>
      <SectionForm
        titre="Actions spécifiques prévues"
        icone="sparkles"
        aide="Pour une subvention d'action : une ligne par action, le projet financier détaillé est à joindre."
      >
        <Lignes prefixe="actions" lignes={m.actions} colonnes={COLONNES_ACTION} />
        {m.actions.length ? (
          <div className="mt-2">
            {m.actions.map((a, i) => (
              <Zone
                key={a.intitule}
                label={`Descriptif · ${a.intitule}`}
                name={`actions[${i}].descriptif`}
                valeur={a.descriptif}
                rows={2}
              />
            ))}
          </div>
        ) : null}
      </SectionForm>
    </>
  );
}

function FicheTresorerie({ d }: ContexteFiche) {
  const t = d.tresorerie;
  return (
    <>
      <SectionForm titre="Trésorerie" icone="piggy-bank">
        <Grille colonnes={3}>
          <Num
            label="Solde au début de l'exercice"
            name="soldeDebut"
            valeur={t.soldeDebut}
            argent
          />
          <Num label="Résultat de l'exercice" name="resultat" valeur={t.resultat} argent />
          <Num label="Solde en fin d'exercice" name="soldeFin" valeur={t.soldeFin} argent />
          <Num label="Compte courant" name="compteCourant" valeur={t.compteCourant} argent />
          <Num label="Épargne et placements" name="epargne" valeur={t.epargne} argent />
          <Num label="Caisse" name="caisse" valeur={t.caisse} argent />
        </Grille>
      </SectionForm>
      <SectionForm titre="Rapprochement" icone="scale">
        <Grille colonnes={4}>
          <Num
            label="Recettes non encaissées"
            name="recettesNonEncaissees"
            valeur={t.recettesNonEncaissees}
            argent
          />
          <Num
            label="Dépenses non décaissées"
            name="depensesNonDecaissees"
            valeur={t.depensesNonDecaissees}
            argent
          />
          <Num
            label="Encaissements d'avance"
            name="encaissementsAvance"
            valeur={t.encaissementsAvance}
            argent
          />
          <Num
            label="Décaissements d'avance"
            name="decaissementsAvance"
            valeur={t.decaissementsAvance}
            argent
          />
        </Grille>
        <Grille colonnes={2}>
          <Zone
            label="Nature des placements et réserves"
            name="natures"
            valeur={t.natures}
            rows={3}
          />
        </Grille>
      </SectionForm>
    </>
  );
}

function FicheBilan({ s, d, plan }: ContexteFiche) {
  const b = d.bilan;
  return (
    <>
      <SectionForm titre={`Subvention ${s.exercice - 1}`} icone="banknote">
        <Grille colonnes={3}>
          <Num
            label={`Subvention perçue en ${s.exercice - 1}`}
            name="subventionPrecedente"
            valeur={b.subventionPrecedente}
            argent
          />
          <Champ
            label="Début de l'exercice"
            name="exerciceDebut"
            type="date"
            valeur={b.exerciceDebut}
          />
          <Champ label="Fin de l'exercice" name="exerciceFin" type="date" valeur={b.exerciceFin} />
          <Zone
            label="Justification de l'utilisation de la subvention"
            name="justification"
            valeur={b.justification}
            rows={4}
          />
        </Grille>
      </SectionForm>
      <SectionForm titre="Actions réalisées" icone="sparkles">
        <Lignes prefixe="actions" lignes={b.actions} colonnes={COLONNES_ACTION} />
      </SectionForm>
      <div className="grille grille-2 align-items-start">
        <SectionForm titre="Compte de résultat · charges" icone="arrow-down-right">
          <TableauBudgetRealiseSaisie
            titre="Postes"
            prefixeBudget="budget"
            prefixeRealise="realise"
            postes={plan.charges}
            budget={b.budget}
            realise={b.realise}
          />
        </SectionForm>
        <SectionForm titre="Compte de résultat · produits" icone="arrow-up-right">
          <TableauBudgetRealiseSaisie
            titre="Postes"
            prefixeBudget="budget"
            prefixeRealise="realise"
            postes={plan.produits}
            budget={b.budget}
            realise={b.realise}
          />
        </SectionForm>
      </div>
      <SectionForm titre="Contributions volontaires en nature" icone="handshake">
        <TableauBudgetRealiseSaisie
          titre="86 / 87"
          prefixeBudget="contributionsBudget"
          prefixeRealise="contributionsRealise"
          postes={[...plan.contributionsCharges, ...plan.contributionsProduits]}
          budget={b.contributionsBudget}
          realise={b.contributionsRealise}
        />
      </SectionForm>
      <SectionForm
        titre="Synthèse"
        icone="file-text"
        aide="Rapports moral, d'activité et financier présentés en assemblée générale."
      >
        <Grille colonnes={2}>
          <Zone
            label="Synthèse de l'année écoulée"
            name="synthese"
            valeur={b.synthese}
            rows={6}
            requis
          />
        </Grille>
      </SectionForm>
    </>
  );
}

function FicheAttestation({ d }: ContexteFiche) {
  const a = d.attestation;
  return (
    <>
      <SectionForm titre="Attestation sur l'honneur" icone="scale">
        <div className="d-flex flex-column gap-2">
          <Interrupteur
            label="L'association est à jour de ses obligations administratives, comptables, sociales et fiscales (déclarations et paiements)."
            name="obligationsAJour"
            coche={a.obligationsAJour}
          />
          <Interrupteur
            label="Les informations de ce dossier sont exactes et sincères, y compris l'ensemble des demandes de subvention déposées auprès d'autres financeurs publics."
            name="informationsSinceres"
            coche={a.informationsSinceres}
          />
          <fieldset className="mt-1">
            <legend className="form-label">
              Aides publiques perçues sur les trois derniers exercices
            </legend>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="cumulAides"
                id="cumul-inf"
                value="inf"
                defaultChecked={a.cumulAides === "inf"}
              />
              <label className="form-check-label" htmlFor="cumul-inf">
                L'association n'a pas perçu un montant total et cumulé d'aides publiques supérieur à
                500 000 €.
              </label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="cumulAides"
                id="cumul-sup"
                value="sup"
                defaultChecked={a.cumulAides === "sup"}
              />
              <label className="form-check-label" htmlFor="cumul-sup">
                L'association a perçu un montant total et cumulé d'aides publiques supérieur à 500
                000 €.
              </label>
            </div>
          </fieldset>
        </div>
      </SectionForm>
      <SectionForm
        titre="Contrat d'engagement républicain"
        icone="landmark"
        aide="Décret n° 2021-1947 du 31 décembre 2021 : toute association qui sollicite une subvention s'engage à respecter les principes de liberté, d'égalité, de fraternité et de dignité de la personne humaine, ainsi que les symboles de la République."
      >
        <Interrupteur
          label="J'ai pris connaissance du contrat d'engagement républicain et l'association s'engage à le respecter."
          name="engagementRepublicain"
          coche={a.engagementRepublicain}
        />
      </SectionForm>
      <SectionForm titre="Signataire" icone="pen-line">
        <Grille colonnes={2}>
          <Champ
            label="Nom et prénom du signataire"
            name="signataireNom"
            valeur={a.signataireNom}
            requis
          />
          <Champ
            label="Qualité"
            name="signataireQualite"
            valeur={a.signataireQualite}
            placeholder="Président(e), trésorier(ère)…"
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <Interrupteur
              label="Je signe en tant que mandataire du représentant légal"
              name="mandataire"
              coche={a.mandataire}
              aide="Le pouvoir portant les deux signatures est alors à joindre aux pièces."
            />
          </div>
        </Grille>
      </SectionForm>
    </>
  );
}

const FORMULAIRES: Record<Exclude<FicheCle, "pieces">, (c: ContexteFiche) => React.ReactNode> = {
  presentation: FichePresentation,
  bureau: FicheBureau,
  effectifs: FicheEffectifs,
  rayonnement: FicheRayonnement,
  budget: FicheBudget,
  motivation: FicheMotivation,
  tresorerie: FicheTresorerie,
  bilan: FicheBilan,
  attestation: FicheAttestation,
};

/** Le formulaire d'une fiche : enregistrer, ou enregistrer et passer à la suivante. */
export function FormFiche({
  cle,
  ctx,
  action,
  csrf,
  retour,
  suivante,
}: {
  cle: Exclude<FicheCle, "pieces">;
  ctx: ContexteFiche;
  action: string;
  csrf: string;
  retour: string;
  suivante: FicheCle | null;
}) {
  const Corps = FORMULAIRES[cle];
  return (
    <form method="POST" action={action} id="form-principal" className="form-seul" data-double-envoi>
      <input type="hidden" name="csrf_token" value={csrf} />
      <Corps {...ctx} />
      <div className="form-pied">
        <a href={retour} className="btn btn-outline-secondary">
          Retour au dossier
        </a>
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-outline-primary" name="suite" value="">
            <Icone nom="check" taille={14} /> Enregistrer
          </button>
          {suivante ? (
            <button type="submit" className="btn btn-primary" name="suite" value={suivante}>
              <Icone nom="arrow-right" taille={14} /> Enregistrer et continuer
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

// ── Lecture ──

function LuContact({ label, c }: { label: string; c: Contact }) {
  const nom = `${c.nom} ${c.prenom}`.trim();
  if (!nom) return <Lu label={label} valeur={null} tiret />;
  return (
    <Lu
      label={label}
      valeur={
        <span className="cell2" style={{ whiteSpace: "normal" }}>
          <span>{nom}</span>
          <small>
            {[
              c.telephone,
              c.courriel,
              [c.adresse, c.codePostal, c.commune].filter(Boolean).join(" "),
            ]
              .filter(Boolean)
              .join(" · ")}
          </small>
        </span>
      }
    />
  );
}

function num(v: number | null): string | null {
  return v === null ? null : v.toLocaleString("fr-FR");
}
function eur(v: number | null): string | null {
  return v === null ? null : montant(v);
}
const oui = (b: boolean) => (b ? "Oui" : "Non");

function LuEffectifs({ titre, e, sportive }: { titre: string; e: Effectifs; sportive: boolean }) {
  return (
    <Lu
      label={titre}
      valeur={
        e.total === null
          ? null
          : `${num(e.total)} adhérents${e.chatillonnais !== null ? ` · ${num(e.chatillonnais)} Châtillonnais` : ""}${e.exterieurs !== null ? ` · ${num(e.exterieurs)} extérieurs` : ""}${e.mineurs !== null ? ` · ${num(e.mineurs)} mineurs` : ""}${e.femmes !== null ? ` · ${num(e.femmes)} femmes` : ""}${sportive && e.licencies !== null ? ` · ${num(e.licencies)} licenciés` : ""}`
      }
      pleine
    />
  );
}

function TableMoyens({ titre, m }: { titre: string; m: Moyen[] }) {
  if (!m.length) return null;
  return (
    <Lu
      label={titre}
      valeur={
        <ul className="mb-0 ps-3">
          {m.map((x) => (
            <li key={`${x.designation}-${x.par}`}>
              {x.designation}
              {x.heures !== null ? ` · ${num(x.heures)} h/an` : ""}
              {x.par ? ` · par ${x.par}` : ""}
            </li>
          ))}
        </ul>
      }
      pleine
    />
  );
}

function TableActions({ actions }: { actions: Action[] }) {
  if (!actions.length) return <p className="text-muted small mb-0">Aucune action spécifique.</p>;
  return (
    <div className="table-responsive">
      <table className="table table-sm mb-0">
        <thead>
          <tr>
            <th>Action</th>
            <th>Date / lieu</th>
            <th>Public</th>
            <th className="text-end">Bénéficiaires</th>
            <th className="text-end">Coût</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={a.intitule}>
              <td>
                <span className="cell2" style={{ whiteSpace: "normal" }}>
                  <span>{a.intitule}</span>
                  {a.descriptif ? <small>{a.descriptif}</small> : null}
                </span>
              </td>
              <td>{[a.date, a.lieu].filter(Boolean).join(" · ") || "—"}</td>
              <td>{a.public || "—"}</td>
              <td className="text-end">{num(a.beneficiaires) ?? "—"}</td>
              <td className="text-end">{eur(a.cout) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Un plan en lecture : seuls les postes renseignés, totaux. */
export function TableauPlanLecture({
  titre,
  postes,
  montants,
}: {
  titre: string;
  postes: readonly Poste[];
  montants: Montants;
}) {
  const total = postes.reduce((s, x) => s + (montants[x.code] ?? 0), 0);
  return (
    <table className="table table-sm table-plan mb-0">
      <thead>
        <tr>
          <th>{titre}</th>
          <th className="text-end">Montant</th>
        </tr>
      </thead>
      <tbody>
        {groupes(postes).map((g) => {
          const lignes = g.postes.filter((x) => montants[x.code]);
          if (!lignes.length) return null;
          return (
            <Fragment key={g.groupe}>
              <tr className="groupe">
                <td colSpan={2}>{g.groupe}</td>
              </tr>
              {lignes.map((x) => (
                <tr key={x.code}>
                  <td>{x.libelle}</td>
                  <td className="text-end tabular">{montant(montants[x.code])}</td>
                </tr>
              ))}
            </Fragment>
          );
        })}
        <tr className="total">
          <td>Total</td>
          <td className="text-end tabular">{montant(Math.round(total * 100) / 100)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function TableauBudgetRealiseLecture({
  titre,
  postes,
  budget,
  realise,
}: {
  titre: string;
  postes: readonly Poste[];
  budget: Montants;
  realise: Montants;
}) {
  const ecarts = ecartsBudgetRealise(postes, budget, realise).filter((e) => e.budget || e.realise);
  const lib = new Map(postes.map((x) => [x.code, x.libelle]));
  const tb = ecarts.reduce((s, e) => s + e.budget, 0);
  const tr = ecarts.reduce((s, e) => s + e.realise, 0);
  return (
    <table className="table table-sm table-plan mb-0">
      <thead>
        <tr>
          <th>{titre}</th>
          <th className="text-end">Budget</th>
          <th className="text-end">Réalisé</th>
          <th className="text-end">Écart</th>
        </tr>
      </thead>
      <tbody>
        {ecarts.map((e) => (
          <tr key={e.code}>
            <td>{lib.get(e.code)}</td>
            <td className="text-end tabular">{montant(e.budget)}</td>
            <td className="text-end tabular">{montant(e.realise)}</td>
            <td className={`text-end tabular${e.ecart < 0 ? " text-danger" : ""}`}>
              {montant(e.ecart)}
            </td>
          </tr>
        ))}
        <tr className="total">
          <td>Total</td>
          <td className="text-end tabular">{montant(tb)}</td>
          <td className="text-end tabular">{montant(tr)}</td>
          <td className="text-end tabular">{montant(Math.round((tr - tb) * 100) / 100)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/** Une fiche en lecture seule (back-office, dossier déposé). */
export function LectureFiche({
  cle,
  ctx,
  org,
}: {
  cle: Exclude<FicheCle, "pieces">;
  ctx: ContexteFiche;
  org: {
    name: string;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    siret: string | null;
    rna: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
  };
}) {
  const { s, d, sportive, plan } = ctx;
  switch (cle) {
    case "presentation": {
      const p = d.presentation;
      return (
        <Lus>
          <Lu label="Nature" valeur={SUBVENTION_NATURES[s.nature] ?? s.nature} />
          <Lu label="Nom" valeur={`${org.name}${p.sigle ? ` (${p.sigle})` : ""}`} />
          <Lu
            label="Siège"
            valeur={[org.address, [org.postalCode, org.city].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(", ")}
          />
          <Lu
            label="Contact"
            valeur={[org.phone, org.email, org.website].filter(Boolean).join(" · ")}
          />
          <Lu label="SIRET / RNA" valeur={[org.siret, org.rna].filter(Boolean).join(" / ")} />
          <Lu
            label="Déclaration au JO"
            valeur={p.dateJo ? dateCourte(new Date(`${p.dateJo}T00:00:00Z`)) : null}
          />
          <Lu label="Affiliation" valeur={p.affiliation} />
          <Lu
            label="Personnes morales adhérentes"
            valeur={
              p.adherentsPersonnesMorales ? `Oui · ${p.adherentsPersonnesMoralesLesquelles}` : "Non"
            }
          />
          <Lu
            label="Agréments"
            valeur={
              p.agrements.length
                ? p.agrements
                    .map((a) => [a.type, a.par, a.date].filter(Boolean).join(" · "))
                    .join(" ; ")
                : null
            }
            pleine
          />
          <Lu label="Label" valeur={[p.labelNom, p.labelOrganisme].filter(Boolean).join(" · ")} />
          <Lu
            label="Utilité publique"
            valeur={
              p.utilitePublique
                ? `Oui${p.utilitePubliqueDateJo ? ` (JO du ${p.utilitePubliqueDateJo})` : ""}`
                : "Non"
            }
          />
          <Lu label="Commissaire aux comptes" valeur={oui(p.commissaireAuxComptes)} />
          <Lu
            label="Changement depuis la dernière demande"
            valeur={oui(p.changementDepuisDerniereDemande)}
          />
        </Lus>
      );
    }
    case "bureau": {
      const b = d.bureau;
      return (
        <Lus>
          <LuContact label="Président(e)" c={b.president} />
          <LuContact label="Trésorier(ère)" c={b.tresorier} />
          <LuContact label="Vice-président(e)" c={b.vicePresident} />
          <LuContact label="Secrétaire" c={b.secretaire} />
          <Lu label="Autres membres" valeur={b.autresMembres} pleine pre />
          <Lu
            label="Chargé(e) du dossier"
            valeur={
              b.chargeDossier.nom
                ? `${b.chargeDossier.nom}${b.chargeDossier.fonction ? `, ${b.chargeDossier.fonction}` : ""} · ${[b.chargeDossier.telephone, b.chargeDossier.courriel].filter(Boolean).join(" · ")}`
                : null
            }
            pleine
          />
        </Lus>
      );
    }
    case "effectifs": {
      const e = d.effectifs;
      return (
        <Lus>
          <Lu label="Bénévoles" valeur={num(e.benevoles)} />
          <Lu label="Volontaires" valeur={num(e.volontaires)} />
          <Lu
            label="Salariés"
            valeur={
              e.salaries === null
                ? null
                : `${num(e.salaries)}${e.etpt !== null ? ` (${num(e.etpt)} ETPT)` : ""}`
            }
          />
          <Lu label="Adhérents" valeur={num(e.adherents)} />
          <LuEffectifs
            titre={`Exercice ${s.exercice - 1}`}
            e={e.exercicePrecedent}
            sportive={sportive}
          />
          <LuEffectifs titre={`Prévision ${s.exercice}`} e={e.previsionnel} sportive={sportive} />
          <Lu
            label="Cotisations"
            valeur={
              e.cotisations.length
                ? e.cotisations
                    .map(
                      (c) =>
                        `${c.libelle}${c.montant !== null ? ` : ${montant(c.montant)}` : ""}${c.nombre !== null ? ` (${num(c.nombre)})` : ""}`,
                    )
                    .join(" · ")
                : null
            }
            pleine
          />
        </Lus>
      );
    }
    case "rayonnement": {
      const r = d.rayonnement;
      const pa = r.participation;
      const vie = [
        pa.forum ? "Forum des associations" : null,
        pa.feteDuSport ? "Fête du sport" : null,
        pa.reunionAssociationsSportives ? "Réunion des associations sportives" : null,
      ].filter(Boolean);
      return (
        <Lus>
          <Lu label="Orientations" valeur={r.orientations} pleine pre />
          <Lu label="Vie locale" valeur={vie.length ? vie.join(" · ") : null} pleine />
          <Lu label="Solidarité" valeur={pa.solidarite} />
          <Lu label="Inclusion" valeur={pa.inclusion} />
          <Lu label="Handicap" valeur={pa.handicap} />
          <Lu label="Culture" valeur={pa.culturel} />
          <Lu label="Autres" valeur={pa.autres} pleine />
          <TableMoyens titre="Locaux" m={r.moyens.locaux} />
          <TableMoyens titre="Personnel" m={r.moyens.personnel} />
          <TableMoyens titre="Transport" m={r.moyens.transport} />
          <TableMoyens titre="Documents" m={r.moyens.documents} />
        </Lus>
      );
    }
    case "budget": {
      const b = d.budget;
      const t = totaux(plan, { ...b.charges, ...b.produits, ...b.contributions });
      const ratio = ratioDemande(s.montantDemande, t.produitsDirects);
      return (
        <>
          <Lus>
            <Lu
              label="Exercice"
              valeur={
                b.exerciceDebut || b.exerciceFin
                  ? `${b.exerciceDebut || "…"} → ${b.exerciceFin || "…"}`
                  : null
              }
            />
            <Lu label="Résultat prévisionnel" valeur={montant(t.resultat)} />
            <Lu
              label="Part de la subvention"
              valeur={ratio === null ? null : `${ratio.toLocaleString("fr-FR")} % des produits`}
            />
            <Lu label="Autres financeurs" valeur={b.financeurs} pleine pre />
          </Lus>
          <div className="grille grille-2 align-items-start mt-2">
            <TableauPlanLecture titre="Charges" postes={plan.charges} montants={b.charges} />
            <TableauPlanLecture titre="Produits" postes={plan.produits} montants={b.produits} />
          </div>
          {t.contributionsCharges || t.contributionsProduits ? (
            <div className="grille grille-2 align-items-start mt-2">
              <TableauPlanLecture
                titre="86 · Emplois des contributions"
                postes={plan.contributionsCharges}
                montants={b.contributions}
              />
              <TableauPlanLecture
                titre="87 · Contributions en nature"
                postes={plan.contributionsProduits}
                montants={b.contributions}
              />
            </div>
          ) : null}
        </>
      );
    }
    case "motivation": {
      const m = d.motivation;
      return (
        <>
          <Lus>
            <Lu label="Objet" valeur={s.objet} />
            <Lu label="Type" valeur={SUBVENTION_TYPES[s.type] ?? s.type} />
            <Lu label="Montant demandé" valeur={<strong>{montant(s.montantDemande)}</strong>} />
            <Lu label="Justification" valeur={m.justification} pleine pre />
            <Lu label="Explications sur les postes" valeur={m.explicationsPostes} pleine pre />
          </Lus>
          <div className="mt-2">
            <TableActions actions={m.actions} />
          </div>
        </>
      );
    }
    case "tresorerie": {
      const t = d.tresorerie;
      return (
        <Lus>
          <Lu label="Solde début d'exercice" valeur={eur(t.soldeDebut)} />
          <Lu label="Résultat" valeur={eur(t.resultat)} />
          <Lu label="Solde fin d'exercice" valeur={eur(t.soldeFin)} />
          <Lu label="Compte courant" valeur={eur(t.compteCourant)} />
          <Lu label="Épargne" valeur={eur(t.epargne)} />
          <Lu label="Caisse" valeur={eur(t.caisse)} />
          <Lu label="Recettes non encaissées" valeur={eur(t.recettesNonEncaissees)} />
          <Lu label="Dépenses non décaissées" valeur={eur(t.depensesNonDecaissees)} />
          <Lu label="Encaissements d'avance" valeur={eur(t.encaissementsAvance)} />
          <Lu label="Décaissements d'avance" valeur={eur(t.decaissementsAvance)} />
          <Lu label="Placements et réserves" valeur={t.natures} pleine pre />
        </Lus>
      );
    }
    case "bilan": {
      const b = d.bilan;
      return (
        <>
          <Lus>
            <Lu
              label={`Subvention perçue en ${s.exercice - 1}`}
              valeur={eur(b.subventionPrecedente)}
            />
            <Lu
              label="Exercice"
              valeur={
                b.exerciceDebut || b.exerciceFin
                  ? `${b.exerciceDebut || "…"} → ${b.exerciceFin || "…"}`
                  : null
              }
            />
            <Lu label="Utilisation de la subvention" valeur={b.justification} pleine pre />
          </Lus>
          <div className="mt-2">
            <TableActions actions={b.actions} />
          </div>
          <div className="grille grille-2 align-items-start mt-2">
            <TableauBudgetRealiseLecture
              titre="Charges"
              postes={plan.charges}
              budget={b.budget}
              realise={b.realise}
            />
            <TableauBudgetRealiseLecture
              titre="Produits"
              postes={plan.produits}
              budget={b.budget}
              realise={b.realise}
            />
          </div>
          <Lus>
            <Lu label="Synthèse" valeur={b.synthese} pleine pre />
          </Lus>
        </>
      );
    }
    case "attestation": {
      const a = d.attestation;
      return (
        <Lus>
          <Lu label="Obligations à jour" valeur={oui(a.obligationsAJour)} />
          <Lu label="Informations sincères" valeur={oui(a.informationsSinceres)} />
          <Lu
            label="Aides publiques (3 exercices)"
            valeur={
              a.cumulAides === "sup"
                ? "Plus de 500 000 €"
                : a.cumulAides === "inf"
                  ? "500 000 € au plus"
                  : null
            }
          />
          <Lu label="Engagement républicain" valeur={oui(a.engagementRepublicain)} />
          <Lu
            label="Signataire"
            valeur={
              a.signataireNom
                ? `${a.signataireNom}${a.signataireQualite ? `, ${a.signataireQualite}` : ""}${a.mandataire ? " (mandataire)" : ""}`
                : null
            }
          />
        </Lus>
      );
    }
  }
}

/** La liste des pièces attendues et leur état. */
export function EtatPiecesListe({ etats }: { etats: { piece: Piece; fournie: boolean }[] }) {
  return (
    <ul className="liste-simple mb-0" style={{ margin: "0 -18px" }}>
      {etats.map(({ piece, fournie }) => (
        <li key={piece.kind}>
          <Icone
            nom={fournie ? "circle-check" : "circle-alert"}
            taille={16}
            classes={fournie ? "text-success" : "text-warning"}
          />
          <span className="cell2" style={{ flex: 1, whiteSpace: "normal" }}>
            <span>{piece.libelle}</span>
            {piece.aide ? <small>{piece.aide}</small> : null}
          </span>
          <Chip teinte={fournie ? "emerald" : "amber"}>{fournie ? "Fournie" : "Manquante"}</Chip>
        </li>
      ))}
    </ul>
  );
}
