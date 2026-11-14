/**
 * Les trois vues du planning : semaine (espaces × jours), mois (grille d'un espace ou
 * compteurs), jour (heures × espaces). Les cellules cliquables ouvrent la saisie d'une
 * réservation préremplie (planning.js lit data-creer).
 */
import { Vignette } from "@/components/documents";
import { Icone } from "@/components/icones";
import { JOURS_ISO } from "@/lib/constantes";
import { heure, nomCourt, plageHoraire } from "@/lib/libelles";
import { parisMidnight, parisParts, toParisWall } from "@/lib/paris-time";
import { type Couleur, couleurEvt } from "@/lib/planning-vues";
import { avecRetour } from "@/lib/url";
import {
  type Blocage,
  bornesJour,
  duJour,
  type EspacePlanning,
  type EvtResa,
  estWeekend,
  type Fenetre,
  HEURE_DEBUT_JOUR,
  HEURE_FIN_JOUR,
} from "@/modules/planning/server";

const ATTENTE = ["a_traiter", "en_traitement"];

function urlCreer(espaceId: number, jour: string, heureDebut?: string): string {
  return `/reservations/nouvelle?espace=${espaceId}&date=${jour}${heureDebut ? `&heure_debut=${heureDebut}` : ""}`;
}

/** Les heures d'un élément restreintes au jour affiché (« 9h00 – 12h00 », « → 18h00 »). */
function heuresDuJour(i: { startAt: Date; endAt: Date }, jour: string): string {
  const b = bornesJour(jour);
  const debutDedans = i.startAt >= b.startAt;
  const finDedans = i.endAt <= b.endAt;
  if (debutDedans && finDedans) return plageHoraire(i.startAt, i.endAt);
  if (debutDedans) return `${heure(i.startAt)} →`;
  if (finDedans) return `→ ${heure(i.endAt)}`;
  return "Toute la journée";
}

export function Evt({
  e,
  espace,
  jour,
  compact = false,
  couleur = "espace",
  deplacable = false,
  retour,
}: {
  e: EvtResa;
  espace?: EspacePlanning;
  jour: string;
  /** La page du planning affichée : la fiche du dossier y ramène par sa flèche de retour. */
  retour?: string;
  compact?: boolean;
  couleur?: Couleur;
  /** Glissable vers une autre case du même espace (planning.js). */
  deplacable?: boolean;
}) {
  const liseré = couleurEvt(couleur, e, espace);
  const debut = toParisWall(e.startAt);
  return (
    <a
      href={avecRetour(`/reservations/${e.reservationId}`, retour)}
      className={`evt${ATTENTE.includes(e.status) ? " evt--attente" : ""}${deplacable ? " evt--deplacable" : ""}`}
      style={liseré ? { borderLeftColor: liseré } : undefined}
      title={`${e.numero} · ${e.titre}${e.qui ? ` · ${e.qui}` : ""}${espace ? ` · ${nomCourt(espace)}` : ""}${deplacable ? " · glisser pour déplacer" : ""}`}
      data-creneau-id={deplacable ? e.id : undefined}
      data-reservation-id={deplacable ? e.reservationId : undefined}
      data-espace-id={deplacable ? e.espaceId : undefined}
      data-jour={deplacable ? parisParts(e.startAt).dateKey : undefined}
      data-debut-min={deplacable ? debut.min : undefined}
      data-duree-min={
        deplacable ? Math.round((e.endAt.getTime() - e.startAt.getTime()) / 60_000) : undefined
      }
      data-titre={deplacable ? e.titre : undefined}
    >
      <span className="evt-titre">{e.titre}</span>
      <span className="evt-heure">
        {heuresDuJour(e, jour)}
        {ATTENTE.includes(e.status) ? " · à traiter" : ""}
      </span>
      {!compact ? (
        <span className="evt-qui">
          {espace && !compact ? `${nomCourt(espace)}${e.qui ? " · " : ""}` : ""}
          {e.qui}
        </span>
      ) : null}
    </a>
  );
}

export function Bloc({
  b,
  jour,
  csrf,
  peutEditer,
  retour,
}: {
  b: Blocage;
  jour: string;
  csrf: string;
  peutEditer: boolean;
  retour: string;
}) {
  return (
    <div className="evt evt--bloque d-flex align-items-start gap-1" title={b.motif ?? "Bloqué"}>
      <span className="flex-grow-1" style={{ minWidth: 0 }}>
        <span className="evt-titre">
          <Icone nom="ban" taille={10} /> {b.motif || "Indisponible"}
        </span>
        <span className="evt-heure">{heuresDuJour(b, jour)}</span>
      </span>
      {peutEditer ? (
        <form method="POST" action={`/planning/blocage/${b.id}/supprimer`} className="d-inline">
          <input type="hidden" name="csrf_token" value={csrf} />
          <input type="hidden" name="next" value={retour} />
          <button
            type="submit"
            className="btn btn-ghost btn-icone btn-sm"
            style={{ width: 20, height: 20 }}
            title="Lever ce blocage"
            aria-label="Lever ce blocage"
            data-confirm-stop="Lever ce blocage de l'espace ?"
          >
            <Icone nom="x" taille={11} />
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** La cellule d'un espace dans une grille : photo, nom et site ; nom complet et capacité en infobulle. */
export function EspaceCell({ e, retour }: { e: EspacePlanning; retour?: string }) {
  const cap = e.capacitySeated ?? e.capacityStanding;
  const infobulle = `${e.name} · ${e.site.name}${cap ? ` · ${cap} pers.` : ""}`;
  return (
    <div className="espace-cell" title={infobulle}>
      <Vignette photo={e.documents[0] ?? null} alt={e.name} icone={e.nature?.icon ?? "door-open"} />
      <span className="cell2">
        <a href={avecRetour(`/espaces/${e.id}`, retour)} className="nom" title={infobulle}>
          {nomCourt(e)}
        </a>
        <small title={infobulle}>{e.site.name}</small>
      </span>
    </div>
  );
}

type VueProps = {
  fen: Fenetre;
  espaces: EspacePlanning[];
  creneaux: EvtResa[];
  blocages: Blocage[];
  csrf: string;
  peutEditer: boolean;
  aujourdhui: string;
  retour: string;
  /** Mode de couleur des créneaux : espace (défaut), statut ou type d'usager. */
  couleur?: Couleur;
};

function enteteJour(jour: string): string {
  const d = parisMidnight(jour);
  const p = parisParts(d);
  const w = toParisWall(d);
  return `${JOURS_ISO[p.weekday - 1].court} ${String(w.da).padStart(2, "0")}/${String(w.mo).padStart(2, "0")}`;
}

export function VueSemaine({
  fen,
  espaces,
  creneaux,
  blocages,
  csrf,
  peutEditer,
  aujourdhui,
  retour,
  couleur = "espace",
}: VueProps) {
  const deplacable = peutEditer;
  return (
    <div className="planning">
      <table>
        <thead>
          <tr>
            <th className="col-espace">Espace</th>
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
          {espaces.map((e) => (
            <tr key={e.id}>
              <td className="col-espace">
                <EspaceCell e={e} retour={retour} />
              </td>
              {fen.jours.map((j) => {
                const evts = duJour(
                  creneaux.filter((c) => c.espaceId === e.id),
                  j,
                );
                const blocs = duJour(
                  blocages.filter((b) => b.espaceId === e.id),
                  j,
                );
                return (
                  <td
                    key={j}
                    className={`${peutEditer ? "jour-cellule" : ""}${estWeekend(j) ? " weekend" : ""}`}
                    data-creer={peutEditer ? urlCreer(e.id, j) : undefined}
                    data-jour={peutEditer ? j : undefined}
                    data-espace-id={peutEditer ? e.id : undefined}
                    title={peutEditer ? "Cliquer pour réserver ce jour" : undefined}
                  >
                    {blocs.map((b) => (
                      <Bloc
                        key={`b${b.id}`}
                        b={b}
                        jour={j}
                        csrf={csrf}
                        peutEditer={peutEditer}
                        retour={retour}
                      />
                    ))}
                    {evts.map((ev) => (
                      <Evt
                        retour={retour}
                        key={ev.id}
                        e={ev}
                        espace={e}
                        jour={j}
                        compact
                        couleur={couleur}
                        deplacable={deplacable && STATUTS_DEPLACABLES.includes(ev.status)}
                      />
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Les dossiers dont un créneau se déplace par glisser-déposer (règle du serveur : dossier occupant). */
const STATUTS_DEPLACABLES = ["a_traiter", "en_traitement", "acceptee", "signee", "confirmee"];

/** Le détail d'un blocage en une ligne : « Travaux · 9h00 - 12h00 · Salle Gabriel Péri ». */
function libelleBlocage(b: Blocage, jour: string, parEspace: Map<number, EspacePlanning>): string {
  const espace = parEspace.get(b.espaceId);
  return [b.motif || "Indisponible", heuresDuJour(b, jour), espace ? nomCourt(espace) : null]
    .filter(Boolean)
    .join(" · ");
}

/** Menu positionné par rapport à la fenêtre : la grille du mois (overflow masqué) ne le rogne pas. */
const POPPER_FIXE = '{"strategy":"fixed"}';

export function VueMois({
  fen,
  espaces,
  creneaux,
  blocages,
  csrf,
  peutEditer,
  aujourdhui,
  retour,
  urlJour,
  couleur = "espace",
}: VueProps & { urlJour: (jour: string) => string }) {
  const unSeul = espaces.length === 1 ? espaces[0] : null;
  const parEspace = new Map(espaces.map((e) => [e.id, e]));
  return (
    <div className="mois-grille">
      {JOURS_ISO.map((j) => (
        <div key={j.iso} className="mois-entete">
          {j.long}
        </div>
      ))}
      {fen.jours.map((j) => {
        const hors = j.slice(0, 7) !== fen.mois;
        const evts = duJour(creneaux, j);
        const blocs = duJour(blocages, j);
        const num = Number(j.slice(8, 10));
        return (
          <div
            key={j}
            className={`mois-jour${hors ? " hors" : ""}${j === aujourdhui ? " aujourdhui" : ""}`}
          >
            <div className="num">
              <a href={urlJour(j)} title="Voir la journée" style={{ color: "inherit" }}>
                {num}
              </a>
              {unSeul && peutEditer ? (
                <a
                  href={urlCreer(unSeul.id, j)}
                  className="text-muted"
                  title="Réserver ce jour"
                  aria-label="Réserver ce jour"
                >
                  <Icone nom="plus" taille={12} />
                </a>
              ) : null}
              {!unSeul && blocs.length === 1 && blocs[0] ? (
                // Un seul blocage : la pastille y mène directement, le détail au survol.
                <span className="mois-pastilles">
                  <a
                    href={avecRetour(`/espaces/${blocs[0].espaceId}#indisponibilites`, retour)}
                    className="chip chip-red"
                    title={`Blocage : ${libelleBlocage(blocs[0], j, parEspace)}`}
                  >
                    <Icone nom="ban" taille={12} /> 1 blocage
                  </a>
                </span>
              ) : null}
              {!unSeul && blocs.length > 1 ? (
                <span className="mois-pastilles dropdown">
                  <button
                    type="button"
                    className="chip chip-red"
                    data-bs-toggle="dropdown"
                    data-bs-popper-config={POPPER_FIXE}
                    aria-expanded="false"
                    title={`${blocs.length} blocages : cliquer pour voir ce qui bloque`}
                  >
                    <Icone nom="ban" taille={12} /> {blocs.length} blocages
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end mois-menu">
                    {blocs.map((b) => {
                      const espace = parEspace.get(b.espaceId);
                      return (
                        <li key={b.id}>
                          <a
                            className="dropdown-item"
                            href={avecRetour(`/espaces/${b.espaceId}#indisponibilites`, retour)}
                            title="Ouvrir les indisponibilités de cet espace"
                          >
                            <Icone nom="ban" taille={14} />
                            <span className="cell2">
                              <span>{b.motif || "Indisponible"}</span>
                              <small>
                                {heuresDuJour(b, j)}
                                {espace ? ` · ${nomCourt(espace)}` : ""}
                              </small>
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </span>
              ) : null}
            </div>
            {unSeul ? (
              <>
                {blocs.map((b) => (
                  <Bloc
                    key={`b${b.id}`}
                    b={b}
                    jour={j}
                    csrf={csrf}
                    peutEditer={peutEditer}
                    retour={retour}
                  />
                ))}
                {evts.slice(0, 4).map((ev) => (
                  <Evt
                    retour={retour}
                    key={ev.id}
                    e={ev}
                    espace={unSeul}
                    jour={j}
                    compact
                    couleur={couleur}
                  />
                ))}
                {evts.length > 4 ? (
                  <a href={urlJour(j)} className="small text-muted">
                    + {evts.length - 4} autre{evts.length - 4 > 1 ? "s" : ""}
                  </a>
                ) : null}
              </>
            ) : evts.length ? (
              <div className="mt-1">
                {evts.slice(0, 3).map((ev) => (
                  <Evt
                    retour={retour}
                    key={ev.id}
                    e={ev}
                    espace={parEspace.get(ev.espaceId)}
                    jour={j}
                    compact
                    couleur={couleur}
                  />
                ))}
                {evts.length > 3 ? (
                  // Au-delà de trois réservations : « + 2 autres » ouvre la liste complète du jour.
                  <span className="dropdown">
                    <button
                      type="button"
                      className="mois-autres"
                      data-bs-toggle="dropdown"
                      data-bs-popper-config={POPPER_FIXE}
                      aria-expanded="false"
                      title={`${evts.length} réservations ce jour : cliquer pour toutes les voir`}
                    >
                      + {evts.length - 3} autre{evts.length - 3 > 1 ? "s" : ""}
                    </button>
                    <ul className="dropdown-menu mois-menu">
                      {evts.map((ev) => {
                        const espace = parEspace.get(ev.espaceId);
                        return (
                          <li key={ev.id}>
                            <a
                              className="dropdown-item"
                              href={avecRetour(`/reservations/${ev.reservationId}`, retour)}
                            >
                              <span
                                className="pastille-espace"
                                style={{ background: espace?.color ?? "var(--faint)" }}
                              />
                              <span className="cell2">
                                <span>{ev.titre}</span>
                                <small>
                                  {heuresDuJour(ev, j)}
                                  {espace ? ` · ${nomCourt(espace)}` : ""}
                                </small>
                              </span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function VueJour({
  fen,
  espaces,
  creneaux,
  blocages,
  csrf,
  peutEditer,
  retour,
  couleur = "espace",
}: VueProps) {
  const jour = fen.jours[0];
  const b = bornesJour(jour);
  const heures = Array.from(
    { length: HEURE_FIN_JOUR - HEURE_DEBUT_JOUR + 1 },
    (_, i) => HEURE_DEBUT_JOUR + i,
  );
  /** L'heure de la ligne où un élément apparaît : son heure de début (bornée au jour et à 7h). */
  const ligneDe = (i: { startAt: Date }): number => {
    if (i.startAt < b.startAt) return HEURE_DEBUT_JOUR;
    const h = Math.floor(toParisWall(i.startAt).min / 60);
    return Math.min(HEURE_FIN_JOUR, Math.max(HEURE_DEBUT_JOUR, h));
  };
  const evtsJour = duJour(creneaux, jour);
  const blocsJour = duJour(blocages, jour);
  return (
    <div className="planning planning-jour">
      <table>
        <thead>
          <tr>
            <th className="col-espace" style={{ width: 70 }}>
              Heure
            </th>
            {espaces.map((e) => (
              <th key={e.id}>
                <EspaceCell e={e} retour={retour} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heures.map((h) => (
            <tr key={h}>
              <td className="col-espace" style={{ width: 70 }}>
                <span className="heure">{h}h00</span>
              </td>
              {espaces.map((e) => {
                const evts = evtsJour.filter((c) => c.espaceId === e.id && ligneDe(c) === h);
                const blocs = blocsJour.filter((x) => x.espaceId === e.id && ligneDe(x) === h);
                return (
                  <td
                    key={e.id}
                    className={peutEditer ? "jour-cellule" : undefined}
                    style={{ height: 56, minHeight: 56 }}
                    data-creer={
                      peutEditer
                        ? urlCreer(e.id, jour, `${String(h).padStart(2, "0")}:00`)
                        : undefined
                    }
                    data-jour={peutEditer ? jour : undefined}
                    data-espace-id={peutEditer ? e.id : undefined}
                    data-heure={peutEditer ? `${String(h).padStart(2, "0")}:00` : undefined}
                  >
                    {blocs.map((x) => (
                      <Bloc
                        key={`b${x.id}`}
                        b={x}
                        jour={jour}
                        csrf={csrf}
                        peutEditer={peutEditer}
                        retour={retour}
                      />
                    ))}
                    {evts.map((ev) => (
                      <Evt
                        retour={retour}
                        key={ev.id}
                        e={ev}
                        espace={e}
                        jour={jour}
                        couleur={couleur}
                        deplacable={peutEditer && STATUTS_DEPLACABLES.includes(ev.status)}
                      />
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
