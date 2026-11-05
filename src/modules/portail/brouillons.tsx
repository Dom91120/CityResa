/** Les brouillons de demande de l'usager, sur « Mes réservations ». */
import { Icone } from "@/components/icones";
import { decrireBrouillon } from "@/lib/brouillons";
import { depuis } from "@/lib/libelles";
import type { brouillonsDe } from "@/server/brouillons";

export function ListeBrouillons({
  brouillons,
  csrf,
}: {
  brouillons: Awaited<ReturnType<typeof brouillonsDe>>;
  csrf: string;
}) {
  return (
    <div className="table-responsive">
      <table className="table align-middle mb-0">
        <thead>
          <tr>
            <th>Demande</th>
            <th>Espace</th>
            <th>Enregistré</th>
            <th className="actions" />
          </tr>
        </thead>
        <tbody>
          {brouillons.map((b) => {
            const d = decrireBrouillon(b.data);
            return (
              <tr key={b.id}>
                <td>
                  <span className="cell2">
                    <strong>{d.titre}</strong>
                    <small>{d.quand}</small>
                  </span>
                </td>
                <td className="small" title={b.espace.name}>
                  {b.espace.shortName || b.espace.name}
                </td>
                <td className="small text-muted">{depuis(b.updatedAt)}</td>
                <td className="actions text-nowrap">
                  <a
                    href={`/portail/reserver/${b.espace.slug}?brouillon=${b.id}`}
                    className="btn btn-primary btn-sm"
                  >
                    <Icone nom="pencil" taille={13} /> Reprendre
                  </a>{" "}
                  <form
                    method="POST"
                    action={`/portail/brouillons/${b.id}/supprimer`}
                    className="d-inline"
                  >
                    <input type="hidden" name="csrf_token" value={csrf} />
                    <button
                      type="submit"
                      className="btn btn-ghost btn-ghost-danger btn-sm"
                      data-confirm={`Supprimer le brouillon « ${d.titre} » ?`}
                    >
                      <Icone nom="trash-2" taille={13} /> Supprimer
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
