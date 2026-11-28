import { notFound } from "next/navigation";
import { Entete, Lu, Lus, MenuPost, MenuSep, Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Chip, OuiNon } from "@/components/macros";
import {
  CATEGORY_LABELS,
  PERMISSION_CATEGORIES,
  PERMISSION_LEVELS,
  ROLE_LABELS,
} from "@/lib/constantes";
import { ecarts, lireNiveaux, resumeEcarts as resumerEcarts, TEINTES_NIVEAU } from "@/lib/droits";
import { dateHeure, depuis, nomCourt } from "@/lib/libelles";
import { libelleSecteur } from "@/lib/secteurs";
import { contexteAdmin } from "@/modules/admin/server";
import { donneesLiees, espacesGeresPar, nomComplet } from "@/modules/utilisateurs/server";
import { prisma } from "@/server/db";
import { libelleRattachement, rattachementsDe } from "@/server/services";

export const metadata = { title: "Compte - CityRésa" };

export default async function UtilisateurPage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteAdmin();
  const { id } = await params;
  const u = await prisma.user.findUnique({
    where: { id },
    include: {
      organisation: { select: { id: true, name: true } },
      _count: { select: { sessions: true, notifications: true } },
    },
  });
  if (!u) notFound();
  const [role, liees, espaces, services, journal] = await Promise.all([
    prisma.role.findUnique({ where: { name: u.role } }),
    donneesLiees(id),
    u.kind === "agent" ? espacesGeresPar(id) : Promise.resolve([]),
    u.kind === "agent" && page.features.processus ? rattachementsDe(id) : Promise.resolve([]),
    prisma.actionLog.findMany({
      where: { OR: [{ username: u.email }, { detail: { contains: u.email } }] },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const { csrf } = page;
  const ici = `/utilisateurs/${id}`;
  const soiMeme = u.id === page.user.id;
  const nom = nomComplet(u);
  const supprimable = !liees.length && !soiMeme;
  // Les droits du rôle et ce qui en diffère sur ce compte (src/lib/droits.ts).
  const droitsRole = lireNiveaux(role?.permissions);
  const ecartsDroits =
    u.kind === "agent" && role && !role.isAdmin
      ? ecarts(droitsRole, lireNiveaux(u.permissions))
      : [];
  const resumeEcarts = resumerEcarts(ecartsDroits);
  return (
    <>
      <Entete
        titre={nom}
        retour={
          u.kind === "agent"
            ? "/utilisateurs"
            : u.organisation
              ? `/usagers/${u.organisation.id}#membres`
              : "/usagers"
        }
        sousTitre={
          <>
            {u.email}
            {u.fonction ? ` · ${u.fonction}` : ""}
          </>
        }
        badges={
          <>
            <Chip
              teinte={u.kind === "usager" ? "amber" : u.role === "admin" ? "rose" : "sky"}
              classes="ms-2"
            >
              {role?.label ?? ROLE_LABELS[u.role] ?? u.role}
            </Chip>
            {ecartsDroits.length ? (
              <a href="#droits" className="chip chip-amber ms-1" title={resumeEcarts}>
                Droits personnalisés
              </a>
            ) : null}
            {!u.isActive ? (
              <Chip teinte="slate" classes="ms-1">
                Inactif
              </Chip>
            ) : null}
          </>
        }
        actions={
          <a href={`${ici}/modifier`} className="btn btn-outline-secondary">
            <Icone nom="pencil" taille={14} /> Modifier
          </a>
        }
        menu={[
          u.isActive ? (
            <MenuPost
              key="reinit"
              url={`${ici}/reinitialiser`}
              csrf={csrf}
              libelle="Envoyer un lien de réinitialisation"
              icone="key-round"
              confirm={`Envoyer un lien de réinitialisation du mot de passe à ${u.email} ?`}
            />
          ) : null,
          u.twoFactorEnabled ? (
            <MenuPost
              key="2fa"
              url={`${ici}/reset-2fa`}
              csrf={csrf}
              libelle="Réinitialiser la double authentification"
              icone="shield"
              confirm="Désactiver la 2FA de ce compte ? La personne devra la réactiver depuis son profil."
            />
          ) : null,
          !soiMeme ? (
            <MenuPost
              key="actif"
              url={`${ici}/actif`}
              csrf={csrf}
              libelle={u.isActive ? "Désactiver le compte" : "Réactiver le compte"}
              icone={u.isActive ? "ban" : "refresh-cw"}
              danger={u.isActive}
              confirm={
                u.isActive
                  ? `Désactiver le compte de ${nom} ? Ses sessions seront fermées.`
                  : undefined
              }
            />
          ) : null,
          supprimable ? <MenuSep key="sep" /> : null,
          supprimable ? (
            <MenuPost
              key="supprimer"
              url={`${ici}/supprimer`}
              csrf={csrf}
              libelle="Supprimer définitivement"
              icone="trash-2"
              danger
              confirm={`Supprimer définitivement le compte de ${nom} ? Cette action est irréversible.`}
            />
          ) : null,
        ]}
      />

      <div className="fiche-colonnes fiche-colonnes--6-5">
        <div className="data-card overflow-visible">
          <Section titre="Compte" icone="circle-user">
            <Lus intitule="83px">
              <Lu
                label="Nature"
                valeur={u.kind === "agent" ? "Agent de la collectivité" : "Usager du portail"}
              />
              <Lu label="Rôle" valeur={role?.label ?? u.role} />
              {u.kind === "agent" ? (
                <Lu label="Secteur" valeur={libelleSecteur(u.secteur)} />
              ) : null}
              {u.kind === "agent" && page.features.processus ? (
                <Lu
                  label={services.length > 1 ? "Services" : "Service"}
                  valeur={
                    services.length ? (
                      <span className="coches">
                        {services.map((s) => (
                          <a key={s.id} href="/processus" className="chip chip-emerald">
                            {s.name}
                            <span className="text-faint"> ({libelleRattachement(s)})</span>
                          </a>
                        ))}
                      </span>
                    ) : (
                      "Aucun"
                    )
                  }
                />
              ) : null}
              <Lu label="Courriel" valeur={<a href={`mailto:${u.email}`}>{u.email}</a>} />
              <Lu label="Téléphone" valeur={u.phone} tiret />
              <Lu label="Fonction" valeur={u.fonction} tiret />
              <Lu
                label="Organisation"
                valeur={
                  u.organisation ? (
                    <a href={`/usagers/${u.organisation.id}`}>{u.organisation.name}</a>
                  ) : null
                }
              />
              <Lu label="Actif" valeur={<OuiNon v={u.isActive} />} />
              <Lu label="Créé le" valeur={dateHeure(u.createdAt)} />
              <Lu
                label="Dernière connexion"
                valeur={
                  u.lastLoginAt
                    ? `${dateHeure(u.lastLoginAt)} (${depuis(u.lastLoginAt)})`
                    : "Jamais"
                }
              />
              <Lu
                label="CGU acceptées le"
                valeur={u.acceptedCguAt ? dateHeure(u.acceptedCguAt) : null}
              />
              <Lu label="Sessions ouvertes" valeur={String(u._count.sessions)} />
            </Lus>
          </Section>

          <Section titre="Sécurité" icone="shield-check">
            <Lus intitule="80px">
              <Lu label="Double authentification" valeur={<OuiNon v={u.twoFactorEnabled} />} />
              <Lu
                label="Verrouillage 2FA"
                valeur={
                  u.totpLockedUntil && u.totpLockedUntil > new Date()
                    ? `Jusqu'au ${dateHeure(u.totpLockedUntil)}`
                    : null
                }
              />
              <Lu label="Notifications par courriel" valeur={<OuiNon v={u.notifEmail} />} />
              <Lu label="Lien ICS personnel" valeur={<OuiNon v={Boolean(u.icsToken)} />} />
            </Lus>
          </Section>

          {u.kind === "agent" ? (
            <Section titre="Droits" icone="key-round" id="droits" nb={ecartsDroits.length || null}>
              {role?.isAdmin ? (
                <p className="text-muted small mb-0">
                  Un administrateur a tous les droits : rien à personnaliser.
                </p>
              ) : (
                <form method="POST" action={`${ici}/droits`} data-double-envoi>
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <p className="text-muted small mb-2">
                    Ce compte a les droits de son rôle, <strong>{role?.label ?? u.role}</strong>.
                    Vous pouvez y déroger domaine par domaine, pour ouvrir ou pour retirer un accès
                    ; ce qui reste sur « Comme le rôle » suivra le rôle s'il change.
                  </p>
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-2">
                      <thead>
                        <tr>
                          <th>Domaine</th>
                          <th>Rôle</th>
                          <th>Ce compte</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PERMISSION_CATEGORIES.map((c) => {
                          const duRole = droitsRole[c] ?? 0;
                          const derogation = ecartsDroits.find((e) => e.categorie === c);
                          return (
                            <tr key={c}>
                              <td>
                                <label htmlFor={`droit-${c}`} className="mb-0">
                                  {CATEGORY_LABELS[c]}
                                </label>
                              </td>
                              <td>
                                <Chip teinte={TEINTES_NIVEAU[duRole]}>
                                  {PERMISSION_LEVELS[duRole]}
                                </Chip>
                              </td>
                              <td>
                                <select
                                  name={`droit_${c}`}
                                  id={`droit-${c}`}
                                  className={`form-select form-select-sm${derogation ? " border-warning" : ""}`}
                                  style={{ minWidth: 150 }}
                                  defaultValue={derogation ? String(derogation.compte) : ""}
                                >
                                  <option value="">Comme le rôle</option>
                                  {[0, 1, 2, 3]
                                    .filter((n) => n !== duRole)
                                    .map((n) => (
                                      <option key={n} value={n}>
                                        {PERMISSION_LEVELS[n]}
                                      </option>
                                    ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <button type="submit" className="btn btn-primary btn-sm">
                      <Icone nom="check" taille={14} /> Enregistrer les droits
                    </button>
                    {ecartsDroits.length ? (
                      // Formulaire à part (plus bas) : la confirmation renvoie un formulaire
                      // entier, sans dire quel bouton l'a déclenchée.
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        data-confirm={`Rendre à ${nom} les droits de son rôle, sans aucune dérogation ?`}
                        data-confirm-form="#form-droits-retablir"
                      >
                        <Icone nom="rotate-ccw" taille={14} /> Revenir aux droits du rôle
                      </button>
                    ) : null}
                  </div>
                  <p className="text-muted small mt-2 mb-0">
                    Le secteur, les espaces en charge et les services du compte continuent de
                    s'appliquer : ces droits disent ce qu'il peut faire, pas sur quoi.
                  </p>
                </form>
              )}
            </Section>
          ) : null}

          {u.kind === "agent" ? (
            <Section titre="Espaces en charge" icone="door-open" nb={espaces.length}>
              {espaces.length ? (
                <div className="coches">
                  {espaces.map((g) => (
                    <a
                      key={g.espaceId}
                      href={`/espaces/${g.espaceId}`}
                      className="chip chip-violet"
                    >
                      {nomCourt(g.espace)} · {g.espace.site.name}
                      <span className="text-faint"> ({g.role})</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-muted small mb-0">
                  Aucun périmètre restreint : l'agent intervient sur tous les espaces selon son
                  rôle. Le périmètre se règle depuis <a href="/utilisateurs">Comptes</a> (icône de
                  porte).
                </p>
              )}
            </Section>
          ) : null}
        </div>

        <div className="data-card overflow-visible">
          <Section titre="Données liées" icone="database">
            {liees.length ? (
              <>
                <ul className="mb-2 small">
                  {liees.map((l) => (
                    <li key={l.label}>
                      <strong>{l.n}</strong> {l.label}
                    </li>
                  ))}
                </ul>
                <p className="text-muted small mb-0">
                  Ce compte ne peut pas être supprimé : désactivez-le pour en bloquer l'accès.
                </p>
              </>
            ) : (
              <p className="text-muted small mb-0">
                Aucune donnée liée : le compte peut être supprimé définitivement.
              </p>
            )}
          </Section>

          {ecartsDroits.length ? (
            <form
              method="POST"
              action={`${ici}/droits`}
              id="form-droits-retablir"
              className="d-none"
              aria-hidden="true"
            >
              <input type="hidden" name="csrf_token" value={csrf} />
              <input type="hidden" name="retablir" value="1" />
            </form>
          ) : null}

          <Section titre="Journal" icone="history" nb={journal.length} ouverte={false}>
            {journal.length ? (
              <ul className="historique list-unstyled mb-0">
                {journal.map((h) => (
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
    </>
  );
}
