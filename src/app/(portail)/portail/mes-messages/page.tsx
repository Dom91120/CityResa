import { Icone } from "@/components/icones";
import { Avatar, StatutResa } from "@/components/macros";
import { depuis } from "@/lib/libelles";
import { BlocVide } from "@/modules/portail/vues";
import { prisma } from "@/server/db";
import { contexteUsager } from "@/server/page";
import { whereUsager } from "@/server/reservations";

export const metadata = { title: "Mes messages - CityRésa" };

export default async function MesMessagesPage() {
  const page = await contexteUsager();
  const { user } = page;
  const dossiers = await prisma.reservation.findMany({
    where: { AND: [whereUsager(user), { messages: { some: { isInternal: false } } }] },
    include: {
      espace: { select: { name: true } },
      messages: {
        where: { isInternal: false },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { author: { select: { firstName: true, lastName: true } } },
      },
      _count: {
        select: {
          messages: { where: { isInternal: false, authorKind: "agent", readAt: null } },
        },
      },
    },
  });
  const fils = dossiers
    .filter((d) => d.messages.length)
    .sort((a, b) => b.messages[0].createdAt.getTime() - a.messages[0].createdAt.getTime());
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mes messages</h1>
          <p className="page-subtitle">Vos échanges avec la collectivité, dossier par dossier.</p>
        </div>
      </div>
      <div className="data-card">
        {fils.length ? (
          fils.map((d) => {
            const m = d.messages[0];
            const nonLus = d._count.messages;
            const auteur =
              m.authorKind === "agent"
                ? "La collectivité"
                : m.authorKind === "systeme"
                  ? "CityRésa"
                  : m.author
                    ? `${m.author.firstName} ${m.author.lastName}`.trim()
                    : "Vous";
            return (
              <a
                key={d.id}
                href={`/portail/mes-reservations/${d.id}#messages`}
                className="resa-carte"
                style={{ gridTemplateColumns: "auto 1fr auto", color: "inherit" }}
              >
                <Avatar nom={auteur} agent={m.authorKind === "agent"} />
                <div style={{ minWidth: 0 }}>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="titre">{d.title}</span>
                    <StatutResa status={d.status} />
                    {nonLus ? (
                      <span className="chip chip-rose">
                        {nonLus} nouveau{nonLus > 1 ? "x" : ""}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-muted small">
                    {d.numero} · {d.espace.name}
                  </div>
                  <div
                    className={`mt-1 ${nonLus ? "fw-semibold" : "text-muted"}`}
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {auteur} : {m.body}
                  </div>
                </div>
                <div className="droite text-muted small">
                  {depuis(m.createdAt)}
                  <Icone nom="chevron-right" taille={16} />
                </div>
              </a>
            );
          })
        ) : (
          <BlocVide
            icone="message-circle"
            titre="Aucun message"
            texte="Les échanges avec la collectivité se font depuis la fiche de chaque réservation, dans la section « Messages »."
            action={
              <a href="/portail/mes-reservations" className="btn btn-outline-primary">
                Mes réservations
              </a>
            }
          />
        )}
      </div>
    </>
  );
}
