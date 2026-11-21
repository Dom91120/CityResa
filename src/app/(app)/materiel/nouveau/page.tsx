import { EnteteForm } from "@/components/formulaire";
import { categoriesMateriel, lieuxDeRattachement } from "@/modules/materiel/server";
import { FormulaireMateriel } from "@/modules/materiel/vues";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Nouveau matériel - CityRésa" };

export default async function NouveauMaterielPage() {
  const page = await contexteModule("materiel", "materiel");
  await requireEdit("materiel");
  const [categories, lieux] = await Promise.all([categoriesMateriel(), lieuxDeRattachement()]);
  return (
    <>
      <EnteteForm
        titre="Nouveau matériel"
        retour="/materiel"
        sousTitre="Un matériel mobilisable avec une réservation, avec son stock et sa tarification."
        libelle="Créer"
      />
      <FormulaireMateriel
        materiel={null}
        action="/materiel/nouveau"
        csrf={page.csrf}
        categories={categories}
        sites={lieux.sites}
        espaces={lieux.espaces}
      />
    </>
  );
}
