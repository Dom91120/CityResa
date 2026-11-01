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
import { StatutResa } from "@/components/macros";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import { plage } from "@/lib/libelles";
import { voitEspace } from "@/modules/reservations/requetes";
import { agentsActifs, naturesEvenement, organisationsSaisie } from "@/modules/reservations/saisie";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";
import { chargerReservation } from "@/server/reservations";

export const metadata = { title: "Modifier la réservation - CityRésa" };

export default async function ModifierReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const page = await contexteModule("reservations");
  const id = idDeRoute((await params).id);
  const r = await chargerReservation(id);
  if (!r) notFound();
  const fiche = `/reservations/${r.id}`;
  if (!voitEspace(page.user, r.espaceId) || !page.user.canEdit("reservations"))
    redirigerAvecFlashDepuisRendu(fiche, "Vous ne pouvez pas modifier ce dossier.", "danger");
  if (r.status === "archivee")
    redirigerAvecFlashDepuisRendu(fiche, "Un dossier archivé ne se modifie plus.", "warning");
  const [organisations, natures, agents] = await Promise.all([
    organisationsSaisie(),
    naturesEvenement(),
    agentsActifs(),
  ]);

  return (
    <>
      <EnteteForm
        titre={
          <>
            Modifier la réservation N°{r.numero} <StatutResa status={r.status} />
          </>
        }
        retour={fiche}
        sousTitre={`${r.espace.name} · ${plage(r.startAt, r.endAt)} — les créneaux se gèrent depuis la fiche.`}
      />
      <form
        method="POST"
        action={`${fiche}/modifier`}
        id="form-principal"
        className="form-seul"
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <SectionForm titre="Événement" icone="party-popper">
          <Grille colonnes={2}>
            <Champ label="Objet de la réservation" name="title" valeur={r.title} requis pleine />
            <Select
              label="Nature"
              name="nature_id"
              valeur={r.natureId}
              options={natures.map((n) => [String(n.id), n.label])}
              blank="—"
            />
            <Champ
              label="Participants attendus"
              name="participants"
              type="number"
              min={0}
              valeur={r.participants}
            />
            <Zone label="Description" name="description" valeur={r.description} rows={4} />
            <Interrupteur
              label="Événement ouvert au public"
              name="is_public_event"
              coche={r.isPublicEvent}
            />
          </Grille>
        </SectionForm>
        <SectionForm
          titre="Demandeur et suivi"
          icone="users"
          aide="Changer d'organisation recalcule les montants selon son profil tarifaire."
        >
          <Grille colonnes={2}>
            <Select
              label="Organisation"
              name="organisation_id"
              valeur={r.organisationId}
              options={organisations.map((o) => [
                String(o.id),
                `${o.name} · ${ORGANISATION_TYPES[o.type] ?? o.type}${o.profil ? ` · ${o.profil.label}` : ""}`,
              ])}
              blank="— Aucune —"
            />
            <Select
              label="Agent assigné"
              name="agent_id"
              valeur={r.agentId}
              options={agents.map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim() || a.email])}
              blank="Personne"
            />
            <Zone
              label="Notes internes (invisibles pour l'usager)"
              name="internal_notes"
              valeur={r.internalNotes}
              rows={4}
            />
          </Grille>
        </SectionForm>
        <PiedForm retour={fiche} />
      </form>
    </>
  );
}
