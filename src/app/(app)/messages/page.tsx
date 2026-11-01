import { Icone } from "@/components/icones";
import { Barre, PaginationBar, SegTabs, urlAvec, VideBloc } from "@/components/liste";
import { Avatar, Chip, PastilleEspace, StatutResa, TypeOrganisation } from "@/components/macros";
import { ScriptDiffere } from "@/components/scripts";
import { dateMoyenne, depuis, nomCourt } from "@/lib/libelles";
import { auteurDe, conversations } from "@/modules/messages/server";
import { contexteModule } from "@/server/module";
import { paginate, param, resolvePerPage } from "@/server/paging";

export const metadata = { title: "Messages - CityRésa" };

function extrait(texte: string, max = 140): string {
  const t = texte.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteModule("messages");
  const params = await searchParams;
  const q = (param(params, "q") ?? "").trim();
  const onglet = param(params, "onglet") === "nonlus" ? "nonlus" : "tous";
  const toutes = await conversations(page.user, q);
  const nonLues = toutes.filter((c) => c.nonLus > 0);
  const liste = onglet === "nonlus" ? nonLues : toutes;
  const perPage = await resolvePerPage(params, page.user, "messages.list");
  const [rows, p] = paginate(liste, params, perPage);
  const totalNonLus = nonLues.reduce((s, c) => s + c.nonLus, 0);
  const retour = `${page.pathname}${page.search.toString() ? `?${page.search.toString()}` : ""}`;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Messages <span className="page-count">{toutes.length}</span>
          </h1>
          <p className="page-subtitle">
            {totalNonLus
              ? `${totalNonLus} message${totalNonLus > 1 ? "s" : ""} d'usagers sans réponse, dans ${nonLues.length} dossier${nonLues.length > 1 ? "s" : ""}.`
              : "Tous les messages des usagers ont été lus."}
          </p>
        </div>
        <div className="page-actions">
          {totalNonLus && page.user.canEdit("messages") ? (
            <form method="POST" action="/messages/tout-lu">
              <input type="hidden" name="csrf_token" value={page.csrf} />
              <input type="hidden" name="next" value={retour} />
              <button
                type="submit"
                className="btn btn-outline-secondary btn-sm"
                data-confirm={`Marquer lus les ${totalNonLus} messages non lus ?`}
              >
                <Icone nom="check-check" taille={14} /> Tout marquer lu
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <SegTabs
        tabs={[
          {
            href: urlAvec(page.pathname, page.search, { onglet: "nonlus", page: null }),
            label: "Non lus",
            count: nonLues.length,
            active: onglet === "nonlus",
          },
          {
            href: urlAvec(page.pathname, page.search, { onglet: null, page: null }),
            label: "Tous",
            count: toutes.length,
            active: onglet === "tous",
            teinte: "muted",
          },
        ]}
      />
      <Barre
        q={q}
        pathname={page.pathname}
        search={page.search}
        placeholder="Numéro, titre, organisation, espace, texte…"
        hidden={{ onglet: onglet === "nonlus" ? "nonlus" : null }}
      />

      <div className="data-card">
        {rows.length ? (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Dossier</th>
                  <th>Dernier message</th>
                  <th className="text-end">Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const r = c.reservation;
                  const lien = `/reservations/${r.id}#discussion`;
                  return (
                    <tr key={r.id} className={c.nonLus ? "fw-medium" : undefined}>
                      <td style={{ maxWidth: 320 }}>
                        <span className="d-flex align-items-center gap-2">
                          <PastilleEspace couleur={r.espace.color} />
                          <span className="cell2">
                            <a href={lien} style={{ color: "var(--strong)" }}>
                              {r.numero} · {r.title}
                            </a>
                            <small>
                              {nomCourt(r.espace)} · {dateMoyenne(r.startAt)}
                              {r.organisation ? ` · ${r.organisation.name}` : ""}
                            </small>
                          </span>
                          <StatutResa status={r.status} />
                        </span>
                      </td>
                      <td style={{ maxWidth: 460 }}>
                        <span className="d-flex align-items-start gap-2">
                          <Avatar
                            nom={auteurDe(c.dernier)}
                            taille="sm"
                            agent={c.dernier.authorKind === "agent"}
                          />
                          <span className="cell2">
                            <span>
                              <span style={{ color: "var(--strong)" }}>{auteurDe(c.dernier)}</span>
                              {c.dernier.authorKind === "usager" ? (
                                <TypeOrganisation type={r.organisation?.type ?? null} />
                              ) : null}
                              {c.nonLus ? (
                                <Chip teinte="rose" classes="ms-2">
                                  {c.nonLus} non lu{c.nonLus > 1 ? "s" : ""}
                                </Chip>
                              ) : null}
                            </span>
                            <small style={{ whiteSpace: "normal" }}>
                              {extrait(c.dernier.body)}
                            </small>
                          </span>
                        </span>
                      </td>
                      <td className="text-end text-nowrap text-muted small">
                        {depuis(c.dernier.createdAt)}
                        <small className="d-block">
                          {c.total} message{c.total > 1 ? "s" : ""}
                        </small>
                      </td>
                      <td className="actions">
                        <a
                          href={lien}
                          className={`btn btn-sm ${c.nonLus ? "btn-primary" : "btn-outline-secondary"}`}
                        >
                          {c.nonLus ? "Répondre" : "Ouvrir"}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <VideBloc
            icone={onglet === "nonlus" ? "circle-check" : "message-circle"}
            titre={
              q
                ? "Aucune conversation ne correspond"
                : onglet === "nonlus"
                  ? "Aucun message en attente de réponse"
                  : "Aucune conversation"
            }
            texte={
              q
                ? "Essayez un autre mot-clé."
                : onglet === "nonlus"
                  ? "Les messages des usagers que vous n'avez pas encore lus apparaîtront ici."
                  : "Les échanges avec les usagers se font depuis le fil de discussion de chaque dossier."
            }
            action={
              onglet === "nonlus" && toutes.length ? (
                <a
                  href={urlAvec(page.pathname, page.search, { onglet: null })}
                  className="btn btn-outline-secondary btn-sm"
                >
                  Voir toutes les conversations
                </a>
              ) : null
            }
          />
        )}
      </div>
      <PaginationBar p={p} pathname={page.pathname} search={page.search} />
      <ScriptDiffere src="/js/reservations.js" nonce={page.nonce} />
    </>
  );
}
