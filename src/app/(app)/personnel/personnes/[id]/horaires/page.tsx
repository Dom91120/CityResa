import { notFound } from "next/navigation";
import { EnteteForm, PiedForm, SectionForm } from "@/components/formulaire";
import { lireModeHoraires } from "@/lib/affectation";
import { lireHoraires } from "@/lib/creneaux";
import { nomPersonne } from "@/lib/personnel";
import { GrilleHorairesTravail } from "@/modules/personnel/vues";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";
import { type Params, param } from "@/server/paging";
import { chargerPersonneComplete } from "@/server/personnel";

export const metadata = { title: "Horaires de travail - CityRésa" };

/** Une adresse interne de retour (le planning d'où l'on vient), sinon la fiche. */
function retourSur(next: string | undefined, repli: string): string {
  return next?.startsWith("/") && !next.startsWith("//") ? next : repli;
}

/**
 * Les horaires de travail d'une personne, seuls : ouverte depuis le planning de service, la page
 * y ramène après l'enregistrement.
 */
export default async function HorairesPersonnePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}) {
  const page = await contexteModule("personnel", "personnel");
  await requireEdit("personnel");
  const id = idDeRoute((await params).id);
  const p = await chargerPersonneComplete(id);
  if (!p) notFound();
  const fiche = `/personnel/personnes/${id}`;
  const retour = retourSur(param(await searchParams, "next"), fiche);
  return (
    <>
      <EnteteForm
        titre={`Horaires de travail · ${nomPersonne(p)}`}
        retour={retour}
        sousTitre={[p.fonction, p.contratType ? `${p.contratType.label} · ${p.quotite} %` : null]
          .filter(Boolean)
          .join(" · ")}
      />
      <form method="POST" id="form-principal" action={`${fiche}/horaires`} data-double-envoi>
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <input type="hidden" name="next" value={retour} />
        <SectionForm
          titre="Horaires de travail"
          icone="clock"
          aide="Si les nouveaux horaires rendent impossibles des affectations à venir, elles sont retirées et remises en affectation."
        >
          <GrilleHorairesTravail
            horaires={p.horaires}
            mode={lireModeHoraires(p.horairesMode)}
            type={
              p.contratType
                ? {
                    label: p.contratType.label,
                    horaires: lireHoraires(p.contratType.planningType?.horaires),
                  }
                : null
            }
          />
        </SectionForm>
      </form>
      <PiedForm retour={retour} />
    </>
  );
}
