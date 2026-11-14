import { Icone } from "@/components/icones";
import { urlAvec, VideBloc } from "@/components/liste";
import { Chip } from "@/components/macros";
import { JOURS_ISO } from "@/lib/constantes";
import { plageMinutes } from "@/lib/editions";
import { pluriel } from "@/lib/libelles";
import { FiltreEspaces, FiltreSites } from "@/modules/planning/filtres";
import {
  espacesDuPerimetre,
  espacesPlanning,
  lireFiltresPlanning,
} from "@/modules/planning/server";
import { EspaceCell } from "@/modules/planning/vues";
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
  for (const id of filtres.sites) q.append("site", String(id));
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
          {/* Bouton scindé : à gauche le PDF au dernier format choisi ; à droite le choix du format,
              qui ne génère rien (retenu dans le navigateur par dom-actions.js). */}
          <div className="btn-group btn-scinde" data-choix-memorise="pdf-format">
            <a
              href={`/planning/semaine.pdf?${q.toString()}&format=A4`}
              className="btn btn-outline-secondary btn-sm"
              target="_blank"
              rel="noopener"
              title="Générer le PDF de la semaine type"
              data-choix-principal
            >
              <Icone nom="printer" taille={14} /> PDF <span data-choix-libelle>A4</span>
            </a>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm dropdown-toggle-split"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              aria-label="Choisir le format du PDF"
              title="Choisir le format du PDF"
            >
              <Icone nom="chevron-down" taille={12} />
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              {(
                [
                  ["A4", "Format A4"],
                  ["A3", "Format A3"],
                ] as const
              ).map(([format, libelle]) => (
                <li key={format}>
                  <button
                    type="button"
                    className={`dropdown-item${format === "A4" ? " est-retenu" : ""}`}
                    aria-current={format === "A4" ? "true" : undefined}
                    data-choix-valeur={format}
                    data-choix-href={`/planning/semaine.pdf?${q.toString()}&format=${format}`}
                  >
                    <Icone nom="check" taille={14} classes="coche" /> {libelle}
                  </button>
                </li>
              ))}
            </ul>
          </div>
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
          className="form-select form-select-sm filtre-select filtre-select--bouton"
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
        <FiltreSites
          sites={sites}
          choisis={filtres.sites}
          hrefTous={urlAvec(page.pathname, page.search, { site: null })}
        />
        <FiltreEspaces
          espaces={tous}
          sites={filtres.sites}
          choisis={filtres.espaces}
          hrefTous={urlAvec(page.pathname, page.search, { espace: null })}
        />
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
                      <EspaceCell e={e} />
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
