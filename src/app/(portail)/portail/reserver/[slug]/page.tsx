import { notFound, redirect } from "next/navigation";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import { JOURS_ISO, MATERIEL_UNITES, OPTION_UNITES } from "@/lib/constantes";
import { manquesDossier, phraseManques } from "@/lib/dossier-usager";
import { duree, montant, nomCourt } from "@/lib/libelles";
import { addParisDays, parisMidnight, todayParisISO } from "@/lib/paris-time";
import { aPartirDe } from "@/lib/tarification";
import {
  documentsPublics,
  espacePublic,
  libelleReserveA,
  organisationDe,
  photoPrincipale,
  profilAutorise,
} from "@/modules/portail/catalogue";
import { Etapes } from "@/modules/portail/vues";
import { CochesCalendrier } from "@/modules/reservations/champs";
import { saisonActive } from "@/server/calendrier";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/guards";
import { contexteUsager } from "@/server/page";

export const metadata = { title: "Demander une réservation - CityRésa" };

export default async function ReserverPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const espace = await espacePublic(slug);
  if (!espace) notFound();
  const u = await getCurrentUser();
  if (u?.isAgent) redirect(`/reservations/nouvelle?espace=${espace.id}`);
  const page = await contexteUsager();
  const { user, csrf, features } = page;
  const cfg = await getSettings();
  const sp = await searchParams;
  const v = (k: string) => (typeof sp[k] === "string" ? String(sp[k]) : "");
  const [org, natures, options, materiels, profils, saison] = await Promise.all([
    organisationDe(user),
    prisma.referential.findMany({
      where: { kind: "evenement_nature", isActive: true },
      orderBy: [{ position: "asc" }, { label: "asc" }],
    }),
    prisma.option.findMany({
      where: { isActive: true, OR: [{ espaceId: espace.id }, { espaceId: null }] },
      orderBy: [{ position: "asc" }, { label: "asc" }],
    }),
    features.materiel
      ? prisma.materiel.findMany({
          where: { isActive: true, stockTotal: { gt: 0 } },
          include: { categorie: true },
          orderBy: [{ categorie: { position: "asc" } }, { name: "asc" }],
        })
      : [],
    prisma.referential.findMany({ where: { kind: "profil" }, select: { code: true, label: true } }),
    saisonActive(),
  ]);
  const profil = org?.profil ?? null;
  const photo = photoPrincipale(espace);
  const docs = documentsPublics(espace);
  const retourFiche = `/portail/espaces/${espace.slug}`;

  // Blocages.
  let blocage: React.ReactNode = null;
  if (cfg.VALIDATION_COMPTE_USAGER && org && !org.validatedAt)
    blocage = (
      <>
        <strong>Votre compte est en attente de validation.</strong> La collectivité vérifie la fiche
        de <em>{org.name}</em> ; vous pourrez déposer une demande dès qu'elle sera validée. Vous
        recevrez un courriel à ce moment-là.
      </>
    );
  else if (org && manquesDossier(org, user).length)
    blocage = (
      <>
        <strong>Votre dossier est incomplet.</strong> Avant de déposer une demande,{" "}
        {org.type === "association"
          ? "une association doit renseigner son siège, son président et la date de l'assemblée générale qui l'a nommé, ainsi que les coordonnées de son contact."
          : "renseignez vos coordonnées complètes."}{" "}
        {phraseManques(manquesDossier(org, user))}
        <div className="mt-2 d-flex gap-2 flex-wrap">
          {manquesDossier(org, user).some((m) => m.cible === "organisation") ? (
            <a href="/portail/mon-organisation" className="btn btn-primary btn-sm">
              <Icone nom="building-2" taille={14} /> Compléter mon organisation
            </a>
          ) : null}
          {manquesDossier(org, user).some((m) => m.cible === "compte") ? (
            <a href="/portail/mon-compte" className="btn btn-outline-primary btn-sm">
              <Icone nom="circle-user" taille={14} /> Compléter mon compte
            </a>
          ) : null}
        </div>
      </>
    );
  else if (!profilAutorise(espace.allowedProfiles, profil?.code ?? null))
    blocage = (
      <>
        <strong>Cet espace n'est pas ouvert à votre profil.</strong>{" "}
        {libelleReserveA(espace.allowedProfiles, profils)}. Pour toute question, contactez la
        collectivité
        {cfg.COLLECTIVITE_EMAIL ? (
          <>
            {" "}
            à <a href={`mailto:${cfg.COLLECTIVITE_EMAIL}`}>{cfg.COLLECTIVITE_EMAIL}</a>
          </>
        ) : null}
        .
      </>
    );

  const dateMin = todayParisISO(addParisDays(parisMidnight(todayParisISO()), espace.delayMinDays));
  const dateMax = todayParisISO(
    addParisDays(parisMidnight(todayParisISO()), espace.horizonMaxDays),
  );
  const capacite = Math.max(espace.capacityStanding ?? 0, espace.capacitySeated ?? 0) || null;
  const pas = espace.slotStepMin || 15;
  const weekdays = v("weekday")
    ? [v("weekday")]
    : Array.isArray(sp.weekday)
      ? (sp.weekday as string[])
      : [];

  return (
    <>
      <p className="mb-3">
        <a href={retourFiche} className="text-muted small">
          <Icone nom="arrow-left" taille={14} /> Retour à la fiche de l'espace
        </a>
      </p>
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
        {photo ? (
          <img src={`/documents/${photo.id}/thumb`} alt="" className="vignette vignette-lg" />
        ) : null}
        <div>
          <h1 className="h2 mb-1">Demander une réservation</h1>
          <div className="text-muted">
            <Icone nom="door-open" taille={14} /> {nomCourt(espace)} · {espace.site.name}
            {cfg.PORTAIL_AFFICHER_TARIFS ? (
              <>
                {" · "}
                {aPartirDe(espace.tarifs, profil?.id ?? null)}
              </>
            ) : null}
          </div>
          {org ? (
            <div className="small text-muted mt-1">
              Demande au nom de <strong>{org.name}</strong>
              {profil ? (
                <>
                  {" "}
                  <Chip teinte="rose">{profil.label}</Chip>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {blocage ? (
        <div className="data-card p-4">
          <div className="alert alert-warning mb-3">
            <Icone nom="lock" taille={16} /> {blocage}
          </div>
          <a href={retourFiche} className="btn btn-outline-secondary">
            Retour à l'espace
          </a>
        </div>
      ) : (
        <form
          method="POST"
          action={`/portail/reserver/${espace.slug}`}
          id="form-principal"
          data-devis="#devis"
          data-double-envoi
        >
          <input type="hidden" name="csrf_token" value={csrf} />
          <input type="hidden" name="espace_id" value={espace.id} />

          <div data-etapes>
            <Etapes
              etapes={
                features.materiel
                  ? ["Créneau", "Événement", "Options et matériel", "Récapitulatif"]
                  : ["Créneau", "Événement", "Options", "Récapitulatif"]
              }
              courante={1}
            />
          </div>

          <div
            className="fiche-colonnes"
            style={{ gridTemplateColumns: "minmax(0, 7fr) minmax(0, 4fr)" }}
          >
            <div>
              <fieldset className="form-section" data-etape id="etape-1">
                <legend className="form-section-titre">
                  <Icone nom="calendar-days" taille={14} /> 1. Quand ?
                </legend>
                <p className="form-section-aide">
                  Au moins {espace.delayMinDays} jour{espace.delayMinDays > 1 ? "s" : ""} à
                  l'avance, par pas de {pas} min, durée minimale {duree(espace.minDurationMin)}
                  {espace.maxDurationMin ? `, maximale ${duree(espace.maxDurationMin)}` : ""}.
                </p>
                <div className="grille grille-3">
                  <div>
                    <label className="form-label" htmlFor="f-date">
                      Date <span className="req">*</span>
                    </label>
                    <input
                      type="date"
                      name="date"
                      id="f-date"
                      className="form-control form-control-lg"
                      required
                      min={dateMin}
                      max={dateMax}
                      defaultValue={v("date")}
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="f-heure_debut">
                      Heure de début <span className="req">*</span>
                    </label>
                    <input
                      type="time"
                      name="heure_debut"
                      id="f-heure_debut"
                      className="form-control form-control-lg"
                      required
                      step={pas * 60}
                      defaultValue={v("heure_debut")}
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="f-heure_fin">
                      Heure de fin <span className="req">*</span>
                    </label>
                    <input
                      type="time"
                      name="heure_fin"
                      id="f-heure_fin"
                      className="form-control form-control-lg"
                      required
                      step={pas * 60}
                      defaultValue={v("heure_fin")}
                    />
                    <div className="form-text">
                      Une fin à 00:00 ou avant le début = le lendemain.
                    </div>
                  </div>
                </div>
                <div className="form-check form-switch mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    name="recurrence"
                    id="f-recurrence"
                    data-recurrence="#bloc-recurrence"
                    defaultChecked={v("recurrence") === "on"}
                  />
                  <label className="form-check-label" htmlFor="f-recurrence">
                    Répéter ce créneau (cours hebdomadaire, réunion mensuelle…)
                  </label>
                </div>
                <div id="bloc-recurrence" className="d-none">
                  <div className="grille grille-3">
                    <div>
                      <label className="form-label" htmlFor="f-freq">
                        Fréquence
                      </label>
                      <select
                        name="freq"
                        id="f-freq"
                        className="form-select"
                        defaultValue={v("freq") || "weekly"}
                      >
                        <option value="daily">Chaque jour</option>
                        <option value="weekly">Chaque semaine</option>
                        <option value="monthly">Chaque mois</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label" htmlFor="f-interval">
                        Toutes les…
                      </label>
                      <input
                        type="number"
                        name="interval"
                        id="f-interval"
                        className="form-control"
                        min={1}
                        max={12}
                        defaultValue={v("interval") || 1}
                      />
                      <div className="form-text">1 = chaque fois, 2 = une fois sur deux.</div>
                    </div>
                    <div>
                      <label className="form-label" htmlFor="f-until">
                        Jusqu'au
                      </label>
                      <input
                        type="date"
                        name="until"
                        id="f-until"
                        className="form-control"
                        min={dateMin}
                        max={dateMax}
                        defaultValue={v("until") || saison?.fin || ""}
                      />
                      {saison ? (
                        <div className="form-text">Fin de la saison {saison.label} par défaut.</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="form-label">Jours de la semaine (récurrence hebdomadaire)</div>
                  <div className="coches mb-3">
                    {JOURS_ISO.map((j) => (
                      <label key={j.iso}>
                        <input
                          type="checkbox"
                          name="weekday"
                          value={j.iso}
                          defaultChecked={weekdays.includes(String(j.iso))}
                        />
                        {j.long}
                      </label>
                    ))}
                  </div>
                  <div className="grille grille-2 mb-3">
                    <CochesCalendrier
                      horsVacances={v("hors_vacances") === "on"}
                      horsFeries={v("hors_feries") === "on"}
                      saison={saison}
                    />
                  </div>
                  <div className="grille grille-2">
                    <div>
                      <label className="form-label" htmlFor="f-except">
                        Autre date à exclure (facultatif)
                      </label>
                      <input type="date" name="except" id="f-except" className="form-control" />
                      <div className="form-text">Vacances, jour férié…</div>
                    </div>
                    <div>
                      <label className="form-label" htmlFor="f-except2">
                        Autre date à exclure
                      </label>
                      <input type="date" name="except" id="f-except2" className="form-control" />
                    </div>
                  </div>
                </div>
              </fieldset>

              <fieldset className="form-section" data-etape id="etape-2">
                <legend className="form-section-titre">
                  <Icone nom="party-popper" taille={14} /> 2. Votre événement
                </legend>
                <div className="grille grille-2">
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label" htmlFor="f-title">
                      Objet de la réservation <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      id="f-title"
                      className="form-control form-control-lg"
                      required
                      maxLength={160}
                      placeholder="Ex. : Assemblée générale, cours de yoga, anniversaire…"
                      defaultValue={v("title")}
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="f-nature_id">
                      Type d'événement
                    </label>
                    <select
                      name="nature_id"
                      id="f-nature_id"
                      className="form-select"
                      defaultValue={v("nature_id")}
                    >
                      <option value="">—</option>
                      {natures.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="f-participants">
                      Nombre de participants prévus <span className="req">*</span>
                    </label>
                    <input
                      type="number"
                      name="participants"
                      id="f-participants"
                      className="form-control"
                      required
                      min={1}
                      max={capacite ?? undefined}
                      defaultValue={v("participants")}
                      data-participants-max={capacite ?? undefined}
                    />
                    <div className="form-text">
                      {capacite ? `Capacité maximale : ${capacite} personnes.` : "Indicatif."}
                    </div>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label" htmlFor="f-description">
                      Précisions utiles
                    </label>
                    <textarea
                      name="description"
                      id="f-description"
                      className="form-control"
                      rows={4}
                      maxLength={4000}
                      placeholder="Déroulé, besoins particuliers, public attendu…"
                      defaultValue={v("description")}
                    />
                  </div>
                  <div className="form-check form-switch" style={{ gridColumn: "1 / -1" }}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      name="is_public_event"
                      id="f-is_public_event"
                      defaultChecked={v("is_public_event") === "on"}
                    />
                    <label className="form-check-label" htmlFor="f-is_public_event">
                      Événement ouvert au public (peut paraître à l'agenda de la ville)
                    </label>
                  </div>
                </div>
              </fieldset>

              <fieldset className="form-section" data-etape id="etape-3">
                <legend className="form-section-titre">
                  <Icone nom="boxes" taille={14} /> 3.{" "}
                  {features.materiel ? "Options et matériel" : "Options"}
                </legend>
                {options.length ? (
                  <div className="mb-3">
                    {options.map((o) => (
                      <div
                        key={o.id}
                        className="d-flex align-items-center gap-3 py-2"
                        style={{ borderTop: "1px solid var(--line)" }}
                      >
                        {o.unite === "forfait" ? (
                          <div className="form-check mb-0 flex-grow-1">
                            {o.mandatory ? (
                              <input type="hidden" name={`option_${o.id}`} value="1" />
                            ) : null}
                            <input
                              className="form-check-input"
                              type="checkbox"
                              name={o.mandatory ? undefined : `option_${o.id}`}
                              value="1"
                              id={`f-option_${o.id}`}
                              defaultChecked={o.mandatory}
                              disabled={o.mandatory}
                            />
                            <label className="form-check-label" htmlFor={`f-option_${o.id}`}>
                              <strong>{o.label}</strong>
                              {o.mandatory ? (
                                <Chip teinte="slate" classes="ms-2">
                                  obligatoire
                                </Chip>
                              ) : null}
                              {o.description ? (
                                <div className="text-muted small">{o.description}</div>
                              ) : null}
                            </label>
                          </div>
                        ) : (
                          <div className="d-flex align-items-center gap-3 flex-grow-1 flex-wrap">
                            <label className="flex-grow-1 mb-0" htmlFor={`f-option_${o.id}`}>
                              <strong>{o.label}</strong>
                              {o.mandatory ? (
                                <Chip teinte="slate" classes="ms-2">
                                  obligatoire
                                </Chip>
                              ) : null}
                              {o.description ? (
                                <div className="text-muted small">{o.description}</div>
                              ) : null}
                            </label>
                            <input
                              type="number"
                              name={`option_${o.id}`}
                              id={`f-option_${o.id}`}
                              className="form-control"
                              style={{ width: 90 }}
                              min={o.mandatory ? 1 : 0}
                              defaultValue={o.mandatory ? 1 : 0}
                              aria-label={`Quantité pour ${o.label}`}
                            />
                          </div>
                        )}
                        <div className="text-end text-nowrap small">
                          {o.montant ? montant(o.montant) : "Inclus"}
                          <div className="text-muted">{OPTION_UNITES[o.unite] ?? o.unite}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted small">
                    Aucune prestation complémentaire pour cet espace.
                  </p>
                )}
                {features.materiel ? (
                  materiels.length ? (
                    <>
                      <div className="form-label mt-2">Matériel à mobiliser</div>
                      <p className="form-section-aide">
                        Indiquez les quantités souhaitées ; le stock affiché est le stock total de
                        la collectivité, la disponibilité est vérifiée à l'envoi.
                      </p>
                      <div className="table-responsive">
                        <table className="table mb-0">
                          <tbody>
                            {materiels.map((m) => (
                              <tr key={m.id}>
                                <td>
                                  <label htmlFor={`f-materiel_${m.id}`} className="mb-0">
                                    <strong>{m.name}</strong>
                                    {m.categorie ? (
                                      <span className="text-muted small">
                                        {" "}
                                        · {m.categorie.label}
                                      </span>
                                    ) : null}
                                    {m.description ? (
                                      <div className="text-muted small">{m.description}</div>
                                    ) : null}
                                  </label>
                                </td>
                                <td className="text-muted small text-nowrap">
                                  stock : {m.stockTotal}
                                </td>
                                <td className="text-end small text-nowrap">
                                  {m.montant ? montant(m.montant) : "Gratuit"}
                                  <div className="text-muted">
                                    {MATERIEL_UNITES[m.unite] ?? m.unite}
                                  </div>
                                </td>
                                <td style={{ width: 100 }}>
                                  <input
                                    type="number"
                                    name={`materiel_${m.id}`}
                                    id={`f-materiel_${m.id}`}
                                    className="form-control form-control-sm"
                                    min={0}
                                    max={m.stockTotal}
                                    defaultValue={0}
                                    aria-label={`Quantité de ${m.name}`}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted small mb-0">Aucun matériel proposé pour l'instant.</p>
                  )
                ) : null}
              </fieldset>
            </div>

            <aside>
              <div className="data-card carte-resa p-4" data-etape id="etape-4">
                <h2 className="h5 mb-3">
                  <Icone nom="receipt" taille={16} /> 4. Récapitulatif
                </h2>
                <div className="recap mb-3">
                  <dl className="mb-0">
                    <dt>Espace</dt>
                    <dd>
                      {nomCourt(espace)} · {espace.site.name}
                    </dd>
                    <dt>Demandeur</dt>
                    <dd>
                      {user.name}
                      {org ? ` · ${org.name}` : ""}
                    </dd>
                    {cfg.PORTAIL_AFFICHER_TARIFS ? (
                      <>
                        <dt>Devis estimatif</dt>
                        <dd className="mb-0">
                          <div id="devis" className="mt-1">
                            <span className="text-muted">
                              Renseignez le créneau pour voir le montant.
                            </span>
                          </div>
                        </dd>
                      </>
                    ) : (
                      <div id="devis" className="d-none" />
                    )}
                  </dl>
                </div>
                {espace.requiresValidation ? (
                  <p className="small text-muted">
                    <Icone nom="hourglass" taille={13} /> Votre demande sera étudiée par la
                    collectivité, qui vous répondra par courriel.
                  </p>
                ) : (
                  <p className="small text-muted">
                    <Icone nom="check" taille={13} /> La réservation est confirmée dès l'envoi si le
                    créneau est libre.
                  </p>
                )}
                {cfg.PORTAIL_CONDITIONS ? (
                  <details className="mb-3 small">
                    <summary className="fw-semibold">Conditions de réservation</summary>
                    <div className="mt-2 text-muted" style={{ whiteSpace: "pre-wrap" }}>
                      {cfg.PORTAIL_CONDITIONS}
                    </div>
                  </details>
                ) : null}
                {docs.length ? (
                  <ul className="list-unstyled small mb-3">
                    {docs.map((d) => (
                      <li key={d.id}>
                        <a href={`/documents/${d.id}/view`} target="_blank" rel="noopener">
                          <Icone nom="file-text" taille={13} /> {d.title || d.filename}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    name="accepte_reglement"
                    id="f-accepte_reglement"
                    required
                  />
                  <label className="form-check-label" htmlFor="f-accepte_reglement">
                    J'ai lu et j'accepte le règlement et les conditions de réservation{" "}
                    <span className="req">*</span>
                  </label>
                </div>
                <button type="submit" className="btn btn-primary btn-lg w-100">
                  <Icone nom="send" taille={16} /> Envoyer ma demande
                </button>
                <a href={retourFiche} className="btn btn-ghost w-100 mt-2">
                  Annuler
                </a>
              </div>
            </aside>
          </div>
        </form>
      )}
    </>
  );
}
