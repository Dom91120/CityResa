import { EnteteForm, Grille, PiedForm, SectionForm, Select } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { SUBVENTION_NATURES } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import { exerciceParDefaut, organisationsDemandeuses } from "@/modules/subventions/server";
import { chargerCampagnes } from "@/server/campagnes-subvention";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Nouveau dossier de subvention - CityRésa" };

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
  const [organisations, campagnes] = await Promise.all([
    organisationsDemandeuses(),
    chargerCampagnes(),
  ]);
  const exercice = exerciceParDefaut();
  const exercices = [
    ...new Set([exercice + 1, exercice, exercice - 1, ...campagnes.map((c) => c.exercice)]),
  ].sort((a, b) => b - a);
  const preselect = Number.parseInt(sp.organisation ?? "", 10);
  const ouverte = campagnes.find((c) => c.status === "ouverte");
  return (
    <>
      <EnteteForm
        titre="Commencer un dossier de subvention"
        retour="/subventions"
        sousTitre="Au nom d'une association (dossier papier ou reçu par courriel) : vous remplissez ensuite les fiches."
        libelle="Commencer le dossier"
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
        <SectionForm titre="Association et exercice" icone="building-2">
          <Grille colonnes={3}>
            <Select
              label="Association demandeuse"
              name="organisation_id"
              options={organisations.map((o) => [
                String(o.id),
                o.validee ? o.name : `${o.name} (non validée)`,
              ])}
              valeur={Number.isInteger(preselect) && preselect > 0 ? preselect : null}
              blank="Choisir…"
              requis
              aide="Seule une association peut demander une subvention."
            />
            <Select
              label="Exercice"
              name="exercice"
              options={exercices.map((e) => {
                const c = campagnes.find((x) => x.exercice === e);
                return [String(e), c ? `${e} · ${c.label}` : String(e)];
              })}
              valeur={ouverte?.exercice ?? exercice}
              requis
              aide="Le dossier est rattaché à la campagne de l'exercice si elle existe."
            />
            <Select
              label="Nature"
              name="nature"
              options={Object.entries(SUBVENTION_NATURES)}
              valeur="renouvellement"
              requis
              aide="Une première demande si l'association n'a pas de dossier antérieur."
            />
          </Grille>
        </SectionForm>
        <div className="astuce mb-3">
          <Icone nom="lightbulb" taille={16} />
          <span>
            Le dossier est pré-rempli depuis la fiche de l'association et son dossier précédent. Il
            reçoit son numéro (SUB-EXERCICE-NNNN) au dépôt ; un dépôt hors période de campagne est
            possible avec un motif de dérogation.
            {ouverte
              ? ` Campagne ouverte : ${ouverte.label}, dépôt jusqu'au ${dateCourte(ouverte.clotureDate)}.`
              : " Aucune campagne ouverte actuellement."}
          </span>
        </div>
        <PiedForm retour="/subventions" libelle="Commencer le dossier" />
      </form>
    </>
  );
}
