/**
 * Les vues du module Personnel de service : grille personnes × jours (semaine ou jour) avec
 * la ligne « À couvrir », le formulaire de vacation (modale d'ajout, page de modification),
 * la pastille d'état de couverture.
 */
import { type CSSProperties, Fragment, type ReactNode } from "react";
import { ModalAction } from "@/components/fiche";
import { Champ, Coches, Grille, Select } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import {
  type AbsenceRef,
  absencesDuJour,
  libellePlages,
  type PersonneAffectable,
  type PlageMinutes,
  periodesTravaillees,
} from "@/lib/affectation";
import { JOURS_ISO } from "@/lib/constantes";
import { lireHoraires } from "@/lib/creneaux";
import { ymdUtc } from "@/lib/date-utc";
import {
  bornesFrise,
  empiler,
  graduations,
  libelleHeure,
  minutesDuJour,
  positionFrise,
} from "@/lib/frise";
import { heure, isoParis, nomCourt, plageHoraire } from "@/lib/libelles";
import { parisMidnight, parisParts, toParisWall } from "@/lib/paris-time";
import {
  type CreneauCouvert,
  ETATS_COUVERTURE,
  type EtatCouverture,
  nomPersonne,
} from "@/lib/personnel";
import { avecRetour } from "@/lib/url";
import { bornesJour, duJour, estWeekend, type Fenetre } from "@/modules/planning/server";
import type { AffectationRow } from "@/server/affectation";
import type { PersonneComplete, PersonneRow, SiteRef, VacationRow } from "@/server/personnel";

export function ChipCouverture({ etat, titre }: { etat: EtatCouverture; titre?: string }) {
  const e = ETATS_COUVERTURE[etat];
  return (
    <Chip teinte={e.teinte} dot titre={titre}>
      {e.label}
    </Chip>
  );
}

/** Les heures d'un élément restreintes au jour affiché. */
function heuresDuJour(i: { startAt: Date; endAt: Date }, jour: string): string {
  const b = bornesJour(jour);
  const debutDedans = i.startAt >= b.startAt;
  const finDedans = i.endAt <= b.endAt;
  if (debutDedans && finDedans) return plageHoraire(i.startAt, i.endAt);
  if (debutDedans) return `${heure(i.startAt)} →`;
  if (finDedans) return `→ ${heure(i.endAt)}`;
  return "Toute la journée";
}

function enteteJour(jour: string): string {
  const d = parisMidnight(jour);
  const p = parisParts(d);
  const w = toParisWall(d);
  return `${JOURS_ISO[p.weekday - 1].court} ${String(w.da).padStart(2, "0")}/${String(w.mo).padStart(2, "0")}`;
}

const TEINTE_VAR: Record<EtatCouverture, string> = {
  couvert: "var(--emerald-text)",
  partiel: "var(--amber-text)",
  non_couvert: "var(--red-text)",
};

/** Une vacation dans une case du planning. */
function Vac({ v, jour, peutEditer }: { v: VacationRow; jour: string; peutEditer: boolean }) {
  const style = v.personnel.color ? { borderLeftColor: v.personnel.color } : undefined;
  const contenu = (
    <>
      <span className="evt-titre">{v.site.name}</span>
      <span className="evt-heure evt-ligne">
        {heuresDuJour(v, jour)}
        {v.note ? ` · ${v.note}` : ""}
      </span>
    </>
  );
  const titre = `${nomPersonne(v.personnel)} · ${v.site.name} · ${heuresDuJour(v, jour)}${v.note ? ` · ${v.note}` : ""}${v.serieId ? " · chaque semaine" : ""}`;
  return peutEditer ? (
    <a href={`/personnel/vacations/${v.id}`} className="evt" style={style} title={titre}>
      {contenu}
    </a>
  ) : (
    <span className="evt" style={style} title={titre}>
      {contenu}
    </span>
  );
}

/** Un créneau réservé dans la ligne « À couvrir ». */
function ACouvrir({
  e,
  jour,
  noms,
  retour,
}: {
  e: CreneauCouvert;
  jour: string;
  noms: Map<number, string>;
  retour?: string;
}) {
  const qui = e.couverture.personnelIds.map((id) => noms.get(id) ?? `#${id}`).join(", ");
  const etat = ETATS_COUVERTURE[e.couverture.etat];
  return (
    <a
      href={avecRetour(`/reservations/${e.creneau.reservationId}`, retour)}
      className={`evt${e.couverture.etat === "non_couvert" ? " evt--attente" : ""}`}
      style={{ borderLeftColor: TEINTE_VAR[e.couverture.etat] }}
      title={`${e.creneau.numero} · ${e.creneau.titre} · ${e.creneau.espaceNom} · ${etat.label}${qui ? ` : ${qui}` : ""}`}
    >
      <span className="evt-titre">{e.creneau.titre}</span>
      <span className="evt-heure">
        {heuresDuJour(e.creneau, jour)} · {e.creneau.espaceNom}
      </span>
      <span className="evt-qui" style={{ color: TEINTE_VAR[e.couverture.etat] }}>
        {etat.label}
        {qui ? ` · ${qui}` : ""}
        {e.couverture.epingle ? " (épinglé)" : ""}
      </span>
    </a>
  );
}

/** Un créneau affecté (ou proposé) à une personne, dans sa case du planning. */
function Affectation({ c, jour, retour }: { c: AffectationRow; jour: string; retour?: string }) {
  const propose = !c.personnelId;
  const titre = `${c.reservation.numero} · ${c.reservation.title} · ${nomCourt(c.espace)}${propose ? " · proposition à valider" : " · affecté"}`;
  return (
    <a
      href={avecRetour(`/reservations/${c.reservation.id}`, retour)}
      className={`evt${propose ? " evt--propose" : ""}`}
      style={{ borderLeftColor: propose ? "var(--amber-text)" : "var(--emerald-text)" }}
      title={titre}
    >
      <span className="evt-titre">
        <Icone nom={propose ? "hourglass" : "bookmark"} taille={10} /> {c.reservation.title}
      </span>
      <span className="evt-heure">
        {heuresDuJour(c, jour)} · {nomCourt(c.espace)}
      </span>
      {propose ? <span className="evt-qui">Proposé · à valider</span> : null}
    </a>
  );
}

/** Les plages travaillées d'une personne un jour donné, et ses absences hachurées. */
function JourTravail({
  p,
  jour,
  absences,
}: {
  p: PersonneAffectable;
  jour: string;
  absences: readonly AbsenceRef[];
}) {
  const t = periodesTravaillees(p, jour, absences);
  const abs = absencesDuJour(absences, p.id, jour);
  return (
    <>
      {t.etat === "repos" ? (
        <span className="plages-jour">Repos</span>
      ) : t.etat === "hors_contrat" ? (
        <span className="plages-jour">Hors contrat</span>
      ) : t.etat === "travail" ? (
        <span className="plages-jour" title="Plages de travail du cycle, absences déduites">
          {t.plages.length ? libellePlages(t.plages) : "Absent toute la journée"}
        </span>
      ) : null}
      {abs.map((a, i) => (
        <Absence key={`a${i}`} a={a} />
      ))}
    </>
  );
}

export function GrilleService({
  fen,
  personnes,
  vacations,
  etats,
  peutEditer,
  aujourdhui,
  contexte,
  affectations,
  retour,
}: {
  fen: Fenetre;
  personnes: PersonneRow[];
  vacations: VacationRow[];
  etats: CreneauCouvert[];
  peutEditer: boolean;
  aujourdhui: string;
  /** Contrats, horaires et absences (module d'affectation). */
  contexte: { personnes: PersonneAffectable[]; absences: AbsenceRef[] };
  /** Créneaux affectés ou proposés sur la fenêtre. */
  affectations: AffectationRow[];
  /** La page affichée : la fiche du dossier y ramène par sa flèche de retour. */
  retour?: string;
}) {
  // Un seul jour affiché : la largeur sert à dérouler ses heures.
  if (fen.vue === "jour")
    return (
      <FriseService
        jour={fen.jours[0]}
        personnes={personnes}
        vacations={vacations}
        etats={etats}
        peutEditer={peutEditer}
        contexte={contexte}
        affectations={affectations}
        retour={retour}
      />
    );
  const noms = new Map(personnes.map((p) => [p.id, nomPersonne(p)]));
  for (const v of vacations)
    if (!noms.has(v.personnelId)) noms.set(v.personnelId, nomPersonne(v.personnel));
  const affectables = new Map(contexte.personnes.map((p) => [p.id, p]));
  return (
    <>
      <div className="planning planning-service">
        <table>
          <thead>
            <tr>
              <th className="col-espace">Personne</th>
              {fen.jours.map((j) => (
                <th key={j} className={j === aujourdhui ? "aujourdhui" : undefined}>
                  {enteteJour(j)}
                  {j === aujourdhui ? (
                    <span className="d-block small fw-normal">aujourd'hui</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="col-espace">
                <div className="espace-cell">
                  {/* L'icône tient la place de la pastille de couleur des lignes de personnes. */}
                  <span className="pastille-icone">
                    <Icone nom="calendar-check" taille={13} />
                  </span>
                  <span className="cell2">
                    <span className="nom">À couvrir</span>
                    <small>Créneaux réservés</small>
                  </span>
                </div>
              </td>
              {fen.jours.map((j) => (
                <td key={j} className={estWeekend(j) ? "weekend" : undefined}>
                  {duJour(
                    etats.map((e) => ({
                      ...e,
                      startAt: e.creneau.startAt,
                      endAt: e.creneau.endAt,
                    })),
                    j,
                  ).map((e) => (
                    <ACouvrir key={e.creneau.id} e={e} jour={j} noms={noms} retour={retour} />
                  ))}
                </td>
              ))}
            </tr>
            {personnes.map((p) => (
              <tr key={p.id}>
                <td className="col-espace">
                  <div className="espace-cell">
                    <span
                      className="pastille-espace"
                      style={{ background: p.color ?? "var(--faint)" }}
                    />
                    <span className="cell2">
                      <a href={avecRetour(`/personnel/personnes/${p.id}`, retour)} className="nom">
                        {nomPersonne(p)}
                      </a>
                      <small>{p.fonction ?? ""}</small>
                    </span>
                  </div>
                </td>
                {fen.jours.map((j) => {
                  const aff = affectables.get(p.id);
                  return (
                    <td key={j} className={estWeekend(j) ? "weekend" : undefined}>
                      {aff ? <JourTravail p={aff} jour={j} absences={contexte.absences} /> : null}
                      {duJour(
                        vacations.filter((v) => v.personnelId === p.id),
                        j,
                      ).map((v) => (
                        <Vac key={v.id} v={v} jour={j} peutEditer={peutEditer} />
                      ))}
                      {duJour(
                        affectations.filter(
                          (c) =>
                            (c.personnelId ?? (c.proposeAt ? c.personnelProposeId : null)) === p.id,
                        ),
                        j,
                      ).map((c) => (
                        <Affectation key={`c${c.id}`} c={c} jour={j} retour={retour} />
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LegendeService />
    </>
  );
}

/** Un échantillon de vignette pour la légende : liseré, pointillés ou hachures. */
function Echantillon({ couleur, variante }: { couleur: string; variante?: string }) {
  return (
    <span
      className={`legende-evt${variante ? ` ${variante}` : ""}`}
      style={{ borderLeftColor: couleur }}
      aria-hidden="true"
    />
  );
}

/** La légende du planning de service : ce que disent les liserés, les pointillés et les fonds. */
function LegendeService({ frise = false }: { frise?: boolean }) {
  return (
    <div className="legende-service small text-muted">
      <span className="legende-titre fw-semibold">
        <span className="legende-repere">
          <Icone nom="calendar-check" taille={13} />
        </span>
        À couvrir
      </span>
      <ul className="list-inline mb-0" aria-label="Légende de la ligne À couvrir">
        <li className="list-inline-item">
          <Echantillon couleur={TEINTE_VAR.couvert} /> Couvert
        </li>
        <li className="list-inline-item">
          <Echantillon couleur={TEINTE_VAR.partiel} /> Partiel
        </li>
        <li className="list-inline-item">
          <Echantillon couleur={TEINTE_VAR.non_couvert} variante="evt--attente" /> À couvrir
          (pointillés)
        </li>
      </ul>
      <span className="legende-titre fw-semibold">
        <span className="legende-repere">
          <span className="pastille-espace" style={{ background: "#8b5cf6" }} />
        </span>
        Personnes
      </span>
      <ul
        className="list-inline mb-0 legende-colonnes"
        aria-label="Légende des lignes de personnes"
      >
        {frise ? (
          <li className="list-inline-item">
            <span className="legende-evt legende-plage" aria-hidden="true" /> Plage de travail du
            cycle
          </li>
        ) : null}
        <li className="list-inline-item">
          <Echantillon couleur="#8b5cf6" /> Vacation (liseré à la couleur de la personne)
        </li>
        <li className="list-inline-item">
          <Echantillon couleur="var(--emerald-text)" /> <Icone nom="bookmark" taille={10} /> Créneau
          affecté
        </li>
        <li className="list-inline-item">
          <Echantillon couleur="var(--amber-text)" variante="evt--propose" />{" "}
          <Icone nom="hourglass" taille={10} /> Proposition à valider (pointillés, fond jaune)
        </li>
        <li className="list-inline-item">
          <Echantillon couleur="var(--amber-text)" variante="evt--absence" />{" "}
          <Icone nom="calendar-x" taille={10} /> Absence (hachures)
        </li>
      </ul>
    </div>
  );
}

/** Les champs d'une vacation (ajout avec répétition, ou modification). */
export function ChampsVacation({
  personnes,
  sites,
  valeurs,
  avecRepetition,
  prefixe = "vac",
}: {
  personnes: PersonneRow[];
  sites: SiteRef[];
  valeurs: {
    personnelId?: number | null;
    siteId?: number | null;
    date: string;
    heureDebut: string;
    heureFin: string;
    note?: string | null;
  };
  avecRepetition: boolean;
  prefixe?: string;
}) {
  return (
    <div className="grille grille-2">
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="form-label" htmlFor={`${prefixe}-personne`}>
          Personne <span className="req">*</span>
        </label>
        <select
          name="personnel_id"
          id={`${prefixe}-personne`}
          className="form-select"
          defaultValue={valeurs.personnelId ? String(valeurs.personnelId) : ""}
          required
        >
          <option value="">Choisir…</option>
          {personnes.map((p) => (
            <option key={p.id} value={p.id}>
              {nomPersonne(p)}
              {p.fonction ? ` · ${p.fonction}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="form-label" htmlFor={`${prefixe}-site`}>
          Site <span className="req">*</span>
        </label>
        <select
          name="site_id"
          id={`${prefixe}-site`}
          className="form-select"
          defaultValue={
            valeurs.siteId ? String(valeurs.siteId) : sites.length === 1 ? String(sites[0].id) : ""
          }
          required
        >
          <option value="">Choisir…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="form-text">La personne est de service sur tous les espaces du site.</div>
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="form-label" htmlFor={`${prefixe}-date`}>
          Date <span className="req">*</span>
        </label>
        <input
          type="date"
          name="date"
          id={`${prefixe}-date`}
          className="form-control"
          defaultValue={valeurs.date}
          required
        />
      </div>
      <div>
        <label className="form-label" htmlFor={`${prefixe}-debut`}>
          Début <span className="req">*</span>
        </label>
        <input
          type="time"
          name="heure_debut"
          id={`${prefixe}-debut`}
          className="form-control"
          defaultValue={valeurs.heureDebut}
          required
        />
      </div>
      <div>
        <label className="form-label" htmlFor={`${prefixe}-fin`}>
          Fin <span className="req">*</span>
        </label>
        <input
          type="time"
          name="heure_fin"
          id={`${prefixe}-fin`}
          className="form-control"
          defaultValue={valeurs.heureFin}
          required
        />
        <div className="form-text">Une fin avant le début = le lendemain.</div>
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="form-label" htmlFor={`${prefixe}-note`}>
          Note
        </label>
        <input
          type="text"
          name="note"
          id={`${prefixe}-note`}
          className="form-control"
          maxLength={200}
          defaultValue={valeurs.note ?? ""}
          placeholder="Ouverture et fermeture, remise des clés, état des lieux…"
        />
      </div>
      {avecRepetition ? (
        <>
          <div style={{ gridColumn: "1 / -1" }} className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              name="repeter"
              id={`${prefixe}-repeter`}
            />
            <label className="form-check-label" htmlFor={`${prefixe}-repeter`}>
              Répéter chaque semaine, le même jour
            </label>
          </div>
          <div>
            <label className="form-label" htmlFor={`${prefixe}-jusquau`}>
              Jusqu'au (inclus)
            </label>
            <input
              type="date"
              name="repeter_jusquau"
              id={`${prefixe}-jusquau`}
              className="form-control"
            />
          </div>
          <div className="d-flex flex-column justify-content-end gap-1">
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                name="hors_feries"
                id={`${prefixe}-feries`}
                defaultChecked
              />
              <label className="form-check-label" htmlFor={`${prefixe}-feries`}>
                Sauter les jours fériés
              </label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                name="hors_vacances"
                id={`${prefixe}-vacances`}
              />
              <label className="form-check-label" htmlFor={`${prefixe}-vacances`}>
                Sauter les vacances scolaires
              </label>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ModalAjouterVacation({
  csrf,
  personnes,
  sites,
  date,
  siteId,
  personnelId,
  retour,
}: {
  csrf: string;
  personnes: PersonneRow[];
  sites: SiteRef[];
  date: string;
  siteId: number | null;
  personnelId: number | null;
  retour: string;
}) {
  return (
    <ModalAction
      id="modal-vacation"
      titre="Ajouter une vacation"
      action="/personnel/vacations/ajouter"
      csrf={csrf}
      bouton="Ajouter"
      icone="calendar-plus"
      aide="Une vacation : une personne de service sur un site, d'une heure à une autre. Une même personne ne peut pas être de service deux fois en même temps."
    >
      <input type="hidden" name="next" value={retour} />
      <ChampsVacation
        personnes={personnes}
        sites={sites}
        valeurs={{ personnelId, siteId, date, heureDebut: "17:00", heureFin: "23:00" }}
        avecRepetition
      />
    </ModalAction>
  );
}

/** Les valeurs de formulaire d'une vacation existante. */
export function valeursDe(v: VacationRow) {
  const d = isoParis(v.startAt);
  return {
    personnelId: v.personnelId,
    siteId: v.siteId,
    date: d.date,
    heureDebut: d.time,
    heureFin: isoParis(v.endAt).time,
    note: v.note,
  };
}

// ── Contrat, horaires de travail, sites, absences ──

const DEFAUT_SEMAINE: [string, string][] = [
  ["08:00", "12:00"],
  ["13:30", "17:00"],
];

/** Le cycle hebdomadaire d'horaires de travail : par jour, repos ou jusqu'à deux plages. */
export function GrilleHorairesTravail({ horaires }: { horaires: unknown }) {
  const h = lireHoraires(horaires);
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div className="form-check form-switch mb-2">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          name="horaires_fixes"
          id="f-horaires_fixes"
          defaultChecked={!!h}
        />
        <label className="form-check-label" htmlFor="f-horaires_fixes">
          Horaires de travail fixes (cycle hebdomadaire)
        </label>
        <div className="form-text">
          Décoché : la personne peut être affectée à toute heure de ses jours (vacataire sans
          cycle). Coché : seuls les créneaux compris dans ses plages lui sont proposés.
        </div>
      </div>
      <div className="horaires-travail">
        <span className="entete">Jour</span>
        <span className="entete">Repos</span>
        <span className="entete">Début</span>
        <span className="entete">Fin</span>
        <span className="entete">2e début</span>
        <span className="entete">2e fin</span>
        {JOURS_ISO.map((j) => {
          const plages = h ? (h[String(j.iso)] ?? []) : j.iso <= 5 ? DEFAUT_SEMAINE : [];
          const repos = plages.length === 0;
          const [p1, p2] = plages;
          const champs: [string, string, string][] = [
            ["h1_de", p1?.[0] ?? "", "début"],
            ["h1_a", p1?.[1] ?? "", "fin"],
            ["h2_de", p2?.[0] ?? "", "second début"],
            ["h2_a", p2?.[1] ?? "", "seconde fin"],
          ];
          return (
            <Fragment key={j.iso}>
              <label className="jour" htmlFor={`f-h1_de_${j.iso}`}>
                {j.long}
              </label>
              <div className="form-check m-0">
                <input
                  type="checkbox"
                  className="form-check-input"
                  name={`repos_${j.iso}`}
                  id={`f-repos_${j.iso}`}
                  defaultChecked={repos}
                  aria-label={`${j.long} : repos`}
                />
              </div>
              {champs.map(([cle, val, libelle]) => (
                <input
                  key={cle}
                  type="time"
                  name={`${cle}_${j.iso}`}
                  id={`f-${cle}_${j.iso}`}
                  className="form-control form-control-sm"
                  defaultValue={val}
                  step={300}
                  aria-label={`${j.long} : ${libelle}`}
                />
              ))}
            </Fragment>
          );
        })}
      </div>
      <div className="form-text">
        Une case « Repos » cochée ignore les heures du jour. La seconde plage sert à la coupure
        méridienne.
      </div>
    </div>
  );
}

/** Les champs du contrat et des sites d'une personne (modale « Modifier la fiche »). */
export function ChampsContrat({
  p,
  types,
  sites,
}: {
  p: PersonneComplete;
  types: { id: number; label: string }[];
  sites: SiteRef[];
}) {
  const principal = p.sites.find((s) => s.principal)?.siteId ?? p.sites[0]?.siteId ?? null;
  return (
    <>
      <h6 className="mt-3 mb-2">Contrat et temps de travail</h6>
      <Grille colonnes={2}>
        <Select
          label="Type de contrat"
          name="contrat_type_id"
          valeur={p.contratTypeId}
          blank="Non renseigné"
          options={types.map((t) => [String(t.id), t.label])}
        />
        <Champ
          label="Quotité (%)"
          name="quotite"
          type="number"
          min={1}
          max={100}
          valeur={p.quotite}
          aide="100 = temps complet, 80 = quatre cinquièmes…"
        />
        <Champ
          label="Durée hebdomadaire (h)"
          name="heures_hebdo"
          type="number"
          step={0.5}
          min={1}
          max={48}
          valeur={p.heuresHebdo === null ? "" : String(p.heuresHebdo)}
          aide="Temps non complet : la durée du contrat (28 h…). Vide = 35 h × quotité."
        />
        <div />
        <Champ
          label="Début du contrat"
          name="contrat_debut"
          type="date"
          valeur={p.contratDebut ? ymdUtc(p.contratDebut) : ""}
        />
        <Champ
          label="Fin du contrat"
          name="contrat_fin"
          type="date"
          valeur={p.contratFin ? ymdUtc(p.contratFin) : ""}
          aide="Vide = sans terme. Hors de ces dates, la personne n'est jamais proposée."
        />
        <GrilleHorairesTravail horaires={p.horaires} />
      </Grille>
      <h6 className="mt-3 mb-2">Sites d'intervention</h6>
      <Grille colonnes={2}>
        <Coches
          name="site"
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
          cochees={p.sites.map((s) => s.siteId)}
          label="Sites où la personne peut être affectée"
        />
        <Select
          label="Site principal"
          name="site_principal"
          valeur={principal}
          blank="Le premier coché"
          options={sites.map((s) => [String(s.id), s.name])}
          aide="Passe en tête des candidats sur ce site."
        />
      </Grille>
    </>
  );
}

/** Les champs d'une absence (modale « Ajouter une absence »). */
export function ChampsAbsence({
  motifs,
  aujourdhui,
}: {
  motifs: { id: number; label: string }[];
  aujourdhui: string;
}) {
  return (
    <Grille colonnes={2}>
      <Select
        label="Motif"
        name="motif_id"
        blank="Sans motif"
        options={motifs.map((m) => [String(m.id), m.label])}
        pleine
      />
      <Champ label="Du" name="du" type="date" valeur={aujourdhui} requis />
      <Champ
        label="Au (inclus)"
        name="au"
        type="date"
        valeur={aujourdhui}
        aide="Vide = le même jour."
      />
      <div style={{ gridColumn: "1 / -1" }} className="form-check form-switch">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          name="journee"
          id="f-journee"
          defaultChecked
        />
        <label className="form-check-label" htmlFor="f-journee">
          Journée(s) entière(s)
        </label>
        <div className="form-text">
          Décochez pour indiquer des heures (demi-journée, rendez-vous).
        </div>
      </div>
      <Champ label="Heure de début" name="heure_debut" type="time" valeur="08:00" />
      <Champ label="Heure de fin" name="heure_fin" type="time" valeur="12:00" />
      <Champ label="Note" name="note" valeur="" pleine placeholder="Facultatif" />
    </Grille>
  );
}

// ── Vue Jour : frise horaire ──

/** Hauteur d'un niveau de la frise et marge qui l'entoure, en pixels. */
const FRISE_NIVEAU = 50;
const FRISE_MARGE = 6;

type ElementFrise = PlageMinutes & { cle: string; rendu: ReactNode };

/** Une vignette d'absence (hachurée). */
function Absence({ a }: { a: PlageMinutes & { motif: string | null } }) {
  return (
    <span className="evt evt--absence" title={`Absence${a.motif ? ` : ${a.motif}` : ""}`}>
      <span className="evt-titre">
        <Icone nom="calendar-x" taille={10} /> {a.motif ?? "Absence"}
      </span>
      <span className="evt-heure">
        {a.debutMin === 0 && a.finMin === 1440 ? "Toute la journée" : libellePlages([a])}
      </span>
    </span>
  );
}

/** La ligne d'une frise : plages de travail en fond, éléments posés à leurs heures. */
function Piste({
  elements,
  plages = [],
  mention,
  bornes,
}: {
  elements: ElementFrise[];
  plages?: PlageMinutes[];
  /** « Repos », « Hors contrat » : ce que dit la ligne quand le cycle ne prévoit rien. */
  mention?: string;
  bornes: PlageMinutes;
}) {
  const { places, niveaux } = empiler(elements);
  return (
    <>
      {/* Plages et mention se placent dans la case entière : elles en suivent toute la hauteur. */}
      {plages.map((p) => {
        const pos = positionFrise(p, bornes);
        return (
          <span
            key={p.debutMin}
            className="frise-plage"
            style={{ left: `${pos.gauche}%`, width: `${pos.largeur}%` }}
            title={`Plage de travail du cycle, absences déduites : ${libellePlages([p])}`}
          />
        );
      })}
      {mention ? <span className="frise-mention">{mention}</span> : null}
      <div className="frise-piste" style={{ height: niveaux * FRISE_NIVEAU + FRISE_MARGE }}>
        {places.map(({ element, niveau }) => {
          const pos = positionFrise(element, bornes);
          return (
            <div
              key={element.cle}
              className="frise-item"
              style={{
                left: `${pos.gauche}%`,
                width: `${pos.largeur}%`,
                top: FRISE_MARGE + niveau * FRISE_NIVEAU,
              }}
            >
              {element.rendu}
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * La vue Jour du planning de service : les heures en abscisse, une ligne par personne. La largeur
 * sert à lire le temps — qui est de service, à quelle heure, et où sont les trous.
 */
function FriseService({
  jour,
  personnes,
  vacations,
  etats,
  peutEditer,
  contexte,
  affectations,
  retour,
}: {
  jour: string;
  personnes: PersonneRow[];
  vacations: VacationRow[];
  etats: CreneauCouvert[];
  peutEditer: boolean;
  contexte: { personnes: PersonneAffectable[]; absences: AbsenceRef[] };
  affectations: AffectationRow[];
  retour?: string;
}) {
  const noms = new Map(personnes.map((p) => [p.id, nomPersonne(p)]));
  for (const v of vacations)
    if (!noms.has(v.personnelId)) noms.set(v.personnelId, nomPersonne(v.personnel));
  const affectables = new Map(contexte.personnes.map((p) => [p.id, p]));
  /** Pose un élément daté sur la journée (rien s'il ne la touche pas). */
  const poser = (
    i: { startAt: Date; endAt: Date },
    cle: string,
    rendu: ReactNode,
  ): ElementFrise[] => {
    const m = minutesDuJour(i, jour);
    return m ? [{ ...m, cle, rendu }] : [];
  };

  const aCouvrir = etats.flatMap((e) =>
    poser(
      e.creneau,
      `e${e.creneau.id}`,
      <ACouvrir e={e} jour={jour} noms={noms} retour={retour} />,
    ),
  );
  const lignes = personnes.map((p) => {
    const aff = affectables.get(p.id);
    const travail = aff ? periodesTravaillees(aff, jour, contexte.absences) : null;
    const absences = aff ? absencesDuJour(contexte.absences, p.id, jour) : [];
    const elements: ElementFrise[] = [
      ...vacations
        .filter((v) => v.personnelId === p.id)
        .flatMap((v) => poser(v, `v${v.id}`, <Vac v={v} jour={jour} peutEditer={peutEditer} />)),
      ...affectations
        .filter((c) => (c.personnelId ?? (c.proposeAt ? c.personnelProposeId : null)) === p.id)
        .flatMap((c) => poser(c, `c${c.id}`, <Affectation c={c} jour={jour} retour={retour} />)),
    ];
    return {
      personne: p,
      elements,
      // Une absence couvre souvent la journée entière : elle se pose sur la frise sans l'élargir.
      absences: absences.map((a, i) => ({ ...a, cle: `a${i}`, rendu: <Absence a={a} /> })),
      plages: travail?.etat === "travail" ? travail.plages : [],
      mention:
        travail?.etat === "repos"
          ? "Repos"
          : travail?.etat === "hors_contrat"
            ? "Hors contrat"
            : undefined,
    };
  });
  const bornes = bornesFrise([...aCouvrir, ...lignes.flatMap((l) => [...l.elements, ...l.plages])]);
  const heures = graduations(bornes);
  const weekend = estWeekend(jour) ? "weekend" : undefined;

  return (
    <>
      <div className="planning planning-service planning-frise">
        <table style={{ "--frise-heures": heures.length - 1 } as CSSProperties}>
          <thead>
            <tr>
              <th className="col-espace">Personne</th>
              <th>
                <span className="visually-hidden">{enteteJour(jour)}, heure par heure</span>
                <div className="frise-heures" aria-hidden="true">
                  {heures.slice(1, -1).map((m) => (
                    <span
                      key={m}
                      style={{
                        left: `${positionFrise({ debutMin: m, finMin: m }, bornes).gauche}%`,
                      }}
                    >
                      {libelleHeure(m)}
                    </span>
                  ))}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="col-espace">
                <div className="espace-cell">
                  <span className="pastille-icone">
                    <Icone nom="calendar-check" taille={13} />
                  </span>
                  <span className="cell2">
                    <span className="nom">À couvrir</span>
                    <small>Créneaux réservés</small>
                  </span>
                </div>
              </td>
              <td className={weekend}>
                <Piste elements={aCouvrir} bornes={bornes} />
              </td>
            </tr>
            {lignes.map((l) => (
              <tr key={l.personne.id}>
                <td className="col-espace">
                  <div className="espace-cell">
                    <span
                      className="pastille-espace"
                      style={{ background: l.personne.color ?? "var(--faint)" }}
                    />
                    <span className="cell2">
                      <a
                        href={avecRetour(`/personnel/personnes/${l.personne.id}`, retour)}
                        className="nom"
                      >
                        {nomPersonne(l.personne)}
                      </a>
                      <small>{l.personne.fonction ?? ""}</small>
                    </span>
                  </div>
                </td>
                <td className={weekend}>
                  <Piste
                    elements={[...l.absences, ...l.elements]}
                    plages={l.plages}
                    mention={l.elements.length || l.absences.length ? undefined : l.mention}
                    bornes={bornes}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LegendeService frise />
    </>
  );
}
