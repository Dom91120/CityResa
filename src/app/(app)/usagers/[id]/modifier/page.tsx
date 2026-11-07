import { notFound } from "next/navigation";
import {
  Champ,
  EnteteForm,
  Grille,
  Interrupteur,
  PiedForm,
  SectionForm,
  Select,
  Zone,
} from "@/components/formulaire";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import { isoDate } from "@/lib/forms-util";
import { profils } from "@/modules/usagers/server";
import { prisma } from "@/server/db";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier un usager - CityRésa" };

export default async function ModifierUsagerPage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("usagers");
  const id = idDeRoute((await params).id);
  const org = await prisma.organisation.findUnique({ where: { id } });
  if (!org) notFound();
  if (!page.user.canEdit("usagers"))
    redirigerAvecFlashDepuisRendu(
      `/usagers/${id}`,
      "Vous n'avez pas le droit de modifier cet usager.",
      "danger",
    );
  const listeProfils = await profils();
  const retour = `/usagers/${id}`;
  return (
    <>
      <EnteteForm titre={org.name} retour={retour} sousTitre="Modifier l'organisation" />
      <form
        method="POST"
        action={`/usagers/${id}/modifier`}
        id="form-principal"
        className="form-seul"
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <SectionForm titre="Organisation" icone="building-2">
          <Grille colonnes={3}>
            <Select
              label="Type"
              name="type"
              options={Object.entries(ORGANISATION_TYPES)}
              valeur={org.type}
              requis
            />
            <Champ label="Nom" name="name" valeur={org.name} requis />
            <Select
              label="Profil tarifaire"
              name="profil_id"
              options={listeProfils.map((p) => [String(p.id), p.label])}
              valeur={org.profilId}
              blank="— Aucun —"
            />
            <Champ label="Adresse" name="address" valeur={org.address} pleine />
            <Champ label="Code postal" name="postal_code" valeur={org.postalCode} />
            <Champ label="Ville" name="city" valeur={org.city} />
            <Champ label="SIRET" name="siret" valeur={org.siret} />
            <Champ label="RNA" name="rna" valeur={org.rna} />
            <Champ label="Site web" name="website" type="url" valeur={org.website} />
            <Champ label="Courriel" name="email_org" type="email" valeur={org.email} />
            <Champ label="Téléphone" name="phone_org" type="tel" valeur={org.phone} />
          </Grille>
        </SectionForm>
        <SectionForm
          titre="Représentant légal"
          icone="user-check"
          aide="Président(e) d'une association, dirigeant(e) d'une entreprise. Une association doit aussi indiquer la date de l'assemblée générale qui l'a nommé(e) : ces données sont exigées avant toute demande de réservation."
        >
          <Grille colonnes={3}>
            <Champ label="Prénom" name="legal_first_name" valeur={org.legalFirstName} />
            <Champ label="Nom" name="legal_last_name" valeur={org.legalLastName} />
            <Champ
              label="Date de l'AG de nomination"
              name="legal_appointed_at"
              type="date"
              valeur={isoDate(org.legalAppointedAt)}
              aide="Associations seulement"
            />
            <div style={{ gridColumn: "1 / -1" }}>
              <Interrupteur
                label="Association conventionnée avec la Ville"
                name="conventionnee"
                coche={org.conventionnee}
                aide="Prioritaire dans les campagnes annuelles de créneaux, après les services de la Ville et les autres collectivités."
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Interrupteur
                label="Association sportive"
                name="sportive"
                coche={org.sportive}
                aide="Dossier de demande de subvention et plan de budget des associations sportives."
              />
            </div>
          </Grille>
        </SectionForm>
        <SectionForm
          titre="Notes internes"
          icone="sticky-note"
          aide="Visibles par les agents seulement."
        >
          <Grille colonnes={2}>
            <Zone label="Notes" name="notes" valeur={org.notes} rows={4} />
          </Grille>
        </SectionForm>
        <PiedForm retour={retour} />
      </form>
    </>
  );
}
