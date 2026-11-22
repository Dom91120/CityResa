import { notFound } from "next/navigation";
import { Icone } from "@/components/icones";
import { sourceApercu } from "@/lib/apercu-pdf";
import { cheminInterne } from "@/lib/url";
import { param } from "@/server/paging";

export const metadata = { title: "Aperçu - CityRésa" };

/**
 * L'aperçu d'un PDF sur le portail (dossier de subvention, facture, document d'un espace) : le
 * document est encadré tel que le serveur le produit, avec les droits d'accès de sa propre
 * adresse ; la page elle-même n'en ouvre aucun.
 */
export default async function ApercuPortailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const src = sourceApercu(param(params, "src"));
  if (!src) notFound();
  const titre = (param(params, "titre") ?? "").trim().slice(0, 120) || "Aperçu du document";
  const retour = cheminInterne(param(params, "retour"));
  return (
    <>
      <div className="page-header">
        <div style={{ minWidth: 0 }}>
          {retour?.startsWith("/portail") ? (
            <a href={retour} className="text-muted small text-decoration-none">
              <Icone nom="arrow-left" taille={14} /> Retour
            </a>
          ) : null}
          <h1 className="page-title">{titre}</h1>
        </div>
        <div className="page-actions">
          <a href={src} className="btn btn-outline-secondary btn-sm" target="_blank" rel="noopener">
            <Icone nom="external-link" taille={14} /> Ouvrir dans un onglet
          </a>
          <a href={src} className="btn btn-outline-secondary btn-sm" download>
            <Icone nom="download" taille={14} /> Télécharger
          </a>
        </div>
      </div>
      <div className="data-card apercu-pdf">
        <iframe src={src} title={titre} />
      </div>
    </>
  );
}
