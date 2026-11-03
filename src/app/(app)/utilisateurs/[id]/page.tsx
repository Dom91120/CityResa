import { notFound } from "next/navigation";
import { Entete, Lu, Lus, MenuPost, MenuSep, Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Chip, OuiNon } from "@/components/macros";
import { ROLE_LABELS } from "@/lib/constantes";
import { dateHeure, depuis, nomCourt } from "@/lib/libelles";
import { contexteAdmin } from "@/modules/admin/server";
import { donneesLiees, espacesGeresPar, nomComplet } from "@/modules/utilisateurs/server";
import { prisma } from "@/server/db";

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
  const [role, liees, espaces, journal] = await Promise.all([
    prisma.role.findUnique({ where: { name: u.role } }),
    donneesLiees(id),
    u.kind === "agent" ? espacesGeresPar(id) : Promise.resolve([]),
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
  return (
    <>
      <Entete
        titre={nom}
        retour="/utilisateurs"
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

      <div className="fiche-colonnes">
        <div className="data-card overflow-visible">
          <Section titre="Compte" icone="circle-user">
            <Lus>
              <Lu
                label="Nature"
                valeur={u.kind === "agent" ? "Agent de la collectivité" : "Usager du portail"}
              />
              <Lu label="Rôle" valeur={role?.label ?? u.role} />
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
            <Lus>
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
                  rôle. Le périmètre se règle depuis <a href="/equipe">Mon équipe</a>.
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
