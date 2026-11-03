import { notFound } from "next/navigation";
import { Galerie } from "@/components/documents";
import {
  BoutonOuvrir,
  Entete,
  Lu,
  Lus,
  MenuLien,
  MenuPost,
  MenuSep,
  ModalAction,
  Section,
} from "@/components/fiche";
import { Champ, Coches, Grille, Interrupteur, Select, Zone } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { VideBloc } from "@/components/liste";
import { Avatar, Chip, OuiNon, PastilleEspace, StatutResa } from "@/components/macros";
import { OPTION_UNITES, TARIF_UNITES } from "@/lib/constantes";
import { dateCourte, montantOuGratuit, plage } from "@/lib/libelles";
import { aPartirDe } from "@/lib/tarification";
import {
  agentsDisponibles,
  chargerEspace,
  decrireRegles,
  horairesTableau,
  indisponibilitesAVenir,
  libellesProfils,
  occupation30Jours,
  prochainsCreneaux,
  ROLES_GESTIONNAIRE,
  referentielsEspaces,
} from "@/modules/espaces/server";
import { Onglets, StatutEspace, Visibilite, Volet } from "@/modules/espaces/vues";
import { forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Espace - CityRésa" };

export default async function EspacePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("espaces");
  const id = idDeRoute((await params).id);
  const e = await chargerEspace(id);
  if (!e) notFound();
  const [photos, refs, prochains, blocages, occupation] = await Promise.all([
    forParent("espace", id, { kinds: ["photo"] }),
    referentielsEspaces(),
    prochainsCreneaux(id, 10),
    indisponibilitesAVenir(id),
    occupation30Jours(id),
  ]);
  const peutEditer = page.user.canEdit("espaces");
  const peutSupprimer = page.user.canDelete("espaces");
  const agents = peutEditer ? await agentsDisponibles(e.gestionnaires.map((g) => g.userId)) : [];
  const libelles = libellesProfils(refs.profils);
  const fiche = `/espaces/${id}`;
  const csrf = page.csrf;
  const base = page.user.settings.APP_BASE_URL.replace(/\/+$/, "");
  const urlIcs = e.icsToken ? `${base}/ics/espace/${e.icsToken}` : null;
  const urlPortail = e.isPublic && page.features.portail ? `/portail/espaces/${e.slug}` : null;
  const equipementsCoches = e.equipements.map((x) => x.equipementId);
  const bloque = e.status !== "actif" || !e.isActive;

  return (
    <>
      <Entete
        titre={
          <span className="d-inline-flex align-items-center gap-2">
            <PastilleEspace couleur={e.color} />
            {e.name}
          </span>
        }
        sousTitre={
          <>
            <a href={`/sites/${e.siteId}`}>{e.site.name}</a>
            {e.nature ? ` · ${e.nature.label}` : ""}
            {e.parent ? (
              <>
                {" · sous-espace de "}
                <a href={`/espaces/${e.parent.id}`}>{e.parent.name}</a>
              </>
            ) : null}
          </>
        }
        retour="/espaces"
        badges={
          <span className="ms-2 d-inline-flex gap-1 align-items-center">
            <StatutEspace status={e.status} isActive={e.isActive} />
          </span>
        }
        actions={
          <>
            <a href={`/planning?espace=${id}`} className="btn btn-outline-secondary">
              <Icone nom="calendar-days" taille={14} /> Planning
            </a>
            {peutEditer ? (
              <a href={`${fiche}/modifier`} className="btn btn-primary js-modifier">
                <Icone nom="pencil" taille={14} /> Modifier
              </a>
            ) : null}
          </>
        }
        menu={[
          peutEditer && !bloque ? (
            <MenuLien
              key="resa"
              url={`/reservations/nouveau?espace=${id}`}
              libelle="Nouvelle réservation"
              icone="calendar-plus"
            />
          ) : null,
          urlPortail ? (
            <MenuLien
              key="portail"
              url={urlPortail}
              libelle="Voir sur le portail"
              icone="globe"
              cible="_blank"
            />
          ) : null,
          peutEditer ? (
            <MenuLien
              key="sous"
              url={`/espaces/nouveau?site=${e.siteId}`}
              libelle="Ajouter un espace sur ce site"
              icone="plus"
            />
          ) : null,
          peutSupprimer ? <MenuSep key="sep" /> : null,
          peutSupprimer ? (
            <MenuPost
              key="suppr"
              url={`${fiche}/supprimer`}
              libelle={e._count.reservations ? "Désactiver l'espace" : "Supprimer l'espace"}
              icone="trash-2"
              csrf={csrf}
              danger
              confirm={
                e._count.reservations
                  ? `Cet espace a ${e._count.reservations} réservation(s) : il sera désactivé, pas supprimé. Continuer ?`
                  : "Supprimer définitivement cet espace ?"
              }
            />
          ) : null,
        ]}
      />

      <Onglets
        onglets={[
          { id: "synthese", label: "Synthèse", icone: "door-open" },
          { id: "photos", label: "Photos", icone: "image", nb: photos.length },
          { id: "equipements", label: "Équipements", icone: "wifi", nb: e.equipements.length },
          { id: "tarifs", label: "Tarifs", icone: "euro", nb: e.tarifs.length },
          { id: "options", label: "Prestations", icone: "sparkles", nb: e.options.length },
          {
            id: "gestionnaires",
            label: "Gestionnaires",
            icone: "users",
            nb: e.gestionnaires.length,
          },
          { id: "indisponibilites", label: "Indisponibilités", icone: "ban", nb: blocages.length },
          {
            id: "reservations",
            label: "Réservations",
            icone: "clipboard-list",
            nb: prochains.length,
          },
          { id: "ics", label: "Flux ICS", icone: "calendar" },
          { id: "activite", label: "Activité", icone: "activity" },
        ]}
      />

      <div className="tab-content">
        {/* ── Synthèse ── */}
        <Volet id="synthese" premier>
          <div className="fiche-colonnes fiche-colonnes--espace">
            <div className="data-card overflow-visible">
              <Section titre="Identité" icone="door-open">
                <Lus>
                  <Lu label="Site" valeur={<a href={`/sites/${e.siteId}`}>{e.site.name}</a>} />
                  <Lu label="Nature" valeur={e.nature?.label} />
                  <Lu label="Libellé court" valeur={e.shortName} />
                  <Lu label="Étage" valeur={e.floor} />
                  <Lu
                    label="Capacité"
                    valeur={
                      e.capacityStanding || e.capacitySeated
                        ? [
                            e.capacityStanding ? `${e.capacityStanding} debout` : null,
                            e.capacitySeated ? `${e.capacitySeated} assis` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : null
                    }
                  />
                  <Lu
                    label="Surface"
                    valeur={e.surface ? `${String(e.surface).replace(".", ",")} m²` : null}
                  />
                  <Lu
                    label="Visibilité"
                    valeur={
                      <Visibilite
                        isPublic={e.isPublic}
                        allowedProfiles={e.allowedProfiles}
                        libelles={libelles}
                      />
                    }
                    pleine
                  />
                  <Lu label="Tarif" valeur={aPartirDe(e.tarifs)} />
                  <Lu
                    label="Portail"
                    valeur={
                      urlPortail ? (
                        <span className="d-inline-flex align-items-center gap-2 flex-wrap">
                          <a href={urlPortail} target="_blank" rel="noopener">
                            Voir sur le portail
                          </a>
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-muted"
                            data-copier={`${base}${urlPortail}`}
                            title={`Copier le lien : ${base}${urlPortail}`}
                            aria-label="Copier le lien du portail"
                          >
                            <Icone nom="copy" taille={14} />
                          </button>
                        </span>
                      ) : e.isPublic ? (
                        "Portail désactivé"
                      ) : (
                        "Non publié"
                      )
                    }
                    tiret
                    pleine
                  />
                  <Lu label="Description" valeur={e.description} pleine pre />
                  {e.enfants.length ? (
                    <Lu
                      label="Sous-espaces"
                      pleine
                      valeur={
                        <span className="d-inline-flex flex-wrap gap-1">
                          {e.enfants.map((s) => (
                            <a key={s.id} href={`/espaces/${s.id}`} className="chip chip-slate">
                              <PastilleEspace couleur={s.color} /> {s.name}
                            </a>
                          ))}
                        </span>
                      }
                    />
                  ) : null}
                  <Lu label="Créé le" valeur={dateCourte(e.createdAt)} />
                </Lus>
              </Section>
              <Section titre="Règlement et consignes" icone="scroll-text">
                <Lus colonnes={1}>
                  <Lu label="Règlement et conditions" valeur={e.rules} pre tiret />
                  <Lu label="Consignes pratiques" valeur={e.instructions} pre tiret />
                </Lus>
              </Section>
            </div>
            <div className="data-card overflow-visible">
              <Section titre="Règles de réservation" icone="clock">
                <ul className="liste-simple">
                  {decrireRegles(e).map((r) => (
                    <li key={r}>
                      <Icone nom="check" taille={14} classes="text-primary" /> {r}
                    </li>
                  ))}
                </ul>
              </Section>
              <Section titre="Horaires d'ouverture" icone="calendar-clock">
                <table className="table">
                  <tbody>
                    {horairesTableau(e.openHours).map((h) => (
                      <tr key={h.jour}>
                        <td className="fw-medium" style={{ width: 120 }}>
                          {h.jour}
                        </td>
                        <td className={h.plages === "Fermé" ? "text-muted" : ""}>{h.plages}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            </div>
          </div>
        </Volet>

        {/* ── Photos ── */}
        <Volet id="photos">
          <div className="data-card">
            <div className="card-header-custom">
              <h6>Galerie de photos</h6>
              <span className="text-muted small">
                La première photo est la vignette de l'espace.
              </span>
            </div>
            <div className="card-body-custom">
              <Galerie
                photos={photos}
                parentKind="espace"
                parentId={id}
                csrf={csrf}
                next={`${fiche}#photos`}
                peutEditer={peutEditer && page.features.documents}
              />
            </div>
          </div>
        </Volet>

        {/* ── Équipements ── */}
        <Volet id="equipements">
          <div className="data-card">
            <div className="card-header-custom">
              <h6>Équipements disponibles</h6>
              <span className="text-muted small">
                Affichés sur le portail et dans la convention.
              </span>
            </div>
            <div className="card-body-custom">
              {peutEditer ? (
                refs.equipements.length ? (
                  <form method="POST" action={`${fiche}/equipements`} data-double-envoi>
                    <input type="hidden" name="csrf_token" value={csrf} />
                    <Coches
                      name="equipement"
                      options={refs.equipements.map((r) => ({
                        value: r.id,
                        label: r.label,
                        icone: r.icon ?? undefined,
                      }))}
                      cochees={equipementsCoches}
                    />
                    <div className="mt-3">
                      <button type="submit" className="btn btn-primary btn-sm">
                        <Icone nom="check" taille={14} /> Enregistrer les équipements
                      </button>
                    </div>
                  </form>
                ) : (
                  <VideBloc
                    icone="wifi"
                    titre="Aucun équipement défini"
                    texte="La liste des équipements se gère dans les référentiels."
                    action={
                      page.user.isAdmin ? (
                        <a
                          href="/referentiels#equipement"
                          className="btn btn-sm btn-outline-primary"
                        >
                          Ouvrir les référentiels
                        </a>
                      ) : null
                    }
                  />
                )
              ) : e.equipements.length ? (
                <ul className="equipements list-unstyled mb-0">
                  {e.equipements.map((x) => (
                    <li key={x.equipementId}>
                      <Icone nom={x.equipement.icon ?? "check"} taille={14} /> {x.equipement.label}
                      {x.quantity ? ` × ${x.quantity}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted small mb-0">Aucun équipement renseigné.</p>
              )}
            </div>
          </div>
        </Volet>

        {/* ── Tarifs ── */}
        <Volet id="tarifs">
          <div className="data-card">
            <div className="card-header-custom">
              <h6>
                Grille tarifaire
                <span className="chip chip-primary ms-2">{aPartirDe(e.tarifs)}</span>
              </h6>
              {peutEditer ? (
                <BoutonOuvrir
                  cible="modal-tarif"
                  libelle="Ajouter un tarif"
                  icone="plus"
                  classe="btn-primary btn-sm"
                />
              ) : null}
            </div>
            {e.tarifs.length ? (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Profil</th>
                      <th>Unité</th>
                      <th className="text-end">Montant</th>
                      <th>Libellé</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {e.tarifs.map((t) => (
                      <tr key={t.id}>
                        <td>
                          {t.profil ? (
                            <Chip teinte="violet">{t.profil.label}</Chip>
                          ) : (
                            <Chip teinte="sky">Tous profils</Chip>
                          )}
                        </td>
                        <td>{TARIF_UNITES[t.unite] ?? t.unite}</td>
                        <td className="text-end tabular fw-medium">
                          {montantOuGratuit(t.montant)}
                        </td>
                        <td>{t.label ?? <span className="text-faint">—</span>}</td>
                        <td className="actions">
                          {peutEditer ? (
                            <form method="POST" action={`${fiche}/tarifs`} className="d-inline">
                              <input type="hidden" name="csrf_token" value={csrf} />
                              <input type="hidden" name="faire" value="supprimer" />
                              <input type="hidden" name="tarif_id" value={t.id} />
                              <button
                                type="submit"
                                className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                                title="Supprimer ce tarif"
                                aria-label="Supprimer ce tarif"
                                data-confirm="Supprimer ce tarif ?"
                              >
                                <Icone nom="trash-2" taille={14} />
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <VideBloc
                icone="euro"
                titre="Aucun tarif"
                texte="Sans tarif, l'espace est proposé « sur demande ». Un montant de 0 € signifie la gratuité."
                action={
                  peutEditer ? (
                    <BoutonOuvrir
                      cible="modal-tarif"
                      libelle="Ajouter un tarif"
                      icone="plus"
                      classe="btn-primary btn-sm"
                    />
                  ) : null
                }
              />
            )}
            <div className="card-pied text-muted small">
              Pour un profil, ses lignes propres s'appliquent ; sinon celles « Tous profils ». À
              chaque créneau, l'unité la moins chère pour l'usager est retenue.
            </div>
          </div>
        </Volet>

        {/* ── Prestations ── */}
        <Volet id="options">
          <div className="data-card">
            <div className="card-header-custom">
              <h6>Options et prestations</h6>
              {peutEditer ? (
                <BoutonOuvrir
                  cible="modal-option"
                  libelle="Ajouter une prestation"
                  icone="plus"
                  classe="btn-primary btn-sm"
                />
              ) : null}
            </div>
            {e.options.length ? (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Prestation</th>
                      <th className="text-end">Montant</th>
                      <th>Unité</th>
                      <th>Obligatoire</th>
                      <th>Active</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {e.options.map((o) => (
                      <tr key={o.id} className={o.isActive ? "" : "text-muted"}>
                        <td>
                          <span className="cell2">
                            <span className="fw-medium">{o.label}</span>
                            {o.description ? <small>{o.description}</small> : null}
                          </span>
                        </td>
                        <td className="text-end tabular">{montantOuGratuit(o.montant)}</td>
                        <td>{OPTION_UNITES[o.unite] ?? o.unite}</td>
                        <td>
                          <OuiNon v={o.mandatory} />
                        </td>
                        <td>
                          <OuiNon v={o.isActive} />
                        </td>
                        <td className="actions">
                          {peutEditer ? (
                            <div className="row-actions">
                              <BoutonOuvrir
                                cible={`modal-option-${o.id}`}
                                libelle="Modifier"
                                icone="pencil"
                                classe="btn-ghost btn-sm"
                                sansTexte
                              />
                              <form method="POST" action={`${fiche}/options`} className="d-inline">
                                <input type="hidden" name="csrf_token" value={csrf} />
                                <input type="hidden" name="faire" value="supprimer" />
                                <input type="hidden" name="option_id" value={o.id} />
                                <button
                                  type="submit"
                                  className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                                  title="Supprimer"
                                  aria-label="Supprimer"
                                  data-confirm={`Supprimer la prestation « ${o.label} » ? Si des dossiers l'utilisent, elle sera seulement désactivée.`}
                                >
                                  <Icone nom="trash-2" taille={14} />
                                </button>
                              </form>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <VideBloc
                icone="sparkles"
                titre="Aucune prestation"
                texte="Ménage, montage, sonorisation… proposées en option (ou imposées) lors d'une demande."
                action={
                  peutEditer ? (
                    <BoutonOuvrir
                      cible="modal-option"
                      libelle="Ajouter une prestation"
                      icone="plus"
                      classe="btn-primary btn-sm"
                    />
                  ) : null
                }
              />
            )}
          </div>
        </Volet>

        {/* ── Gestionnaires ── */}
        <Volet id="gestionnaires">
          <div className="data-card">
            <div className="card-header-custom">
              <h6>Agents en charge de l'espace</h6>
              {peutEditer ? (
                <BoutonOuvrir
                  cible="modal-gestionnaire"
                  libelle="Ajouter un agent"
                  icone="user-plus"
                  classe="btn-primary btn-sm"
                />
              ) : null}
            </div>
            {e.gestionnaires.length ? (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Rôle sur l'espace</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {e.gestionnaires.map((g) => {
                      const nom = `${g.user.firstName} ${g.user.lastName}`.trim() || g.user.email;
                      const r = ROLES_GESTIONNAIRE[g.role];
                      return (
                        <tr key={g.userId}>
                          <td>
                            <span className="d-flex align-items-center gap-2">
                              <Avatar nom={nom} taille="sm" agent />
                              <span className="cell2">
                                <span className="fw-medium">{nom}</span>
                                <small>
                                  {[g.user.fonction, g.user.email].filter(Boolean).join(" · ")}
                                </small>
                              </span>
                            </span>
                          </td>
                          <td>
                            <Chip teinte={r?.teinte ?? "slate"} titre={r?.aide}>
                              {r?.label ?? g.role}
                            </Chip>
                          </td>
                          <td className="actions">
                            {peutEditer ? (
                              <form
                                method="POST"
                                action={`${fiche}/gestionnaires`}
                                className="d-inline"
                              >
                                <input type="hidden" name="csrf_token" value={csrf} />
                                <input type="hidden" name="faire" value="supprimer" />
                                <input type="hidden" name="user_id" value={g.userId} />
                                <button
                                  type="submit"
                                  className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                                  title="Retirer"
                                  aria-label="Retirer"
                                  data-confirm={`Retirer ${nom} des gestionnaires de cet espace ?`}
                                >
                                  <Icone nom="x" taille={14} />
                                </button>
                              </form>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <VideBloc
                icone="users"
                titre="Aucun agent rattaché"
                texte="Sans gestionnaire, tous les agents habilités traitent les demandes de cet espace."
                action={
                  peutEditer ? (
                    <BoutonOuvrir
                      cible="modal-gestionnaire"
                      libelle="Ajouter un agent"
                      icone="user-plus"
                      classe="btn-primary btn-sm"
                    />
                  ) : null
                }
              />
            )}
            <div className="card-pied text-muted small">
              {Object.values(ROLES_GESTIONNAIRE)
                .map((r) => `${r.label} : ${r.aide}`)
                .join(" ")}
            </div>
          </div>
        </Volet>

        {/* ── Indisponibilités ── */}
        <Volet id="indisponibilites">
          <div className="data-card">
            <div className="card-header-custom">
              <h6>Blocages à venir</h6>
              {peutEditer ? (
                <BoutonOuvrir
                  cible="modal-blocage"
                  libelle="Bloquer une période"
                  icone="ban"
                  classe="btn-primary btn-sm"
                />
              ) : null}
            </div>
            {blocages.length ? (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Période</th>
                      <th>Motif</th>
                      <th>Posé par</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {blocages.map((b) => (
                      <tr key={b.id}>
                        <td className="text-nowrap">{plage(b.startAt, b.endAt)}</td>
                        <td>{b.motif ?? <span className="text-faint">—</span>}</td>
                        <td className="text-muted small">{b.createdBy ?? "—"}</td>
                        <td className="actions">
                          {peutEditer ? (
                            <form
                              method="POST"
                              action={`${fiche}/indisponibilites`}
                              className="d-inline"
                            >
                              <input type="hidden" name="csrf_token" value={csrf} />
                              <input type="hidden" name="faire" value="supprimer" />
                              <input type="hidden" name="indisponibilite_id" value={b.id} />
                              <button
                                type="submit"
                                className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                                title="Lever ce blocage"
                                aria-label="Lever ce blocage"
                                data-confirm="Lever ce blocage ?"
                              >
                                <Icone nom="trash-2" taille={14} />
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <VideBloc
                icone="ban"
                titre="Aucun blocage à venir"
                texte="Travaux, usage interne, jours fériés : une période bloquée refuse toute demande."
                action={
                  peutEditer ? (
                    <BoutonOuvrir
                      cible="modal-blocage"
                      libelle="Bloquer une période"
                      icone="ban"
                      classe="btn-primary btn-sm"
                    />
                  ) : null
                }
              />
            )}
          </div>
        </Volet>

        {/* ── Réservations ── */}
        <Volet id="reservations">
          <div className="data-card">
            <div className="card-header-custom">
              <h6>Les 10 prochains créneaux</h6>
              <a href={`/reservations?espace=${id}`} className="btn btn-ghost btn-sm">
                Toutes les réservations <Icone nom="arrow-right" taille={14} />
              </a>
            </div>
            {prochains.length ? (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Créneau</th>
                      <th>Dossier</th>
                      <th>Demandeur</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prochains.map((c) => (
                      <tr key={c.id}>
                        <td className="text-nowrap">{plage(c.startAt, c.endAt)}</td>
                        <td>
                          <span className="cell2">
                            <a
                              href={`/reservations/${c.reservation.id}`}
                              className="fw-medium"
                              style={{ color: "var(--strong)" }}
                            >
                              {c.reservation.title}
                            </a>
                            <small>{c.reservation.numero}</small>
                          </span>
                        </td>
                        <td>
                          {c.reservation.organisation?.name ??
                            (c.reservation.user
                              ? `${c.reservation.user.firstName} ${c.reservation.user.lastName}`
                              : "—")}
                        </td>
                        <td>
                          <StatutResa status={c.reservation.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <VideBloc
                icone="calendar-check"
                titre="Rien de prévu"
                texte="Aucun créneau à venir sur cet espace."
                action={
                  peutEditer && !bloque ? (
                    <a
                      href={`/reservations/nouveau?espace=${id}`}
                      className="btn btn-sm btn-primary"
                    >
                      <Icone nom="calendar-plus" taille={14} /> Nouvelle réservation
                    </a>
                  ) : null
                }
              />
            )}
          </div>
        </Volet>

        {/* ── Flux ICS ── */}
        <Volet id="ics">
          <div className="data-card">
            <div className="card-header-custom">
              <h6>Abonnement au calendrier (ICS)</h6>
            </div>
            <div className="card-body-custom">
              <p className="text-muted small">
                Le flux publie les créneaux fermes de l'espace (30 jours passés et à venir) dans
                Outlook, Google Agenda ou Thunderbird. L'adresse contient un jeton secret : toute
                personne qui la connaît peut lire l'agenda. Révoquez-la pour en changer.
              </p>
              {urlIcs ? (
                <>
                  <div className="d-flex gap-2 align-items-center flex-wrap">
                    <input
                      type="text"
                      className="form-control"
                      readOnly
                      value={urlIcs}
                      aria-label="Adresse du flux ICS"
                      style={{ maxWidth: 560 }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      data-copier={urlIcs}
                    >
                      <Icone nom="copy" taille={14} /> Copier
                    </button>
                    <a
                      href={urlIcs}
                      className="btn btn-outline-secondary"
                      target="_blank"
                      rel="noopener"
                    >
                      <Icone nom="download" taille={14} /> Ouvrir
                    </a>
                  </div>
                  {peutEditer ? (
                    <form method="POST" action={`${fiche}/ics`} className="mt-3">
                      <input type="hidden" name="csrf_token" value={csrf} />
                      <input type="hidden" name="faire" value="revoquer" />
                      <button
                        type="submit"
                        className="btn btn-ghost btn-ghost-danger btn-sm"
                        data-confirm="Révoquer ce flux ? Les calendriers abonnés cesseront de se mettre à jour."
                      >
                        <Icone nom="ban" taille={14} /> Révoquer le flux
                      </button>
                    </form>
                  ) : null}
                </>
              ) : (
                <VideBloc
                  icone="calendar"
                  titre="Aucun flux actif"
                  texte="Générez une adresse d'abonnement pour suivre cet espace depuis un agenda."
                  action={
                    peutEditer ? (
                      <form method="POST" action={`${fiche}/ics`}>
                        <input type="hidden" name="csrf_token" value={csrf} />
                        <input type="hidden" name="faire" value="generer" />
                        <button type="submit" className="btn btn-sm btn-primary">
                          <Icone nom="link" taille={14} /> Générer le flux
                        </button>
                      </form>
                    ) : null
                  }
                />
              )}
            </div>
          </div>
        </Volet>

        {/* ── Activité ── */}
        <Volet id="activite">
          <div className="data-card">
            <div className="card-header-custom">
              <h6>Occupation des 30 derniers jours</h6>
              <a href="/statistiques" className="btn btn-ghost btn-sm">
                Statistiques <Icone nom="arrow-right" taille={14} />
              </a>
            </div>
            <div className="card-body-custom">
              {occupation ? (
                <>
                  <div className="stat-grid">
                    <div className="stat-card">
                      <div className="stat-label">Taux d'occupation</div>
                      <div className="stat-number">
                        {String(occupation.taux).replace(".", ",")} %
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Heures réservées</div>
                      <div className="stat-number">
                        {String(occupation.heures).replace(".", ",")} h
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Créneaux fermes</div>
                      <div className="stat-number">{occupation.nb}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Réservations (total)</div>
                      <div className="stat-number">{e._count.reservations}</div>
                    </div>
                  </div>
                  <div className="occupation-ligne mt-3">
                    <span className="small text-muted">Heures réservées / heures d'ouverture</span>
                    <span className="barre">
                      <span style={{ width: `${occupation.taux}%`, background: e.color }} />
                    </span>
                    <span className="taux">{String(occupation.taux).replace(".", ",")} %</span>
                  </div>
                </>
              ) : (
                <p className="text-muted small mb-0">
                  Cet espace est désactivé : l'occupation n'est plus calculée.
                </p>
              )}
            </div>
          </div>
        </Volet>
      </div>

      {peutEditer ? (
        <>
          <ModalAction
            id="modal-tarif"
            titre="Ajouter un tarif"
            action={`${fiche}/tarifs`}
            csrf={csrf}
            bouton="Ajouter"
            icone="plus"
            aide="Un montant par profil et par unité. 0 € = gratuit pour ce profil."
          >
            <Grille colonnes={2}>
              <Select
                label="Profil"
                name="profil_id"
                options={refs.profils.map((p) => [String(p.id), p.label])}
                blank="Tous profils"
              />
              <Select
                label="Unité"
                name="unite"
                options={Object.entries(TARIF_UNITES)}
                valeur="heure"
                requis
              />
              <Champ
                label="Montant (€)"
                name="montant"
                id="tarif-montant"
                type="number"
                min={0}
                step="0.01"
                requis
                valeur={0}
              />
              <Champ label="Libellé" name="label" id="tarif-label" placeholder="facultatif" />
            </Grille>
          </ModalAction>

          <ModalAction
            id="modal-option"
            titre="Ajouter une prestation"
            action={`${fiche}/options`}
            csrf={csrf}
            bouton="Ajouter"
            icone="plus"
          >
            <input type="hidden" name="faire" value="ajouter" />
            <FormOption option={null} suffixe="new" />
          </ModalAction>
          {e.options.map((o) => (
            <ModalAction
              key={o.id}
              id={`modal-option-${o.id}`}
              titre={`Modifier « ${o.label} »`}
              action={`${fiche}/options`}
              csrf={csrf}
            >
              <input type="hidden" name="faire" value="modifier" />
              <input type="hidden" name="option_id" value={o.id} />
              <FormOption option={o} suffixe={String(o.id)} />
            </ModalAction>
          ))}

          <ModalAction
            id="modal-gestionnaire"
            titre="Ajouter un agent"
            action={`${fiche}/gestionnaires`}
            csrf={csrf}
            bouton="Ajouter"
            icone="user-plus"
            aide="Un agent déjà rattaché voit son rôle mis à jour."
          >
            {agents.length ? (
              <Grille colonnes={2}>
                <Select
                  label="Agent"
                  name="user_id"
                  options={agents.map((a) => [
                    a.id,
                    `${`${a.firstName} ${a.lastName}`.trim() || a.email} (${a.role})`,
                  ])}
                  blank="— Choisir —"
                  requis
                  pleine
                />
                <Select
                  label="Rôle sur l'espace"
                  name="role"
                  options={Object.entries(ROLES_GESTIONNAIRE).map(([k, v]) => [k, v.label])}
                  valeur="gestionnaire"
                  pleine
                />
              </Grille>
            ) : (
              <p className="text-muted small mb-0">
                Tous les agents actifs sont déjà rattachés à cet espace.
              </p>
            )}
          </ModalAction>

          <ModalAction
            id="modal-blocage"
            titre="Bloquer une période"
            action={`${fiche}/indisponibilites`}
            csrf={csrf}
            bouton="Bloquer"
            icone="ban"
            aide="Heure de Paris. Les demandes existantes ne sont pas annulées : vérifiez le planning."
          >
            <Grille colonnes={2}>
              <Champ label="Début · date" name="date_debut" type="date" requis />
              <Champ label="Début · heure" name="heure_debut" type="time" requis valeur="08:00" />
              <Champ label="Fin · date" name="date_fin" type="date" requis />
              <Champ label="Fin · heure" name="heure_fin" type="time" requis valeur="22:00" />
              <Zone
                label="Motif"
                name="motif"
                rows={2}
                maxLength={200}
                placeholder="Travaux, usage interne…"
              />
            </Grille>
          </ModalAction>
        </>
      ) : null}
    </>
  );
}

/** Les champs d'une prestation ; `suffixe` distingue les identifiants d'une modale à l'autre. */
function FormOption({
  option,
  suffixe,
}: {
  option: {
    label: string;
    description: string | null;
    montant: number;
    unite: string;
    mandatory: boolean;
    isActive: boolean;
  } | null;
  suffixe: string;
}) {
  return (
    <Grille colonnes={2}>
      <Champ
        label="Libellé"
        name="label"
        id={`opt-label-${suffixe}`}
        valeur={option?.label}
        requis
        pleine
      />
      <Zone
        label="Description"
        name="description"
        id={`opt-desc-${suffixe}`}
        valeur={option?.description}
        rows={2}
        maxLength={300}
      />
      <Champ
        label="Montant (€)"
        name="montant"
        id={`opt-montant-${suffixe}`}
        type="number"
        min={0}
        step="0.01"
        valeur={option?.montant ?? 0}
      />
      <Select
        label="Unité"
        name="unite"
        id={`opt-unite-${suffixe}`}
        options={Object.entries(OPTION_UNITES)}
        valeur={option?.unite ?? "forfait"}
      />
      <Interrupteur
        label="Obligatoire"
        name="mandatory"
        id={`opt-mandatory-${suffixe}`}
        coche={option?.mandatory ?? false}
        aide="Imposée à toute réservation de l'espace."
      />
      <Interrupteur
        label="Active"
        name="is_active"
        id={`opt-active-${suffixe}`}
        coche={option?.isActive ?? true}
      />
    </Grille>
  );
}
