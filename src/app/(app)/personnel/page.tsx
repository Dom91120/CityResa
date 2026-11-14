import { BoutonOuvrir } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { SegTabs, urlAvec, VideBloc } from "@/components/liste";
import { Chip } from "@/components/macros";
import { candidats, MOTIFS_INDISPONIBLE } from "@/lib/affectation";
import { parseInt_ } from "@/lib/forms-util";
import { dateMoyenne, heure, isoParis, nomCourt, plageHoraire } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { creneauxNonCouverts, nomPersonne, resumeCouverture } from "@/lib/personnel";
import { ChipCouverture, GrilleService, ModalAjouterVacation } from "@/modules/personnel/vues";
import { fenetre, lireDate } from "@/modules/planning/server";
import {
  affectationsEntre,
  contexteAffectation,
  propositionsEnAttente,
} from "@/server/affectation";
import { contexteModule } from "@/server/module";
import { param } from "@/server/paging";
import { etatService, personnes, sitesDuPerimetre } from "@/server/personnel";

export const metadata = { title: "Planning de service - CityRésa" };

const ONGLETS = ["planning", "a_couvrir", "propositions"] as const;
type Onglet = (typeof ONGLETS)[number];

/** Le créneau sur deux lignes : la date, puis les horaires (ou la fin, s'il déborde sur le lendemain). */
function CelluleCreneau({ debut, fin }: { debut: Date; fin: Date }) {
  return (
    <span className="cell2">
      <span>{dateMoyenne(debut)}</span>
      <small>
        {isoParis(debut).date === isoParis(fin).date
          ? plageHoraire(debut, fin)
          : `${heure(debut)} → ${dateMoyenne(fin)} ${heure(fin)}`}
      </small>
    </span>
  );
}

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
  const brut = param(params, "onglet");
  const onglet: Onglet = ONGLETS.includes(brut as Onglet) ? (brut as Onglet) : "planning";
  const [sites, toutes] = await Promise.all([sitesDuPerimetre(page.user), personnes()]);
  const siteIds = siteId ? [siteId] : sites.map((s) => s.id);
  const [{ vacations, etats }, contexte, affectations, propositions] = await Promise.all([
    etatService(page.user, fen.de, fen.a, { siteIds, personnelId }),
    contexteAffectation(fen.de, fen.a),
    affectationsEntre(fen.de, fen.a, siteIds),
    propositionsEnAttente(page.user),
  ]);
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
  const nbAuto = sites.filter((s) => contexte.sites.get(s.id)?.affectationAuto).length;

  // Les candidats de chaque proposition (le contexte couvre leur période entière).
  const ctxPropositions =
    propositions.length &&
    (propositions[0].startAt < fen.de || propositions[propositions.length - 1].endAt > fen.a)
      ? await contexteAffectation(
          new Date(Math.min(fen.de.getTime(), ...propositions.map((p) => p.startAt.getTime()))),
          new Date(Math.max(fen.a.getTime(), ...propositions.map((p) => p.endAt.getTime()))),
        )
      : contexte;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Planning de service <span className="page-count">{fen.label}</span>
          </h1>
          <p className="page-subtitle">
            {vacations.length} vacation{vacations.length > 1 ? "s" : ""} · {resume.total} créneau
            {resume.total > 1 ? "x" : ""} réservé{resume.total > 1 ? "s" : ""}
            {resume.total
              ? ` : ${resume.couvert} couvert${resume.couvert > 1 ? "s" : ""}${resume.partiel ? `, ${resume.partiel} partiel${resume.partiel > 1 ? "s" : ""}` : ""}${resume.non_couvert ? `, ${resume.non_couvert} à couvrir` : ""}`
              : ""}
            {nbAuto
              ? ` · ${nbAuto} site${nbAuto > 1 ? "s" : ""} en affectation automatique`
              : " · affectation sur proposition"}
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
            <>
              <form method="POST" action="/personnel/affecter" className="d-inline">
                <input type="hidden" name="csrf_token" value={page.csrf} />
                <input type="hidden" name="next" value={retour} />
                <input type="hidden" name="date" value={fen.date} />
                <input type="hidden" name="vue" value={vue} />
                {siteId ? <input type="hidden" name="site" value={siteId} /> : null}
                <button
                  type="submit"
                  className="btn btn-outline-secondary btn-sm"
                  title="Affecte (sites en automatique) ou propose (autres sites) une personne disponible sur chaque créneau réservé de la période sans personne de service"
                  data-confirm={`Affecter ou proposer le personnel disponible sur les créneaux réservés : ${fen.label}${siteId ? `, ${sites.find((s) => s.id === siteId)?.name ?? ""}` : ", tous les sites"} ?`}
                >
                  <Icone nom="wand-sparkles" taille={14} /> Affecter
                </button>
              </form>
              <BoutonOuvrir
                cible="modal-vacation"
                libelle="Ajouter une vacation"
                icone="calendar-plus"
                classe="btn-primary btn-sm"
              />
            </>
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
            {
              href: lien({ onglet: "propositions" }),
              label: "Propositions",
              count: propositions.length,
              active: onglet === "propositions",
              teinte: propositions.length ? "amber" : undefined,
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
            <Icone nom="calendar-aujourdhui" taille={14} /> Aujourd'hui
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
            icone="personnel-service"
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
      ) : onglet === "propositions" ? (
        <div className="data-card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Créneau</th>
                  <th>Réservation</th>
                  <th>Espace</th>
                  <th>Personne proposée</th>
                  <th>Autres candidats</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {propositions.length ? (
                  propositions.map((c) => {
                    const { retenus, ecartes } = candidats(
                      {
                        id: c.id,
                        reservationId: c.reservationId,
                        siteId: c.espace.siteId,
                        startAt: c.startAt,
                        endAt: c.endAt,
                      },
                      ctxPropositions.personnes,
                      ctxPropositions,
                    );
                    const autres = retenus.filter((r) => r.personne.id !== c.personnelProposeId);
                    return (
                      <tr key={c.id}>
                        <td className="text-nowrap">
                          <CelluleCreneau debut={c.startAt} fin={c.endAt} />
                        </td>
                        <td>
                          <a href={`/reservations/${c.reservation.id}`}>
                            <strong>{c.reservation.title}</strong>
                          </a>
                          <div className="small text-muted">{c.reservation.numero}</div>
                        </td>
                        <td>
                          {nomCourt(c.espace)}
                          <div className="small text-muted">{c.espace.site.name}</div>
                        </td>
                        <td>
                          {c.personnelPropose ? (
                            <Chip teinte="amber" dot>
                              {nomPersonne(c.personnelPropose)}
                            </Chip>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                        <td>
                          {!autres.length ? (
                            <span className="text-muted">Aucun autre candidat</span>
                          ) : peutEditer && page.user.gereEspace(c.espaceId) ? (
                            // La liste appartient au formulaire de la coche (colonne suivante) : la
                            // coche valide la personne choisie ici, à défaut la personne proposée.
                            <select
                              name="personnel_id"
                              form={`valider-${c.id}`}
                              className="form-select form-select-sm"
                              style={{ width: 150 }}
                              aria-label="Autre personne à affecter à la place de celle proposée"
                              title="Pour affecter une autre personne, choisissez-la ici puis cliquez sur la coche"
                              defaultValue=""
                            >
                              <option value="">— autre candidat —</option>
                              {autres.map((r) => (
                                <option key={r.personne.id} value={r.personne.id}>
                                  {nomPersonne(r.personne)}
                                  {r.principal ? " · site principal" : ""}
                                  {r.heuresSemaine ? ` · ${r.heuresSemaine} h cette semaine` : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="small text-muted">
                              {autres.map((r) => nomPersonne(r.personne)).join(", ")}
                            </span>
                          )}
                          {ecartes.length ? (
                            <div
                              className="indisponibles"
                              title={ecartes
                                .map(
                                  (e) =>
                                    `${nomPersonne(e.personne)} : ${MOTIFS_INDISPONIBLE[e.motif]}`,
                                )
                                .join("\n")}
                            >
                              {ecartes.length} indisponible{ecartes.length > 1 ? "s" : ""}
                              <Icone nom="info" taille={13} />
                            </div>
                          ) : null}
                        </td>
                        <td className="actions text-nowrap">
                          {peutEditer && page.user.gereEspace(c.espaceId) ? (
                            <>
                              <form
                                id={`valider-${c.id}`}
                                method="POST"
                                action={`/personnel/propositions/${c.id}/valider`}
                                className="d-inline"
                              >
                                <input type="hidden" name="csrf_token" value={page.csrf} />
                                <input type="hidden" name="next" value={retour} />
                                <button
                                  type="submit"
                                  className="btn btn-ghost btn-icone btn-sm"
                                  title={
                                    autres.length
                                      ? "Valider la personne proposée, ou celle choisie dans la liste"
                                      : c.personnelPropose
                                        ? `Valider : ${nomPersonne(c.personnelPropose)} de service sur ce créneau`
                                        : "Valider la proposition"
                                  }
                                  aria-label="Valider la proposition"
                                >
                                  <Icone nom="check" taille={14} />
                                </button>
                              </form>{" "}
                              <form
                                method="POST"
                                action={`/personnel/propositions/${c.id}/ecarter`}
                                className="d-inline"
                              >
                                <input type="hidden" name="csrf_token" value={page.csrf} />
                                <input type="hidden" name="next" value={retour} />
                                <button
                                  type="submit"
                                  className="btn btn-ghost btn-icone btn-sm"
                                  title="Écarter cette proposition : la personne ne sera plus proposée sur ce créneau"
                                  aria-label="Écarter la proposition"
                                >
                                  <Icone nom="user-ban" taille={14} />
                                </button>
                              </form>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="ligne-vide">
                      <Icone nom="circle-check" taille={36} />
                      <p className="mb-0">
                        Aucune proposition en attente. Le bouton « Affecter » et la tâche
                        quotidienne en créent sur les sites qui ne sont pas en affectation
                        automatique.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
                      <td className="text-nowrap">
                        <CelluleCreneau debut={e.creneau.startAt} fin={e.creneau.endAt} />
                      </td>
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
          contexte={contexte}
          affectations={affectations}
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
