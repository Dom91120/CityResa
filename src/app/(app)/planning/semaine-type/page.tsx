import { Icone } from "@/components/icones";
import { VideBloc } from "@/components/liste";
import { Chip } from "@/components/macros";
import { JOURS_ISO } from "@/lib/constantes";
import { plageMinutes } from "@/lib/editions";
import { nomCourt, pluriel } from "@/lib/libelles";
import {
  espacesDuPerimetre,
  espacesPlanning,
  lireFiltresPlanning,
} from "@/modules/planning/server";
import { saisonActive, saisons } from "@/server/calendrier";
import { seriesSemaineType } from "@/server/editions";
import { contexteModule } from "@/server/module";
import { param } from "@/server/paging";

export const metadata = { title: "Semaine type - CityRésa" };

/** La semaine type d'une saison : les séries hebdomadaires de chaque espace, jour par jour. */
export default async function SemaineTypePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteModule("planning");
  const params = await searchParams;
  const filtres = lireFiltresPlanning(params);
  const [espaces, tous, toutesSaisons, active] = await Promise.all([
    espacesPlanning(page.user, filtres),
    espacesDuPerimetre(page.user),
    saisons(),
    saisonActive(),
  ]);
  const saisonId = Number(param(params, "saison")) || active?.id || toutesSaisons[0]?.id || null;
  const saison = toutesSaisons.find((s) => s.id === saisonId) ?? null;
  const series = saison
    ? await seriesSemaineType(
        espaces.map((e) => e.id),
        saison,
      )
    : [];
  const sites = [...new Map(tous.map((e) => [e.site.id, e.site])).values()];
  const q = new URLSearchParams();
  if (filtres.site) q.set("site", String(filtres.site));
  for (const id of filtres.espaces) q.append("espace", String(id));
  q.set("type", "type");
  const nbDossiers = new Set(series.map((s) => s.reservationId)).size;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Semaine type {saison ? <span className="page-count">saison {saison.label}</span> : null}
          </h1>
          <p className="page-subtitle">
            Les créneaux hebdomadaires acquis sur la saison, ramenés sur une seule semaine :{" "}
            {pluriel(series.length, "série", "séries")} de{" "}
            {pluriel(nbDossiers, "dossier", "dossiers")} sur{" "}
            {pluriel(espaces.length, "espace", "espaces")}.
          </p>
        </div>
        <div className="page-actions">
          <a href="/planning" className="btn btn-ghost btn-sm">
            <Icone nom="calendar-days" taille={14} /> Planning daté
          </a>
          <a
            href={`/planning/semaine.pdf?${q.toString()}&format=A4`}
            className="btn btn-outline-secondary btn-sm"
            target="_blank"
            rel="noopener"
          >
            <Icone nom="printer" taille={14} /> PDF A4
          </a>
          <a
            href={`/planning/semaine.pdf?${q.toString()}&format=A3`}
            className="btn btn-outline-secondary btn-sm"
            target="_blank"
            rel="noopener"
          >
            <Icone nom="printer" taille={14} /> PDF A3
          </a>
        </div>
      </div>

      <form
        method="GET"
        className="d-flex align-items-center gap-2 flex-wrap mb-3"
        data-auto-submit
        data-auto-submit-natif
      >
        <select
          name="saison"
          className="form-select form-select-sm filtre-select"
          defaultValue={saison ? String(saison.id) : ""}
          aria-label="Saison"
        >
          {toutesSaisons.map((s) => (
            <option key={s.id} value={s.id}>
              Saison {s.label}
              {s.isActive ? " (active)" : ""}
            </option>
          ))}
        </select>
        <select
          name="site"
          className="form-select form-select-sm filtre-select"
          defaultValue={filtres.site ? String(filtres.site) : ""}
          aria-label="Site"
        >
          <option value="">Tous les sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          name="espace"
          className="form-select form-select-sm filtre-select"
          defaultValue={filtres.espaces.length === 1 ? String(filtres.espaces[0]) : ""}
          aria-label="Espace"
        >
          <option value="">Tous les espaces</option>
          {tous
            .filter((e) => !filtres.site || e.siteId === filtres.site)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {nomCourt(e)} · {e.site.name}
              </option>
            ))}
        </select>
        <noscript>
          <button type="submit" className="btn btn-sm btn-outline-secondary">
            Afficher
          </button>
        </noscript>
      </form>

      {!saison ? (
        <div className="data-card">
          <VideBloc
            icone="calendar-range"
            titre="Aucune saison"
            texte="Créez une saison dans Administration › Calendrier des saisons."
          />
        </div>
      ) : (
        <div className="data-card">
          <div className="planning">
            <table>
              <thead>
                <tr>
                  <th className="col-espace">Espace</th>
                  {JOURS_ISO.map((j) => (
                    <th key={j.iso}>{j.long}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {espaces.map((e) => (
                  <tr key={e.id}>
                    <td className="col-espace">
                      <span className="cell2">
                        <a href={`/espaces/${e.id}`}>{nomCourt(e)}</a>
                        <small>{e.site.name}</small>
                      </span>
                    </td>
                    {JOURS_ISO.map((j) => {
                      const du = series.filter((s) => s.espaceId === e.id && s.jour === j.iso);
                      return (
                        <td key={j.iso} className={j.iso >= 6 ? "weekend" : undefined}>
                          {du.map((s) => (
                            <a
                              key={`${s.reservationId}-${s.jour}`}
                              href={`/reservations/${s.reservationId}`}
                              className="evt"
                              title={`${s.numero} · ${s.titre}`}
                            >
                              <span className="evt-heure">
                                {plageMinutes(s.debutMin, s.finMin)}
                              </span>
                              <span className="evt-titre">{s.titre}</span>
                              <span className="evt-qui">
                                {s.qui} · {pluriel(s.nb, "séance", "séances")}
                                {s.horsVacances ? " · hors vacances" : ""}
                              </span>
                            </a>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!espaces.length ? (
                  <tr>
                    <td colSpan={8}>
                      <VideBloc icone="door-open" titre="Aucun espace dans la sélection" />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {series.length === 0 && espaces.length ? (
            <p className="text-muted small p-3 mb-0">
              <Chip teinte="slate">Aucune série</Chip> Aucun dossier à récurrence hebdomadaire
              acquis sur cette saison pour ces espaces.
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
