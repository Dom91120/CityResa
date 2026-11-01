import { notFound } from "next/navigation";
import { FormDocument, ListeDocuments } from "@/components/documents";
import { Lu, Lus, Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { StatutSubvention } from "@/components/macros";
import { SUBVENTION_STATUS, SUBVENTION_TYPES } from "@/lib/constantes";
import { dateHeure, montant } from "@/lib/libelles";
import { organisationDe } from "@/modules/portail/catalogue";
import { prisma } from "@/server/db";
import { forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteUsager } from "@/server/page";

export const metadata = { title: "Demande de subvention - CityRésa" };

const ETAPES_SUB: Record<string, string> = {
  deposee: "Votre demande est enregistrée ; elle sera instruite par les services.",
  instruction: "Votre demande est en cours d'instruction.",
  avis: "Votre demande est soumise à l'avis des élus.",
  votee: "La subvention a été votée.",
  refusee: "La collectivité n'a pas retenu cette demande.",
  versee: "La subvention a été versée.",
  brouillon: "Demande non déposée.",
};

export default async function SubventionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = idDeRoute((await params).id);
  const page = await contexteUsager();
  if (!page.features.subventions) notFound();
  const org = await organisationDe(page.user);
  if (!org) notFound();
  const s = await prisma.subvention.findFirst({ where: { id, organisationId: org.id } });
  if (!s) notFound();
  const pieces = await forParent("subvention", s.id);
  const ici = `/portail/mes-subventions/${s.id}`;
  const decidee = ["votee", "refusee", "versee"].includes(s.status);
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
              {s.objet}
              <StatutSubvention status={s.status} />
            </h1>
            <p className="page-subtitle">
              N° {s.numero} · Exercice {s.exercice} · {SUBVENTION_TYPES[s.type] ?? s.type}
            </p>
          </div>
        </div>
      </div>

      <div className="astuce mb-3">
        <Icone nom="info" taille={18} />
        <div>
          <strong>{SUBVENTION_STATUS[s.status]?.label ?? s.status}.</strong>{" "}
          {ETAPES_SUB[s.status] ?? ""}
        </div>
      </div>

      <div className="data-card">
        <Section titre="Demande" icone="hand-coins">
          <Lus>
            <Lu label="Objet" valeur={s.objet} />
            <Lu label="Type" valeur={SUBVENTION_TYPES[s.type] ?? s.type} />
            <Lu label="Exercice" valeur={String(s.exercice)} />
            <Lu label="Montant demandé" valeur={montant(s.montantDemande)} />
            <Lu
              label="Budget total"
              valeur={s.budgetTotal != null ? montant(s.budgetTotal) : null}
            />
            <Lu
              label="Bénéficiaires"
              valeur={s.beneficiaires != null ? String(s.beneficiaires) : null}
            />
            <Lu
              label="Déposée le"
              valeur={`${dateHeure(s.createdAt)}${s.depositedBy ? ` par ${s.depositedBy}` : ""}`}
            />
            <Lu label="Description" valeur={s.description} pleine pre />
          </Lus>
        </Section>

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
              <Lu label="Note" valeur={s.decisionNote} pleine pre />
            </Lus>
          </Section>
        ) : null}

        <Section titre="Pièces justificatives" icone="paperclip" nb={pieces.length || null}>
          <p className="text-muted small">
            Budget prévisionnel, bilan et compte de résultat, rapport d'activité, RIB… Joignez ici
            les pièces attendues par la collectivité.
          </p>
          <ListeDocuments
            documents={pieces}
            csrf={page.csrf}
            next={ici}
            peutSupprimer={(d) => d.uploadedById === page.user.id && !decidee}
            vide="Aucune pièce jointe."
          />
          {page.features.documents && !decidee ? (
            <div className="mt-3">
              <FormDocument
                parentKind="subvention"
                parentId={s.id}
                csrf={page.csrf}
                next={ici}
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
    </>
  );
}
