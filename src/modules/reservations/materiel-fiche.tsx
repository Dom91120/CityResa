/** Le matériel d'un dossier sur sa fiche : quantités, sortie, retour avec manquants. */
import { ModalAction, Section } from "@/components/fiche";
import { Champ, Grille } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import { dateHeure } from "@/lib/libelles";
import { ETATS_LIGNE, etatLigne } from "@/lib/materiel-stock";
import type { ReservationComplete } from "@/server/reservations";

const TEINTES: Record<string, string> = {
  a_sortir: "slate",
  sortie: "amber",
  rendue: "emerald",
  manquants: "red",
};

export function SectionMateriel({
  r,
  csrf,
  peutDecider,
}: {
  r: ReservationComplete;
  csrf: string;
  peutDecider: boolean;
}) {
  if (!r.materiels.length) return null;
  const fiche = `/reservations/${r.id}`;
  const acquis = ["acceptee", "signee", "confirmee", "terminee"].includes(r.status);
  return (
    <Section titre="Matériel" icone="package" nb={r.materiels.length}>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Matériel</th>
              <th className="text-end">Qté</th>
              <th>Mouvement</th>
              {peutDecider && acquis ? <th className="actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {r.materiels.map((l) => {
              const etat = etatLigne(l);
              return (
                <tr key={l.materielId}>
                  <td>
                    <a href={`/materiel/${l.materielId}`}>{l.materiel.name}</a>
                  </td>
                  <td className="text-end tabular">{l.quantite}</td>
                  <td>
                    <span className="cell2">
                      <Chip teinte={TEINTES[etat]}>
                        {ETATS_LIGNE[etat]}
                        {etat === "manquants" ? ` (${l.manquants})` : ""}
                      </Chip>
                      {l.retourAt ? (
                        <small>rendu le {dateHeure(l.retourAt)}</small>
                      ) : l.sortieAt ? (
                        <small>sorti le {dateHeure(l.sortieAt)}</small>
                      ) : null}
                    </span>
                  </td>
                  {peutDecider && acquis ? (
                    <td className="actions text-nowrap">
                      {etat === "a_sortir" ? (
                        <form
                          method="POST"
                          action={`${fiche}/materiel/${l.materielId}/sortie`}
                          className="d-inline"
                        >
                          <input type="hidden" name="csrf_token" value={csrf} />
                          <button type="submit" className="btn btn-outline-secondary btn-sm">
                            <Icone nom="package" taille={13} /> Sortie
                          </button>
                        </form>
                      ) : etat === "sortie" ? (
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          data-bs-toggle="modal"
                          data-bs-target={`#modal-retour-${l.materielId}`}
                        >
                          <Icone nom="package-check" taille={13} /> Retour
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {peutDecider && acquis
        ? r.materiels
            .filter((l) => etatLigne(l) === "sortie")
            .map((l) => (
              <ModalAction
                key={l.materielId}
                id={`modal-retour-${l.materielId}`}
                titre={`Retour : ${l.materiel.name}`}
                action={`${fiche}/materiel/${l.materielId}/retour`}
                csrf={csrf}
                bouton="Constater le retour"
                icone="package-check"
                aide={`${l.quantite} unité(s) sorties. Les unités manquantes sont retirées du stock utilisable et signalées sur la fiche du matériel.`}
              >
                <Grille colonnes={2}>
                  <Champ
                    label="Unités rendues"
                    name="rendus"
                    id={`retour-${l.materielId}-rendus`}
                    type="number"
                    min={0}
                    max={l.quantite}
                    valeur={l.quantite}
                    requis
                  />
                  <Champ
                    label="Remarque"
                    name="note"
                    id={`retour-${l.materielId}-note`}
                    placeholder="État du matériel, casse…"
                    pleine
                  />
                </Grille>
              </ModalAction>
            ))
        : null}
    </Section>
  );
}
