import {
  Champ,
  EnteteForm,
  Grille,
  Interrupteur,
  PiedForm,
  SectionForm,
  Select,
} from "@/components/formulaire";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import { profils } from "@/modules/usagers/server";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Nouvel usager - CityRésa" };

export default async function NouvelUsagerPage() {
  const page = await contexteModule("usagers");
  if (!page.user.canEdit("usagers"))
    redirigerAvecFlashDepuisRendu(
      "/usagers",
      "Vous n'avez pas le droit de créer un usager.",
      "danger",
    );
  const listeProfils = await profils();
  return (
    <>
      <EnteteForm
        titre="Nouvel usager"
        retour="/usagers"
        sousTitre="L'organisation et son premier compte d'accès au portail. Un mot de passe provisoire sera généré et affiché une seule fois."
        libelle="Créer l'usager"
      />
      <form
        method="POST"
        action="/usagers/nouveau"
        id="form-principal"
        className="form-seul"
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <SectionForm
          titre="Organisation"
          icone="building-2"
          aide="Pour un particulier, le nom de l'organisation est facultatif : le compte portera son nom."
        >
          <Grille colonnes={3}>
            <Select
              label="Type"
              name="type"
              options={Object.entries(ORGANISATION_TYPES)}
              valeur="association"
              requis
            />
            <Champ label="Nom de l'organisation" name="name" placeholder="Association des Amis…" />
            <Select
              label="Profil tarifaire"
              name="profil_id"
              options={listeProfils.map((p) => [String(p.id), p.label])}
              blank="Automatique (type et code postal)"
              aide="Détermine les tarifs appliqués et les espaces accessibles."
            />
            <Champ label="Adresse" name="address" pleine />
            <Champ label="Code postal" name="postal_code" attrs={{ inputMode: "numeric" }} />
            <Champ label="Ville" name="city" />
            <Champ label="SIRET" name="siret" />
            <Champ label="RNA (associations)" name="rna" placeholder="W…" />
            <Champ label="Site web" name="website" type="url" placeholder="https://" />
            <Champ label="Courriel de l'organisation" name="email_org" type="email" />
            <Champ label="Téléphone de l'organisation" name="phone_org" type="tel" />
          </Grille>
        </SectionForm>
        <SectionForm
          titre="Représentant légal"
          icone="user-check"
          aide="Président(e) d'une association, dirigeant(e) d'une entreprise. Une association doit aussi indiquer la date de l'assemblée générale qui l'a nommé(e) : ces données sont exigées avant toute demande de réservation."
        >
          <Grille colonnes={3}>
            <Champ label="Prénom" name="legal_first_name" />
            <Champ label="Nom" name="legal_last_name" />
            <Champ
              label="Date de l'AG de nomination"
              name="legal_appointed_at"
              type="date"
              aide="Associations seulement"
            />
            <div style={{ gridColumn: "1 / -1" }}>
              <Interrupteur
                label="Association conventionnée avec la Ville"
                name="conventionnee"
                coche={false}
                aide="Prioritaire dans les campagnes annuelles de créneaux, après les services de la Ville et les autres collectivités."
              />
            </div>
          </Grille>
        </SectionForm>
        <SectionForm
          titre="Premier compte d'accès"
          icone="circle-user"
          aide="La personne qui déposera les demandes. Elle recevra le courriel de bienvenue à cette adresse."
        >
          <Grille colonnes={3}>
            <Champ label="Prénom" name="first_name" requis />
            <Champ label="Nom" name="last_name" requis />
            <Champ label="Fonction" name="fonction" placeholder="Présidente, gérant…" />
            <Champ label="Courriel (identifiant)" name="email" type="email" requis />
            <Champ label="Téléphone" name="phone" type="tel" />
          </Grille>
        </SectionForm>
        <PiedForm retour="/usagers" libelle="Créer l'usager" />
      </form>
    </>
  );
}
