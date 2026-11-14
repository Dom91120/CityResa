import { BoutonOuvrir, ModalAction } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { SegTabs, urlAvec, VideBloc } from "@/components/liste";
import { ScriptDiffere } from "@/components/scripts";
import { nomCourt } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { legende, lireCouleur, lireVuesEnregistrees, qsVue } from "@/lib/planning-vues";
import {
  FiltreCouleur,
  FiltreEspaces,
  FiltreSites,
  SelecteurPeriode,
} from "@/modules/planning/filtres";
import { VueListe } from "@/modules/planning/liste";
import {
  espacesDuPerimetre,
  espacesPlanning,
  fenetre,
  lireDate,
  lireFiltresPlanning,
  lireVue,
  occupationsPlanning,
  periodeAffichee,
  type Vue,
} from "@/modules/planning/server";
import { VueJour, VueMois, VueSemaine } from "@/modules/planning/vues";
import { contexteModule } from "@/server/module";
import { param } from "@/server/paging";

export const metadata = { title: "Planning - CityRésa" };

const VUES: [Vue, string][] = [
  ["semaine", "Semaine"],
  ["mois", "Mois"],
  ["jour", "Jour"],
  ["liste", "Liste"],
];

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteModule("planning");
  const params = await searchParams;
  const vue = lireVue(param(params, "vue"));
  const date = lireDate(param(params, "date"));
  const fen = fenetre(vue, date);
  const filtres = lireFiltresPlanning(params);
  const couleur = lireCouleur(param(params, "couleur"));
  const vuesEnregistrees = lireVuesEnregistrees(page.user.listPrefs);
  const qsActuelle = qsVue(page.search);
  const [espaces, tous] = await Promise.all([
    espacesPlanning(page.user, filtres),
    espacesDuPerimetre(page.user),
  ]);
  const { creneaux, blocages } = await occupationsPlanning(
    espaces.map((e) => e.id),
    fen,
  );
  const aujourdhui = todayParisISO();
  const peutEditer = page.user.canEdit("reservations");
  const retour = `${page.pathname}${page.search.toString() ? `?${page.search.toString()}` : ""}`;
  const lien = (modifs: Record<string, string | null>) =>
    urlAvec(page.pathname, page.search, modifs);
  const sites = [...new Map(tous.map((e) => [e.site.id, e.site])).values()];
  const unSeul = espaces.length === 1 ? espaces[0] : null;
  const qsFiltres = new URLSearchParams();
  for (const id of filtres.sites) qsFiltres.append("site", String(id));
  for (const id of filtres.espaces) qsFiltres.append("espace", String(id));
  const filtresQs = qsFiltres.toString();
  const nbEvts = creneaux.length;
  const props = {
    fen,
    espaces,
    creneaux,
    blocages,
    csrf: page.csrf,
    peutEditer,
    aujourdhui,
    retour,
    couleur,
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Planning <span className="page-count">{fen.label}</span>
          </h1>
          <p className="page-subtitle">
            {espaces.length} espace{espaces.length > 1 ? "s" : ""} · {nbEvts} créneau
            {nbEvts > 1 ? "x" : ""} réservé
            {nbEvts > 1 ? "s" : ""}
            {blocages.length
              ? ` · ${blocages.length} blocage${blocages.length > 1 ? "s" : ""}`
              : ""}
            {peutEditer ? (
              <>
                <br />
                Cliquez sur une case pour réserver.
              </>
            ) : null}
          </p>
        </div>
        <div className="page-actions">
          <div className="dropdown d-inline-block">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              data-bs-toggle="dropdown"
              data-bs-auto-close="outside"
              aria-expanded="false"
            >
              <Icone nom="bookmark" taille={14} /> Mes vues
              {vuesEnregistrees.length ? ` (${vuesEnregistrees.length})` : ""}{" "}
              <Icone nom="chevron-down" taille={12} />
            </button>
            <div className="dropdown-menu p-2" style={{ minWidth: 300 }}>
              {vuesEnregistrees.map((v) => (
                <div key={v.nom} className="d-flex align-items-center gap-1">
                  <a
                    href={`/planning${v.qs ? `?${v.qs}` : ""}`}
                    className="dropdown-item flex-grow-1"
                  >
                    <Icone nom="bookmark" taille={13} /> {v.nom}
                  </a>
                  <form method="POST" action="/planning/vues" className="d-inline">
                    <input type="hidden" name="csrf_token" value={page.csrf} />
                    <input type="hidden" name="action" value="supprimer" />
                    <input type="hidden" name="nom" value={v.nom} />
                    <input type="hidden" name="next" value={retour} />
                    <button
                      type="submit"
                      className="btn btn-ghost btn-icone btn-sm"
                      title={`Supprimer la vue « ${v.nom} »`}
                      aria-label={`Supprimer la vue ${v.nom}`}
                    >
                      <Icone nom="x" taille={12} />
                    </button>
                  </form>
                </div>
              ))}
              {vuesEnregistrees.length ? <div className="dropdown-divider" /> : null}
              <form method="POST" action="/planning/vues" className="px-2 py-1 d-flex gap-1">
                <input type="hidden" name="csrf_token" value={page.csrf} />
                <input type="hidden" name="action" value="enregistrer" />
                <input type="hidden" name="qs" value={qsActuelle} />
                <input type="hidden" name="next" value={retour} />
                <input
                  type="text"
                  name="nom"
                  className="form-control form-control-sm"
                  placeholder="Nom de la vue actuelle"
                  aria-label="Nom de la vue à enregistrer"
                  maxLength={60}
                  required
                />
                <button type="submit" className="btn btn-primary btn-sm text-nowrap">
                  <Icone nom="save" taille={13} /> Enregistrer
                </button>
              </form>
              <div className="px-2 small text-muted">
                Mémorise la vue, les sites, les espaces et la couleur ; la date reste celle du jour.
              </div>
            </div>
          </div>
          <a
            href={`/planning/semaine-type${filtresQs ? `?${filtresQs}` : ""}`}
            className="btn btn-ghost btn-sm"
          >
            <Icone nom="repeat" taille={14} /> Semaine type
          </a>
          {peutEditer ? (
            <a
              href={`/planning/presences?date=${fen.date}${filtresQs ? `&${filtresQs}` : ""}`}
              className="btn btn-ghost btn-sm"
              title="Constater les présences et les heures réelles des créneaux passés"
            >
              <Icone nom="calendar-check" taille={14} /> Présences
            </a>
          ) : null}
          {unSeul ? (
            <a
              href={`/espaces/${unSeul.id}/feuille.pdf?date=${fen.date}`}
              className="btn btn-outline-secondary btn-sm"
              target="_blank"
              rel="noopener"
              title="Programme de la semaine à afficher à la porte, avec QR code vers la version en ligne"
            >
              <Icone nom="qr-code" taille={14} /> Feuille de salle
            </a>
          ) : null}
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
                <button type="button" className="dropdown-item" data-imprimer>
                  <Icone nom="printer" taille={14} /> Cette page
                </button>
              </li>
              <li>
                <a
                  className="dropdown-item"
                  href={`/planning/semaine.pdf?date=${fen.date}${filtresQs ? `&${filtresQs}` : ""}&format=A4`}
                  target="_blank"
                  rel="noopener"
                >
                  <Icone nom="file-text" taille={14} /> Semaine en PDF (A4, une page par espace)
                </a>
              </li>
              <li>
                <a
                  className="dropdown-item"
                  href={`/planning/semaine.pdf?date=${fen.date}${filtresQs ? `&${filtresQs}` : ""}&format=A3`}
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
              <BoutonOuvrir
                cible="modal-bloquer"
                libelle="Bloquer un créneau"
                icone="ban"
                classe="btn-outline-secondary btn-sm"
              />
              <a
                href={`/reservations/nouvelle?date=${fen.vue === "jour" ? fen.date : aujourdhui}${unSeul ? `&espace=${unSeul.id}` : ""}`}
                className="btn btn-primary btn-sm"
              >
                <Icone nom="plus" taille={14} /> Nouvelle réservation
              </a>
            </>
          ) : null}
        </div>
      </div>

      <div className="planning-barre planning-barre--une-ligne">
        <SegTabs
          tabs={VUES.map(([v, l]) => ({
            href: lien({ vue: v === "semaine" ? null : v }),
            label: l,
            active: fen.vue === v,
          }))}
        />
        <SelecteurPeriode
          texte={periodeAffichee(fen)}
          hrefPrecedent={lien({ date: fen.precedent })}
          hrefSuivant={lien({ date: fen.suivant })}
          hrefAujourdhui={lien({ date: null })}
          date={fen.date}
          formulaire="filtres-planning"
        />
        <span className="planning-barre-vide" aria-hidden="true" />
        <form
          id="filtres-planning"
          method="GET"
          className="d-flex align-items-center gap-2"
          data-auto-submit
          data-auto-submit-natif
        >
          {fen.vue !== "semaine" ? <input type="hidden" name="vue" value={fen.vue} /> : null}
          <FiltreSites
            sites={sites}
            choisis={filtres.sites}
            hrefTous={lien({ site: null })}
            classes="ms-auto"
          />
          <FiltreEspaces
            espaces={tous}
            sites={filtres.sites}
            choisis={filtres.espaces}
            hrefTous={lien({ espace: null })}
          />
          <FiltreCouleur choisie={couleur} />
          <noscript>
            <button type="submit" className="btn btn-sm btn-outline-secondary">
              Afficher
            </button>
          </noscript>
        </form>
      </div>
      {legende(couleur).length ? (
        <ul className="list-inline small text-muted mb-2" aria-label="Légende des couleurs">
          {legende(couleur).map(([l, c]) => (
            <li key={l} className="list-inline-item">
              <span className="legende-liseré" style={{ background: c }} /> {l}
            </li>
          ))}
        </ul>
      ) : null}
      {peutEditer ? <span data-planning-csrf={page.csrf} hidden /> : null}

      {!espaces.length ? (
        <div className="data-card">
          <VideBloc
            icone="calendar-days"
            titre="Aucun espace à afficher"
            texte={
              tous.length
                ? "Retirez un filtre pour voir les espaces du périmètre."
                : "Aucun espace actif : créez d'abord un site et ses espaces."
            }
            action={
              tous.length ? (
                <a href="/planning" className="btn btn-outline-secondary btn-sm">
                  Réinitialiser les filtres
                </a>
              ) : (
                <a href="/espaces" className="btn btn-primary btn-sm">
                  Gérer les espaces
                </a>
              )
            }
          />
        </div>
      ) : fen.vue === "liste" ? (
        <VueListe espaces={espaces} creneaux={creneaux} blocages={blocages} />
      ) : fen.vue === "mois" ? (
        <VueMois {...props} urlJour={(j) => lien({ vue: "jour", date: j })} />
      ) : fen.vue === "jour" ? (
        <VueJour {...props} />
      ) : (
        <VueSemaine {...props} />
      )}

      {peutEditer ? (
        <ModalAction
          id="modal-bloquer"
          titre="Bloquer un créneau"
          action="/planning/bloquer"
          csrf={page.csrf}
          bouton="Bloquer"
          icone="ban"
          aide="Travaux, usage interne, fermeture : l'espace devient indisponible sur la période. Si des réservations sont en place, un aperçu les liste avant de bloquer (annulation et courriel aux usagers au choix)."
        >
          <input type="hidden" name="next" value={retour} />
          {fen.vue !== "semaine" ? <input type="hidden" name="vue" value={fen.vue} /> : null}
          <div className="grille grille-2">
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="bloc-espace">
                Espace <span className="req">*</span>
              </label>
              <select
                name="espace_id"
                id="bloc-espace"
                className="form-select"
                defaultValue={unSeul ? String(unSeul.id) : ""}
                required
              >
                <option value="">Choisir…</option>
                {tous.map((e) => (
                  <option key={e.id} value={e.id}>
                    {nomCourt(e)} · {e.site.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="bloc-date">
                Date <span className="req">*</span>
              </label>
              <input
                type="date"
                name="date"
                id="bloc-date"
                className="form-control"
                defaultValue={fen.vue === "jour" ? fen.date : aujourdhui}
                required
              />
            </div>
            <div>
              <label className="form-label" htmlFor="bloc-debut">
                Début <span className="req">*</span>
              </label>
              <input
                type="time"
                name="heure_debut"
                id="bloc-debut"
                className="form-control"
                defaultValue="08:00"
                required
              />
            </div>
            <div>
              <label className="form-label" htmlFor="bloc-fin">
                Fin <span className="req">*</span>
              </label>
              <input
                type="time"
                name="heure_fin"
                id="bloc-fin"
                className="form-control"
                defaultValue="22:00"
                required
              />
              <div className="form-text">Une fin avant le début = le lendemain.</div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="bloc-motif">
                Motif
              </label>
              <input
                type="text"
                name="motif"
                id="bloc-motif"
                className="form-control"
                maxLength={200}
                placeholder="Travaux, conseil municipal, fermeture annuelle…"
              />
            </div>
          </div>
        </ModalAction>
      ) : null}

      <ScriptDiffere src="/js/planning.js" nonce={page.nonce} />
      <ScriptDiffere src="/js/reservations.js" nonce={page.nonce} />
    </>
  );
}
