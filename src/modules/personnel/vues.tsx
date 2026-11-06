/**
 * Les vues du module Personnel de service : grille personnes × jours (semaine ou jour) avec
 * la ligne « À couvrir », le formulaire de vacation (modale d'ajout, page de modification),
 * la pastille d'état de couverture.
 */
import { ModalAction } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import { JOURS_ISO } from "@/lib/constantes";
import { heure, isoParis, plageHoraire } from "@/lib/libelles";
import { parisMidnight, parisParts, toParisWall } from "@/lib/paris-time";
import {
  type CreneauCouvert,
  ETATS_COUVERTURE,
  type EtatCouverture,
  nomPersonne,
} from "@/lib/personnel";
import { bornesJour, duJour, estWeekend, type Fenetre } from "@/modules/planning/server";
import type { PersonneRow, SiteRef, VacationRow } from "@/server/personnel";

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
      <span className="evt-heure">{heuresDuJour(v, jour)}</span>
      {v.note ? <span className="evt-qui">{v.note}</span> : null}
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
}: {
  e: CreneauCouvert;
  jour: string;
  noms: Map<number, string>;
}) {
  const qui = e.couverture.personnelIds.map((id) => noms.get(id) ?? `#${id}`).join(", ");
  const etat = ETATS_COUVERTURE[e.couverture.etat];
  return (
    <a
      href={`/reservations/${e.creneau.reservationId}`}
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

export function GrilleService({
  fen,
  personnes,
  vacations,
  etats,
  peutEditer,
  aujourdhui,
}: {
  fen: Fenetre;
  personnes: PersonneRow[];
  vacations: VacationRow[];
  etats: CreneauCouvert[];
  peutEditer: boolean;
  aujourdhui: string;
}) {
  const noms = new Map(personnes.map((p) => [p.id, nomPersonne(p)]));
  for (const v of vacations)
    if (!noms.has(v.personnelId)) noms.set(v.personnelId, nomPersonne(v.personnel));
  return (
    <div className="planning">
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
                <span className="cell2">
                  <span className="nom">
                    <Icone nom="calendar-check" taille={13} /> À couvrir
                  </span>
                  <small>Créneaux réservés</small>
                </span>
              </div>
            </td>
            {fen.jours.map((j) => (
              <td key={j} className={estWeekend(j) ? "weekend" : undefined}>
                {duJour(
                  etats.map((e) => ({ ...e, startAt: e.creneau.startAt, endAt: e.creneau.endAt })),
                  j,
                ).map((e) => (
                  <ACouvrir key={e.creneau.id} e={e} jour={j} noms={noms} />
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
                    <a href={`/personnel/personnes/${p.id}`} className="nom">
                      {nomPersonne(p)}
                    </a>
                    <small>{p.fonction ?? ""}</small>
                  </span>
                </div>
              </td>
              {fen.jours.map((j) => (
                <td key={j} className={estWeekend(j) ? "weekend" : undefined}>
                  {duJour(
                    vacations.filter((v) => v.personnelId === p.id),
                    j,
                  ).map((v) => (
                    <Vac key={v.id} v={v} jour={j} peutEditer={peutEditer} />
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
