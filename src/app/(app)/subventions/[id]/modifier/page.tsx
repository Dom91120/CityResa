import { notFound } from "next/navigation";
import { EnteteForm, PiedForm } from "@/components/formulaire";
import {
  chargerSubvention,
  estModifiable,
  organisationsDemandeuses,
} from "@/modules/subventions/server";
import { ChampsSubvention } from "@/modules/subventions/vues";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier une demande de subvention - CityRésa" };

export default async function ModifierSubventionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const page = await contexteModule("subventions", "subventions");
  const id = idDeRoute((await params).id);
  const s = await chargerSubvention(id);
  if (!s) notFound();
  if (!page.user.canEdit("subventions"))
    redirigerAvecFlashDepuisRendu(`/subventions/${id}`, "Modification non autorisée.", "danger");
  if (!estModifiable(s))
    redirigerAvecFlashDepuisRendu(
      `/subventions/${id}`,
      "Cette demande est close : elle ne peut plus être modifiée.",
      "warning",
    );
  const organisations = await organisationsDemandeuses();
  if (!organisations.some((o) => o.id === s.organisationId))
    organisations.unshift({
      id: s.organisationId,
      name: s.organisation.name,
      type: s.organisation.type,
      validee: Boolean(s.organisation.validatedAt),
    });
  const exercices = [...new Set([s.exercice + 1, s.exercice, s.exercice - 1])].sort(
    (a, b) => b - a,
  );
  const retour = `/subventions/${id}`;
  return (
    <>
      <EnteteForm titre={`Modifier ${s.numero}`} retour={retour} sousTitre={s.organisation.name} />
      <form
        method="POST"
        id="form-principal"
        action={`/subventions/${id}/modifier`}
        className="form-seul"
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <ChampsSubvention
          v={{
            organisationId: s.organisationId,
            exercice: s.exercice,
            type: s.type,
            objet: s.objet,
            description: s.description,
            montantDemande: s.montantDemande,
            budgetTotal: s.budgetTotal,
            beneficiaires: s.beneficiaires,
          }}
          organisations={organisations}
          exercices={exercices}
        />
        <PiedForm
          retour={retour}
          supprimer={
            page.user.canDelete("subventions") && s.status === "deposee" && !s.avis.length
              ? `/subventions/${id}/supprimer`
              : null
          }
          confirmation={`Supprimer définitivement la demande ${s.numero} ?`}
        />
      </form>
    </>
  );
}
