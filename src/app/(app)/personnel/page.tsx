import { BoutonOuvrir } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { SegTabs, urlAvec, VideBloc } from "@/components/liste";
import { parseInt_ } from "@/lib/forms-util";
import { plage } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { creneauxNonCouverts, nomPersonne, resumeCouverture } from "@/lib/personnel";
import { ChipCouverture, GrilleService, ModalAjouterVacation } from "@/modules/personnel/vues";
import { fenetre, lireDate } from "@/modules/planning/server";
import { contexteModule } from "@/server/module";
import { param } from "@/server/paging";
import { etatService, personnes, sitesDuPerimetre } from "@/server/personnel";

export const metadata = { title: "Personnel de service - CityRésa" };

export default async function PersonnelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteModule("personnel", "personnel");
  const params = await searchParams;
  const vue = param(params, "vue") === "jour" ? "jour" : "semaine";
  const date = lireDate(param(params, "date"));
  const fen = fenetre(vue, date);
  const siteId = parseInt_(param(params, "site"), null, 1);
  const personnelId = parseInt_(param(params, "personne"), null, 1);
  const onglet = param(params, "onglet") === "a_couvrir" ? "a_couvrir" : "planning";
  const [sites, toutes] = await Promise.all([sitesDuPerimetre(page.user), personnes()]);
  const siteIds = siteId ? [siteId] : sites.map((s) => s.id);
  const { vacations, etats } = await etatService(page.user, fen.de, fen.a, {
    siteIds,
    personnelId,
  });
  const visibles = personnelId ? toutes.filter((p) => p.id === personnelId) : toutes;
  const resume = resumeCouverture(etats);
  const aCouvrir = creneauxNonCouverts(etats);
  const noms = new Map(toutes.map((p) => [p.id, nomPersonne(p)]));
  const aujourdhui = todayParisISO();
  const peutEditer = page.user.canEdit("personnel");
  const lien = (modifs: Record<string, string | null>) =>
    urlAvec(page.pathname, page.search, modifs);
  const retour = `${page.pathname}${page.search.toString() ? `?${page.search.toString()}` : ""}`;
  const qs = new URLSearchParams();
  qs.set("date", fen.date);
  if (siteId) qs.set("site", String(siteId));
  const pdf = `/personnel/semaine.pdf?${qs.toString()}`;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Personnel de service <span className="page-count">{fen.label}</span>
          </h1>
          <p className="page-subtitle">
            {vacations.length} vacation{vacations.length > 1 ? "s" : ""} · {resume.total} créneau
            {resume.total > 1 ? "x" : ""} réservé{resume.total > 1 ? "s" : ""}
            {resume.total
              ? ` : ${resume.couvert} couvert${resume.couvert > 1 ? "s" : ""}${resume.partiel ? `, ${resume.partiel} partiel${resume.partiel > 1 ? "s" : ""}` : ""}${resume.non_couvert ? `, ${resume.non_couvert} à couvrir` : ""}`
              : ""}
            .
          </p>
        </div>
        <div className="page-actions">
          <a href="/personnel/personnes" className="btn btn-ghost btn-sm">
            <Icone nom="users" taille={14} /> Personnes
          </a>
          <div className="dropdown d-inline-block">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <Icone nom="printer" taille={14} /> Imprimer <Icone nom="chevron-down" taille={12} />
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <a
                  className="dropdown-item"
                  href={`${pdf}&format=A4`}
                  target="_blank"
                  rel="noopener"
                >
                  <Icone nom="file-text" taille={14} /> Semaine en PDF (A4, une page par site)
                </a>
              </li>
              <li>
                <a
                  className="dropdown-item"
                  href={`${pdf}&format=A3`}
                  target="_blank"
                  rel="noopener"
                >
                  <Icone nom="file-text" taille={14} /> Semaine en PDF (A3)
                </a>
              </li>
            </ul>
          </div>
          {peutEditer ? (
            <BoutonOuvrir
              cible="modal-vacation"
              libelle="Ajouter une vacation"
              icone="calendar-plus"
              classe="btn-primary btn-sm"
            />
          ) : null}
        </div>
      </div>

      <div className="planning-barre">
        <SegTabs
          tabs={[
            { href: lien({ onglet: null }), label: "Planning", active: onglet === "planning" },
            {
              href: lien({ onglet: "a_couvrir" }),
              label: "À couvrir",
              count: aCouvrir.length,
              active: onglet === "a_couvrir",
              teinte: aCouvrir.length ? "red" : undefined,
            },
          ]}
        />
        <div className="d-flex align-items-center gap-1 mb-3">
          <a
            href={lien({ date: fen.precedent })}
            className="btn btn-outline-secondary btn-icone btn-sm"
            title="Période précédente"
            aria-label="Période précédente"
          >
            <Icone nom="chevron-left" taille={14} />
          </a>
          <span className="periode">{fen.label}</span>
          <a
            href={lien({ date: fen.suivant })}
            className="btn btn-outline-secondary btn-icone btn-sm"
            title="Période suivante"
            aria-label="Période suivante"
          >
            <Icone nom="chevron-right" taille={14} />
          </a>
          <a href={lien({ date: null })} className="btn btn-ghost btn-sm">
            Aujourd'hui
          </a>
        </div>
        <form
          method="GET"
          className="d-flex align-items-center gap-2 flex-wrap mb-3"
          data-auto-submit
          data-auto-submit-natif
        >
          {onglet !== "planning" ? <input type="hidden" name="onglet" value={onglet} /> : null}
          <select
            name="vue"
            className="form-select form-select-sm filtre-select"
            defaultValue={vue === "jour" ? "jour" : ""}
            aria-label="Vue"
          >
            <option value="">Semaine</option>
            <option value="jour">Jour</option>
          </select>
          <input
            type="date"
            name="date"
            className="form-control form-control-sm"
            defaultValue={fen.date}
            aria-label="Aller à la date"
            style={{ width: 160 }}
          />
          <select
            name="site"
            className="form-select form-select-sm filtre-select"
            defaultValue={siteId ? String(siteId) : ""}
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
            name="personne"
            className="form-select form-select-sm filtre-select"
            defaultValue={personnelId ? String(personnelId) : ""}
            aria-label="Personne"
          >
            <option value="">Toutes les personnes</option>
            {toutes.map((p) => (
              <option key={p.id} value={p.id}>
                {nomPersonne(p)}
              </option>
            ))}
          </select>
          <noscript>
            <button type="submit" className="btn btn-sm btn-outline-secondary">
              Afficher
            </button>
          </noscript>
        </form>
      </div>

      {!toutes.length ? (
        <div className="data-card">
          <VideBloc
            icone="shield"
            titre="Aucune personne de service"
            texte="Ajoutez d'abord les gardiens, agents d'accueil et vacataires à planifier."
            action={
              peutEditer ? (
                <a href="/personnel/personnes" className="btn btn-primary btn-sm">
                  <Icone nom="user-plus" taille={14} /> Ajouter une personne
                </a>
              ) : undefined
            }
          />
        </div>
      ) : onglet === "a_couvrir" ? (
        <div className="data-card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Créneau</th>
                  <th>Réservation</th>
                  <th>Espace</th>
                  <th>Site</th>
                  <th>État</th>
                  <th>Personnes de service</th>
                </tr>
              </thead>
              <tbody>
                {aCouvrir.length ? (
                  aCouvrir.map((e) => (
                    <tr key={e.creneau.id}>
                      <td className="text-nowrap">{plage(e.creneau.startAt, e.creneau.endAt)}</td>
                      <td>
                        <a href={`/reservations/${e.creneau.reservationId}`}>
                          <strong>{e.creneau.titre}</strong>
                        </a>
                        <div className="small text-muted">{e.creneau.numero}</div>
                      </td>
                      <td>{e.creneau.espaceNom}</td>
                      <td>{e.creneau.siteNom}</td>
                      <td>
                        <ChipCouverture etat={e.couverture.etat} />
                      </td>
                      <td>
                        {e.couverture.personnelIds.length ? (
                          e.couverture.personnelIds.map((id) => noms.get(id) ?? `#${id}`).join(", ")
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="ligne-vide">
                      <Icone nom="circle-check" taille={36} />
                      <p className="mb-0">
                        Tous les créneaux réservés de la période ont une personne de service.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <GrilleService
          fen={fen}
          personnes={visibles}
          vacations={vacations}
          etats={etats}
          peutEditer={peutEditer}
          aujourdhui={aujourdhui}
        />
      )}

      {peutEditer ? (
        <ModalAjouterVacation
          csrf={page.csrf}
          personnes={toutes}
          sites={sites}
          date={vue === "jour" ? fen.date : aujourdhui}
          siteId={siteId}
          personnelId={personnelId}
          retour={retour}
        />
      ) : null}
    </>
  );
}
