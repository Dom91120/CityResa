import { notFound } from "next/navigation";
import { EnteteForm, PiedForm, SectionForm } from "@/components/formulaire";
import { ScriptDiffere } from "@/components/scripts";
import { GrilleHorairesTravail } from "@/modules/personnel/vues";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";
import { typesDeContratAvecPlanning } from "@/server/personnel";

export const metadata = { title: "Planning type - CityRésa" };

/** La saisie du planning type d'un type de contrat : sa grille hebdomadaire d'horaires. */
export default async function PlanningTypePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("personnel", "personnel");
  await requireEdit("personnel");
  const id = idDeRoute((await params).id);
  const type = (await typesDeContratAvecPlanning()).find((t) => t.id === id);
  if (!type) notFound();
  const liste = "/personnel/plannings-types";
  return (
    <>
      <EnteteForm
        titre={`Planning type · ${type.label}`}
        retour={liste}
        sousTitre={
          type.suivi
            ? `${type.suivi} personne${type.suivi > 1 ? "s" : ""} en service sui${type.suivi > 1 ? "vent" : "t"} ce planning type : ${type.suivi > 1 ? "leurs" : "ses"} horaires changeront avec lui.`
            : "Personne ne suit encore ce planning type."
        }
      />
      <form
        method="POST"
        id="form-principal"
        action={`${liste}/${type.id}/enregistrer`}
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <SectionForm
          titre="Horaires de travail de la semaine"
          icone="clock"
          aide="Ces horaires s'appliquent aux personnes de ce type de contrat qui suivent le planning type. Hors de ces plages, elles ne sont pas proposées automatiquement ; leurs affectations à venir devenues impossibles sont retirées et remises en affectation."
        >
          <GrilleHorairesTravail horaires={type.horaires} />
        </SectionForm>
      </form>
      <PiedForm
        retour={liste}
        supprimer={type.horaires ? `${liste}/${type.id}/supprimer` : null}
        confirmation={`Retirer le planning type « ${type.label} » ? Les personnes qui le suivent n'auront plus de contrainte horaire.`}
      />
      <ScriptDiffere src="/js/horaires.js" nonce={page.nonce} />
    </>
  );
}
