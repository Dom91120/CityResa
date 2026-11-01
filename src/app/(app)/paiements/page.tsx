import { Icone } from "@/components/icones";
import {
  Barre,
  Filtre,
  PaginationBar,
  SegTabs,
  Th,
  trier,
  urlAvec,
  Vide,
} from "@/components/liste";
import { StatutFacture } from "@/components/macros";
import { FACTURE_TYPES } from "@/lib/constantes";
import { dateCourte, montant } from "@/lib/libelles";
import { PERIODES, periode } from "@/lib/periodes";
import {
  aujourdhuiUtc,
  chargerFactures,
  compterOnglets,
  debiteur,
  filtrerFactures,
  lireFiltres,
  ONGLETS_FACTURES,
  organisationsDe,
  payeDe,
  resteDe,
  synthese,
} from "@/modules/paiements/server";
import { CartesFactures, Debiteur, Echeance, TypeFacture } from "@/modules/paiements/vues";
import { contexteModule } from "@/server/module";
import { type Params, paginate, resolvePerPage } from "@/server/paging";

export const metadata = { title: "Paiements - CityRésa" };

export default async function PaiementsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const page = await contexteModule("paiements", "paiements");
  const params = await searchParams;
  const fl = lireFiltres(params);
  const now = new Date();
  const auj = aujourdhuiUtc(now);
  const toutes = await chargerFactures();
  const p = periode(fl.periode || undefined, now);
  const s = synthese(toutes, p, now);
  const onglets = compterOnglets(toutes, fl, now);
  const filtrees = filtrerFactures(toutes, fl, now);
  const triees = trier(
    filtrees,
    page.search,
    {
      numero: (f) => f.numero,
      type: (f) => FACTURE_TYPES[f.type] ?? f.type,
      dossier: (f) => f.reservation?.numero ?? "",
      debiteur: (f) => debiteur(f).nom,
      montant: (f) => f.montantTtc,
      reste: (f) => resteDe(f),
      echeance: (f) => f.dueAt,
      statut: (f) => f.status,
      date: (f) => f.createdAt,
    },
    "date",
    "desc",
  );
  const perPage = await resolvePerPage(params, page.user, "paiements.list");
  const [rows, pg] = paginate(triees, params, perPage);
  const peutEditer = page.user.canEdit("paiements");
  const exportHref = urlAvec("/paiements/export.csv", page.search, { page: null, per_page: null });
  const th = (col: string, label: string, classes = "") => (
    <Th col={col} label={label} pathname={page.pathname} search={page.search} classes={classes} />
  );
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Paiements <span className="page-count">{pg.total}</span>
          </h1>
          <p className="page-subtitle">
            Factures d'acompte, de solde et de caution, suivi des règlements.
          </p>
        </div>
        <div className="page-actions">
          <a href={exportHref} className="btn btn-outline-secondary btn-sm">
            <Icone nom="download" taille={14} /> Export CSV
          </a>
          {peutEditer ? (
            <a href="/paiements/nouvelle" className="btn btn-primary btn-sm">
              <Icone nom="plus" taille={14} /> Facture libre
            </a>
          ) : null}
        </div>
      </div>

      <CartesFactures s={s} libellePeriode={p.label} base="/paiements" />

      <SegTabs
        tabs={ONGLETS_FACTURES.map(([cle, label]) => ({
          href: urlAvec(page.pathname, page.search, { statut: cle || null, page: null }),
          label,
          count: onglets[cle],
          active: fl.statut === cle,
          teinte: cle === "a_payer" || cle === "retard" ? undefined : "muted",
        }))}
      />

      <Barre
        q={fl.q}
        pathname={page.pathname}
        search={page.search}
        placeholder="Numéro, dossier, débiteur…"
        hidden={{
          statut: fl.statut,
          type: fl.type,
          periode: fl.periode,
          organisation: fl.organisation ? String(fl.organisation) : null,
        }}
        filtres={
          <>
            {fl.statut ? <input type="hidden" name="statut" value={fl.statut} /> : null}
            <Filtre
              name="type"
              value={fl.type}
              options={Object.entries(FACTURE_TYPES)}
              blank="Tous les types"
              ariaLabel="Type de facture"
            />
            <Filtre
              name="periode"
              value={fl.periode}
              options={PERIODES}
              blank="Toutes périodes"
              ariaLabel="Période d'émission"
            />
            <Filtre
              name="organisation"
              value={fl.organisation ? String(fl.organisation) : ""}
              options={organisationsDe(toutes)}
              blank="Toutes les organisations"
              ariaLabel="Organisation"
            />
            <button type="submit" className="btn btn-outline-secondary btn-sm">
              <Icone nom="filter" taille={14} /> Filtrer
            </button>
          </>
        }
      />

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                {th("numero", "Numéro")}
                {th("type", "Type")}
                {th("dossier", "Dossier")}
                {th("debiteur", "Débiteur")}
                {th("montant", "Montant TTC", "text-end")}
                <th className="text-end">Payé</th>
                {th("reste", "Reste", "text-end")}
                {th("echeance", "Échéance")}
                {th("statut", "Statut")}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((f) => {
                  const reste = resteDe(f);
                  return (
                    <tr key={f.id}>
                      <td>
                        <span className="cell2">
                          <a
                            href={`/paiements/${f.id}`}
                            className="fw-medium"
                            style={{ color: "var(--strong)" }}
                          >
                            {f.numero}
                          </a>
                          <small>émise le {dateCourte(f.createdAt)}</small>
                        </span>
                      </td>
                      <td>
                        <TypeFacture type={f.type} />
                      </td>
                      <td>
                        {f.reservation ? (
                          <span className="cell2">
                            <a href={`/reservations/${f.reservation.id}`}>{f.reservation.numero}</a>
                            <small>{f.reservation.title}</small>
                          </span>
                        ) : (
                          <span className="cell2">
                            <span className="text-muted">Facture libre</span>
                            <small>{f.libelle}</small>
                          </span>
                        )}
                      </td>
                      <td>
                        <Debiteur f={f} />
                      </td>
                      <td className="text-end tabular fw-medium">{montant(f.montantTtc)}</td>
                      <td className="text-end tabular">{montant(payeDe(f))}</td>
                      <td className="text-end tabular">
                        {reste > 0 ? (
                          <strong className="text-danger">{montant(reste)}</strong>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td>
                        <Echeance f={f} aujourdhui={auj} />
                      </td>
                      <td>
                        <StatutFacture status={f.status} />
                      </td>
                      <td className="actions">
                        <span className="row-actions">
                          {peutEditer && f.status === "a_payer" ? (
                            <a
                              href={`/paiements/${f.id}#encaisser`}
                              className="btn btn-sm btn-primary"
                              title="Enregistrer un paiement"
                            >
                              <Icone nom="banknote" taille={14} /> Encaisser
                            </a>
                          ) : null}
                          <a
                            href={`/paiements/${f.id}/pdf`}
                            className="btn btn-ghost btn-icone btn-sm"
                            title="PDF"
                            aria-label="PDF"
                            target="_blank"
                            rel="noopener"
                          >
                            <Icone nom="file-text" taille={14} />
                          </a>
                          {peutEditer && f.status === "a_payer" && !f.paiements.length ? (
                            <form method="POST" action={`/paiements/${f.id}/annuler`}>
                              <input type="hidden" name="csrf_token" value={page.csrf} />
                              <input
                                type="hidden"
                                name="next"
                                value={urlAvec(page.pathname, page.search, {})}
                              />
                              <button
                                type="submit"
                                className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                                title="Annuler la facture"
                                aria-label="Annuler la facture"
                                data-confirm={`Annuler la facture ${f.numero} ?`}
                              >
                                <Icone nom="ban" taille={14} />
                              </button>
                            </form>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <Vide
                  colonnes={10}
                  icone="receipt"
                  message={
                    fl.q || fl.type || fl.periode || fl.organisation
                      ? "Aucune facture ne correspond à ces critères."
                      : fl.statut === "retard"
                        ? "Aucune échéance dépassée : tout est à jour."
                        : fl.statut === "a_payer"
                          ? "Aucune facture en attente de règlement."
                          : "Aucune facture pour l'instant : elles sont émises à la confirmation des réservations."
                  }
                  urlAjout={
                    peutEditer && !fl.q && !fl.statut && !fl.type ? "/paiements/nouvelle" : null
                  }
                  libelleAjout="Émettre une facture libre"
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationBar p={pg} pathname={page.pathname} search={page.search} />
    </>
  );
}
