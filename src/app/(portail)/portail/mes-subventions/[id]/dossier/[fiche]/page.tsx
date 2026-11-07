import { notFound } from "next/navigation";
import { Icone } from "@/components/icones";
import { StatutSubvention } from "@/components/macros";
import { estFiche } from "@/lib/dossier-subvention";
import { organisationDe } from "@/modules/portail/catalogue";
import { CorpsFiche } from "@/modules/subventions/dossier-page";
import { chargerSubvention } from "@/modules/subventions/server";
import { idDeRoute } from "@/server/guards";
import { contexteUsager } from "@/server/page";

export const metadata = { title: "Mon dossier de subvention - CityRésa" };

export default async function FicheDossierPortailPage({
  params,
}: {
  params: Promise<{ id: string; fiche: string }>;
}) {
  const p = await params;
  const id = idDeRoute(p.id);
  const page = await contexteUsager();
  if (!page.features.subventions || !estFiche(p.fiche)) notFound();
  const org = await organisationDe(page.user);
  if (!org) notFound();
  const s = await chargerSubvention(id);
  if (!s || s.organisationId !== org.id) notFound();
  const retour = `/portail/mes-subventions/${s.id}`;
  return (
    <>
      <div className="page-header fiche-entete">
        <div className="d-flex align-items-center" style={{ gap: 12, minWidth: 0 }}>
          <a href={retour} className="fiche-retour" title="Retour" aria-label="Retour">
            <Icone nom="arrow-left" taille={16} />
          </a>
          <div>
            <h1 className="page-title">
              Dossier de subvention {s.exercice}
              <StatutSubvention status={s.status} />
            </h1>
            <p className="page-subtitle">
              {s.status === "brouillon"
                ? "Remplissez les fiches dans l'ordre, enregistrez à chaque étape ; vous pourrez reprendre plus tard."
                : `Dossier ${s.numero} déposé : consultation.`}
            </p>
          </div>
        </div>
        <div className="page-actions">
          <a
            href={`${retour}/dossier.pdf`}
            className="btn btn-outline-secondary btn-sm"
            target="_blank"
            rel="noopener"
          >
            <Icone nom="file-text" taille={14} /> Aperçu PDF
          </a>
        </div>
      </div>
      <CorpsFiche
        page={page}
        s={s}
        cle={p.fiche}
        base="/portail/mes-subventions"
        portail
        peutEditer
      />
    </>
  );
}
