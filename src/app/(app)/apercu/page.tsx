import { notFound } from "next/navigation";
import { Entete } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { sourceApercu } from "@/lib/apercu-pdf";
import { cheminInterne } from "@/lib/url";
import { contextePage } from "@/server/page";
import { param } from "@/server/paging";

export const metadata = { title: "Aperçu - CityRésa" };

/**
 * L'aperçu d'un PDF de l'application, affiché dans la page : le document est encadré tel que le
 * serveur le produit (les droits d'accès restent ceux de sa propre adresse), avec de quoi
 * l'ouvrir à part ou le télécharger.
 */
export default async function ApercuPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await contextePage();
  const params = await searchParams;
  const src = sourceApercu(param(params, "src"));
  if (!src) notFound();
  const titre = (param(params, "titre") ?? "").trim().slice(0, 120) || "Aperçu du document";
  const retour = cheminInterne(param(params, "retour")) ?? undefined;
  return (
    <>
      <Entete
        titre={titre}
        retour={retour}
        actions={
          <>
            <a href={src} className="btn btn-outline-secondary" target="_blank" rel="noopener">
              <Icone nom="external-link" taille={14} /> Ouvrir dans un onglet
            </a>
            <a href={src} className="btn btn-outline-secondary" download>
              <Icone nom="download" taille={14} /> Télécharger
            </a>
          </>
        }
      />
      <div className="data-card apercu-pdf">
        <iframe src={src} title={titre} />
      </div>
    </>
  );
}
