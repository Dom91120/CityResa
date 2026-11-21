import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import { heuresDuCycle } from "@/lib/affectation";
import { SemaineHoraires } from "@/modules/personnel/vues";
import { contexteModule } from "@/server/module";
import { typesDeContratAvecPlanning } from "@/server/personnel";

export const metadata = { title: "Plannings types - CityRésa" };

/**
 * Les plannings types du personnel de service : un cycle hebdomadaire d'horaires de travail par
 * type de contrat, suivi par les personnes de ce contrat qui n'ont pas d'horaires personnalisés.
 */
export default async function PlanningsTypesPage() {
  const page = await contexteModule("personnel", "personnel");
  const types = await typesDeContratAvecPlanning();
  const peutEditer = page.user.canEdit("personnel");
  const definis = types.filter((t) => t.horaires).length;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Plannings types <span className="page-count">{definis}</span>
          </h1>
          <p className="page-subtitle">
            Les horaires de travail par type de contrat. Une personne suit le planning type de son
            contrat, sauf si sa fiche lui donne des horaires personnalisés.
          </p>
        </div>
        <div className="page-actions">
          <a href="/personnel" className="btn btn-ghost btn-sm">
            <Icone nom="calendar-days" taille={14} /> Planning de service
          </a>
          <a href="/personnel/personnes" className="btn btn-outline-secondary btn-sm">
            <Icone nom="users" taille={14} /> Personnes
          </a>
        </div>
      </div>
      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">Type de contrat</th>
                <th scope="col">Horaires de travail</th>
                <th scope="col" className="text-end">
                  Par semaine
                </th>
                <th scope="col" className="text-end">
                  Personnes qui le suivent
                </th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td className="fw-medium">{t.label}</td>
                  <td className="small">
                    {t.horaires ? (
                      <SemaineHoraires horaires={t.horaires} compacte />
                    ) : (
                      <span className="text-muted">
                        Aucun planning type : pas de contrainte horaire.
                      </span>
                    )}
                  </td>
                  <td className="text-end tabular text-nowrap">
                    {t.horaires ? `${String(heuresDuCycle(t.horaires)).replace(".", ",")} h` : "—"}
                  </td>
                  <td className="text-end">
                    {t.suivi ? (
                      <Chip teinte={t.horaires ? "emerald" : "amber"}>{t.suivi}</Chip>
                    ) : (
                      <span className="text-faint">0</span>
                    )}
                  </td>
                  <td className="actions">
                    {peutEditer ? (
                      <a
                        href={`/personnel/plannings-types/${t.id}`}
                        className="btn btn-outline-secondary btn-sm text-nowrap"
                      >
                        <Icone nom={t.horaires ? "pencil" : "plus"} taille={13} />{" "}
                        {t.horaires ? "Modifier" : "Définir"}
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!types.length ? (
                <tr>
                  <td colSpan={5} className="text-muted p-3">
                    Aucun type de contrat actif : ils se gèrent dans Administration › Référentiels.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <p className="small text-muted mt-2">
        Une pastille jaune signale des personnes qui suivent un planning type encore à définir :
        elles n'ont, en attendant, aucune contrainte horaire.
      </p>
    </>
  );
}
