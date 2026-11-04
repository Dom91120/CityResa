import { notFound } from "next/navigation";
import { EnteteForm, Interrupteur } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { StatutResa } from "@/components/macros";
import { plage } from "@/lib/libelles";
import { prisma } from "@/server/db";
import { apercuFermeture } from "@/server/fermetures";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";
import { param } from "@/server/paging";

export const metadata = { title: "Fermeture exceptionnelle - CityRésa" };

/** Aperçu d'une fermeture : les dossiers touchés, avant de poser le blocage. */
export default async function FermeturePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteModule("planning");
  const user = await requireEdit("reservations");
  const params = await searchParams;
  const espaceId = Number(param(params, "espace"));
  const startAt = new Date(param(params, "debut") ?? "");
  const endAt = new Date(param(params, "fin") ?? "");
  const motif = (param(params, "motif") ?? "").slice(0, 200);
  const brut = param(params, "next") ?? "";
  const retour = brut.startsWith("/") && !brut.startsWith("//") ? brut : "/planning";
  if (
    !Number.isInteger(espaceId) ||
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    endAt <= startAt ||
    !user.gereEspace(espaceId)
  )
    notFound();
  const espace = await prisma.espace.findUnique({
    where: { id: espaceId },
    select: { id: true, name: true, site: { select: { name: true } } },
  });
  if (!espace) notFound();
  const dossiers = await apercuFermeture(espaceId, startAt, endAt);
  const nbOcc = dossiers.reduce((n, d) => n + d.occurrences.length, 0);
  const entiers = dossiers.filter((d) => d.entier).length;

  return (
    <>
      <EnteteForm
        titre="Fermeture exceptionnelle"
        sousTitre={
          espace.site.name === espace.name ? espace.name : `${espace.name} · ${espace.site.name}`
        }
        retour={retour}
        libelle="Fermer l'espace"
      />
      <form method="POST" action="/planning/fermer" id="form-principal" data-double-envoi>
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <input type="hidden" name="next" value={retour} />
        <input type="hidden" name="espace_id" value={espace.id} />
        <input type="hidden" name="debut" value={startAt.toISOString()} />
        <input type="hidden" name="fin" value={endAt.toISOString()} />
        <input type="hidden" name="motif" value={motif} />
        {dossiers.flatMap((d) =>
          d.occurrences.map((o) => (
            <input key={o.creneauId} type="hidden" name="creneau" value={o.creneauId} />
          )),
        )}

        <div className="data-card">
          <div className="card-header-custom">
            <h6>Période</h6>
          </div>
          <div className="p-3">
            <p className="mb-1">
              <strong>{plage(startAt, endAt)}</strong>
              {motif ? ` · ${motif}` : null}
            </p>
            <p className="text-muted small mb-0">
              {dossiers.length
                ? `${dossiers.length} dossier${dossiers.length > 1 ? "s" : ""} et ${nbOcc} créneau${nbOcc > 1 ? "x" : ""} tombent pendant cette fermeture.`
                : "Aucune réservation en place sur cette période : le blocage sera simplement posé."}
            </p>
          </div>
        </div>

        {dossiers.length ? (
          <>
            <div className="data-card">
              <div className="card-header-custom">
                <h6>Réservations concernées</h6>
              </div>
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Dossier</th>
                      <th>Demandeur</th>
                      <th>Statut</th>
                      <th>Créneaux touchés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossiers.map((d) => (
                      <tr key={d.reservationId}>
                        <td>
                          <a href={`/reservations/${d.reservationId}`}>{d.numero}</a>
                          <div className="text-muted small">{d.title}</div>
                        </td>
                        <td>{d.demandeur || <span className="text-faint">—</span>}</td>
                        <td>
                          <StatutResa status={d.status} />
                        </td>
                        <td className="small">
                          {d.occurrences.map((o) => (
                            <div key={o.creneauId} className="text-nowrap">
                              {plage(o.startAt, o.endAt)}
                            </div>
                          ))}
                          {d.entier ? (
                            <div className="text-warning mt-1">
                              <Icone nom="triangle-alert" taille={14} /> Tous ses créneaux : à
                              annuler ou reporter depuis la fiche
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="data-card">
              <div className="card-header-custom">
                <h6>Suite à donner</h6>
              </div>
              <div className="p-3">
                <Interrupteur
                  label="Annuler les créneaux touchés"
                  name="annuler"
                  coche
                  aide={
                    entiers
                      ? "Retirés des dossiers et du montant dû. Les dossiers dont la fermeture couvre tous les créneaux sont laissés tels quels."
                      : "Retirés des dossiers et du montant dû."
                  }
                />
                <Interrupteur
                  label="Prévenir les usagers par courriel"
                  name="prevenir"
                  coche
                  aide="Un courriel par dossier (modèle « Fermeture exceptionnelle ») avec les créneaux concernés et un lien pour convenir d'un report."
                />
              </div>
            </div>
          </>
        ) : null}
      </form>
    </>
  );
}
