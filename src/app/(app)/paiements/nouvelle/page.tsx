import {
  Champ,
  EnteteForm,
  Grille,
  Interrupteur,
  PiedForm,
  SectionForm,
  Select,
} from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { FACTURE_TYPES } from "@/lib/constantes";
import { addParisDays, todayParisISO } from "@/lib/paris-time";
import { organisationsFacturables } from "@/modules/paiements/server";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Nouvelle facture - CityRésa" };

export default async function NouvelleFacturePage() {
  const page = await contexteModule("paiements", "paiements");
  if (!page.user.canEdit("paiements"))
    redirigerAvecFlashDepuisRendu("/paiements", "Vous ne pouvez pas émettre de facture.", "danger");
  const organisations = await organisationsFacturables();
  const taux = page.user.settings.TVA_TAUX || 0;
  const echeance = todayParisISO(addParisDays(new Date(), 30));
  return (
    <>
      <EnteteForm
        titre="Nouvelle facture libre"
        retour="/paiements"
        sousTitre="Une facture hors dossier de réservation : prestation, matériel, régularisation…"
        libelle="Émettre la facture"
      />
      <form
        method="POST"
        id="form-principal"
        action="/paiements/nouvelle"
        className="form-seul"
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <SectionForm titre="Débiteur" icone="building-2">
          <Grille colonnes={2}>
            <Select
              label="Organisation"
              name="organisation_id"
              options={organisations}
              blank="Choisir…"
              requis
              aide="Les factures d'un particulier passent par son dossier de réservation."
            />
            <Select
              label="Type"
              name="type"
              options={Object.entries(FACTURE_TYPES)}
              valeur="solde"
              requis
            />
          </Grille>
        </SectionForm>
        <SectionForm
          titre="Montant"
          icone="euro"
          aide={
            taux
              ? `TVA au taux de ${String(taux).replace(".", ",")} % calculée depuis le montant TTC (sans TVA pour une caution ou un avoir).`
              : "Aucune TVA n'est appliquée (taux à 0 dans les paramètres)."
          }
        >
          <Grille colonnes={2}>
            <Champ label="Libellé" name="libelle" requis pleine placeholder="Objet de la facture" />
            <Champ
              label="Montant TTC (€)"
              name="montant_ttc"
              type="number"
              step="0.01"
              min="0.01"
              requis
            />
            <Champ label="Échéance" name="due_at" type="date" valeur={echeance} />
          </Grille>
        </SectionForm>
        <SectionForm titre="Envoi" icone="send">
          <Interrupteur
            label="Envoyer la facture par courriel à l'organisation (PDF joint)"
            name="envoyer"
            coche
            aide="Seulement si l'organisation a une adresse de courriel ; vous pourrez la renvoyer depuis la fiche."
          />
        </SectionForm>
        <div className="astuce mb-3">
          <Icone nom="lightbulb" taille={16} />
          <span>
            Le numéro est attribué à l'émission (FAC-ANNÉE-NNNN). Le PDF est produit à la demande
            depuis la fiche de la facture.
          </span>
        </div>
        <PiedForm retour="/paiements" libelle="Émettre la facture" />
      </form>
    </>
  );
}
