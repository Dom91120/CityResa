import { EnteteForm } from "@/components/formulaire";
import { FormulaireSite } from "@/modules/sites/vues";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Nouveau site - CityRésa" };

export default async function NouveauSitePage() {
  const page = await contexteModule("espaces");
  await requireEdit("espaces");
  return (
    <>
      <EnteteForm
        titre="Nouveau site"
        retour="/sites"
        sousTitre="Un lieu qui regroupe des espaces : bâtiment, complexe sportif, parc…"
        libelle="Créer le site"
      />
      <FormulaireSite site={null} action="/sites/nouveau" csrf={page.csrf} />
    </>
  );
}
