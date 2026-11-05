import {
  Champ,
  EnteteForm,
  Grille,
  Interrupteur,
  SectionForm,
  Select,
  Zone,
} from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { VideBloc } from "@/components/liste";
import { ScriptDiffere } from "@/components/scripts";
import { ORGANISATION_TYPES, RESERVATION_STATUS } from "@/lib/constantes";
import { parseInt_ } from "@/lib/forms-util";
import { nomCourt } from "@/lib/libelles";
import { parisDateTimeToInstant, todayParisISO } from "@/lib/paris-time";
import {
  BlocRecurrence,
  ChoixMateriel,
  ChoixOptions,
  RappelEspace,
} from "@/modules/reservations/champs";
import { voitEspace } from "@/modules/reservations/requetes";
import {
  espaceSaisie,
  espacesSaisie,
  materielsPour,
  naturesEvenement,
  optionsPour,
  organisationsSaisie,
} from "@/modules/reservations/saisie";
import { saisonActive } from "@/server/calendrier";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { contexteModule } from "@/server/module";
import { param } from "@/server/paging";

export const metadata = { title: "Nouvelle réservation - CityRésa" };

function heureValide(v: string | undefined): string {
  return v && /^\d{2}:\d{2}$/.test(v) ? v : "";
}

export default async function NouvelleReservationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteModule("reservations");
  if (!page.user.canEdit("reservations"))
    redirigerAvecFlashDepuisRendu(
      "/reservations",
      "Vous n'avez pas le droit de saisir une réservation.",
      "danger",
    );
  const params = await searchParams;
  const espaceId = parseInt_(param(params, "espace"), null, 1);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(param(params, "date") ?? "")
    ? (param(params, "date") as string)
    : "";
  const heureDebut = heureValide(param(params, "heure_debut"));
  const heureFin = heureValide(param(params, "heure_fin"));
  const organisationId =
    parseInt_(param(params, "organisation_id"), null, 1) ??
    parseInt_(param(params, "organisation"), null, 1);
  const titre = param(params, "title") ?? "";
  const participants = param(params, "participants") ?? "";

  const [espaces, organisations, natures, saison] = await Promise.all([
    espacesSaisie(page.user),
    organisationsSaisie(),
    naturesEvenement(),
    saisonActive(),
  ]);
  const espace = espaceId && voitEspace(page.user, espaceId) ? await espaceSaisie(espaceId) : null;
  const debut = date && heureDebut ? parisDateTimeToInstant(date, heureDebut) : null;
  const finBrute = date && heureFin ? parisDateTimeToInstant(date, heureFin) : null;
  const fin =
    debut && finBrute
      ? finBrute <= debut
        ? new Date(finBrute.getTime() + 86_400_000)
        : finBrute
      : null;
  const fenetre = debut && fin ? { de: debut, a: fin } : null;
  const [options, materiels] = espace
    ? await Promise.all([optionsPour(espace.id), materielsPour(page.user, fenetre)])
    : [[], []];
  const pas = espace ? espace.slotStepMin * 60 : 900;
  const retour = "/reservations";

  return (
    <>
      <EnteteForm
        titre="Nouvelle réservation"
        retour={retour}
        sousTitre="Saisie par un agent : la demande est créée au nom de l'usager choisi."
        libelle="Créer la réservation"
      />

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="form-section">
            <div className="form-section-titre">
              <Icone nom="door-open" taille={14} /> Espace
            </div>
            <form
              method="GET"
              action="/reservations/nouvelle"
              className="d-flex gap-2 align-items-end flex-wrap"
            >
              {date ? <input type="hidden" name="date" value={date} /> : null}
              {heureDebut ? <input type="hidden" name="heure_debut" value={heureDebut} /> : null}
              {heureFin ? <input type="hidden" name="heure_fin" value={heureFin} /> : null}
              {organisationId ? (
                <input type="hidden" name="organisation_id" value={organisationId} />
              ) : null}
              <div style={{ flex: "1 1 320px" }}>
                <label className="form-label" htmlFor="choix-espace">
                  Espace à réserver <span className="req">*</span>
                </label>
                <select
                  name="espace"
                  id="choix-espace"
                  className="form-select"
                  defaultValue={espace ? String(espace.id) : ""}
                  data-recharger="#form-principal"
                  data-recharger-champs="date,heure_debut,heure_fin,organisation_id,title,participants"
                >
                  <option value="">Choisir un espace…</option>
                  {espaces.map((e) => (
                    <option key={e.id} value={e.id}>
                      {nomCourt(e)} · {e.site.name}
                      {e.status !== "actif"
                        ? ` (${e.status === "maintenance" ? "en travaux" : "inactif"})`
                        : ""}
                    </option>
                  ))}
                </select>
                <div className="form-text">
                  Les options, le matériel et les tarifs se mettent à jour selon l'espace choisi.
                </div>
              </div>
              <button type="submit" className="btn btn-outline-secondary">
                Appliquer
              </button>
            </form>
          </div>

          {!espace ? (
            <div className="data-card">
              <VideBloc
                icone="door-open"
                titre="Commencez par choisir un espace"
                texte="Le formulaire s'adapte à ses règles (horaires, pas de réservation, options, tarifs)."
              />
            </div>
          ) : (
            <form
              method="POST"
              action="/reservations/nouvelle"
              id="form-principal"
              data-devis="#devis"
              data-double-envoi
            >
              <input type="hidden" name="csrf_token" value={page.csrf} />
              <input type="hidden" name="espace_id" value={espace.id} />

              <SectionForm titre="Demandeur" icone="users">
                <Grille colonnes={2}>
                  <div>
                    <label className="form-label" htmlFor="f-organisation_id">
                      Usager (organisation ou particulier) <span className="req">*</span>
                    </label>
                    <select
                      name="organisation_id"
                      id="f-organisation_id"
                      className="form-select"
                      defaultValue={organisationId ? String(organisationId) : ""}
                      required
                    >
                      <option value="">Choisir…</option>
                      {organisations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} · {ORGANISATION_TYPES[o.type] ?? o.type}
                          {o.profil ? ` · ${o.profil.label}` : ""}
                          {!o.validatedAt ? " · non validé" : ""}
                        </option>
                      ))}
                    </select>
                    <div className="form-text">
                      Le tarif dépend du profil de l'usager.{" "}
                      <a href="/usagers/nouveau">Nouvel usager</a>
                    </div>
                  </div>
                </Grille>
              </SectionForm>

              <SectionForm
                titre="Créneau"
                icone="calendar-days"
                aide={`Heures de Paris, par pas de ${espace.slotStepMin} min. Une fin avant le début signifie « le lendemain ».`}
              >
                <Grille colonnes={3}>
                  <Champ
                    label="Date"
                    name="date"
                    type="date"
                    valeur={date || todayParisISO()}
                    requis
                  />
                  <Champ
                    label="Heure de début"
                    name="heure_debut"
                    type="time"
                    valeur={heureDebut}
                    requis
                    step={pas}
                  />
                  <Champ
                    label="Heure de fin"
                    name="heure_fin"
                    type="time"
                    valeur={heureFin}
                    requis
                    step={pas}
                  />
                  <BlocRecurrence saison={saison} />
                </Grille>
              </SectionForm>

              <SectionForm titre="Événement" icone="party-popper">
                <Grille colonnes={2}>
                  <Champ
                    label="Objet de la réservation"
                    name="title"
                    valeur={titre}
                    requis
                    placeholder="Assemblée générale, cours de yoga, mariage…"
                    pleine
                  />
                  <Select
                    label="Nature de l'événement"
                    name="nature_id"
                    options={natures.map((n) => [String(n.id), n.label])}
                    blank="—"
                  />
                  <Champ
                    label="Participants attendus"
                    name="participants"
                    type="number"
                    min={0}
                    valeur={participants}
                    aide={
                      espace.capacityStanding || espace.capacitySeated
                        ? `Capacité : ${espace.capacitySeated ?? "—"} assis / ${espace.capacityStanding ?? "—"} debout`
                        : undefined
                    }
                  />
                  <Zone
                    label="Description"
                    name="description"
                    rows={3}
                    placeholder="Déroulé, besoins particuliers, horaires d'installation…"
                  />
                  <Interrupteur
                    label="Événement ouvert au public (affichable à l'agenda de la ville)"
                    name="is_public_event"
                    coche={false}
                  />
                </Grille>
              </SectionForm>

              <SectionForm
                titre="Options"
                icone="sparkles"
                aide="Prestations facturées en plus de l'espace."
              >
                <ChoixOptions options={options} choisies={new Map()} />
              </SectionForm>

              {page.features.materiel ? (
                <SectionForm
                  titre="Matériel"
                  icone="boxes"
                  aide={
                    fenetre
                      ? "Stock disponible sur les dates saisies."
                      : "Indiquez d'abord la date et les heures pour connaître le stock disponible sur ces dates."
                  }
                >
                  <ChoixMateriel
                    materiels={materiels}
                    choisis={new Map()}
                    fenetreConnue={Boolean(fenetre)}
                  />
                </SectionForm>
              ) : null}

              <SectionForm
                titre="Décision"
                icone="check-check"
                aide="Un agent peut créer un dossier déjà accepté ou confirmé."
              >
                <Grille colonnes={3}>
                  <Select
                    label="Statut initial"
                    name="statut_initial"
                    valeur="a_traiter"
                    options={(["a_traiter", "acceptee", "confirmee"] as const).map((s) => [
                      s,
                      RESERVATION_STATUS[s].label,
                    ])}
                    aide="« Acceptée » envoie la convention à signer ; « Confirmée » réserve l'espace d'office."
                  />
                  <div className="pt-4">
                    <Interrupteur
                      label="Mise à disposition gratuite"
                      name="gratuit"
                      coche={false}
                      aide="Aucune redevance ni caution ; le fondement est alors obligatoire."
                    />
                    <input
                      type="text"
                      name="gratuit_motif"
                      className="form-control form-control-sm mt-1"
                      placeholder="Fondement : délibération, convention…"
                      aria-label="Fondement de la gratuité"
                      maxLength={300}
                    />
                  </div>
                  <div className="pt-4">
                    <Interrupteur
                      label="Passer outre le délai et l'horizon"
                      name="ignorer_delai"
                      coche={false}
                      aide={`Délai de l'espace : ${espace.delayMinDays} j, horizon ${espace.horizonMaxDays} j.`}
                    />
                  </div>
                </Grille>
              </SectionForm>

              <div className="form-pied">
                <a href={retour} className="btn btn-outline-secondary">
                  Annuler
                </a>
                <button type="submit" className="btn btn-primary">
                  <Icone nom="check" taille={14} /> Créer la réservation
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="col-lg-4">
          {espace ? (
            <>
              <div className="data-card mb-3">
                <div className="card-header-custom">
                  <h6>
                    <Icone nom="receipt" taille={16} classes="text-primary" /> Devis en direct
                  </h6>
                </div>
                <div className="card-body-custom p-3" id="devis">
                  <p className="text-muted small mb-0">
                    Le montant se calcule dès que la date et les heures sont saisies.
                  </p>
                </div>
              </div>
              <RappelEspace espace={espace} />
            </>
          ) : null}
        </div>
      </div>
      <ScriptDiffere src="/js/reservations.js" nonce={page.nonce} />
    </>
  );
}
