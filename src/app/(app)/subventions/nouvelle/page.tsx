import { EnteteForm, PiedForm } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { exerciceParDefaut, organisationsDemandeuses } from "@/modules/subventions/server";
import { ChampsSubvention } from "@/modules/subventions/vues";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Nouvelle demande de subvention - CityRésa" };

export default async function NouvelleSubventionPage({
  searchParams,
}: {
  searchParams: Promise<{ organisation?: string }>;
}) {
  const page = await contexteModule("subventions", "subventions");
  if (!page.user.canEdit("subventions"))
    redirigerAvecFlashDepuisRendu(
      "/subventions",
      "Vous ne pouvez pas déposer de demande de subvention.",
      "danger",
    );
  const sp = await searchParams;
  const organisations = await organisationsDemandeuses();
  const exercice = exerciceParDefaut();
  const exercices = [exercice + 1, exercice, exercice - 1, exercice - 2];
  const preselect = Number.parseInt(sp.organisation ?? "", 10);
  return (
    <>
      <EnteteForm
        titre="Déposer une demande de subvention"
        retour="/subventions"
        sousTitre="Au nom d'une association (dossier papier ou reçu par courriel)."
        libelle="Déposer la demande"
      />
      {organisations.length ? null : (
        <div className="astuce mb-3">
          <Icone nom="info" taille={16} />
          <span>
            Aucune association n'est enregistrée : créez d'abord sa fiche dans{" "}
            <a href="/usagers">Usagers</a>.
          </span>
        </div>
      )}
      <form
        method="POST"
        id="form-principal"
        action="/subventions/nouvelle"
        className="form-seul"
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <ChampsSubvention
          v={{
            organisationId: Number.isInteger(preselect) && preselect > 0 ? preselect : null,
            exercice,
            type: "fonctionnement",
            objet: "",
            description: null,
            montantDemande: null,
            budgetTotal: null,
            beneficiaires: null,
          }}
          organisations={organisations}
          exercices={exercices}
        />
        <div className="astuce mb-3">
          <Icone nom="lightbulb" taille={16} />
          <span>
            La demande reçoit un numéro (SUB-EXERCICE-NNNN) et l'association en est informée par
            courriel. Les pièces (statuts, budget, RIB…) se déposent ensuite depuis la fiche.
          </span>
        </div>
        <PiedForm retour="/subventions" libelle="Déposer la demande" />
      </form>
    </>
  );
}
