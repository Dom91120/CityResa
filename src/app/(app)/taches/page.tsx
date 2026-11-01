import { Icone } from "@/components/icones";
import { Vide } from "@/components/liste";
import { Chip } from "@/components/macros";
import { dateHeure, depuis } from "@/lib/libelles";
import { contexteAdmin } from "@/modules/admin/server";
import { prisma } from "@/server/db";
import { prochaineExecution, TACHES } from "@/server/jobs-registre";
import { LIBELLES_TACHES } from "@/server/taches";

export const metadata = { title: "Tâches planifiées - CityRésa" };

function horaire(t: (typeof TACHES)[number]): string {
  if (t.intervalleMinutes)
    return t.intervalleMinutes % 60 === 0
      ? `Toutes les ${t.intervalleMinutes / 60} h`
      : `Toutes les ${t.intervalleMinutes} min`;
  return `Chaque jour à ${t.heure ?? 0}h${String(t.minute ?? 0).padStart(2, "0")}`;
}

function StatutRun({ status }: { status: string }) {
  if (status === "ok") return <Chip teinte="emerald">OK</Chip>;
  if (status === "running") return <Chip teinte="sky">En cours</Chip>;
  return <Chip teinte="red">Erreur</Chip>;
}

export default async function TachesPage() {
  const page = await contexteAdmin();
  const cfg = page.user.settings;
  const [derniers, historique] = await Promise.all([
    prisma.schedulerRun.findMany({ orderBy: { startedAt: "desc" }, distinct: ["task"] }),
    prisma.schedulerRun.findMany({ orderBy: { startedAt: "desc" }, take: 100 }),
  ]);
  const dernierPar = new Map(derniers.map((r) => [r.task, r]));
  const now = new Date();
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Tâches planifiées <span className="page-count">{TACHES.length}</span>
          </h1>
          <p className="page-subtitle">
            Les traitements automatiques (rappels, relances, archivage, sauvegarde) et leurs
            dernières exécutions.
          </p>
        </div>
      </div>
      <div className="data-card">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Tâche</th>
                <th>Horaire</th>
                <th>État</th>
                <th>Prochaine exécution</th>
                <th>Dernière exécution</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {TACHES.map((t) => {
                const active = !t.actif || t.actif(cfg);
                const d = dernierPar.get(t.id);
                return (
                  <tr key={t.id}>
                    <td>
                      <span className="cell2">
                        <strong>{t.label}</strong>
                        <small>
                          <code>{t.id}</code>
                        </small>
                      </span>
                    </td>
                    <td className="small">{horaire(t)}</td>
                    <td>
                      {active ? (
                        <Chip teinte="emerald">Active</Chip>
                      ) : (
                        <Chip teinte="slate" titre="Désactivée par la configuration">
                          Inactive
                        </Chip>
                      )}
                    </td>
                    <td className="small text-muted">
                      {active ? dateHeure(prochaineExecution(t, now)) : "—"}
                    </td>
                    <td className="small">
                      {d ? (
                        <span className="d-flex align-items-center gap-2 flex-wrap">
                          <StatutRun status={d.status} />
                          <span className="text-muted" title={dateHeure(d.startedAt)}>
                            {depuis(d.startedAt)}
                          </span>
                          {d.message ? <span className="text-muted">· {d.message}</span> : null}
                        </span>
                      ) : (
                        <span className="text-faint">Jamais</span>
                      )}
                    </td>
                    <td>
                      <form
                        method="POST"
                        action={`/taches/${t.id}`}
                        className="row-actions"
                        data-double-envoi
                      >
                        <input type="hidden" name="csrf_token" value={page.csrf} />
                        <button
                          type="submit"
                          className="btn btn-outline-primary btn-sm"
                          data-confirm={`Exécuter maintenant « ${t.label} » ?`}
                        >
                          <Icone nom="refresh-cw" taille={13} /> Exécuter
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="h5 mt-4 mb-2">Historique des exécutions</h2>
      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Début</th>
                <th>Tâche</th>
                <th>Statut</th>
                <th>Durée</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {historique.length ? (
                historique.map((r) => (
                  <tr key={r.id}>
                    <td className="small text-muted text-nowrap tabular">
                      {dateHeure(r.startedAt)}
                    </td>
                    <td className="small">{LIBELLES_TACHES[r.task] ?? r.task}</td>
                    <td>
                      <StatutRun status={r.status} />
                    </td>
                    <td className="small text-muted tabular">
                      {r.finishedAt
                        ? `${Math.max(0, Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 100) / 10)} s`
                        : "—"}
                    </td>
                    <td className="small" style={{ overflowWrap: "anywhere" }}>
                      {r.message ?? ""}
                    </td>
                  </tr>
                ))
              ) : (
                <Vide
                  colonnes={5}
                  icone="calendar-clock"
                  message="Aucune exécution tracée pour le moment."
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
