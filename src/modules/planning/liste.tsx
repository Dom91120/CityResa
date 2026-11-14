/** La vue liste du planning : une table chronologique, lisible au clavier et par synthèse vocale. */
import { Icone } from "@/components/icones";
import { VideBloc } from "@/components/liste";
import { Chip, PastilleEspace, StatutResa } from "@/components/macros";
import { dateMoyenne, nomCourt, plageHoraire } from "@/lib/libelles";
import { type LigneListe, lignesListe } from "@/lib/planning-vues";
import { avecRetour } from "@/lib/url";
import type { Blocage, EspacePlanning, EvtResa } from "@/modules/planning/server";

export function VueListe({
  espaces,
  creneaux,
  blocages,
  retour,
}: {
  espaces: EspacePlanning[];
  creneaux: EvtResa[];
  blocages: Blocage[];
  /** La page du planning affichée : la fiche du dossier y ramène par sa flèche de retour. */
  retour?: string;
}) {
  const parEspace = new Map(espaces.map((e) => [e.id, e]));
  const lignes = lignesListe(creneaux, blocages).filter((l) => parEspace.has(l.espaceId));
  if (!lignes.length)
    return (
      <div className="data-card">
        <VideBloc
          icone="calendar-check"
          titre="Rien sur cette période"
          texte="Aucune réservation ni blocage pour les espaces affichés."
        />
      </div>
    );
  return (
    <div className="data-card">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 table-serree">
          <caption className="visually-hidden">
            Créneaux et blocages de la période, par ordre chronologique
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Heures</th>
              <th scope="col">Espace</th>
              <th scope="col">Objet</th>
              <th scope="col">Usager</th>
              <th scope="col">Statut</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <Ligne key={l.cle} l={l} espace={parEspace.get(l.espaceId)} retour={retour} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Ligne({
  l,
  espace,
  retour,
}: {
  l: LigneListe;
  espace: EspacePlanning | undefined;
  retour?: string;
}) {
  return (
    <tr className={l.genre === "blocage" ? "text-muted" : undefined}>
      <td className="text-nowrap">{dateMoyenne(l.startAt)}</td>
      <td className="text-nowrap">{plageHoraire(l.startAt, l.endAt)}</td>
      <td>
        {espace ? (
          <span className="d-flex align-items-center gap-2" title={espace.name}>
            <PastilleEspace couleur={espace.color} />
            {nomCourt(espace)}
          </span>
        ) : null}
      </td>
      <td>
        {l.genre === "reservation" ? (
          <a href={avecRetour(`/reservations/${l.reservationId}`, retour)} className="cell2">
            <strong>{l.titre}</strong>
            <small>{l.numero}</small>
          </a>
        ) : (
          <span>
            <Icone nom="ban" taille={12} /> {l.titre}
          </span>
        )}
      </td>
      <td className="small">{l.qui || <span className="text-faint">—</span>}</td>
      <td>{l.status ? <StatutResa status={l.status} /> : <Chip teinte="slate">Bloqué</Chip>}</td>
    </tr>
  );
}
