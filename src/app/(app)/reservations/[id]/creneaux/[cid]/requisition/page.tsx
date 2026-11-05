import { notFound } from "next/navigation";
import { Champ, EnteteForm, Interrupteur, SectionForm, Zone } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { StatutResa } from "@/components/macros";
import { isoParis, plage } from "@/lib/libelles";
import { dernierPrevu, encoderAlternative, obstacleRequisition } from "@/lib/priorite";
import { voitEspace } from "@/modules/reservations/requetes";
import { alternativesPour } from "@/server/alternatives";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";
import { chargerReservation } from "@/server/reservations";

export const metadata = { title: "Priorité municipale - CityRésa" };

/** Réquisitionner un créneau d'un dossier acquis pour un événement de la Ville : déplacement ou annulation sans frais. */
export default async function RequisitionPage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}) {
  const page = await contexteModule("reservations");
  const p = await params;
  const id = idDeRoute(p.id);
  const cid = idDeRoute(p.cid);
  const r = await chargerReservation(id);
  if (!r) notFound();
  const fiche = `/reservations/${r.id}`;
  const cible = r.creneaux.find((c) => c.id === cid);
  if (!cible) notFound();
  if (
    !voitEspace(page.user, r.espaceId) ||
    !page.user.canEdit("reservations") ||
    !page.user.gereEspace(r.espaceId)
  )
    redirigerAvecFlashDepuisRendu(fiche, "Vous ne pouvez pas agir sur ce dossier.", "danger");
  const obstacle = obstacleRequisition(r, cible);
  if (obstacle) redirigerAvecFlashDepuisRendu(fiche, obstacle, "warning");

  const alternatives = await alternativesPour({
    espaceId: r.espaceId,
    i: cible,
    participants: r.participants,
    excludeReservationId: r.id,
    ignorerDelai: true,
    fermeture: cible,
  });
  const dernier = dernierPrevu(r.creneaux, cible.id);
  const depart = isoParis(cible.startAt);
  const fin = isoParis(cible.endAt);
  const pas = r.espace.slotStepMin * 60;
  const demandeur = r.organisation?.name ?? r.user?.name ?? "l'usager";

  return (
    <>
      <EnteteForm
        titre={
          <>
            Priorité municipale sur N°{r.numero} <StatutResa status={r.status} />
          </>
        }
        retour={fiche}
        sousTitre={`${r.title} · ${r.espace.name} · ${demandeur}`}
        libelle="Réquisitionner"
      />
      <form
        method="POST"
        action={`${fiche}/creneaux/${cible.id}/requisition`}
        id="form-principal"
        className="form-seul"
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />

        <SectionForm titre="Événement de la Ville" icone="landmark">
          <p className="text-muted small">
            La Ville a besoin de <strong>{r.espace.name}</strong> le{" "}
            <strong>{plage(cible.startAt, cible.endAt)}</strong>, réservé par {demandeur}. Le
            créneau est repris pour l'événement indiqué ; l'usager est prévenu avec ce motif.
          </p>
          <div className="grille grille-2">
            <Champ
              label="Événement"
              name="evenement"
              requis
              placeholder="Cérémonie, élection, Téléthon, conseil municipal…"
              pleine
            />
            <Zone
              label="Précisions pour l'usager"
              name="motif"
              rows={2}
              aide="Facultatif : reprises dans le courriel et dans l'historique du dossier."
            />
          </div>
        </SectionForm>

        <SectionForm titre="Sort du créneau de l'usager" icone="calendar-clock">
          <div className="form-check">
            <input
              className="form-check-input"
              type="radio"
              name="mode"
              id="mode-deplacer"
              value="deplacer"
              defaultChecked={alternatives.length > 0}
            />
            <label className="form-check-label" htmlFor="mode-deplacer">
              <strong>Déplacer</strong> le créneau sur un horaire libre équivalent
            </label>
          </div>
          <div className="ms-4 mb-3">
            {alternatives.length ? (
              <>
                {alternatives.map((a, i) => (
                  <div className="form-check" key={a.lienSaisie}>
                    <input
                      className="form-check-input"
                      type="radio"
                      name="alternative"
                      id={`alt-${i}`}
                      value={encoderAlternative(a)}
                      defaultChecked={i === 0}
                    />
                    <label className="form-check-label" htmlFor={`alt-${i}`}>
                      {a.texte}
                    </label>
                  </div>
                ))}
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="alternative"
                    id="alt-saisie"
                    value=""
                  />
                  <label className="form-check-label" htmlFor="alt-saisie">
                    Un autre horaire, sur ce même espace :
                  </label>
                </div>
              </>
            ) : (
              <p className="text-muted small mb-2">
                <Icone nom="info" taille={14} /> Aucun créneau équivalent libre n'a été trouvé
                automatiquement ; saisissez un horaire sur ce même espace, ou annulez le créneau.
              </p>
            )}
            <div className="grille grille-3 mt-2">
              <div>
                <label className="form-label" htmlFor="cr-date">
                  Date
                </label>
                <input
                  type="date"
                  name="date"
                  id="cr-date"
                  className="form-control"
                  defaultValue={depart.date}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="cr-debut">
                  Début
                </label>
                <input
                  type="time"
                  name="heure_debut"
                  id="cr-debut"
                  className="form-control"
                  step={pas}
                  defaultValue={depart.time}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="cr-fin">
                  Fin
                </label>
                <input
                  type="time"
                  name="heure_fin"
                  id="cr-fin"
                  className="form-control"
                  step={pas}
                  defaultValue={fin.time}
                />
              </div>
            </div>
            {r.signedAt ? (
              <p className="text-muted small mt-2 mb-0">
                La convention est signée : un déplacement produit un avenant, envoyé à l'usager pour
                signature.
              </p>
            ) : null}
          </div>
          <div className="form-check">
            <input
              className="form-check-input"
              type="radio"
              name="mode"
              id="mode-annuler"
              value="annuler"
              defaultChecked={alternatives.length === 0}
            />
            <label className="form-check-label" htmlFor="mode-annuler">
              <strong>Annuler</strong>{" "}
              {dernier
                ? "la réservation sans frais (c'est son dernier créneau prévu) ; les sommes réglées sont à rembourser"
                : "ce créneau sans frais, retiré du montant du dossier ; les autres créneaux sont maintenus"}
            </label>
          </div>
        </SectionForm>

        <SectionForm titre="Suite" icone="mail">
          <Interrupteur
            label="Prévenir l'usager par courriel"
            name="prevenir"
            coche
            aide="Modèle « Priorité municipale » : événement, précisions, sort du créneau, lien vers le dossier."
          />
          <Interrupteur
            label="Enchaîner sur la saisie de la réservation de la Ville"
            name="enchainer"
            coche
            aide="Ouvre la saisie d'une réservation pré-remplie sur le créneau libéré, au nom de l'événement."
          />
        </SectionForm>
      </form>
    </>
  );
}
