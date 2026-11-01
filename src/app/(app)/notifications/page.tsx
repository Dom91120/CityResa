import { Icone } from "@/components/icones";
import { PaginationBar, SegTabs, urlAvec, VideBloc } from "@/components/liste";
import { Chip } from "@/components/macros";
import { dateHeure, depuis } from "@/lib/libelles";
import { NOTIF_ICONES, pageBase } from "@/modules/admin/server";
import { prisma } from "@/server/db";
import { contextePage } from "@/server/page";
import { param, resolvePerPage } from "@/server/paging";

export const metadata = { title: "Notifications - CityRésa" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contextePage();
  const params = await searchParams;
  const vue = param(params, "vue") ?? "";
  const where = { userId: page.user.id, ...(vue === "non_lues" ? { readAt: null } : {}) };
  const [total, nonLues] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: page.user.id, readAt: null } }),
  ]);
  const perPage = await resolvePerPage(params, page.user, "notifications.list", 20);
  const { skip, take, p } = pageBase(params, total, perPage);
  const rows = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Notifications <span className="page-count">{total}</span>
          </h1>
          <p className="page-subtitle">
            {nonLues ? `${nonLues} non lue${nonLues > 1 ? "s" : ""}.` : "Tout est lu."}
          </p>
        </div>
        <div className="page-actions">
          {nonLues ? (
            <form method="POST" action="/notifications/lues">
              <input type="hidden" name="csrf_token" value={page.csrf} />
              <button type="submit" className="btn btn-outline-primary">
                <Icone nom="check-check" taille={14} /> Tout marquer lu
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <SegTabs
        tabs={[
          {
            href: urlAvec(page.pathname, page.search, { vue: null, page: null }),
            label: "Toutes",
            active: vue === "",
          },
          {
            href: urlAvec(page.pathname, page.search, { vue: "non_lues", page: null }),
            label: "Non lues",
            count: nonLues,
            active: vue === "non_lues",
          },
        ]}
      />
      {rows.length ? (
        <div className="data-card">
          {rows.map((n) => {
            const [ico, teinte] = NOTIF_ICONES[n.type] ?? NOTIF_ICONES.systeme;
            return (
              <div
                key={n.id}
                className={`notif${n.readAt ? "" : " non-lue"}`}
                style={{ padding: "12px 18px" }}
              >
                <span className={`notif-ico chip-${teinte}`}>
                  <Icone nom={ico} taille={14} />
                </span>
                <span className="notif-texte flex-grow-1" style={{ fontSize: ".86rem" }}>
                  <strong>{n.link ? <a href={n.link}>{n.title}</a> : n.title}</strong>
                  {n.body ? <span className="d-block text-muted">{n.body}</span> : null}
                  <small title={dateHeure(n.createdAt)}>{depuis(n.createdAt)}</small>
                </span>
                <span className="d-flex align-items-center gap-2">
                  {n.readAt ? null : <Chip teinte="rose">Nouveau</Chip>}
                  {n.readAt ? null : (
                    <form method="POST" action="/notifications/lues">
                      <input type="hidden" name="csrf_token" value={page.csrf} />
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        className="btn btn-ghost btn-icone btn-sm"
                        title="Marquer lue"
                        aria-label="Marquer lue"
                      >
                        <Icone nom="check" taille={14} />
                      </button>
                    </form>
                  )}
                  {n.link ? (
                    <a
                      href={n.link}
                      className="btn btn-ghost btn-icone btn-sm"
                      title="Ouvrir"
                      aria-label="Ouvrir"
                    >
                      <Icone nom="arrow-right" taille={14} />
                    </a>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <VideBloc
          icone="bell-off"
          titre={vue === "non_lues" ? "Aucune notification non lue" : "Aucune notification"}
          texte="Les nouvelles demandes, messages, signatures et rappels apparaîtront ici."
        />
      )}
      <PaginationBar p={p} pathname={page.pathname} search={page.search} />
    </>
  );
}
