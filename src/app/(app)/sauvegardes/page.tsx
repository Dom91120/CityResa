import { Icone } from "@/components/icones";
import { Vide } from "@/components/liste";
import { CarteStat } from "@/components/stats";
import { dateHeure, depuis } from "@/lib/libelles";
import { contexteAdmin } from "@/modules/admin/server";
import { backupDir, dbSizeMb, listBackups } from "@/server/db-backup";

export const metadata = { title: "Sauvegardes - CityRésa" };

function taille(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.round(kb)} Ko`;
}

export default async function SauvegardesPage() {
  const page = await contexteAdmin();
  const cfg = page.user.settings;
  const [tailleMb, sauvegardes] = await Promise.all([dbSizeMb(), listBackups(cfg)]);
  const derniere = sauvegardes[0];
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Sauvegardes <span className="page-count">{sauvegardes.length}</span>
          </h1>
          <p className="page-subtitle">
            Copies de la base PostgreSQL (format pg_dump « custom »). Dossier :{" "}
            <code>{backupDir(cfg)}</code>
          </p>
        </div>
        <div className="page-actions">
          <form method="POST" action="/sauvegardes" data-double-envoi>
            <input type="hidden" name="csrf_token" value={page.csrf} />
            <button type="submit" className="btn btn-primary">
              <Icone nom="database" taille={14} /> Sauvegarder maintenant
            </button>
          </form>
        </div>
      </div>

      {/* Les mêmes cartes de synthèse que sur le tableau de bord ; les valeurs en texte sont
          affichées plus petit que les chiffres. */}
      <div className="stat-grid">
        <CarteStat
          icone="database"
          teinte="sky"
          label="Taille de la base"
          valeur={tailleMb ? `${String(tailleMb).replace(".", ",")} Mo` : "—"}
        />
        <CarteStat
          icone="history"
          teinte={derniere ? "emerald" : "amber"}
          label="Dernière sauvegarde"
          valeur={
            <span style={{ fontSize: "1.3rem" }}>
              {derniere ? depuis(derniere.date) : "Aucune"}
            </span>
          }
          detail={derniere ? dateHeure(derniere.date) : undefined}
        />
        <CarteStat
          icone="refresh-cw"
          teinte="violet"
          label="Rotation"
          valeur={cfg.BACKUP_DB_KEEP}
          detail={
            <>
              sauvegardes conservées · <a href="/parametres#sauvegardes">régler</a>
            </>
          }
        />
        <CarteStat
          icone="calendar-clock"
          teinte={cfg.BACKUP_DB_DIR ? "emerald" : "slate"}
          label="Sauvegarde auto"
          valeur={
            <span style={{ fontSize: "1.3rem" }}>
              {cfg.BACKUP_DB_DIR ? "Chaque nuit à 1h" : "Désactivée"}
            </span>
          }
          detail={
            cfg.BACKUP_DB_DIR ? (
              <a href="/taches">Voir la tâche planifiée</a>
            ) : (
              // Le dossier ne se règle pas à l'écran : c'est un réglage du serveur.
              <span title="Réglage BACKUP_DB_DIR du serveur (fichier .env)">
                Aucun dossier défini sur le serveur.
              </span>
            )
          }
        />
      </div>

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Fichier</th>
                <th>Date</th>
                <th className="text-end">Taille</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sauvegardes.length ? (
                sauvegardes.map((s) => (
                  <tr key={s.name}>
                    <td>
                      <code>{s.name}</code>
                    </td>
                    <td className="small text-muted">
                      {dateHeure(s.date)} · {depuis(s.date)}
                    </td>
                    <td className="text-end tabular small">{taille(s.sizeKb)}</td>
                    <td>
                      <div className="row-actions">
                        <a
                          href={`/data/sauvegardes/${encodeURIComponent(s.name)}`}
                          className="btn btn-ghost btn-icone btn-sm"
                          title="Télécharger"
                          aria-label="Télécharger"
                        >
                          <Icone nom="download" taille={14} />
                        </a>
                        <form
                          method="POST"
                          action={`/sauvegardes/${encodeURIComponent(s.name)}/supprimer`}
                        >
                          <input type="hidden" name="csrf_token" value={page.csrf} />
                          <button
                            type="submit"
                            className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                            title="Supprimer"
                            aria-label="Supprimer"
                            data-confirm={`Supprimer la sauvegarde ${s.name} ?`}
                          >
                            <Icone nom="trash-2" taille={14} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <Vide
                  colonnes={4}
                  icone="database"
                  message="Aucune sauvegarde dans le dossier. Lancez-en une maintenant ou réglez BACKUP_DB_DIR pour la sauvegarde automatique."
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="small text-muted mt-3 d-flex gap-2 align-items-start">
        <Icone nom="info" taille={14} />
        <span>
          Restauration : <code>pg_restore --clean --no-owner -d $DATABASE_URL fichier.dump</code>.
          Le binaire pg_dump se règle par <code>PG_DUMP_BIN</code> (ex.{" "}
          <code>docker exec cityresa-pg pg_dump</code>).
        </span>
      </p>
    </>
  );
}
