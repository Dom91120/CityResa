import { notFound } from "next/navigation";
import { FormDocument, ListeDocuments } from "@/components/documents";
import {
  BoutonOuvrir,
  Entete,
  Lu,
  Lus,
  MenuLien,
  MenuPost,
  MenuSep,
  ModalAction,
  Section,
} from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Avatar, Chip, OuiNon, StatutSubvention, TypeOrganisation } from "@/components/macros";
import { AVIS_LABELS, ROLE_LABELS, SUBVENTION_STATUS, SUBVENTION_TYPES } from "@/lib/constantes";
import { nomRepresentant } from "@/lib/dossier-usager";
import { dateCourte, dateHeure, depuis, montant, pluriel } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import {
  avisOuvert,
  chargerSubvention,
  compterAvis,
  estModifiable,
  TRANSITION_LIBELLES,
  TRANSITIONS_SUBVENTION,
} from "@/modules/subventions/server";
import { ChipAvis, TypeSubvention } from "@/modules/subventions/vues";
import { docCategories, forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Demande de subvention - CityRésa" };

const ETAPES: { cle: string; label: string }[] = [
  { cle: "deposee", label: "Déposée" },
  { cle: "instruction", label: "Instruction" },
  { cle: "avis", label: "Avis des élus" },
  { cle: "votee", label: "Votée" },
  { cle: "versee", label: "Versée" },
];

function Frise({ status }: { status: string }) {
  if (status === "refusee")
    return (
      <div className="frise frise--grande">
        <div className="frise-etape faite">
          <div className="pt" />
          Déposée
        </div>
        <div className="frise-etape faite">
          <div className="pt" />
          Instruite
        </div>
        <div className="frise-etape courante" style={{ color: "var(--danger)" }}>
          <div
            className="pt"
            style={{ background: "var(--danger)", boxShadow: "0 0 0 3px var(--danger-dim)" }}
          />
          Refusée
        </div>
      </div>
    );
  const index = Math.max(
    0,
    ETAPES.findIndex((e) => e.cle === status),
  );
  return (
    <div className="frise frise--grande">
      {ETAPES.map((e, i) => (
        <div
          key={e.cle}
          className={`frise-etape${i < index ? " faite" : i === index ? " courante" : ""}`}
        >
          <div className="pt" />
          {e.label}
        </div>
      ))}
    </div>
  );
}

export default async function SubventionPage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("subventions", "subventions");
  const id = idDeRoute((await params).id);
  const s = await chargerSubvention(id);
  if (!s) notFound();
  const [documents, categories] = await Promise.all([
    forParent("subvention", id),
    page.features.documents ? docCategories() : Promise.resolve([]),
  ]);
  const { user } = page;
  const peutEditer = user.canEdit("subventions");
  const ici = `/subventions/${id}`;
  const org = s.organisation;
  const transitions = peutEditer ? (TRANSITIONS_SUBVENTION[s.status] ?? []) : [];
  const monAvis = s.avis.find((a) => a.authorId === user.id) ?? null;
  const compte = compterAvis(s.avis);
  const montantsProposes = s.avis.map((a) => a.montant).filter((m): m is number => m !== null);
  const montantSuggere = montantsProposes.length
    ? Math.round((montantsProposes.reduce((a, b) => a + b, 0) / montantsProposes.length) * 100) /
      100
    : s.montantDemande;
  const pourcentage =
    s.budgetTotal && s.budgetTotal > 0
      ? Math.round((s.montantDemande / s.budgetTotal) * 100)
      : null;
  const contactOrg = [nomRepresentant(org), org.email, org.phone].filter(Boolean).join(" · ");
  return (
    <>
      <Entete
        titre={`Demande ${s.numero}`}
        sousTitre={
          <>
            <a href={`/usagers/${org.id}`}>{org.name}</a> · exercice {s.exercice} ·{" "}
            {montant(s.montantDemande)} demandés
          </>
        }
        retour="/subventions"
        badges={
          <>
            <TypeSubvention type={s.type} />
            <StatutSubvention status={s.status} />
          </>
        }
        actions={
          peutEditer && estModifiable(s) ? (
            <a href={`${ici}/modifier`} className="btn btn-outline-secondary">
              <Icone nom="pencil" taille={14} /> Modifier
            </a>
          ) : undefined
        }
        menu={[
          <MenuLien
            key="org"
            url={`/usagers/${org.id}`}
            libelle="Fiche de l'association"
            icone="building-2"
          />,
          <MenuLien
            key="export"
            url={`/subventions/export.csv?exercice=${s.exercice}`}
            libelle={`Export CSV de l'exercice ${s.exercice}`}
            icone="download"
          />,
          user.canDelete("subventions") && s.status === "deposee" && !s.avis.length ? (
            <MenuSep key="sep" />
          ) : null,
          user.canDelete("subventions") && s.status === "deposee" && !s.avis.length ? (
            <MenuPost
              key="supprimer"
              url={`${ici}/supprimer`}
              libelle="Supprimer la demande"
              icone="trash-2"
              csrf={page.csrf}
              danger
              confirm={`Supprimer définitivement la demande ${s.numero} ?`}
            />
          ) : null,
        ]}
      />

      <div className="fiche-colonnes">
        <div className="data-card">
          <Section titre="Demande" icone="hand-coins">
            <Lus>
              <Lu label="Numéro" valeur={s.numero} />
              <Lu label="Exercice" valeur={String(s.exercice)} />
              <Lu label="Type" valeur={SUBVENTION_TYPES[s.type] ?? s.type} />
              <Lu label="Statut" valeur={<StatutSubvention status={s.status} />} />
              <Lu label="Montant demandé" valeur={montant(s.montantDemande)} />
              <Lu
                label="Budget total"
                valeur={
                  s.budgetTotal !== null
                    ? `${montant(s.budgetTotal)}${pourcentage !== null ? ` (${pourcentage} % demandés)` : ""}`
                    : null
                }
              />
              <Lu
                label="Bénéficiaires"
                valeur={s.beneficiaires !== null ? pluriel(s.beneficiaires, "personne") : null}
              />
              <Lu
                label="Montant accordé"
                valeur={
                  s.montantAccorde !== null ? <strong>{montant(s.montantAccorde)}</strong> : null
                }
              />
              <Lu label="Déposée le" valeur={dateHeure(s.createdAt)} />
              <Lu label="Déposée par" valeur={s.depositedBy} />
              <Lu label="Instructeur" valeur={s.instructeur} />
              <Lu label="Décision le" valeur={s.decisionAt ? dateHeure(s.decisionAt) : null} />
              <Lu label="Objet" valeur={s.objet} pleine />
              <Lu label="Description" valeur={s.description} pleine pre />
              <Lu label="Note de décision" valeur={s.decisionNote} pleine pre />
            </Lus>
          </Section>

          <Section titre="Association" icone="building-2" ouverte={false}>
            <Lus>
              <Lu
                label="Nom"
                valeur={
                  <span className="d-inline-flex align-items-center gap-2">
                    <a href={`/usagers/${org.id}`}>{org.name}</a>
                    <TypeOrganisation type={org.type} />
                  </span>
                }
              />
              <Lu label="Validée" valeur={<OuiNon v={Boolean(org.validatedAt)} />} />
              <Lu label="Contact" valeur={contactOrg} pleine />
              <Lu
                label="Adresse"
                valeur={[org.address, [org.postalCode, org.city].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(", ")}
                pleine
              />
              <Lu label="RNA" valeur={org.rna} />
              <Lu label="SIRET" valeur={org.siret} />
              <Lu
                label="Comptes du portail"
                valeur={
                  org.users.length
                    ? org.users
                        .map((u) => `${u.firstName} ${u.lastName}`.trim() || u.email)
                        .join(", ")
                    : "aucun compte : l'association n'a pas accès au portail"
                }
                pleine
              />
            </Lus>
          </Section>

          <Section titre="Pièces" icone="paperclip" nb={documents.length}>
            <ListeDocuments
              documents={documents}
              csrf={page.csrf}
              next={ici}
              peutSupprimer={() => peutEditer}
              vide="Aucune pièce : statuts, budget prévisionnel, RIB, bilan…"
            />
            {page.features.documents && peutEditer ? (
              <div className="mt-3">
                <FormDocument
                  parentKind="subvention"
                  parentId={id}
                  csrf={page.csrf}
                  next={ici}
                  categories={categories}
                  kinds={[
                    ["piece", "Pièce justificative"],
                    ["statuts", "Statuts"],
                    ["assurance", "Attestation d'assurance"],
                    ["autre", "Autre"],
                  ]}
                />
              </div>
            ) : null}
          </Section>
        </div>

        <div className="d-flex flex-column gap-3">
          <div className="data-card">
            <Section titre="Instruction" icone="gavel">
              <div className="mb-3">
                <Frise status={s.status} />
              </div>
              <p className="text-muted small mb-3">
                {s.status === "deposee"
                  ? "Demande reçue : prenez-la en instruction pour l'examiner."
                  : s.status === "instruction"
                    ? `En instruction${s.instructeur ? ` par ${s.instructeur}` : ""} : vérifiez les pièces puis soumettez-la aux élus.`
                    : s.status === "avis"
                      ? `Ouverte aux avis des élus (${pluriel(s.avis.length, "avis reçu", "avis reçus")}). Votez le montant ou refusez.`
                      : s.status === "votee"
                        ? `Votée${s.decisionAt ? ` le ${dateCourte(s.decisionAt)}` : ""} pour ${montant(s.montantAccorde ?? 0)} : marquez-la versée une fois le paiement effectué.`
                        : s.status === "versee"
                          ? "Subvention versée : dossier clos."
                          : s.status === "refusee"
                            ? `Refusée${s.decisionAt ? ` le ${dateCourte(s.decisionAt)}` : ""}.`
                            : SUBVENTION_STATUS[s.status]?.label}
              </p>
              {transitions.length ? (
                <div className="d-flex flex-wrap gap-2">
                  {transitions.map((t) => {
                    const lib = TRANSITION_LIBELLES[t];
                    if (t === "votee" || t === "refusee" || t === "versee")
                      return (
                        <BoutonOuvrir
                          key={t}
                          cible={`modal-${t}`}
                          libelle={lib.label}
                          icone={lib.icone}
                          classe={t === "refusee" ? "btn-outline-danger" : "btn-primary"}
                        />
                      );
                    return (
                      <form key={t} method="POST" action={`${ici}/statut`}>
                        <input type="hidden" name="csrf_token" value={page.csrf} />
                        <input type="hidden" name="statut" value={t} />
                        <input type="hidden" name="next" value={ici} />
                        <button
                          type="submit"
                          className="btn btn-primary"
                          data-confirm={`${lib.label} : ${lib.aide} Continuer ?`}
                        >
                          <Icone nom={lib.icone} taille={14} /> {lib.label}
                        </button>
                      </form>
                    );
                  })}
                </div>
              ) : !peutEditer ? (
                <p className="text-faint small mb-0">Vous consultez ce dossier en lecture seule.</p>
              ) : null}
            </Section>
          </div>

          <div className="data-card" id="avis">
            <Section
              titre="Avis"
              icone="users"
              nb={s.avis.length}
              droite={
                s.avis.length
                  ? (["favorable", "reserve", "defavorable"] as const).map((k) =>
                      compte[k] ? (
                        <Chip key={k} teinte={AVIS_LABELS[k].teinte}>
                          {compte[k]} {AVIS_LABELS[k].label.toLowerCase()}
                        </Chip>
                      ) : null,
                    )
                  : undefined
              }
            >
              {s.avis.length ? (
                <ul className="liste-simple mb-3" style={{ margin: "0 -18px" }}>
                  {s.avis.map((a) => {
                    const nom = a.author
                      ? `${a.author.firstName} ${a.author.lastName}`.trim()
                      : "Auteur inconnu";
                    return (
                      <li key={a.id} style={{ alignItems: "flex-start" }}>
                        <Avatar nom={nom} agent />
                        <span className="cell2" style={{ flex: 1, whiteSpace: "normal" }}>
                          <span className="d-flex align-items-center gap-2 flex-wrap">
                            <strong>{nom}</strong>
                            {a.author ? (
                              <small>{ROLE_LABELS[a.author.role] ?? a.author.role}</small>
                            ) : null}
                            <ChipAvis avis={a.avis} />
                            {a.montant !== null ? (
                              <Chip teinte="slate">propose {montant(a.montant)}</Chip>
                            ) : null}
                          </span>
                          {a.commentaire ? (
                            <span
                              className="mt-1"
                              style={{ whiteSpace: "pre-wrap", color: "var(--body)" }}
                            >
                              {a.commentaire}
                            </span>
                          ) : null}
                        </span>
                        <span className="quand" title={dateHeure(a.createdAt)}>
                          {depuis(a.createdAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-muted small">
                  {avisOuvert(s)
                    ? "Aucun avis pour l'instant."
                    : "Aucun avis n'a été donné sur cette demande."}
                </p>
              )}
              {peutEditer && avisOuvert(s) ? (
                <form method="POST" action={`${ici}/avis`} className="mt-2" data-double-envoi>
                  <input type="hidden" name="csrf_token" value={page.csrf} />
                  <input type="hidden" name="next" value={`${ici}#avis`} />
                  <div className="form-label">
                    {monAvis ? "Modifier mon avis" : "Donner mon avis"}
                  </div>
                  <div className="grille grille-3">
                    <div>
                      <label className="form-label" htmlFor="a-avis">
                        Avis <span className="req">*</span>
                      </label>
                      <select
                        name="avis"
                        id="a-avis"
                        className="form-select form-select-sm"
                        defaultValue={monAvis?.avis ?? ""}
                        required
                      >
                        <option value="" disabled>
                          Choisir…
                        </option>
                        {Object.entries(AVIS_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label" htmlFor="a-montant">
                        Montant proposé (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="montant"
                        id="a-montant"
                        className="form-control form-control-sm"
                        defaultValue={monAvis?.montant ?? ""}
                        placeholder={String(s.montantDemande)}
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label className="form-label" htmlFor="a-commentaire">
                        Commentaire
                      </label>
                      <textarea
                        name="commentaire"
                        id="a-commentaire"
                        className="form-control form-control-sm"
                        rows={3}
                        defaultValue={monAvis?.commentaire ?? ""}
                        style={{ minHeight: 64 }}
                      />
                    </div>
                  </div>
                  <div className="d-flex justify-content-end">
                    <button type="submit" className="btn btn-sm btn-primary">
                      <Icone nom="check" taille={14} />{" "}
                      {monAvis ? "Mettre à jour" : "Enregistrer mon avis"}
                    </button>
                  </div>
                </form>
              ) : null}
            </Section>
          </div>
        </div>
      </div>

      {transitions.includes("votee") ? (
        <ModalAction
          id="modal-votee"
          titre={`Voter la subvention ${s.numero}`}
          action={`${ici}/statut`}
          csrf={page.csrf}
          bouton="Enregistrer le vote"
          icone="gavel"
          aide={`Montant demandé : ${montant(s.montantDemande)}${montantsProposes.length ? ` · moyenne des montants proposés par les élus : ${montant(montantSuggere)}` : ""}. L'association recevra un courriel.`}
        >
          <input type="hidden" name="statut" value="votee" />
          <input type="hidden" name="next" value={ici} />
          <div className="mb-3">
            <label className="form-label" htmlFor="v-montant">
              Montant accordé (€) <span className="req">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="montant_accorde"
              id="v-montant"
              className="form-control"
              defaultValue={montantSuggere.toFixed(2)}
              required
            />
            <div className="form-text">0 pour un vote sans attribution.</div>
          </div>
          <div>
            <label className="form-label" htmlFor="v-note">
              Note (délibération, conditions…)
            </label>
            <textarea name="note" id="v-note" className="form-control" rows={3} />
          </div>
        </ModalAction>
      ) : null}
      {transitions.includes("refusee") ? (
        <ModalAction
          id="modal-refusee"
          titre={`Refuser la demande ${s.numero}`}
          action={`${ici}/statut`}
          csrf={page.csrf}
          bouton="Refuser"
          icone="ban"
          danger
          aide="Le motif est transmis à l'association par courriel."
        >
          <input type="hidden" name="statut" value="refusee" />
          <input type="hidden" name="next" value={ici} />
          <label className="form-label" htmlFor="r-note">
            Motif du refus <span className="req">*</span>
          </label>
          <textarea name="note" id="r-note" className="form-control" rows={4} required />
        </ModalAction>
      ) : null}
      {transitions.includes("versee") ? (
        <ModalAction
          id="modal-versee"
          titre={`Versement de ${montant(s.montantAccorde ?? 0)} · ${s.numero}`}
          action={`${ici}/statut`}
          csrf={page.csrf}
          bouton="Marquer versée"
          icone="banknote"
          aide="Clôt le dossier. Les membres de l'association sont prévenus."
        >
          <input type="hidden" name="statut" value="versee" />
          <input type="hidden" name="next" value={ici} />
          <label className="form-label" htmlFor="ve-date">
            Date du versement
          </label>
          <input
            type="date"
            name="date_versement"
            id="ve-date"
            className="form-control"
            defaultValue={todayParisISO()}
            max={todayParisISO()}
          />
        </ModalAction>
      ) : null}
    </>
  );
}
