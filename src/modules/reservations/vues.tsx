/**
 * Sous-composants de la liste des réservations : la carte (charte rose) et la ligne de
 * table d'un dossier.
 */
import { Vignette } from "@/components/documents";
import { Icone } from "@/components/icones";
import { Th } from "@/components/liste";
import { Frise, PastilleEspace, StatutResa, TypeOrganisation } from "@/components/macros";
import type { ReservationStatus } from "@/lib/constantes";
import {
  dateMoyenne,
  depuis,
  montantOuGratuit,
  nomCourt,
  plage,
  plageHoraire,
  pluriel,
} from "@/lib/libelles";
import { demandeurDe, type ReservationListe } from "@/modules/reservations/requetes";

/** « Répondre » pour une demande à traiter, « Suivre » pour un dossier vivant, « Voir » sinon. */
export function libelleBouton(status: string): string {
  const s = status as ReservationStatus;
  if (s === "a_traiter" || s === "en_traitement") return "Répondre";
  if (s === "acceptee" || s === "signee" || s === "confirmee") return "Suivre";
  return "Voir";
}

export function CarteResa({ r }: { r: ReservationListe }) {
  const libelle = libelleBouton(r.status);
  const nb = r._count.creneaux;
  return (
    <div className="resa-carte">
      <a href={`/reservations/${r.id}`} aria-label={`Réservation ${r.numero}`}>
        <Vignette
          photo={r.espace.documents[0] ?? null}
          alt={r.espace.name}
          icone={r.espace.nature?.icon ?? "door-open"}
        />
      </a>
      <div style={{ minWidth: 0 }}>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <a href={`/reservations/${r.id}`} className="titre">
            {r.title}
          </a>
          <StatutResa status={r.status} />
          <span className="text-faint small">{r.numero}</span>
        </div>
        <div className="meta">
          <span className="d-flex align-items-center gap-2">
            <PastilleEspace couleur={r.espace.color} />
            {nomCourt(r.espace)} · {r.espace.site.name}
          </span>
          <span className="d-flex align-items-center gap-2 flex-wrap">
            <Icone nom="users" taille={13} />
            {demandeurDe(r) || "Demandeur inconnu"}
            <TypeOrganisation type={r.organisation?.type ?? null} />
            {r.nature ? <span className="text-faint">· {r.nature.label}</span> : null}
            {r.participants ? (
              <span className="text-faint">· {pluriel(r.participants, "participant")}</span>
            ) : null}
          </span>
          <span className="d-flex align-items-center gap-2">
            <Icone nom="calendar-days" taille={13} />
            {plage(r.startAt, r.endAt)}
            {nb > 1 ? <span className="chip chip-slate">{nb} créneaux</span> : null}
          </span>
        </div>
      </div>
      <div className="droite">
        <Frise status={r.status} />
        <div className="d-flex align-items-center gap-2">
          <span className="text-faint small">reçue {depuis(r.createdAt)}</span>
          <a
            href={`/reservations/${r.id}`}
            className={`btn btn-sm ${libelle === "Répondre" ? "btn-primary" : "btn-outline-secondary"}`}
          >
            {libelle}
          </a>
        </div>
      </div>
    </div>
  );
}

export function TableResa({
  rows,
  pathname,
  search,
}: {
  rows: ReservationListe[];
  pathname: string;
  search: URLSearchParams;
}) {
  return (
    <div className="table-responsive">
      <table className="table table-hover">
        <thead>
          <tr>
            <Th col="numero" label="Dossier" pathname={pathname} search={search} />
            <Th col="espace" label="Espace" pathname={pathname} search={search} />
            <Th col="organisation" label="Demandeur" pathname={pathname} search={search} />
            <Th col="date" label="Dates" pathname={pathname} search={search} />
            <Th col="statut" label="Statut" pathname={pathname} search={search} />
            <Th col="agent" label="Agent" pathname={pathname} search={search} />
            <Th
              col="montant"
              label="Montant"
              pathname={pathname}
              search={search}
              classes="text-end"
            />
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <span className="cell2">
                  <a
                    href={`/reservations/${r.id}`}
                    className="fw-medium"
                    style={{ color: "var(--strong)" }}
                  >
                    {r.title}
                  </a>
                  <small>
                    {r.numero} · reçue {depuis(r.createdAt)}
                  </small>
                </span>
              </td>
              <td>
                <span className="d-flex align-items-center gap-2">
                  <PastilleEspace couleur={r.espace.color} />
                  <span className="cell2">
                    <span>{nomCourt(r.espace)}</span>
                    <small>{r.espace.site.name}</small>
                  </span>
                </span>
              </td>
              <td>
                <span className="cell2">
                  <span>{demandeurDe(r) || "—"}</span>
                  <small>
                    <TypeOrganisation type={r.organisation?.type ?? null} />
                  </small>
                </span>
              </td>
              <td className="text-nowrap">
                <span className="cell2">
                  <span>{dateMoyenne(r.startAt)}</span>
                  <small>
                    {plageHoraire(r.startAt, r.endAt)}
                    {r._count.creneaux > 1 ? ` · ${r._count.creneaux} créneaux` : ""}
                  </small>
                </span>
              </td>
              <td>
                <StatutResa status={r.status} />
              </td>
              <td>
                {r.agent ? (
                  `${r.agent.firstName} ${r.agent.lastName}`.trim()
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
              <td className="text-end text-nowrap">
                {montantOuGratuit(r.gratuit ? 0 : r.montantTtc)}
              </td>
              <td className="actions">
                <a href={`/reservations/${r.id}`} className="btn btn-sm btn-outline-secondary">
                  {libelleBouton(r.status)}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
