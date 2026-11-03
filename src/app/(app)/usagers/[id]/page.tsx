import { notFound } from "next/navigation";
import { FormDocument, ListeDocuments, PiecesAttendues } from "@/components/documents";
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
import { Champ, Grille } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import {
  Avatar,
  Chip,
  StatutFacture,
  StatutResa,
  StatutSubvention,
  TypeOrganisation,
} from "@/components/macros";
import { DOCUMENT_KINDS, SUBVENTION_TYPES } from "@/lib/constantes";
import {
  manquesDossier,
  nomRepresentant,
  phraseManques,
  qualiteRepresentant,
} from "@/lib/dossier-usager";
import { dateCourte, dateHeure, dateMoyenne, depuis, montant } from "@/lib/libelles";
import { chargerOrganisation } from "@/modules/usagers/server";
import { nomComplet } from "@/modules/utilisateurs/server";
import { prisma } from "@/server/db";
import { docCategories, forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Usager - CityRésa" };

const KINDS_ORG: [string, string][] = ["statuts", "assurance", "piece", "autre"].map((k) => [
  k,
  DOCUMENT_KINDS[k],
]);

export default async function UsagerPage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("usagers");
  const id = idDeRoute((await params).id);
  const org = await chargerOrganisation(id);
  if (!org) notFound();
  const { user, csrf, features } = page;
  const peutEditer = user.canEdit("usagers");
  const manques = manquesDossier(org, org.users.find((u) => u.isActive) ?? null);
  const [reservations, factures, subventions, documents, categories, historique] =
    await Promise.all([
      prisma.reservation.findMany({
        where: { organisationId: id },
        include: { espace: { select: { name: true } } },
        orderBy: { startAt: "desc" },
        take: 50,
      }),
      features.paiements && user.canView("paiements")
        ? prisma.facture.findMany({
            where: { organisationId: id },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : Promise.resolve([]),
      features.subventions && user.canView("subventions")
        ? prisma.subvention.findMany({
            where: { organisationId: id },
            orderBy: [{ exercice: "desc" }, { createdAt: "desc" }],
            take: 50,
          })
        : Promise.resolve([]),
      features.documents ? forParent("organisation", id) : Promise.resolve([]),
      features.documents ? docCategories() : Promise.resolve([]),
      prisma.actionLog.findMany({
        where: { OR: [{ detail: { contains: org.name } }, { detail: { contains: `#${id}` } }] },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);
  const ici = `/usagers/${id}`;
  const adresse = [org.address, [org.postalCode, org.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return (
    <>
      <Entete
        titre={org.name}
        retour="/usagers"
        sousTitre={
          <>
            <TypeOrganisation type={org.type} />
            {org.profil ? <span className="ms-2">Profil : {org.profil.label}</span> : null}
            <span className="ms-2 text-muted">· créé le {dateCourte(org.createdAt)}</span>
          </>
        }
        badges={
          !org.isActive ? (
            <Chip teinte="slate" classes="ms-2">
              Inactif
            </Chip>
          ) : !org.validatedAt ? (
            <Chip teinte="amber" classes="ms-2">
              À valider
            </Chip>
          ) : null
        }
        actions={
          peutEditer ? (
            <>
              {!org.validatedAt && org.isActive ? (
                <form method="POST" action={`${ici}/valider`} className="d-inline">
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <button type="submit" className="btn btn-primary">
                    <Icone nom="badge-check" taille={14} /> Valider
                  </button>
                </form>
              ) : null}
              <a href={`${ici}/modifier`} className="btn btn-outline-secondary js-modifier">
                <Icone nom="pencil" taille={14} /> Modifier
              </a>
            </>
          ) : null
        }
        menu={
          peutEditer
            ? [
                <MenuLien
                  key="membre"
                  url={`${ici}#membres`}
                  libelle="Voir les membres"
                  icone="users"
                />,
                <MenuSep key="sep" />,
                <MenuPost
                  key="actif"
                  url={`${ici}/actif`}
                  csrf={csrf}
                  libelle={org.isActive ? "Désactiver l'organisation" : "Réactiver l'organisation"}
                  icone={org.isActive ? "ban" : "refresh-cw"}
                  danger={org.isActive}
                  confirm={
                    org.isActive
                      ? "Désactiver cette organisation ? Ses membres ne pourront plus se connecter."
                      : undefined
                  }
                />,
              ]
            : undefined
        }
      />

      {manques.length ? (
        <div className="astuce mb-3">
          <Icone nom="triangle-alert" taille={16} />
          <span>
            <strong>Dossier incomplet pour réserver.</strong> {phraseManques(manques)}{" "}
            {peutEditer ? (
              <a href={`${ici}/modifier`}>Compléter la fiche</a>
            ) : (
              "L'usager sera invité à compléter sa fiche avant de déposer une demande."
            )}
          </span>
        </div>
      ) : null}

      {!org.validatedAt && org.isActive ? (
        <div className="astuce mb-3">
          <Icone nom="info" taille={16} />
          <span>
            Cette organisation n'a pas encore été validée : ses membres ne bénéficient pas des
            tarifs de leur profil et certains espaces leur restent inaccessibles.
            {peutEditer ? " Vérifiez les pièces et la fiche, puis cliquez sur « Valider »." : ""}
          </span>
        </div>
      ) : null}

      <div className="fiche-colonnes">
        <div className="data-card overflow-visible">
          <Section titre="Organisation" icone="building-2">
            <Lus>
              <Lu label="Type" valeur={<TypeOrganisation type={org.type} />} />
              <Lu label="Profil tarifaire" valeur={org.profil?.label} tiret />
              <Lu label="Adresse" valeur={adresse} tiret />
              <Lu label={qualiteRepresentant(org.type)} valeur={nomRepresentant(org)} tiret />
              {org.type === "association" ? (
                <Lu label="AG de nomination" valeur={dateCourte(org.legalAppointedAt)} tiret />
              ) : null}
              <Lu
                label="Courriel"
                valeur={org.email ? <a href={`mailto:${org.email}`}>{org.email}</a> : null}
                tiret
              />
              <Lu
                label="Téléphone"
                valeur={org.phone ? <a href={`tel:${org.phone}`}>{org.phone}</a> : null}
                tiret
              />
              <Lu
                label="Site web"
                valeur={
                  org.website ? (
                    <a href={org.website} target="_blank" rel="noopener">
                      {org.website}
                    </a>
                  ) : null
                }
              />
              <Lu label="SIRET" valeur={org.siret} />
              <Lu label="RNA" valeur={org.rna} />
              <Lu
                label="Validée le"
                valeur={
                  org.validatedAt ? (
                    dateHeure(org.validatedAt)
                  ) : (
                    <Chip teinte="amber">En attente de validation</Chip>
                  )
                }
              />
              <Lu label="Statut" valeur={org.isActive ? "Active" : "Désactivée"} />
              <Lu label="Notes internes" valeur={org.notes} pleine pre />
            </Lus>
          </Section>

          <Section
            titre="Membres"
            icone="users"
            nb={org.users.length}
            id="membres"
            droite={
              peutEditer ? (
                <BoutonOuvrir
                  cible="modal-membre"
                  libelle="Ajouter un membre"
                  icone="user-plus"
                  classe="btn-outline-primary btn-sm"
                />
              ) : null
            }
          >
            {org.users.length ? (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Contact</th>
                      <th>Fonction</th>
                      <th>Dernière connexion</th>
                      <th>Statut</th>
                      {peutEditer ? <th /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {org.users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <span className="d-flex align-items-center gap-2">
                            <Avatar nom={nomComplet(u)} taille="sm" />
                            <strong>{nomComplet(u)}</strong>
                          </span>
                        </td>
                        <td className="small">
                          <span className="cell2">
                            <a href={`mailto:${u.email}`}>{u.email}</a>
                            {u.phone ? <small>{u.phone}</small> : null}
                          </span>
                        </td>
                        <td className="small">
                          {u.fonction ?? <span className="text-faint">—</span>}
                        </td>
                        <td className="small text-muted">
                          {u.lastLoginAt ? depuis(u.lastLoginAt) : "Jamais"}
                        </td>
                        <td>
                          {u.isActive ? (
                            <Chip teinte="emerald">Actif</Chip>
                          ) : (
                            <Chip teinte="slate">Désactivé</Chip>
                          )}
                        </td>
                        {peutEditer ? (
                          <td>
                            <div className="row-actions">
                              <form method="POST" action={`${ici}/membres/${u.id}/reinitialiser`}>
                                <input type="hidden" name="csrf_token" value={csrf} />
                                <button
                                  type="submit"
                                  className="btn btn-ghost btn-icone btn-sm"
                                  title="Envoyer un lien de réinitialisation du mot de passe"
                                  aria-label="Envoyer un lien de réinitialisation"
                                  disabled={!u.isActive}
                                  data-confirm={`Envoyer un lien de réinitialisation du mot de passe à ${u.email} ?`}
                                >
                                  <Icone nom="key-round" taille={14} />
                                </button>
                              </form>
                              <form method="POST" action={`${ici}/membres/${u.id}/actif`}>
                                <input type="hidden" name="csrf_token" value={csrf} />
                                <button
                                  type="submit"
                                  className={`btn btn-ghost btn-icone btn-sm${u.isActive ? " btn-ghost-danger" : ""}`}
                                  title={
                                    u.isActive ? "Désactiver le compte" : "Réactiver le compte"
                                  }
                                  aria-label={
                                    u.isActive ? "Désactiver le compte" : "Réactiver le compte"
                                  }
                                  data-confirm={
                                    u.isActive
                                      ? `Désactiver le compte de ${nomComplet(u)} ?`
                                      : undefined
                                  }
                                >
                                  <Icone nom={u.isActive ? "ban" : "refresh-cw"} taille={14} />
                                </button>
                              </form>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted small mb-0">
                Aucun compte rattaché. Ajoutez un membre pour que l'organisation puisse déposer des
                demandes sur le portail.
              </p>
            )}
          </Section>

          <Section
            titre="Réservations"
            icone="clipboard-list"
            nb={org._count.reservations}
            ouverte={reservations.length > 0}
          >
            {reservations.length ? (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Dossier</th>
                      <th>Espace</th>
                      <th>Date</th>
                      <th className="text-end">Montant</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <a href={`/reservations/${r.id}`} className="cell2">
                            <strong>{r.numero}</strong>
                            <small>{r.title}</small>
                          </a>
                        </td>
                        <td className="small">{r.espace.name}</td>
                        <td className="small">{dateMoyenne(r.startAt)}</td>
                        <td className="text-end tabular small">
                          {r.gratuit ? "Gratuit" : montant(r.montantTtc)}
                        </td>
                        <td>
                          <StatutResa status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {org._count.reservations > reservations.length ? (
                  <p className="small text-muted mt-2 mb-0">
                    Les {reservations.length} plus récentes sur {org._count.reservations}.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted small mb-0">Aucune réservation pour cet usager.</p>
            )}
          </Section>

          {features.paiements && user.canView("paiements") ? (
            <Section titre="Factures" icone="receipt" nb={org._count.factures} ouverte={false}>
              {factures.length ? (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Numéro</th>
                        <th>Libellé</th>
                        <th className="text-end">Montant TTC</th>
                        <th>Échéance</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {factures.map((f) => (
                        <tr key={f.id}>
                          <td>
                            <a href={`/paiements/${f.id}`}>
                              <strong>{f.numero}</strong>
                            </a>
                          </td>
                          <td className="small">{f.libelle}</td>
                          <td className="text-end tabular">{montant(f.montantTtc)}</td>
                          <td className="small text-muted">{dateCourte(f.dueAt)}</td>
                          <td>
                            <StatutFacture status={f.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted small mb-0">Aucune facture.</p>
              )}
            </Section>
          ) : null}

          {features.subventions && user.canView("subventions") ? (
            <Section
              titre="Subventions"
              icone="hand-coins"
              nb={org._count.subventions}
              ouverte={false}
            >
              {subventions.length ? (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Dossier</th>
                        <th>Exercice</th>
                        <th>Type</th>
                        <th className="text-end">Demandé</th>
                        <th className="text-end">Accordé</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subventions.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <a href={`/subventions/${s.id}`} className="cell2">
                              <strong>{s.numero}</strong>
                              <small>{s.objet}</small>
                            </a>
                          </td>
                          <td>{s.exercice}</td>
                          <td className="small">{SUBVENTION_TYPES[s.type] ?? s.type}</td>
                          <td className="text-end tabular">{montant(s.montantDemande)}</td>
                          <td className="text-end tabular">
                            {s.montantAccorde !== null ? montant(s.montantAccorde) : "—"}
                          </td>
                          <td>
                            <StatutSubvention status={s.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted small mb-0">Aucune demande de subvention.</p>
              )}
            </Section>
          ) : null}
        </div>

        <div className="data-card overflow-visible">
          {features.documents ? (
            <Section titre="Pièces" icone="paperclip" nb={documents.length} id="documents">
              <PiecesAttendues
                type={org.type}
                pieces={documents}
                seuilJours={user.settings.ALERTE_PIECES_JOURS}
              />
              <ListeDocuments
                documents={documents}
                csrf={csrf}
                next={`${ici}#documents`}
                peutSupprimer={() => peutEditer}
                peutDater={(d) => peutEditer && d.kind !== "photo"}
                seuilJours={user.settings.ALERTE_PIECES_JOURS}
                vide="Aucune pièce : statuts, attestation d'assurance, justificatifs…"
              />
              {peutEditer ? (
                <div className="mt-3">
                  <FormDocument
                    parentKind="organisation"
                    parentId={id}
                    csrf={csrf}
                    next={`${ici}#documents`}
                    kinds={KINDS_ORG}
                    categories={categories}
                    compact
                    validite
                  />
                </div>
              ) : null}
            </Section>
          ) : null}

          <Section titre="Historique" icone="history" nb={historique.length} ouverte={false}>
            {historique.length ? (
              <ul className="historique list-unstyled mb-0">
                {historique.map((h) => (
                  <li key={h.id}>
                    <span className="quand">{dateHeure(h.createdAt)}</span>
                    <span>
                      {h.action}
                      {h.detail ? <span className="text-muted"> · {h.detail}</span> : null}
                      <span className="qui d-block">{h.username}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted small mb-0">Aucune action journalisée.</p>
            )}
          </Section>
        </div>
      </div>

      {peutEditer ? (
        <ModalAction
          id="modal-membre"
          titre="Ajouter un membre"
          action={`${ici}/membres`}
          csrf={csrf}
          bouton="Créer le compte"
          icone="user-plus"
          aide="Un compte usager rattaché à cette organisation. Un mot de passe provisoire sera généré et affiché une seule fois ; la personne recevra aussi le courriel de bienvenue."
        >
          <Grille colonnes={2}>
            <Champ label="Prénom" name="first_name" id="m-first" requis />
            <Champ label="Nom" name="last_name" id="m-last" requis />
            <Champ label="Courriel" name="email" id="m-email" type="email" requis pleine />
            <Champ label="Téléphone" name="phone" id="m-phone" type="tel" />
            <Champ label="Fonction" name="fonction" id="m-fonction" placeholder="Trésorier…" />
          </Grille>
        </ModalAction>
      ) : null}
    </>
  );
}
