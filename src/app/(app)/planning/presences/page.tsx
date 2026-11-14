import { Icone } from "@/components/icones";
import { SegTabs, urlAvec, VideBloc } from "@/components/liste";
import { Chip } from "@/components/macros";
import { parseInt_ } from "@/lib/forms-util";
import { dateCourte, dateHeure, duree, isoParis, plageHoraire } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { decrirePresence, resumePresences } from "@/lib/presences";
import {
  espacesDuPerimetre,
  fenetre,
  lireDate,
  lireFiltresPlanning,
} from "@/modules/planning/server";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { contexteModule } from "@/server/module";
import { param } from "@/server/paging";
import { creneauxAConstater } from "@/server/presences";

export const metadata = { title: "Présences - CityRésa" };

/** Saisie rapide des présences : les créneaux passés de la semaine, à constater ou déjà constatés. */
export default async function PresencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteModule("planning");
  if (!page.user.canEdit("reservations"))
    redirigerAvecFlashDepuisRendu(
      "/planning",
      "Vous ne pouvez pas constater les présences.",
      "danger",
    );
  const params = await searchParams;
  const dossier = parseInt_(param(params, "dossier"), null, 1);
  const date = lireDate(param(params, "date"));
  const fen = fenetre("semaine", date);
  const filtres = lireFiltresPlanning(params);
  const onglet = param(params, "onglet") === "tous" ? "tous" : "a_constater";
  const [tous, sites] = await Promise.all([
    creneauxAConstater(
      page.user,
      dossier
        ? { dossier }
        : { de: fen.de, a: fen.a, sites: filtres.sites, espaces: filtres.espaces },
    ),
    espacesDuPerimetre(page.user).then((es) => [
      ...new Map(es.map((e) => [e.site.id, e.site])).values(),
    ]),
  ]);
  const aConstater = tous.filter((c) => !c.presence);
  const lignes = onglet === "tous" ? tous : aConstater;
  const resume = resumePresences(tous);
  const lien = (modifs: Record<string, string | null>) =>
    urlAvec(page.pathname, page.search, modifs);
  const ici = `${page.pathname}${page.search.toString() ? `?${page.search.toString()}` : ""}`;
  const aujourdhui = todayParisISO();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Présences{" "}
            <span className="page-count">
              {dossier ? `dossier ${tous[0]?.reservation.numero ?? `#${dossier}`}` : fen.label}
            </span>
          </h1>
          <p className="page-subtitle">
            {resume.passes} créneau{resume.passes > 1 ? "x" : ""} passé
            {resume.passes > 1 ? "s" : ""}
            {resume.renseignes
              ? ` · ${resume.presents} présent${resume.presents > 1 ? "s" : ""}, ${resume.absents} absent${resume.absents > 1 ? "s" : ""} sans prévenir · ${resume.heuresReelles.toLocaleString("fr-FR")} h constatées sur ${resume.heuresPrevues.toLocaleString("fr-FR")} h prévues`
              : " · aucun constat pour l'instant"}
            . Les heures constatées nourrissent la valorisation et les statistiques.
          </p>
        </div>
        <div className="page-actions">
          {dossier ? (
            <a href={`/reservations/${dossier}`} className="btn btn-ghost btn-sm">
              <Icone nom="arrow-left" taille={14} /> Retour au dossier
            </a>
          ) : (
            <>
              <a
                href={lien({ date: fen.precedent, dossier: null })}
                className="btn btn-ghost btn-sm"
                aria-label="Semaine précédente"
              >
                <Icone nom="chevron-left" taille={14} />
              </a>
              <a href={lien({ date: aujourdhui, dossier: null })} className="btn btn-ghost btn-sm">
                Cette semaine
              </a>
              <a
                href={lien({ date: fen.suivant, dossier: null })}
                className="btn btn-ghost btn-sm"
                aria-label="Semaine suivante"
              >
                <Icone nom="chevron-right" taille={14} />
              </a>
            </>
          )}
          <a href="/planning" className="btn btn-outline-secondary btn-sm">
            <Icone nom="calendar" taille={14} /> Planning
          </a>
        </div>
      </div>

      <div className="d-flex align-items-center gap-3 flex-wrap mb-3">
        <SegTabs
          tabs={[
            {
              href: lien({ onglet: null }),
              label: "À constater",
              count: aConstater.length,
              active: onglet === "a_constater",
            },
            {
              href: lien({ onglet: "tous" }),
              label: "Tous les créneaux passés",
              count: tous.length,
              active: onglet === "tous",
              teinte: "muted",
            },
          ]}
        />
        {!dossier && sites.length > 1 ? (
          <form method="GET" className="d-flex align-items-center gap-2" data-auto-submit>
            <input type="hidden" name="date" value={fen.date} />
            {onglet === "tous" ? <input type="hidden" name="onglet" value="tous" /> : null}
            <label className="form-label mb-0 small" htmlFor="f-site">
              Site
            </label>
            <select
              name="site"
              id="f-site"
              className="form-select form-select-sm filtre-select"
              defaultValue={filtres.sites.length === 1 ? filtres.sites[0] : ""}
            >
              <option value="">Tous</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </form>
        ) : null}
      </div>

      {lignes.length ? (
        <div className="data-card">
          <div className="table-responsive">
            <table className="table align-middle mb-0 table-serree">
              <thead>
                <tr>
                  <th>Créneau</th>
                  <th>Espace</th>
                  <th>Dossier</th>
                  <th>Constat</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((c) => {
                  const d = isoParis(c.startAt);
                  const f = isoParis(c.endAt);
                  const reelDebut = c.realStartAt ? isoParis(c.realStartAt).time : d.time;
                  const reelFin = c.realEndAt ? isoParis(c.realEndAt).time : f.time;
                  const r = c.reservation;
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="cell2">
                          <strong className="text-nowrap">{dateCourte(c.startAt)}</strong>
                          <small>
                            {plageHoraire(c.startAt, c.endAt)} ·{" "}
                            {duree((c.endAt.getTime() - c.startAt.getTime()) / 60_000)}
                          </small>
                        </span>
                      </td>
                      <td className="small" title={c.espace.name}>
                        {c.espace.shortName || c.espace.name}
                        <div className="text-muted">{c.espace.site.name}</div>
                      </td>
                      <td>
                        <a href={`/reservations/${r.id}`} className="cell2">
                          <strong>{r.numero}</strong>
                          <small style={{ whiteSpace: "normal" }}>
                            {r.title}
                            {r.organisation
                              ? ` · ${r.organisation.name}`
                              : r.user
                                ? ` · ${r.user.firstName} ${r.user.lastName}`
                                : ""}
                          </small>
                        </a>
                      </td>
                      <td>
                        <form
                          method="POST"
                          action="/planning/presences"
                          className="d-flex align-items-center gap-2 flex-wrap"
                          data-double-envoi
                        >
                          <input type="hidden" name="csrf_token" value={page.csrf} />
                          <input type="hidden" name="creneau_id" value={c.id} />
                          <input type="hidden" name="next" value={ici} />
                          <div
                            className="btn-group btn-group-sm"
                            role="group"
                            aria-label="Présence"
                          >
                            <input
                              type="radio"
                              className="btn-check"
                              name="presence"
                              id={`p-${c.id}-oui`}
                              value="presente"
                              defaultChecked={c.presence === "presente"}
                            />
                            <label className="btn btn-outline-success" htmlFor={`p-${c.id}-oui`}>
                              Présent
                            </label>
                            <input
                              type="radio"
                              className="btn-check"
                              name="presence"
                              id={`p-${c.id}-non`}
                              value="absente"
                              defaultChecked={c.presence === "absente"}
                            />
                            <label className="btn btn-outline-danger" htmlFor={`p-${c.id}-non`}>
                              Absent
                            </label>
                            <input
                              type="radio"
                              className="btn-check"
                              name="presence"
                              id={`p-${c.id}-vide`}
                              value=""
                              defaultChecked={!c.presence}
                            />
                            <label className="btn btn-outline-secondary" htmlFor={`p-${c.id}-vide`}>
                              ?
                            </label>
                          </div>
                          <span className="d-inline-flex align-items-center gap-1 small text-nowrap">
                            <input
                              type="time"
                              name="arrivee"
                              className="form-control form-control-sm"
                              style={{ width: "6.5em" }}
                              defaultValue={reelDebut}
                              aria-label="Heure d'arrivée constatée"
                            />
                            –
                            <input
                              type="time"
                              name="depart"
                              className="form-control form-control-sm"
                              style={{ width: "6.5em" }}
                              defaultValue={reelFin}
                              aria-label="Heure de départ constatée"
                            />
                          </span>
                          <input
                            type="text"
                            name="note"
                            className="form-control form-control-sm"
                            style={{ width: "12em" }}
                            placeholder="Remarque"
                            maxLength={200}
                            defaultValue={c.presenceNote ?? ""}
                            aria-label="Remarque"
                          />
                          <button type="submit" className="btn btn-primary btn-sm">
                            <Icone nom="check" taille={13} /> Enregistrer
                          </button>
                          {c.presence ? (
                            <span className="small text-muted">
                              <Chip teinte={c.presence === "presente" ? "emerald" : "red"}>
                                {decrirePresence(c)}
                              </Chip>{" "}
                              {c.presenceBy ? `par ${c.presenceBy}` : ""}
                              {c.presenceAt ? ` le ${dateHeure(c.presenceAt)}` : ""}
                            </span>
                          ) : null}
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <VideBloc
          icone="calendar-check"
          titre={onglet === "tous" ? "Aucun créneau passé" : "Rien à constater"}
          texte={
            dossier
              ? "Ce dossier n'a pas encore de créneau passé."
              : onglet === "tous"
                ? "Aucun créneau acquis ne s'est tenu sur cette semaine dans votre périmètre."
                : "Tous les créneaux passés de la semaine sont constatés, ou aucun ne s'est encore tenu."
          }
        />
      )}
    </>
  );
}
