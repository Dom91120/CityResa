import { notFound } from "next/navigation";
import { EnteteForm, PiedForm, SectionForm } from "@/components/formulaire";
import { todayParisISO } from "@/lib/paris-time";
import { nomPersonne } from "@/lib/personnel";
import { ChampsAbsence } from "@/modules/personnel/vues";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";
import { type Params, param } from "@/server/paging";
import { chargerPersonneComplete, referentiel } from "@/server/personnel";

export const metadata = { title: "Ajouter une absence - CityRésa" };

/**
 * L'ajout d'une absence (congé, maladie, formation…) à une personne, ouvert depuis une case du
 * planning de service : le jour de la case est prérempli, et la page ramène au planning.
 */
export default async function AbsencePersonnePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}) {
  const page = await contexteModule("personnel", "personnel");
  await requireEdit("personnel");
  const id = idDeRoute((await params).id);
  const sp = await searchParams;
  const [p, motifs] = await Promise.all([
    chargerPersonneComplete(id),
    referentiel("absence_motif"),
  ]);
  if (!p) notFound();
  const fiche = `/personnel/personnes/${id}`;
  const next = param(sp, "next");
  const retour = next?.startsWith("/") && !next.startsWith("//") ? next : fiche;
  const date = param(sp, "date") ?? "";
  const jour = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayParisISO();
  return (
    <>
      <EnteteForm
        titre={`Ajouter une absence · ${nomPersonne(p)}`}
        retour={retour}
        libelle="Ajouter"
      />
      <form
        method="POST"
        id="form-principal"
        action={`${fiche}/absences_ajouter`}
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <input type="hidden" name="next" value={retour} />
        <SectionForm
          titre="Absence"
          icone="calendar-x"
          aide="Congés, RTT, maladie, formation… La personne n'est pas proposée sur la période ; ses affectations déjà posées sont retirées et remises en affectation."
        >
          <ChampsAbsence motifs={motifs} aujourdhui={jour} />
        </SectionForm>
      </form>
      <PiedForm retour={retour} libelle="Ajouter" />
    </>
  );
}
