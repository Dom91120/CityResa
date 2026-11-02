import { BoutonOuvrir, ModalAction } from "@/components/fiche";
import { Champ, Grille, Interrupteur, Select } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { VideBloc } from "@/components/liste";
import { Chip } from "@/components/macros";
import {
  decrirePeriode,
  nbJours,
  PERIODE_KINDS,
  PERIODE_SOURCES,
  type PeriodeJours,
  type PeriodeKind,
  periodesSeRecouvrent,
  saisonDe,
  saisonSuivante,
  ZONE_PAR_DEFAUT,
  ZONES_VACANCES,
} from "@/lib/calendrier";
import { todayParisISO } from "@/lib/paris-time";
import { contexteAdmin } from "@/modules/admin/server";
import { Onglets, Volet } from "@/modules/espaces/vues";
import { type PeriodeLue, periodesEntre, saisons } from "@/server/calendrier";

export const metadata = { title: "Calendrier des saisons - CityRésa" };

/** « 17/10/2026 » depuis « 2026-10-17 ». */
function fr(ymd: string): string {
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
}

function ChipKind({ kind }: { kind: string }) {
  return kind === "vacances" ? (
    <Chip teinte="sky">Vacances</Chip>
  ) : (
    <Chip teinte="amber">Férié</Chip>
  );
}

export default async function CalendrierPage() {
  const page = await contexteAdmin();
  const liste = await saisons();
  const aujourdhui = todayParisISO();
  const periodes = await periodesEntre("1900-01-01", "2999-12-31");
  const dansSaison = (s: PeriodeJours) => periodes.filter((p) => periodesSeRecouvrent(p, s));
  const horsSaison = periodes.filter((p) => !liste.some((s) => periodesSeRecouvrent(p, s)));
  const proposee = liste.length
    ? saisonSuivante(liste.reduce((m, s) => (s.fin > m.fin ? s : m), liste[0]))
    : saisonDe(aujourdhui);

  const onglets = [
    ...liste.map((s) => ({
      id: `s${s.id}`,
      label: s.label,
      icone: s.isActive ? "star" : "calendar-range",
      nb: dansSaison(s).length,
    })),
    ...(horsSaison.length
      ? [{ id: "autres", label: "Hors saison", icone: "calendar-x", nb: horsSaison.length }]
      : []),
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendrier des saisons</h1>
          <p className="page-subtitle">
            Les saisons (années scolaires), les vacances scolaires de la zone C et les jours fériés.
            Une récurrence « hors vacances » ou « hors jours fériés » saute ces jours ; la fin de la
            saison active pré-remplit la date de fin des récurrences.
          </p>
        </div>
        <div className="page-actions">
          <BoutonOuvrir
            cible="modal-saison-nouvelle"
            libelle="Nouvelle saison"
            icone="plus"
            classe="btn-primary"
          />
        </div>
      </div>

      <div className="data-card mb-3">
        <div className="card-header-custom">
          <h6>
            <Icone nom="calendar-range" taille={16} classes="text-primary" /> Saisons
          </h6>
        </div>
        {liste.length ? (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Saison</th>
                  <th>Du</th>
                  <th>Au</th>
                  <th>Vacances</th>
                  <th>Jours fériés</th>
                  <th>État</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {liste.map((s) => {
                  const ps = dansSaison(s);
                  const nbVac = ps.filter((p) => p.kind === "vacances").length;
                  const nbFer = ps.filter((p) => p.kind === "ferie").length;
                  return (
                    <tr key={s.id}>
                      <td className="fw-medium" style={{ color: "var(--strong)" }}>
                        {s.label}
                      </td>
                      <td>{fr(s.debut)}</td>
                      <td>{fr(s.fin)}</td>
                      <td>
                        {nbVac ? (
                          `${nbVac} période${nbVac > 1 ? "s" : ""}`
                        ) : (
                          <span className="text-faint">Aucune : à importer</span>
                        )}
                      </td>
                      <td>{nbFer || <span className="text-faint">—</span>}</td>
                      <td>
                        {s.isActive ? (
                          <Chip teinte="emerald">Active</Chip>
                        ) : s.fin < aujourdhui ? (
                          <Chip teinte="slate">Passée</Chip>
                        ) : (
                          <Chip teinte="violet">À venir</Chip>
                        )}
                      </td>
                      <td className="actions">
                        <div className="row-actions">
                          <BoutonOuvrir
                            cible={`modal-import-${s.id}`}
                            libelle="Importer les vacances"
                            icone="download"
                            classe="btn-outline-secondary btn-sm"
                          />
                          {!s.isActive ? (
                            <form
                              method="POST"
                              action={`/calendrier/saisons/${s.id}/activer`}
                              className="d-inline"
                            >
                              <input type="hidden" name="csrf_token" value={page.csrf} />
                              <button
                                type="submit"
                                className="btn btn-ghost btn-icone btn-sm"
                                title="Rendre active"
                                aria-label="Rendre active"
                              >
                                <Icone nom="star" taille={14} />
                              </button>
                            </form>
                          ) : null}
                          <BoutonOuvrir
                            cible={`modal-saison-${s.id}`}
                            libelle="Modifier"
                            icone="pencil"
                            classe="btn-ghost btn-sm"
                            sansTexte
                          />
                          {!s.isActive ? (
                            <form
                              method="POST"
                              action={`/calendrier/saisons/${s.id}/supprimer`}
                              className="d-inline"
                            >
                              <input type="hidden" name="csrf_token" value={page.csrf} />
                              <button
                                type="submit"
                                className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                                title="Supprimer"
                                aria-label="Supprimer"
                                data-confirm={`Supprimer la saison ${s.label} et ses périodes importées ou calculées ?`}
                              >
                                <Icone nom="trash-2" taille={14} />
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <VideBloc
            icone="calendar-range"
            titre="Aucune saison"
            texte="Créez la saison en cours : ses jours fériés sont inscrits automatiquement, puis importez les vacances scolaires."
            action={
              <BoutonOuvrir
                cible="modal-saison-nouvelle"
                libelle="Nouvelle saison"
                icone="plus"
                classe="btn-primary btn-sm"
              />
            }
          />
        )}
      </div>

      <div className="data-card">
        <div className="card-header-custom">
          <h6>
            <Icone nom="sun" taille={16} classes="text-primary" /> Vacances scolaires et jours
            fériés
          </h6>
          <BoutonOuvrir
            cible="modal-periode-nouvelle"
            libelle="Ajouter une période"
            icone="plus"
            classe="btn-primary btn-sm"
          />
        </div>
        <div className="px-3 pt-2 text-muted small">
          Les vacances s'importent depuis le calendrier scolaire officiel (data.education.gouv.fr) ;
          les jours fériés sont calculés à la création de la saison. Vous pouvez ajouter un pont ou
          une fermeture, ou corriger une date.
        </div>
        {onglets.length ? (
          <>
            <Onglets onglets={onglets} />
            <div className="tab-content">
              {liste.map((s, i) => (
                <Volet key={s.id} id={`s${s.id}`} premier={i === 0}>
                  <TablePeriodes periodes={dansSaison(s)} csrf={page.csrf} />
                </Volet>
              ))}
              {horsSaison.length ? (
                <Volet id="autres" premier={!liste.length}>
                  <TablePeriodes periodes={horsSaison} csrf={page.csrf} />
                </Volet>
              ) : null}
            </div>
          </>
        ) : (
          <VideBloc icone="sun" titre="Aucune période" texte="Créez d'abord une saison." />
        )}
      </div>

      {/* ── Modales ── */}
      <ModalAction
        id="modal-saison-nouvelle"
        titre="Nouvelle saison"
        action="/calendrier/saisons/nouvelle"
        csrf={page.csrf}
        bouton="Créer la saison"
        icone="plus"
        aide="Les jours fériés légaux de la période sont inscrits automatiquement. Importez ensuite les vacances scolaires."
      >
        <ChampsSaison saison={proposee} active={!liste.length} suffixe="new" />
      </ModalAction>
      {liste.map((s) => (
        <ModalAction
          key={s.id}
          id={`modal-saison-${s.id}`}
          titre={`Modifier la saison ${s.label}`}
          action={`/calendrier/saisons/${s.id}/modifier`}
          csrf={page.csrf}
        >
          <ChampsSaison saison={s} active={s.isActive} suffixe={String(s.id)} />
        </ModalAction>
      ))}
      {liste.map((s) => (
        <ModalAction
          key={s.id}
          id={`modal-import-${s.id}`}
          titre={`Importer les vacances scolaires ${s.label}`}
          action={`/calendrier/saisons/${s.id}/importer`}
          csrf={page.csrf}
          bouton="Importer"
          icone="download"
          multipart
          aide="Le serveur interroge le calendrier scolaire officiel (data.education.gouv.fr). Les vacances déjà importées pour cette saison sont remplacées ; les périodes saisies à la main sont conservées."
        >
          <Grille colonnes={2}>
            <Select
              label="Zone"
              name="zone"
              id={`zone-${s.id}`}
              valeur={ZONE_PAR_DEFAUT}
              options={ZONES_VACANCES.map((z) => [z, z])}
              aide="Châtillon (académie de Versailles) : zone C."
            />
            <div>
              <label className="form-label" htmlFor={`fichier-${s.id}`}>
                Export JSON (facultatif)
              </label>
              <input
                type="file"
                name="fichier"
                id={`fichier-${s.id}`}
                className="form-control"
                accept="application/json,.json"
              />
              <div className="form-text">
                Pour un serveur sans accès Internet : l'export JSON du jeu «
                fr-en-calendrier-scolaire ».
              </div>
            </div>
          </Grille>
        </ModalAction>
      ))}
      <ModalAction
        id="modal-periode-nouvelle"
        titre="Ajouter une période"
        action="/calendrier/periodes/nouvelle"
        csrf={page.csrf}
        bouton="Ajouter"
        icone="plus"
      >
        <ChampsPeriode periode={null} suffixe="new" />
      </ModalAction>
      {periodes.map((p) => (
        <ModalAction
          key={p.id}
          id={`modal-periode-${p.id}`}
          titre={`Modifier « ${p.label} »`}
          action={`/calendrier/periodes/${p.id}/modifier`}
          csrf={page.csrf}
        >
          <ChampsPeriode periode={p} suffixe={String(p.id)} />
        </ModalAction>
      ))}
    </>
  );
}

function ChampsSaison({
  saison,
  active,
  suffixe,
}: {
  saison: { label: string; debut: string; fin: string };
  active: boolean;
  suffixe: string;
}) {
  return (
    <Grille colonnes={2}>
      <Champ
        label="Nom"
        name="label"
        id={`saison-label-${suffixe}`}
        valeur={saison.label}
        requis
        placeholder="2026-2027"
        aide="Deux années qui se suivent."
      />
      <div />
      <Champ
        label="Du"
        name="debut"
        id={`saison-debut-${suffixe}`}
        type="date"
        valeur={saison.debut}
        requis
      />
      <Champ
        label="Au"
        name="fin"
        id={`saison-fin-${suffixe}`}
        type="date"
        valeur={saison.fin}
        requis
      />
      <Interrupteur
        label="Saison active"
        name="is_active"
        id={`saison-active-${suffixe}`}
        coche={active}
        aide="Sa fin pré-remplit la date de fin des récurrences. Une seule saison est active."
      />
    </Grille>
  );
}

function ChampsPeriode({ periode, suffixe }: { periode: PeriodeLue | null; suffixe: string }) {
  return (
    <Grille colonnes={2}>
      <Select
        label="Type"
        name="kind"
        id={`periode-kind-${suffixe}`}
        valeur={periode?.kind ?? "vacances"}
        options={(Object.keys(PERIODE_KINDS) as PeriodeKind[]).map((k) => [k, PERIODE_KINDS[k]])}
        requis
      />
      <Champ
        label="Libellé"
        name="label"
        id={`periode-label-${suffixe}`}
        valeur={periode?.label}
        requis
        placeholder="Vacances de la Toussaint, Pont de l'Ascension…"
      />
      <Champ
        label="Du"
        name="debut"
        id={`periode-debut-${suffixe}`}
        type="date"
        valeur={periode?.debut}
        requis
      />
      <Champ
        label="Au (inclus)"
        name="fin"
        id={`periode-fin-${suffixe}`}
        type="date"
        valeur={periode?.fin}
        aide="Laissez vide pour un seul jour."
      />
    </Grille>
  );
}

function TablePeriodes({ periodes, csrf }: { periodes: PeriodeLue[]; csrf: string }) {
  if (!periodes.length)
    return (
      <VideBloc
        icone="sun"
        titre="Aucune période"
        texte="Importez les vacances scolaires ou ajoutez une période."
      />
    );
  return (
    <div className="table-responsive">
      <table className="table table-hover">
        <thead>
          <tr>
            <th>Type</th>
            <th>Libellé</th>
            <th>Dates</th>
            <th>Jours</th>
            <th>Origine</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {periodes.map((p) => (
            <tr key={p.id}>
              <td>
                <ChipKind kind={p.kind} />
              </td>
              <td className="fw-medium" style={{ color: "var(--strong)" }}>
                {p.label}
              </td>
              <td>{decrirePeriode(p)}</td>
              <td>{nbJours(p)}</td>
              <td className="small text-muted">
                {PERIODE_SOURCES[p.source] ?? p.source}
                {p.zone ? ` · ${p.zone}` : ""}
              </td>
              <td className="actions">
                <div className="row-actions">
                  <BoutonOuvrir
                    cible={`modal-periode-${p.id}`}
                    libelle="Modifier"
                    icone="pencil"
                    classe="btn-ghost btn-sm"
                    sansTexte
                  />
                  <form
                    method="POST"
                    action={`/calendrier/periodes/${p.id}/supprimer`}
                    className="d-inline"
                  >
                    <input type="hidden" name="csrf_token" value={csrf} />
                    <button
                      type="submit"
                      className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                      title="Supprimer"
                      aria-label="Supprimer"
                      data-confirm={`Supprimer « ${p.label} » ?`}
                    >
                      <Icone nom="trash-2" taille={14} />
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
