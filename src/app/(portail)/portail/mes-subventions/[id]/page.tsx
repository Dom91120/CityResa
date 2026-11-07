import { notFound, redirect } from "next/navigation";
import { FormDocument, ListeDocuments } from "@/components/documents";
import { Lu, Lus, Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Chip, StatutSubvention } from "@/components/macros";
import { SUBVENTION_NATURES, SUBVENTION_STATUS } from "@/lib/constantes";
import { etatPieces, FICHES } from "@/lib/dossier-subvention";
import { dateCourte, dateHeure, montant } from "@/lib/libelles";
import { planDe } from "@/lib/plan-budget";
import { organisationDe } from "@/modules/portail/catalogue";
import { EtatPiecesListe, LectureFiche } from "@/modules/subventions/dossier-vues";
import { chargerSubvention } from "@/modules/subventions/server";
import { forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteUsager } from "@/server/page";
import { dossierDe, pourManques } from "@/server/subventions-dossier";

export const metadata = { title: "Dossier de subvention - CityRésa" };

const ETAPES_SUB: Record<string, string> = {
  deposee: "Votre dossier est enregistré ; il sera instruit après la clôture de la campagne.",
  instruction: "Votre dossier est en cours d'instruction.",
  avis: "Votre dossier est soumis à l'avis des élus.",
  votee: "La subvention a été votée.",
  refusee: "La collectivité n'a pas retenu cette demande.",
  versee: "La subvention a été versée.",
};

export default async function SubventionPortailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = idDeRoute((await params).id);
  const page = await contexteUsager();
  if (!page.features.subventions) notFound();
  const org = await organisationDe(page.user);
  if (!org) notFound();
  const s = await chargerSubvention(id);
  if (!s || s.organisationId !== org.id) notFound();
  if (s.status === "brouillon") redirect(`/portail/mes-subventions/${s.id}/dossier/presentation`);
  const documents = await forParent("subvention", s.id);
  const pieces = documents.filter((d) => d.kind !== "dossier");
  const d = dossierDe(s);
  const ctx = { s, d, sportive: org.sportive, plan: planDe(org.sportive) };
  const ici = `/portail/mes-subventions/${s.id}`;
  const decidee = ["votee", "refusee", "versee"].includes(s.status);
  const pdfId = s.dossierDocumentId ?? documents.find((x) => x.kind === "dossier")?.id ?? null;
  return (
    <>
      <div className="page-header fiche-entete">
        <div className="d-flex align-items-center" style={{ gap: 12, minWidth: 0 }}>
          <a
            href="/portail/mes-subventions"
            className="fiche-retour"
            title="Retour"
            aria-label="Retour"
          >
            <Icone nom="arrow-left" taille={16} />
          </a>
          <div>
            <h1 className="page-title">
              Dossier {s.numero}
              <StatutSubvention status={s.status} />
            </h1>
            <p className="page-subtitle">
              Exercice {s.exercice} · {SUBVENTION_NATURES[s.nature] ?? s.nature} · {s.objet} ·{" "}
              {montant(s.montantDemande)} demandés
              {s.campagne ? ` · ${s.campagne.label}` : ""}
            </p>
          </div>
        </div>
        <div className="page-actions">
          {pdfId ? (
            <a
              href={`/documents/${pdfId}/view`}
              className="btn btn-outline-primary btn-sm"
              target="_blank"
              rel="noopener"
            >
              <Icone nom="file-text" taille={14} /> Dossier PDF
            </a>
          ) : (
            <a
              href={`${ici}/dossier.pdf`}
              className="btn btn-outline-primary btn-sm"
              target="_blank"
              rel="noopener"
            >
              <Icone nom="file-text" taille={14} /> Dossier PDF
            </a>
          )}
        </div>
      </div>

      <div className="astuce mb-3">
        <Icone nom="info" taille={18} />
        <div>
          <strong>{SUBVENTION_STATUS[s.status]?.label ?? s.status}.</strong>{" "}
          {ETAPES_SUB[s.status] ?? ""}
          {s.recuAt ? ` Reçu le ${dateHeure(s.recuAt)}.` : ""}
          {s.signeAt ? ` Attestation signée par ${s.signeNom} le ${dateHeure(s.signeAt)}.` : ""}
        </div>
      </div>

      <div className="data-card">
        {decidee ? (
          <Section titre="Décision" icone="gavel">
            <Lus>
              <Lu label="Décision" valeur={<StatutSubvention status={s.status} />} />
              <Lu
                label="Montant accordé"
                valeur={s.montantAccorde != null ? montant(s.montantAccorde) : "—"}
                tiret
              />
              <Lu label="Date" valeur={s.decisionAt ? dateHeure(s.decisionAt) : null} />
              <Lu label="Versée le" valeur={s.verseAt ? dateCourte(s.verseAt) : null} />
              <Lu label="Note" valeur={s.decisionNote} pleine pre />
            </Lus>
          </Section>
        ) : null}

        {FICHES.filter((f) => f.cle !== "pieces").map((f, i) => (
          <Section
            key={f.cle}
            titre={`${i + 1}. ${f.titre}`}
            icone={f.icone}
            ouverte={f.cle === "motivation"}
          >
            <LectureFiche cle={f.cle as Exclude<typeof f.cle, "pieces">} ctx={ctx} org={org} />
          </Section>
        ))}

        <Section titre="Pièces" icone="paperclip" nb={pieces.length || null}>
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
            peutSupprimer={(doc) => doc.uploadedById === page.user.id && !decidee}
            vide="Aucune pièce jointe."
          />
          {page.features.documents && !decidee ? (
            <div className="mt-3">
              <p className="text-muted small mb-2">
                Vous pouvez encore ajouter une pièce demandée par les services.
              </p>
              <FormDocument
                parentKind="subvention"
                parentId={s.id}
                csrf={page.csrf}
                next={ici}
                kinds={[
                  ["piece", "Pièce justificative"],
                  ["autre", "Autre"],
                ]}
              />
            </div>
          ) : null}
        </Section>

        <Section titre="Historique" icone="history" ouverte={false} nb={s.histories.length || null}>
          <ul className="liste-simple mb-0" style={{ margin: "0 -18px" }}>
            {s.histories.map((h) => (
              <li key={h.id}>
                <span className="cell2" style={{ flex: 1, whiteSpace: "normal" }}>
                  <span>{h.action}</span>
                  {h.comment ? <small>{h.comment}</small> : null}
                </span>
                <Chip teinte="slate">{dateHeure(h.performedAt)}</Chip>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
