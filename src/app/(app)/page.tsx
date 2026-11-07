import { Icone } from "@/components/icones";
import { Avatar, Delta, PastilleEspace, StatutResa } from "@/components/macros";
import { DonneesGraphique, ScriptDiffere } from "@/components/scripts";
import { CarteStat } from "@/components/stats";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import {
  dateLongue,
  dateMoyenne,
  depuis,
  heure,
  montant,
  nomCourt,
  plageHoraire,
} from "@/lib/libelles";
import { PERIODES, periode, precedente } from "@/lib/periodes";
import { alertes } from "@/server/alertes";
import {
  aTraiterPour,
  indicateurs,
  occupationParEspace,
  prochainement,
  repartitionUsagers,
  revenusParMois,
} from "@/server/dashboard";
import { prisma } from "@/server/db";
import { contextePage } from "@/server/page";

export const metadata = { title: "Tableau de bord - CityRésa" };

const COULEURS_TYPES: Record<string, string> = {
  association: "#10b981",
  entreprise: "#3b82f6",
  particulier: "#f59e0b",
  service_interne: "#8b5cf6",
  collectivite: "#e8336d",
  autre: "#9ca3af",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const page = await contextePage();
  const { user, nonce } = page;
  const sp = await searchParams;
  const p = periode(sp.periode);
  const prec = precedente(p);
  const now = new Date();
  const [kpi, occupation, usagers, revenus, aTraiter, prochains, notifs, alertesDuJour] =
    await Promise.all([
      indicateurs(p, prec, user.espacesGeres),
      occupationParEspace(p),
      repartitionUsagers(p),
      revenusParMois(p.a > now ? now : p.a),
      aTraiterPour(user),
      prochainement(now, 7),
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      alertes(user, user.settings, now),
    ]);
  const totalUsagers = Object.values(usagers).reduce((s, n) => s + n, 0);
  const occupationTop = [...occupation].sort((a, b) => b.taux - a.taux).slice(0, 8);
  const jourLong = dateLongue(now);
  const sousTitre = [
    kpi.a_traiter ? `${kpi.a_traiter} demande${kpi.a_traiter > 1 ? "s" : ""} à traiter` : null,
    kpi.messages ? `${kpi.messages} message${kpi.messages > 1 ? "s" : ""} sans réponse` : null,
    kpi.signatures
      ? `${kpi.signatures} signature${kpi.signatures > 1 ? "s" : ""} en attente`
      : null,
  ].filter(Boolean);
  const cartes = [
    {
      href: "/espaces",
      icone: "door-open",
      teinte: "rose",
      label: "Espaces en ligne",
      valeur: kpi.espaces,
      delta: null as number | null,
    },
    {
      href: "/reservations",
      icone: "clipboard-list",
      teinte: "sky",
      label: "Demandes de réservation",
      valeur: kpi.demandes.valeur,
      delta: kpi.demandes.delta,
    },
    {
      href: "/reservations?statut=confirmee",
      icone: "calendar-check",
      teinte: "emerald",
      label: "Réservations confirmées",
      valeur: kpi.confirmees.valeur,
      delta: kpi.confirmees.delta,
    },
    {
      href: "/reservations?statut=annulee",
      icone: "calendar-x",
      teinte: "red",
      label: "Annulées ou refusées",
      valeur: kpi.annulees.valeur,
      delta: kpi.annulees.delta,
    },
  ];
  return (
    <>
      <h1 className="visually-hidden">Tableau de bord</h1>
      <div className="page-header">
        <div>
          <div
            className="text-faint"
            style={{
              fontSize: ".7rem",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Période
          </div>
          <form method="GET" className="d-flex align-items-center gap-2" data-auto-submit>
            <select
              name="periode"
              className="form-select filtre-select fw-medium"
              defaultValue={p.cle}
              aria-label="Période"
              style={{
                fontSize: "1.05rem",
                border: 0,
                paddingLeft: 0,
                background: "transparent",
                color: "var(--strong)",
              }}
            >
              {PERIODES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </form>
          <p className="page-subtitle">
            {jourLong.charAt(0).toUpperCase() + jourLong.slice(1)}
            {sousTitre.length ? ` · ${sousTitre.join(", ")}` : " · rien d'urgent"}
          </p>
        </div>
        <div className="page-actions">
          <a
            href={`/reservations/export.csv?periode=${p.cle}`}
            className="btn btn-outline-secondary btn-sm"
          >
            <Icone nom="download" taille={14} /> Exporter les données
          </a>
          <a href="/planning" className="btn btn-primary btn-sm">
            <Icone nom="calendar-days" taille={14} /> Planning
          </a>
        </div>
      </div>

      <div className="stat-grid">
        {cartes.map((c) => (
          <CarteStat
            key={c.href}
            href={c.href}
            icone={c.icone}
            teinte={c.teinte}
            label={c.label}
            valeur={c.valeur}
            droite={c.delta !== null ? <Delta valeur={c.delta} /> : undefined}
          />
        ))}
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          <div className="row g-3">
            <div className="col-lg-7">
              <div className="data-card h-100">
                <div className="card-header-custom">
                  <h6>Occupation des espaces</h6>
                  <a href="/statistiques" className="btn btn-ghost btn-sm">
                    Détail
                  </a>
                </div>
                {occupationTop.length ? (
                  <div className="py-2">
                    {occupationTop.map((e) => (
                      <div key={e.id} className="occupation-ligne">
                        <span className="d-flex align-items-center gap-2 min-w-0">
                          <PastilleEspace couleur={e.color} />
                          <span className="cell2">
                            <a
                              href={`/espaces/${e.id}`}
                              className="fw-medium"
                              style={{ color: "var(--strong)" }}
                            >
                              {nomCourt(e)}
                            </a>
                            <small>
                              {e.nb} créneau{e.nb > 1 ? "x" : ""} · {e.heures} h
                            </small>
                          </span>
                        </span>
                        <span className="barre">
                          <span style={{ width: `${e.taux}%`, background: e.color }} />
                        </span>
                        <span className="taux">{String(e.taux).replace(".", ",")} %</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted small">
                    Aucun espace : commencez par en créer un.
                  </div>
                )}
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
                      <div className="graph-wrap" style={{ height: 180 }}>
                        <canvas
                          data-graphique="graph-usagers"
                          aria-label="Répartition des usagers"
                        />
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
                                {Math.round((n / totalUsagers) * 100)} %
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
                          options: { cutout: "70%", plugins: { legend: { display: false } } },
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

          <div className="data-card">
            <div className="card-header-custom">
              <h6>
                <Icone nom="clipboard-list" taille={16} classes="text-primary" /> À traiter
                {kpi.a_traiter ? <span className="chip chip-amber">{kpi.a_traiter}</span> : null}
              </h6>
              <a href="/reservations?statut=a_traiter" className="btn btn-ghost btn-sm">
                Tout voir <Icone nom="arrow-right" taille={14} />
              </a>
            </div>
            {aTraiter.length ? (
              <div className="table-responsive">
                <table className="table table-hover table-serree">
                  <colgroup>
                    <col />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "17%" }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 108 }} />
                    <col style={{ width: 96 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Demande</th>
                      <th>Espace</th>
                      <th>Demandeur</th>
                      <th>Dates</th>
                      <th>Statut</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {aTraiter.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span className="cell2">
                            <a
                              href={`/reservations/${r.id}`}
                              className="fw-medium"
                              style={{ color: "var(--strong)" }}
                              title={r.title}
                            >
                              {r.title}
                            </a>
                            <small>{r.numero}</small>
                            <small>reçue {depuis(r.createdAt)}</small>
                          </span>
                        </td>
                        <td>
                          <span className="d-flex align-items-center gap-2 text-nowrap">
                            <PastilleEspace couleur={r.espace.color} />
                            <span className="text-truncate" title={r.espace.name}>
                              {nomCourt(r.espace)}
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className="cell2">
                            <span
                              title={
                                r.organisation?.name ??
                                (r.user ? `${r.user.firstName} ${r.user.lastName}` : undefined)
                              }
                            >
                              {r.organisation?.name ??
                                (r.user ? `${r.user.firstName} ${r.user.lastName}` : "—")}
                            </span>
                            <small>
                              {r.organisation ? ORGANISATION_TYPES[r.organisation.type] : ""}
                            </small>
                          </span>
                        </td>
                        <td className="text-nowrap">
                          <span className="cell2">
                            <span>{dateMoyenne(r.startAt)}</span>
                            <small>{plageHoraire(r.startAt, r.endAt)}</small>
                            {r._count.creneaux > 1 ? (
                              <small>{r._count.creneaux} créneaux</small>
                            ) : null}
                          </span>
                        </td>
                        <td>
                          <StatutResa status={r.status} />
                        </td>
                        <td className="actions">
                          <a href={`/reservations/${r.id}`} className="btn btn-sm btn-primary">
                            Répondre
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-muted">
                <Icone nom="circle-check" taille={28} classes="text-success d-block mx-auto mb-2" />
                Aucune demande en attente : tout est traité.
              </div>
            )}
          </div>

          <div className="data-card">
            <div className="card-header-custom">
              <h6>Demandes et revenus sur 12 mois</h6>
              <span className="text-muted small">
                Encaissé sur la période : <strong>{montant(kpi.revenus.valeur)}</strong>
              </span>
            </div>
            <div className="card-body-custom">
              <div className="graph-wrap">
                <canvas data-graphique="graph-revenus" aria-label="Demandes et revenus par mois" />
              </div>
              <DonneesGraphique
                id="graph-revenus"
                config={{
                  type: "bar",
                  data: {
                    labels: revenus.map((m) => m.label),
                    datasets: [
                      {
                        type: "bar",
                        label: "Demandes",
                        data: revenus.map((m) => m.demandes),
                        backgroundColor: "rgba(0,110,70,.75)",
                        borderRadius: 6,
                        yAxisID: "y",
                      },
                      {
                        type: "line",
                        label: "Revenus (€)",
                        data: revenus.map((m) => m.revenus),
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

        <div className="dash-col">
          <div className="data-card">
            <div className="card-header-custom">
              <h6>
                <Icone nom="triangle-alert" taille={16} classes="text-ambre" /> Alertes
                {alertesDuJour.length ? (
                  <span className="chip chip-red">{alertesDuJour.length}</span>
                ) : null}
              </h6>
            </div>
            {alertesDuJour.length ? (
              <ul className="liste-simple liste-alertes">
                {alertesDuJour.map((a) => (
                  <li key={a.cle}>
                    <a href={a.href} className="alerte-ligne" title={a.detail}>
                      <span
                        className={`notif-ico chip-${a.niveau === "danger" ? "red" : a.niveau === "warning" ? "amber" : "sky"}`}
                      >
                        <Icone nom={a.icone} taille={14} />
                      </span>
                      <span className="cell2" style={{ minWidth: 0, flex: 1 }}>
                        <span className="fw-medium" style={{ color: "var(--strong)" }}>
                          {a.titre}
                        </span>
                        <small>{a.detail}</small>
                      </span>
                      <Icone nom="chevron-right" taille={14} classes="text-muted" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-3 text-center text-muted small">
                <Icone nom="circle-check" taille={22} classes="text-success d-block mx-auto mb-1" />
                Aucune alerte : pièces, factures et signatures sont à jour.
              </div>
            )}
          </div>

          <div className="data-card">
            <div className="card-header-custom">
              <h6>
                <Icone nom="bell" taille={16} classes="text-primary" /> Notifications
              </h6>
              {page.counts.notifications ? (
                <span className="chip chip-primary">
                  {page.counts.notifications} non lue{page.counts.notifications > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
            {notifs.length ? (
              <ul className="liste-simple">
                {notifs.map((n) => (
                  <li key={n.id}>
                    <span className={`notif-ico chip-${n.readAt ? "slate" : "rose"}`}>
                      <Icone
                        nom={
                          n.type === "message"
                            ? "message-circle"
                            : n.type === "signature"
                              ? "pen-line"
                              : n.type === "paiement"
                                ? "credit-card"
                                : "clipboard-list"
                        }
                        taille={14}
                      />
                    </span>
                    <span className="cell2">
                      <a href={n.link ?? "/notifications"} style={{ color: "var(--strong)" }}>
                        {n.title}
                      </a>
                      {n.body ? <small>{n.body}</small> : null}
                    </span>
                    <span className="quand">{depuis(n.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-muted small">Aucune notification.</div>
            )}
          </div>

          <div className="data-card">
            <div className="card-header-custom">
              <h6>
                <Icone nom="calendar-days" taille={16} classes="text-primary" /> Les 7 prochains
                jours
              </h6>
              <a href="/planning" className="btn btn-ghost btn-sm">
                Planning
              </a>
            </div>
            {prochains.length ? (
              <ul className="liste-simple">
                {prochains.map((c) => (
                  <li key={c.id}>
                    <PastilleEspace couleur={c.espace.color} />
                    <span className="cell2">
                      <a
                        href={`/reservations/${c.reservation.id}`}
                        style={{ color: "var(--strong)" }}
                      >
                        {c.reservation.title}
                      </a>
                      <small>
                        {nomCourt(c.espace)} ·{" "}
                        {c.reservation.organisation?.name ??
                          (c.reservation.user
                            ? `${c.reservation.user.firstName} ${c.reservation.user.lastName}`
                            : "")}
                      </small>
                    </span>
                    <span className="quand text-end" style={{ lineHeight: 1.15 }}>
                      {dateMoyenne(c.startAt)}
                      <br />
                      {heure(c.startAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-muted small">Rien de prévu cette semaine.</div>
            )}
          </div>

          <div className="data-card">
            <div className="card-header-custom">
              <h6>
                <Icone nom="sparkles" taille={16} classes="text-primary" /> En un coup d'œil
              </h6>
            </div>
            <ul className="liste-simple">
              <li>
                <Icone nom="pen-line" taille={16} classes="text-muted" /> Conventions à signer
                <strong className="ms-auto">{kpi.signatures}</strong>
              </li>
              <li>
                <Icone nom="credit-card" taille={16} classes="text-muted" /> Factures à encaisser
                <strong className="ms-auto">{kpi.factures}</strong>
              </li>
              <li>
                <Icone nom="message-circle" taille={16} classes="text-muted" /> Messages sans
                réponse
                <strong className="ms-auto">{kpi.messages}</strong>
              </li>
              <li>
                <Avatar nom={user.name} taille="sm" agent /> Connecté en tant que {user.name}
              </li>
            </ul>
          </div>
        </div>
      </div>
      <ScriptDiffere src="/vendor/chart.umd.min.js" nonce={nonce} />
      <ScriptDiffere src="/js/graphiques.js" nonce={nonce} />
    </>
  );
}
