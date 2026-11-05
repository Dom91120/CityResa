import { notFound } from "next/navigation";
import { EnteteForm, Interrupteur, SectionForm } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { StatutResa } from "@/components/macros";
import { type ReservationStatus, STATUTS_FERMES } from "@/lib/constantes";
import { decrireRecurrence, lireRecurrence } from "@/lib/creneaux";
import { isoParis, plage } from "@/lib/libelles";
import { creneauxPrevus, creneauxVises, PORTEES } from "@/lib/serie";
import { voitEspace } from "@/modules/reservations/requetes";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";
import { chargerReservation } from "@/server/reservations";
import { serieModifiable } from "@/server/serie";

export const metadata = { title: "Modifier un créneau - CityRésa" };

/** Déplacer une occurrence d'un dossier : celle-ci, celle-ci et les suivantes, ou toute la série. */
export default async function ModifierCreneauPage({
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
    redirigerAvecFlashDepuisRendu(fiche, "Vous ne pouvez pas modifier ce dossier.", "danger");
  if (!serieModifiable(r))
    redirigerAvecFlashDepuisRendu(
      fiche,
      "Les créneaux de ce dossier ne se modifient plus.",
      "warning",
    );
  if (cible.status !== "prevu")
    redirigerAvecFlashDepuisRendu(fiche, "Ce créneau est annulé.", "warning");

  const prevus = creneauxPrevus(r.creneaux);
  const rec = lireRecurrence(r.recurrence);
  const nbPar = Object.fromEntries(
    PORTEES.map((o) => [o.value, creneauxVises(r.creneaux, cible, o.value).length]),
  ) as Record<string, number>;
  const enSerie = prevus.length > 1;
  const depart = isoParis(cible.startAt);
  const fin = isoParis(cible.endAt);
  const prevenirParDefaut = STATUTS_FERMES.includes(r.status as ReservationStatus);
  const pas = r.espace.slotStepMin * 60;

  return (
    <>
      <EnteteForm
        titre={
          <>
            Modifier un créneau de N°{r.numero} <StatutResa status={r.status} />
          </>
        }
        retour={fiche}
        sousTitre={`${r.title} · ${r.espace.name}${rec ? ` · ${decrireRecurrence(rec)}` : ""}`}
        libelle="Déplacer"
      />
      <form
        method="POST"
        action={`${fiche}/creneaux/${cible.id}/modifier`}
        id="form-principal"
        className="form-seul"
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />

        <SectionForm titre="Nouvel horaire" icone="calendar-clock">
          <p className="text-muted small">
            Actuellement : <strong>{plage(cible.startAt, cible.endAt)}</strong>. Heures de Paris ;
            la disponibilité de l'espace et ses horaires d'ouverture sont vérifiés.
          </p>
          <div className="grille grille-3">
            <div>
              <label className="form-label" htmlFor="cr-date">
                Date <span className="req">*</span>
              </label>
              <input
                type="date"
                name="date"
                id="cr-date"
                className="form-control"
                required
                defaultValue={depart.date}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="cr-debut">
                Début <span className="req">*</span>
              </label>
              <input
                type="time"
                name="heure_debut"
                id="cr-debut"
                className="form-control"
                required
                step={pas}
                defaultValue={depart.time}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="cr-fin">
                Fin <span className="req">*</span>
              </label>
              <input
                type="time"
                name="heure_fin"
                id="cr-fin"
                className="form-control"
                required
                step={pas}
                defaultValue={fin.time}
              />
            </div>
          </div>
        </SectionForm>

        <SectionForm titre="Portée" icone="repeat">
          {enSerie ? (
            <>
              <p className="text-muted small">
                Les créneaux visés sont décalés du même nombre de jours que celui-ci et prennent ses
                nouvelles heures. Les créneaux annulés ne bougent pas.
              </p>
              {PORTEES.map((o, i) => (
                <div className="form-check" key={o.value}>
                  <input
                    className="form-check-input"
                    type="radio"
                    name="portee"
                    id={`portee-${o.value}`}
                    value={o.value}
                    defaultChecked={i === 0}
                  />
                  <label className="form-check-label" htmlFor={`portee-${o.value}`}>
                    {o.label}{" "}
                    <span className="text-muted">
                      ({nbPar[o.value]} créneau{nbPar[o.value] > 1 ? "x" : ""})
                    </span>
                  </label>
                </div>
              ))}
            </>
          ) : (
            <>
              <input type="hidden" name="portee" value="cette" />
              <p className="text-muted small mb-0">
                <Icone nom="info" taille={14} /> Ce dossier n'a qu'un créneau prévu : seul celui-ci
                est déplacé.
              </p>
            </>
          )}
        </SectionForm>

        <SectionForm titre="Usager" icone="mail">
          <Interrupteur
            label="Prévenir l'usager par courriel"
            name="prevenir"
            coche={prevenirParDefaut}
            aide="Modèle « Créneaux modifiés » : anciens et nouveaux horaires, montant recalculé. Les montants du dossier sont recalculés dans tous les cas."
          />
        </SectionForm>
      </form>
    </>
  );
}
