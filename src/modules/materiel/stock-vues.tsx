/** Fiche d'un matériel : pannes, remises en service, contrôles et journal des mouvements. */
import { ModalAction, Section } from "@/components/fiche";
import { Champ, Grille } from "@/components/formulaire";
import { VideBloc } from "@/components/liste";
import { Chip } from "@/components/macros";
import { dateHeure } from "@/lib/libelles";
import { MOUVEMENTS } from "@/lib/materiel-stock";
import type { mouvementsDe } from "@/server/materiel-stock";

const TEINTES: Record<string, string> = {
  sortie: "amber",
  retour: "emerald",
  perte: "red",
  panne: "red",
  reparation: "emerald",
  controle: "sky",
};

export function ModalsStock({
  fiche,
  csrf,
  stockUtilisable,
  horsService,
}: {
  fiche: string;
  csrf: string;
  stockUtilisable: number;
  horsService: number;
}) {
  return (
    <>
      <ModalAction
        id="modal-panne"
        titre="Signaler une panne ou une perte"
        action={`${fiche}/panne`}
        csrf={csrf}
        bouton="Retirer du stock"
        icone="wrench"
        danger
        aide="Les unités signalées sortent du stock utilisable jusqu'à leur remise en service."
      >
        <Grille colonnes={2}>
          <Champ
            label="Unités concernées"
            name="quantite"
            id="panne-qte"
            type="number"
            min={1}
            max={stockUtilisable}
            valeur={1}
            requis
          />
          <Champ
            label="Motif"
            name="note"
            id="panne-note"
            placeholder="Cassé, perdu, à réparer…"
            pleine
          />
        </Grille>
      </ModalAction>
      <ModalAction
        id="modal-remise"
        titre="Remettre en service"
        action={`${fiche}/remise`}
        csrf={csrf}
        bouton="Remettre en service"
        icone="wrench"
        aide={`${horsService} unité(s) hors service : réparées ou retrouvées, elles reviennent au stock.`}
      >
        <Grille colonnes={2}>
          <Champ
            label="Unités remises en service"
            name="quantite"
            id="remise-qte"
            type="number"
            min={1}
            max={horsService}
            valeur={horsService}
            requis
          />
          <Champ label="Remarque" name="note" id="remise-note" pleine />
        </Grille>
      </ModalAction>
      <ModalAction
        id="modal-controle"
        titre="Contrôle périodique effectué"
        action={`${fiche}/controle`}
        csrf={csrf}
        bouton="Enregistrer le contrôle"
        icone="clipboard-check"
        aide="Date du contrôle : aujourd'hui. Le prochain est calculé d'après la périodicité du matériel."
      >
        <Champ
          label="Observations"
          name="note"
          id="controle-note"
          placeholder="RAS, points vérifiés…"
          pleine
        />
      </ModalAction>
    </>
  );
}

export function SectionJournal({
  mouvements,
}: {
  mouvements: Awaited<ReturnType<typeof mouvementsDe>>;
}) {
  return (
    <Section
      titre="Journal des mouvements"
      icone="history"
      nb={mouvements.length}
      ouverte={mouvements.length > 0}
    >
      {mouvements.length ? (
        <div className="table-responsive">
          <table className="table table-serree mb-0">
            <thead>
              <tr>
                <th>Quand</th>
                <th>Mouvement</th>
                <th className="text-end">Qté</th>
                <th>Dossier</th>
                <th>Par</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.map((m) => (
                <tr key={m.id}>
                  <td className="text-nowrap small">{dateHeure(m.createdAt)}</td>
                  <td>
                    <span className="cell2">
                      <Chip teinte={TEINTES[m.kind] ?? "slate"}>
                        {MOUVEMENTS[m.kind] ?? m.kind}
                      </Chip>
                      {m.note ? <small>{m.note}</small> : null}
                    </span>
                  </td>
                  <td className="text-end tabular">{m.quantite}</td>
                  <td className="small">
                    {m.reservation ? (
                      <a href={`/reservations/${m.reservation.id}`}>{m.reservation.numero}</a>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="small text-muted">{m.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <VideBloc
          icone="history"
          titre="Aucun mouvement"
          texte="Sorties, retours, pannes et contrôles apparaîtront ici."
        />
      )}
    </Section>
  );
}
