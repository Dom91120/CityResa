import { notFound } from "next/navigation";
import { EnteteForm, PiedForm } from "@/components/formulaire";
import { categoriesMateriel, chargerMateriel } from "@/modules/materiel/server";
import { FormulaireMateriel } from "@/modules/materiel/vues";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier un matériel - CityRésa" };

export default async function ModifierMaterielPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const page = await contexteModule("materiel", "materiel");
  await requireEdit("materiel");
  const id = idDeRoute((await params).id);
  const [m, categories] = await Promise.all([chargerMateriel(id), categoriesMateriel()]);
  if (!m) notFound();
  return (
    <>
      <EnteteForm titre={m.name} retour={`/materiel/${id}`} sousTitre="Modifier le matériel" />
      <FormulaireMateriel
        materiel={m}
        action={`/materiel/${id}/modifier`}
        csrf={page.csrf}
        categories={categories}
      />
      <PiedForm
        retour={`/materiel/${id}`}
        supprimer={page.user.canDelete("materiel") ? `/materiel/${id}/supprimer` : null}
        confirmation={
          m._count.reservations
            ? `Ce matériel est utilisé par ${m._count.reservations} dossier(s) : il sera désactivé, pas supprimé. Continuer ?`
            : "Supprimer définitivement ce matériel ?"
        }
      />
    </>
  );
}
