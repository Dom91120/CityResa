import { notFound, redirect } from "next/navigation";
import { FormDocument } from "@/components/documents";
import { FilRetour, Lu, Lus, Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Chip, StatutSubvention } from "@/components/macros";
import { lienApercu } from "@/lib/apercu-pdf";
import { SUBVENTION_NATURES, SUBVENTION_STATUS } from "@/lib/constantes";
import { etatPieces, FICHES } from "@/lib/dossier-subvention";
import { dateCourte, dateHeure, montant } from "@/lib/libelles";
import { planDe } from "@/lib/plan-budget";
import { organisationDe } from "@/modules/portail/catalogue";
import { LectureFiche, PiecesDossier } from "@/modules/subventions/dossier-vues";
import { chargerSubvention } from "@/modules/subventions/server";
import { forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteUsager } from "@/server/page";
import { dossierDe, pourManques } from "@/server/subventions-dossier";

export const metadata = { title: "Dossier de subvention - CityRésa" };

type DossierBandeau = {
  status: string;
  montantAccorde: unknown;
  signeAt: Date | null;
  signeNom: string | null;
  recuAt: Date | null;
  decisionAt: Date | null;
  verseAt: Date | null;
};

/**
 * Le bandeau du dossier : d'abord où il en est aujourd'hui (avec le montant et la date quand il y
 * en a), puis son parcours dans l'ordre des événements, sans répéter ce que dit la première ligne.
 */
function bandeau(s: DossierBandeau): { situation: string; parcours: string[] } {
  const accorde = s.montantAccorde != null ? montant(Number(s.montantAccorde)) : null;
  const le = (d: Date | null) => (d ? ` le ${dateCourte(d)}` : "");
  const situations: Record<string, string> = {
    deposee: "Dossier déposé : il sera instruit après la clôture de la campagne.",
    instruction: "Dossier en cours d'instruction.",
    avis: "Dossier soumis à l'avis des élus.",
    votee: `Subvention votée${le(s.decisionAt)}${accorde ? ` : ${accorde} accordés` : ""}.`,
    refusee: `Demande non retenue${le(s.decisionAt)}.`,
    versee: `Subvention versée${le(s.verseAt)}${accorde ? ` : ${accorde}` : ""}.`,
  };
  const parcours = [
    s.signeAt ? `attestation signée par ${s.signeNom} le ${dateHeure(s.signeAt)}` : null,
    s.recuAt ? `dossier reçu le ${dateHeure(s.recuAt)}` : null,
    // La décision n'est rappelée ici que si la première ligne parle déjà du versement.
    s.status === "versee" && s.decisionAt
      ? `subvention votée le ${dateCourte(s.decisionAt)}`
      : null,
  ].filter((x): x is string => Boolean(x));
  return {
    situation: situations[s.status] ?? SUBVENTION_STATUS[s.status]?.label ?? s.status,
    parcours,
  };
}

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
  const etat = bandeau(s);
  const decidee = ["votee", "refusee", "versee"].includes(s.status);
  const pdfId = s.dossierDocumentId ?? documents.find((x) => x.kind === "dossier")?.id ?? null;
  return (
    <>
      <div className="page-header fiche-entete">
        <div className="d-flex align-items-center" style={{ gap: 12, minWidth: 0 }}>
          <div>
            <FilRetour retour="/portail/mes-subventions" />
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
              href={lienApercu(`/documents/${pdfId}/view`, "Dossier de subvention", ici)}
              className="btn btn-outline-primary btn-sm"
            >
              <Icone nom="file-text" taille={14} /> Dossier PDF
            </a>
          ) : (
            <a
              href={lienApercu(`${ici}/dossier.pdf`, "Dossier de subvention", ici)}
              className="btn btn-outline-primary btn-sm"
            >
              <Icone nom="file-text" taille={14} /> Dossier PDF
            </a>
          )}
        </div>
      </div>

      <div className="astuce mb-3">
        <Icone nom="info" taille={18} />
        <div>
          <strong>{etat.situation}</strong>
          {etat.parcours.length ? (
            <div className="small text-muted">Parcours : {etat.parcours.join(" · ")}.</div>
          ) : null}
          {/* Le service qui instruit le dossier, une fois celui-ci déposé. */}
          {s.service ? (
            <div className="small text-muted">
              Votre interlocuteur :{" "}
              {[s.service.name, s.service.email, s.service.phone].filter(Boolean).join(" · ")}
            </div>
          ) : null}
        </div>
      </div>

      <div className="data-card">
        {decidee ? (
          <Section titre="Décision" icone="gavel">
            <Lus intitule="59px">
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
          <PiecesDossier
            etats={etatPieces(
              pourManques(s, d),
              pieces.map((p) => p.kind),
            )}
            documents={pieces}
            csrf={page.csrf}
            next={ici}
            peutSupprimer={(doc) => doc.uploadedById === page.user.id && !decidee}
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
