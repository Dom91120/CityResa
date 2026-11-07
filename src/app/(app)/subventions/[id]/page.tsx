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
import {
  AVIS_LABELS,
  ROLE_LABELS,
  SUBVENTION_NATURES,
  SUBVENTION_STATUS,
  SUBVENTION_TYPES,
} from "@/lib/constantes";
import { etatPieces, FICHES, fichesIncompletes } from "@/lib/dossier-subvention";
import { nomRepresentant } from "@/lib/dossier-usager";
import { dateCourte, dateHeure, depuis, montant, pluriel } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { planDe, ratioDemande, totaux } from "@/lib/plan-budget";
import {
  ChipCampagne,
  EtatPiecesListe,
  LectureFiche,
  ListeManques,
} from "@/modules/subventions/dossier-vues";
import {
  avisOuvert,
  chargerSubvention,
  compterAvis,
  peutDecider,
  TRANSITION_LIBELLES,
  TRANSITIONS_SUBVENTION,
} from "@/modules/subventions/server";
import { ChipAvis, TypeSubvention } from "@/modules/subventions/vues";
import { prisma } from "@/server/db";
import { docCategories, forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";
import { dossierDe, enRedaction, manquesDe, pourManques } from "@/server/subventions-dossier";

export const metadata = { title: "Dossier de subvention - CityRésa" };

const ETAPES: { cle: string; label: string }[] = [
  { cle: "brouillon", label: "Rédaction" },
  { cle: "deposee", label: "Déposé" },
  { cle: "instruction", label: "Instruction" },
  { cle: "avis", label: "Avis des élus" },
  { cle: "votee", label: "Voté" },
  { cle: "versee", label: "Versé" },
];

function Frise({ status }: { status: string }) {
  if (status === "refusee")
    return (
      <div className="frise frise--grande">
        <div className="frise-etape faite">
          <div className="pt" />
          Déposé
        </div>
        <div className="frise-etape faite">
          <div className="pt" />
          Instruit
        </div>
        <div className="frise-etape courante" style={{ color: "var(--danger)" }}>
          <div
            className="pt"
            style={{ background: "var(--danger)", boxShadow: "0 0 0 3px var(--danger-dim)" }}
          />
          Refusé
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
  const [documents, categories, secteurs, manques] = await Promise.all([
    forParent("subvention", id),
    page.features.documents ? docCategories() : Promise.resolve([]),
    prisma.referential.findMany({
      where: { kind: "subvention_secteur", isActive: true },
      orderBy: [{ position: "asc" }, { label: "asc" }],
    }),
    manquesDe(s, true),
  ]);
  const { user } = page;
  const peutEditer = user.canEdit("subventions");
  const decide = peutDecider(user);
  const ici = `/subventions/${id}`;
  const org = s.organisation;
  const d = dossierDe(s);
  const plan = planDe(org.sportive);
  const ctx = { s, d, sportive: org.sportive, plan };
  const pieces = documents.filter((x) => x.kind !== "dossier");
  const pdfId = s.dossierDocumentId ?? documents.find((x) => x.kind === "dossier")?.id ?? null;
  const redaction = enRedaction(s);
  const incompletes = fichesIncompletes(manques);
  const transitions = decide && !redaction ? (TRANSITIONS_SUBVENTION[s.status] ?? []) : [];
  const monAvis = s.avis.find((a) => a.authorId === user.id) ?? null;
  const compte = compterAvis(s.avis);
  const montantsProposes = s.avis.map((a) => a.montant).filter((m): m is number => m !== null);
  const montantSuggere = montantsProposes.length
    ? Math.round((montantsProposes.reduce((a, b) => a + b, 0) / montantsProposes.length) * 100) /
      100
    : s.montantDemande;
  const t = totaux(plan, { ...d.budget.charges, ...d.budget.produits });
  const ratio = ratioDemande(s.montantDemande, t.produitsDirects);
  const contactOrg = [nomRepresentant(org), org.email, org.phone].filter(Boolean).join(" · ");
  const titre = redaction ? `Dossier ${s.exercice} en rédaction` : `Dossier ${s.numero}`;
  return (
    <>
      <Entete
        titre={titre}
        sousTitre={
          <>
            <a href={`/usagers/${org.id}`}>{org.name}</a> · exercice {s.exercice} ·{" "}
            {SUBVENTION_NATURES[s.nature] ?? s.nature}
            {s.montantDemande ? ` · ${montant(s.montantDemande)} demandés` : ""}
          </>
        }
        retour="/subventions"
        badges={
          <>
            <TypeSubvention type={s.type} />
            <StatutSubvention status={s.status} />
            {org.sportive ? <Chip teinte="sky">Sportive</Chip> : null}
            {s.campagne ? <ChipCampagne c={s.campagne} /> : null}
          </>
        }
        actions={
          <>
            {decide && redaction ? (
              <a href={`${ici}/dossier/presentation`} className="btn btn-primary">
                <Icone nom="pencil" taille={14} /> Compléter le dossier
              </a>
            ) : null}
            {decide && !redaction && ["deposee", "instruction"].includes(s.status) ? (
              <BoutonOuvrir
                cible="modal-incomplet"
                libelle="Renvoyer comme incomplet"
                icone="rotate-ccw"
                classe="btn-outline-secondary"
              />
            ) : null}
            <a
              href={pdfId ? `/documents/${pdfId}/view` : `${ici}/dossier.pdf`}
              className="btn btn-outline-secondary"
              target="_blank"
              rel="noopener"
            >
              <Icone nom="file-text" taille={14} /> PDF
            </a>
          </>
        }
        menu={[
          <MenuLien
            key="org"
            url={`/usagers/${org.id}`}
            libelle="Fiche de l'association"
            icone="building-2"
          />,
          <MenuLien
            key="fiches"
            url={`${ici}/dossier/presentation`}
            libelle="Parcourir les fiches"
            icone="file-text"
          />,
          <MenuLien
            key="campagnes"
            url="/subventions/campagnes"
            libelle="Campagnes de subventions"
            icone="calendar"
          />,
          decide && !redaction ? (
            <MenuLien
              key="modifier"
              url={`${ici}/modifier`}
              libelle="Modifier l'objet et le montant"
              icone="pencil"
            />
          ) : null,
          <MenuLien
            key="export"
            url={`/subventions/export.csv?exercice=${s.exercice}`}
            libelle={`Export CSV de l'exercice ${s.exercice}`}
            icone="download"
          />,
          user.canDelete("subventions") &&
          ["brouillon", "deposee"].includes(s.status) &&
          !s.avis.length ? (
            <MenuSep key="sep" />
          ) : null,
          user.canDelete("subventions") &&
          ["brouillon", "deposee"].includes(s.status) &&
          !s.avis.length ? (
            <MenuPost
              key="supprimer"
              url={`${ici}/supprimer`}
              libelle="Supprimer le dossier"
              icone="trash-2"
              csrf={page.csrf}
              danger
              confirm={`Supprimer définitivement le dossier ${s.numero} ?`}
            />
          ) : null,
        ]}
      />

      <div className="fiche-colonnes fiche-colonnes--50-50">
        <div className="data-card">
          <Section titre="Cadre réservé à l'administration" icone="clipboard-check">
            <Lus>
              <Lu label="Numéro" valeur={redaction ? null : s.numero} tiret />
              <Lu label="Reçu le" valeur={s.recuAt ? dateHeure(s.recuAt) : null} tiret />
              <Lu
                label="Campagne"
                valeur={
                  s.campagne
                    ? `${s.campagne.label} (dépôt jusqu'au ${dateCourte(s.campagne.clotureDate)})`
                    : null
                }
                tiret
              />
              <Lu label="Déposé par" valeur={s.depositedBy} />
              <Lu label="Instructeur" valeur={s.instructeur} />
              <Lu
                label="Signature"
                valeur={
                  s.signeAt
                    ? `${s.signeNom}${s.signeQualite ? `, ${s.signeQualite}` : ""}${s.signeMandataire ? " (mandataire)" : ""} · ${dateHeure(s.signeAt)}`
                    : redaction
                      ? null
                      : "Dossier papier signé"
                }
                tiret
              />
              <Lu
                label="Montant accordé"
                valeur={
                  s.montantAccorde !== null ? <strong>{montant(s.montantAccorde)}</strong> : null
                }
              />
              <Lu label="Décision le" valeur={s.decisionAt ? dateHeure(s.decisionAt) : null} />
              <Lu label="Versée le" valeur={s.verseAt ? dateCourte(s.verseAt) : null} />
              <Lu label="Note de décision" valeur={s.decisionNote} pleine pre />
            </Lus>
            {peutEditer ? (
              <form
                method="POST"
                action={`${ici}/secteur`}
                className="d-flex align-items-end gap-2 mt-3"
                data-auto-submit
              >
                <input type="hidden" name="csrf_token" value={page.csrf} />
                <div style={{ flex: "0 1 320px" }}>
                  <label className="form-label" htmlFor="f-secteur">
                    Secteur d'instruction
                  </label>
                  <select
                    name="secteur_id"
                    id="f-secteur"
                    className="form-select form-select-sm"
                    defaultValue={s.secteurId ?? ""}
                  >
                    <option value="">—</option>
                    {secteurs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-sm btn-outline-secondary">
                  <Icone nom="check" taille={14} /> Enregistrer
                </button>
              </form>
            ) : (
              <Lus>
                <Lu label="Secteur" valeur={s.secteur?.label} />
              </Lus>
            )}
          </Section>

          <Section titre="Synthèse de la demande" icone="hand-coins">
            <Lus>
              <Lu label="Objet" valeur={s.objet} pleine />
              <Lu label="Type" valeur={SUBVENTION_TYPES[s.type] ?? s.type} />
              <Lu
                label="Montant demandé"
                valeur={s.montantDemande ? <strong>{montant(s.montantDemande)}</strong> : null}
                tiret
              />
              <Lu
                label="Total des produits prévus"
                valeur={t.produitsDirects ? montant(t.produitsDirects) : null}
              />
              <Lu
                label="Part de la subvention"
                valeur={ratio === null ? null : `${ratio.toLocaleString("fr-FR")} %`}
              />
              <Lu
                label={`Subvention ${s.exercice - 1}`}
                valeur={
                  d.bilan.subventionPrecedente !== null
                    ? montant(d.bilan.subventionPrecedente)
                    : null
                }
              />
              <Lu
                label="Adhérents"
                valeur={
                  d.effectifs.exercicePrecedent.total !== null
                    ? `${d.effectifs.exercicePrecedent.total}${d.effectifs.exercicePrecedent.chatillonnais !== null ? ` dont ${d.effectifs.exercicePrecedent.chatillonnais} Châtillonnais` : ""}`
                    : null
                }
              />
              <Lu
                label="Bénévoles / salariés"
                valeur={
                  d.effectifs.benevoles !== null || d.effectifs.salaries !== null
                    ? `${d.effectifs.benevoles ?? 0} / ${d.effectifs.salaries ?? 0}`
                    : null
                }
              />
            </Lus>
            {redaction ? (
              <div className="mt-3">
                <ListeManques manques={manques} base={`${ici}/dossier`} />
              </div>
            ) : null}
          </Section>

          {FICHES.filter((f) => f.cle !== "pieces").map((f, i) => (
            <Section
              key={f.cle}
              titre={`${i + 1}. ${f.titre}`}
              icone={f.icone}
              ouverte={false}
              droite={
                incompletes.has(f.cle) ? (
                  <Chip teinte="amber">incomplète</Chip>
                ) : decide && redaction ? (
                  <a href={`${ici}/dossier/${f.cle}`} className="small">
                    modifier
                  </a>
                ) : undefined
              }
            >
              <LectureFiche cle={f.cle as Exclude<typeof f.cle, "pieces">} ctx={ctx} org={org} />
            </Section>
          ))}

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
              <Lu label="Sportive" valeur={<OuiNon v={org.sportive} />} />
              <Lu label="Contact" valeur={contactOrg} pleine />
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

          <Section titre="Pièces" icone="paperclip" nb={pieces.length}>
            <EtatPiecesListe
              etats={etatPieces(
                pourManques(s, d),
                pieces.map((p) => p.kind),
              )}
            />
            <h3 className="h6 mt-3">Pièces déposées</h3>
            <ListeDocuments
              documents={pieces}
              csrf={page.csrf}
              next={ici}
              peutSupprimer={() => peutEditer}
              vide="Aucune pièce déposée."
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
                    ...etatPieces(pourManques(s, d), []).map(
                      (e) => [e.piece.kind, e.piece.libelle] as [string, string],
                    ),
                    ["piece", "Autre pièce justificative"],
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
                {redaction
                  ? `Dossier en rédaction${s.campagne ? ` pour la ${s.campagne.label.toLowerCase()}` : ""} : l'association (ou un agent) le complète puis le dépose.`
                  : s.status === "deposee"
                    ? "Dossier reçu : vérifiez les pièces, renvoyez-le s'il est incomplet, sinon prenez-le en instruction."
                    : s.status === "instruction"
                      ? `En instruction${s.instructeur ? ` par ${s.instructeur}` : ""} : vérifiez le dossier puis soumettez-le aux élus.`
                      : s.status === "avis"
                        ? `Ouvert aux avis des élus (${pluriel(s.avis.length, "avis reçu", "avis reçus")}). Votez le montant ou refusez.`
                        : s.status === "votee"
                          ? `Voté${s.decisionAt ? ` le ${dateCourte(s.decisionAt)}` : ""} pour ${montant(s.montantAccorde ?? 0)} : marquez-le versé une fois le paiement effectué.`
                          : s.status === "versee"
                            ? `Subvention versée${s.verseAt ? ` le ${dateCourte(s.verseAt)}` : ""} : dossier clos.`
                            : s.status === "refusee"
                              ? `Refusé${s.decisionAt ? ` le ${dateCourte(s.decisionAt)}` : ""}.`
                              : SUBVENTION_STATUS[s.status]?.label}
              </p>
              {transitions.length ? (
                <div className="d-flex flex-wrap gap-2">
                  {transitions.map((tr) => {
                    const lib = TRANSITION_LIBELLES[tr];
                    if (tr === "votee" || tr === "refusee" || tr === "versee")
                      return (
                        <BoutonOuvrir
                          key={tr}
                          cible={`modal-${tr}`}
                          libelle={lib.label}
                          icone={lib.icone}
                          classe={tr === "refusee" ? "btn-outline-danger" : "btn-primary"}
                        />
                      );
                    return (
                      <form key={tr} method="POST" action={`${ici}/statut`}>
                        <input type="hidden" name="csrf_token" value={page.csrf} />
                        <input type="hidden" name="statut" value={tr} />
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
              ) : redaction && decide ? (
                <a href={`${ici}/dossier/attestation`} className="btn btn-outline-primary">
                  <Icone nom="send" taille={14} /> Vérifier et déposer
                </a>
              ) : !peutEditer ? (
                <p className="text-faint small mb-0">Vous consultez ce dossier en lecture seule.</p>
              ) : !decide && !redaction ? (
                <p className="text-faint small mb-0">
                  Donnez votre avis ci-dessous : la décision est enregistrée par les agents.
                </p>
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
                    : "Aucun avis n'a été donné sur ce dossier."}
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

          <div className="data-card">
            <Section
              titre="Historique"
              icone="history"
              nb={s.histories.length || null}
              ouverte={false}
            >
              {s.histories.length ? (
                <ul className="liste-simple mb-0" style={{ margin: "0 -18px" }}>
                  {s.histories.map((h) => (
                    <li key={h.id}>
                      <span className="cell2" style={{ flex: 1, whiteSpace: "normal" }}>
                        <span>{h.action}</span>
                        <small>{[h.performedBy, h.comment].filter(Boolean).join(" · ")}</small>
                      </span>
                      <span className="quand" title={dateHeure(h.performedAt)}>
                        {depuis(h.performedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted small mb-0">Aucun événement.</p>
              )}
            </Section>
          </div>
        </div>
      </div>

      {decide && !redaction && ["deposee", "instruction"].includes(s.status) ? (
        <ModalAction
          id="modal-incomplet"
          titre={`Renvoyer le dossier ${s.numero} comme incomplet`}
          action={`${ici}/incomplet`}
          csrf={page.csrf}
          bouton="Renvoyer à l'association"
          icone="rotate-ccw"
          aide="Le dossier repasse en rédaction : l'association reçoit un courriel avec vos remarques et doit le déposer à nouveau avant la clôture de la campagne."
        >
          <label className="form-label" htmlFor="inc-motif">
            Ce qui manque ou est à corriger <span className="req">*</span>
          </label>
          <textarea
            name="motif"
            id="inc-motif"
            className="form-control"
            rows={5}
            required
            defaultValue={manques.length ? manques.map((m) => `- ${m.libelle}`).join("\n") : ""}
          />
        </ModalAction>
      ) : null}
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
          titre={`Refuser le dossier ${s.numero}`}
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
