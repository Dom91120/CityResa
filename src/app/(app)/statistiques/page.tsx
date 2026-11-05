import { Icone, IconePastille } from "@/components/icones";
import { Delta, PastilleEspace, TypeOrganisation } from "@/components/macros";
import { DonneesGraphique, ScriptDiffere } from "@/components/scripts";
import { ORGANISATION_TYPES, RESERVATION_STATUS, type ReservationStatus } from "@/lib/constantes";
import { montant, pluriel } from "@/lib/libelles";
import { PERIODES } from "@/lib/periodes";
import {
  bornesIso,
  chargerStatistiques,
  delaiMoyen,
  heatmap,
  heuresReservees,
  parNature,
  parStatut,
  periodeDepuisParams,
  revenusEncaisses,
  tauxAcceptation,
  topEspaces,
  topOrganisations,
} from "@/modules/statistiques/server";
import { contextePage } from "@/server/page";
import type { Params } from "@/server/paging";

export const metadata = { title: "Statistiques - CityRésa" };

const COULEURS_TYPES: Record<string, string> = {
  association: "#10b981",
  entreprise: "#3b82f6",
  particulier: "#f59e0b",
  service_interne: "#8b5cf6",
  collectivite: "#e8336d",
  autre: "#9ca3af",
};
const PALETTE = [
  "#006e46",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
  "#ec4899",
  "#9ca3af",
];
const COULEURS_STATUTS: Record<string, string> = {
  rose: "#e8336d",
  amber: "#f59e0b",
  sky: "#3b82f6",
  emerald: "#10b981",
  violet: "#8b5cf6",
  slate: "#9ca3af",
  red: "#ef4444",
};

function fr(n: number): string {
  return String(n).replace(".", ",");
}

export default async function StatistiquesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const page = await contextePage();
  const params = await searchParams;
  const p = periodeDepuisParams(params);
  const stats = await chargerStatistiques(p);
  const { kpi, occupation, usagers, mois, reservations, paiements, gracieux, presences } = stats;
  const taux = tauxAcceptation(reservations);
  const delai = delaiMoyen(reservations);
  const heures = heuresReservees(reservations, p);
  const encaisse = revenusEncaisses(paiements);
  const natures = parNature(reservations);
  const statuts = parStatut(reservations);
  const espacesTop = topEspaces(reservations, paiements, p);
  const orgsTop = topOrganisations(reservations, p);
  const grille = heatmap(reservations, p);
  const bornes = bornesIso(p);
  const occupationActive = occupation.filter((e) => e.nb > 0).sort((a, b) => b.taux - a.taux);
  const totalUsagers = Object.values(usagers).reduce((s, n) => s + n, 0);
  const query = p.cle === "libre" ? `de=${bornes.de}&a=${bornes.a}` : `periode=${p.cle}`;
  const effectives = reservations.filter((r) =>
    ["acceptee", "signee", "confirmee", "terminee"].includes(r.status),
  ).length;

  const cartes: {
    icone: string;
    teinte: string;
    label: string;
    valeur: string;
    detail: string;
    delta?: number | null;
  }[] = [
    {
      icone: "clipboard-list",
      teinte: "sky",
      label: "Demandes reçues",
      valeur: String(kpi.demandes.valeur),
      detail: "déposées sur la période",
      delta: kpi.demandes.delta,
    },
    {
      icone: "calendar-check",
      teinte: "emerald",
      label: "Réservations confirmées",
      valeur: String(kpi.confirmees.valeur),
      detail: "dont l'événement a lieu sur la période",
      delta: kpi.confirmees.delta,
    },
    {
      icone: "percent",
      teinte: "rose",
      label: "Taux d'acceptation",
      valeur: taux === null ? "—" : `${fr(taux)} %`,
      detail:
        taux === null ? "aucune décision sur la période" : "acceptées / (acceptées + refusées)",
    },
    {
      icone: "timer",
      teinte: "violet",
      label: "Délai moyen de traitement",
      valeur: delai === null ? "—" : `${fr(delai)} j`,
      detail: delai === null ? "aucune décision manuelle" : "entre la demande et la décision",
    },
    {
      icone: "clock",
      teinte: "amber",
      label: "Heures réservées",
      valeur: `${fr(heures)} h`,
      detail: pluriel(effectives, "réservation effective", "réservations effectives"),
    },
    {
      icone: "calendar-check",
      teinte: "sky",
      label: "Présence constatée",
      valeur: presences.tauxPresence === null ? "—" : `${fr(presences.tauxPresence)} %`,
      detail: presences.renseignes
        ? `${pluriel(presences.absents, "absence non signalée", "absences non signalées")} · ${fr(presences.heuresReelles)} h constatées sur ${fr(presences.heuresPrevues)} h`
        : `aucun constat sur ${pluriel(presences.passes, "créneau passé", "créneaux passés")}`,
    },
    {
      icone: "banknote",
      teinte: "emerald",
      label: "Revenus encaissés",
      valeur: montant(encaisse),
      detail: `${pluriel(paiements.length, "règlement")} (hors cautions)`,
      delta: kpi.revenus.delta,
    },
    {
      icone: "hand-coins",
      teinte: "lime",
      label: "Mises à disposition gracieuses",
      valeur: montant(gracieux.total),
      detail: gracieux.nb
        ? `valeur de ${pluriel(gracieux.nb, "réservation gratuite", "réservations gratuites")}`
        : "aucune gratuité accordée",
    },
    {
      icone: "calendar-x",
      teinte: "red",
      label: "Annulées ou refusées",
      valeur: String(kpi.annulees.valeur),
      detail: "sur la période",
      delta: kpi.annulees.delta,
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Statistiques</h1>
          <p className="page-subtitle">
            {p.label.charAt(0).toUpperCase() + p.label.slice(1)} ·{" "}
            {pluriel(reservations.length, "réservation")} dont l'événement tombe sur la période.
          </p>
        </div>
        <div className="page-actions">
          <a
            href={`/statistiques/export.csv?${query}`}
            className="btn btn-outline-secondary btn-sm"
          >
            <Icone nom="download" taille={14} /> CSV
          </a>
          <a href={`/statistiques/export.xlsx?${query}`} className="btn btn-primary btn-sm">
            <Icone nom="table" taille={14} /> Classeur Excel
          </a>
        </div>
      </div>

      <div className="data-card mb-3">
        <form
          method="GET"
          className="card-body-custom d-flex align-items-end gap-3 flex-wrap"
          data-stats-periode
        >
          <div>
            <label className="form-label" htmlFor="s-periode">
              Période
            </label>
            <select
              name="periode"
              id="s-periode"
              className="form-select form-select-sm filtre-select"
              defaultValue={p.cle === "libre" ? "" : p.cle}
              data-stats-auto
            >
              {PERIODES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
              <option value="">Bornes libres…</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="s-de">
              Du
            </label>
            <input
              type="date"
              name="de"
              id="s-de"
              className="form-control form-control-sm"
              defaultValue={bornes.de}
              data-stats-borne
            />
          </div>
          <div>
            <label className="form-label" htmlFor="s-a">
              Au
            </label>
            <input
              type="date"
              name="a"
              id="s-a"
              className="form-control form-control-sm"
              defaultValue={bornes.a}
              data-stats-borne
            />
          </div>
          <button type="submit" className="btn btn-outline-secondary btn-sm">
            <Icone nom="refresh-cw" taille={14} /> Appliquer
          </button>
          <span className="text-muted small ms-auto">
            Comparaison avec la période précédente de même durée.
          </span>
        </form>
      </div>

      <div className="stat-grid">
        {cartes.map((c) => (
          <div key={c.label} className="stat-card">
            <div className="d-flex align-items-center justify-content-between">
              <IconePastille nom={c.icone} teinte={c.teinte} />
              {c.delta !== undefined ? <Delta valeur={c.delta} /> : null}
            </div>
            <div>
              <div className="stat-label">{c.label}</div>
              <div className="stat-number">{c.valeur}</div>
              <div className="text-muted small mt-1">{c.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-7">
          <div className="data-card h-100">
            <div className="card-header-custom">
              <h6>Occupation des espaces</h6>
              <span className="text-muted small">heures réservées / heures d'ouverture</span>
            </div>
            <div className="card-body-custom">
              {occupationActive.length ? (
                <>
                  <div
                    className="graph-wrap"
                    style={{ height: Math.max(200, 28 * occupationActive.length + 40) }}
                  >
                    <canvas
                      data-graphique="graph-occupation"
                      aria-label="Taux d'occupation par espace"
                    />
                  </div>
                  <DonneesGraphique
                    id="graph-occupation"
                    config={{
                      type: "bar",
                      data: {
                        labels: occupationActive.map((e) => e.name),
                        datasets: [
                          {
                            label: "Taux d'occupation (%)",
                            data: occupationActive.map((e) => e.taux),
                            backgroundColor: occupationActive.map((e) => e.color),
                            borderRadius: 6,
                          },
                        ],
                      },
                      options: {
                        indexAxis: "y",
                        plugins: { legend: { display: false } },
                        scales: {
                          x: { beginAtZero: true, max: 100 },
                          y: { grid: { display: false } },
                        },
                      },
                    }}
                  />
                </>
              ) : (
                <div className="text-center text-muted small py-4">
                  Aucun créneau réservé sur la période.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="data-card h-100">
            <div className="card-header-custom">
              <h6>Nature des événements</h6>
            </div>
            <div className="card-body-custom">
              {natures.length ? (
                <>
                  <div className="graph-wrap" style={{ height: 200 }}>
                    <canvas
                      data-graphique="graph-natures"
                      aria-label="Répartition par nature d'événement"
                    />
                  </div>
                  <ul className="legende list-unstyled mt-3 mb-0">
                    {natures.slice(0, 8).map((n, i) => (
                      <li key={n.label}>
                        <span className="pt" style={{ background: PALETTE[i % PALETTE.length] }} />
                        {n.label}
                        <strong className="ms-auto">{n.nb}</strong>
                      </li>
                    ))}
                  </ul>
                  <DonneesGraphique
                    id="graph-natures"
                    config={{
                      type: "doughnut",
                      data: {
                        labels: natures.map((n) => n.label),
                        datasets: [
                          {
                            data: natures.map((n) => n.nb),
                            backgroundColor: natures.map((_, i) => PALETTE[i % PALETTE.length]),
                            borderWidth: 0,
                            hoverOffset: 4,
                          },
                        ],
                      },
                      options: { cutout: "68%", plugins: { legend: { display: false } } },
                    }}
                  />
                </>
              ) : (
                <div className="text-center text-muted small py-4">
                  Aucune réservation effective sur la période.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-7">
          <div className="data-card h-100">
            <div className="card-header-custom">
              <h6>Demandes et revenus sur 12 mois</h6>
              <span className="text-muted small">jusqu'à la fin de la période</span>
            </div>
            <div className="card-body-custom">
              <div className="graph-wrap">
                <canvas data-graphique="graph-mois" aria-label="Demandes et revenus par mois" />
              </div>
              <DonneesGraphique
                id="graph-mois"
                config={{
                  type: "bar",
                  data: {
                    labels: mois.map((m) => m.label),
                    datasets: [
                      {
                        type: "bar",
                        label: "Demandes",
                        data: mois.map((m) => m.demandes),
                        backgroundColor: "rgba(0,110,70,.75)",
                        borderRadius: 6,
                        yAxisID: "y",
                      },
                      {
                        type: "line",
                        label: "Revenus encaissés (€)",
                        data: mois.map((m) => m.revenus),
                        borderColor: "#3b82f6",
                        backgroundColor: "rgba(59,130,246,.15)",
                        fill: true,
                        tension: 0.35,
                        yAxisID: "y1",
                      },
                    ],
                  },
                  options: {
                    scales: {
                      y: { position: "left" },
                      y1: {
                        position: "right",
                        beginAtZero: true,
                        grid: { drawOnChartArea: false },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="data-card h-100">
            <div className="card-header-custom">
              <h6>Répartition des usagers</h6>
            </div>
            <div className="card-body-custom">
              {totalUsagers ? (
                <>
                  <div className="graph-wrap" style={{ height: 200 }}>
                    <canvas data-graphique="graph-usagers" aria-label="Répartition des usagers" />
                  </div>
                  <ul className="legende list-unstyled mt-3 mb-0">
                    {Object.entries(usagers)
                      .sort((a, b) => b[1] - a[1])
                      .map(([t, n]) => (
                        <li key={t}>
                          <span
                            className="pt"
                            style={{ background: COULEURS_TYPES[t] ?? "#9ca3af" }}
                          />
                          {ORGANISATION_TYPES[t] ?? t}
                          <strong className="ms-auto">
                            {n} · {Math.round((n / totalUsagers) * 100)} %
                          </strong>
                        </li>
                      ))}
                  </ul>
                  <DonneesGraphique
                    id="graph-usagers"
                    config={{
                      type: "doughnut",
                      data: {
                        labels: Object.keys(usagers).map((t) => ORGANISATION_TYPES[t] ?? t),
                        datasets: [
                          {
                            data: Object.values(usagers),
                            backgroundColor: Object.keys(usagers).map(
                              (t) => COULEURS_TYPES[t] ?? "#9ca3af",
                            ),
                            borderWidth: 0,
                            hoverOffset: 4,
                          },
                        ],
                      },
                      options: { cutout: "68%", plugins: { legend: { display: false } } },
                    }}
                  />
                </>
              ) : (
                <div className="text-center text-muted small py-4">
                  Aucune réservation sur la période.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-5">
          <div className="data-card h-100">
            <div className="card-header-custom">
              <h6>Réservations par statut</h6>
            </div>
            <div className="card-body-custom">
              {statuts.length ? (
                <>
                  <div className="graph-wrap" style={{ height: 240 }}>
                    <canvas data-graphique="graph-statuts" aria-label="Réservations par statut" />
                  </div>
                  <DonneesGraphique
                    id="graph-statuts"
                    config={{
                      type: "bar",
                      data: {
                        labels: statuts.map((s) => s.label),
                        datasets: [
                          {
                            label: "Réservations",
                            data: statuts.map((s) => s.nb),
                            backgroundColor: statuts.map(
                              (s) =>
                                COULEURS_STATUTS[
                                  RESERVATION_STATUS[s.cle as ReservationStatus]?.teinte ?? "slate"
                                ],
                            ),
                            borderRadius: 6,
                          },
                        ],
                      },
                      options: {
                        plugins: { legend: { display: false } },
                        scales: { y: { ticks: { precision: 0 } } },
                      },
                    }}
                  />
                </>
              ) : (
                <div className="text-center text-muted small py-4">
                  Aucune réservation sur la période.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="data-card h-100">
            <div className="card-header-custom">
              <h6>Créneaux par jour et tranche horaire</h6>
              <span className="text-muted small">heures réservées</span>
            </div>
            {grille.max ? (
              <div className="table-responsive">
                <table className="table" style={{ fontSize: ".78rem" }}>
                  <thead>
                    <tr>
                      <th>Tranche</th>
                      {grille.jours.map((j) => (
                        <th key={j} className="text-center">
                          {j}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grille.tranches.map((t, ti) => (
                      <tr key={t}>
                        <td className="text-nowrap text-muted">{t}</td>
                        {grille.valeurs[ti].map((v, ji) => {
                          const alpha = v ? 0.12 + 0.78 * (v / grille.max) : 0;
                          return (
                            <td
                              key={grille.jours[ji]}
                              className="text-center tabular"
                              title={`${grille.jours[ji]} ${t} : ${fr(v)} h`}
                              style={{
                                background: v
                                  ? `rgba(var(--primary-rgb), ${alpha.toFixed(2)})`
                                  : undefined,
                                color: alpha > 0.55 ? "#fff" : undefined,
                                fontWeight: v ? 500 : undefined,
                              }}
                            >
                              {v ? fr(v) : <span className="text-faint">·</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-muted small py-4">
                Aucun créneau réservé sur la période.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-6">
          <div className="data-card h-100">
            <div className="card-header-custom">
              <h6>Top 10 des espaces</h6>
              <a href="/espaces" className="btn btn-ghost btn-sm">
                Espaces <Icone nom="arrow-right" taille={14} />
              </a>
            </div>
            {espacesTop.length ? (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Espace</th>
                      <th className="text-end">Heures</th>
                      <th className="text-end">Réserv.</th>
                      <th className="text-end">Revenus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {espacesTop.map((e, i) => (
                      <tr key={e.id}>
                        <td>
                          <span className="d-flex align-items-center gap-2">
                            <span className="text-faint tabular" style={{ width: 18 }}>
                              {i + 1}
                            </span>
                            <PastilleEspace couleur={e.couleur} />
                            <span className="cell2">
                              <a href={`/espaces/${e.id}`} style={{ color: "var(--strong)" }}>
                                {e.nom}
                              </a>
                              <small>{e.site}</small>
                            </span>
                          </span>
                        </td>
                        <td className="text-end tabular">{fr(e.heures)} h</td>
                        <td className="text-end tabular">{e.nb}</td>
                        <td className="text-end tabular">{e.revenus ? montant(e.revenus) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-muted small">Aucune réservation effective.</div>
            )}
          </div>
        </div>
        <div className="col-lg-6">
          <div className="data-card h-100">
            <div className="card-header-custom">
              <h6>Top 10 des usagers</h6>
              <a href="/usagers" className="btn btn-ghost btn-sm">
                Usagers <Icone nom="arrow-right" taille={14} />
              </a>
            </div>
            {orgsTop.length ? (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Organisation</th>
                      <th className="text-end">Réserv.</th>
                      <th className="text-end">Heures</th>
                      <th className="text-end">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgsTop.map((o, i) => (
                      <tr key={o.id ?? "particuliers"}>
                        <td>
                          <span className="d-flex align-items-center gap-2">
                            <span className="text-faint tabular" style={{ width: 18 }}>
                              {i + 1}
                            </span>
                            <span className="cell2">
                              {o.id ? (
                                <a href={`/usagers/${o.id}`} style={{ color: "var(--strong)" }}>
                                  {o.nom}
                                </a>
                              ) : (
                                <span>{o.nom}</span>
                              )}
                              <small>
                                <TypeOrganisation type={o.type} />
                                {o.gratuites ? ` · ${pluriel(o.gratuites, "gratuité")}` : ""}
                              </small>
                            </span>
                          </span>
                        </td>
                        <td className="text-end tabular">{o.nb}</td>
                        <td className="text-end tabular">{fr(o.heures)} h</td>
                        <td className="text-end tabular">
                          {o.montant ? montant(o.montant) : "Gratuit"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-muted small">Aucune réservation effective.</div>
            )}
          </div>
        </div>
      </div>

      {gracieux.parOrganisation.length ? (
        <div className="data-card">
          <div className="card-header-custom">
            <h6>
              <Icone nom="hand-coins" taille={16} classes="text-primary" /> Mises à disposition
              gracieuses par bénéficiaire
            </h6>
            <span className="text-muted small">
              valeur théorique au tarif de l'usager · total {montant(gracieux.total)}
            </span>
          </div>
          <ul className="liste-simple">
            {gracieux.parOrganisation.slice(0, 10).map((o) => (
              <li key={o.id ?? "particuliers"}>
                {o.id ? <a href={`/usagers/${o.id}`}>{o.nom}</a> : <span>{o.nom}</span>}
                <strong className="ms-auto tabular">{montant(o.valeur)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ScriptDiffere src="/vendor/chart.umd.min.js" nonce={page.nonce} />
      <ScriptDiffere src="/js/graphiques.js" nonce={page.nonce} />
      <ScriptDiffere src="/js/statistiques.js" nonce={page.nonce} />
    </>
  );
}
