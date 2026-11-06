import { notFound } from "next/navigation";
import {
  BoutonOuvrir,
  Entete,
  Lu,
  Lus,
  MenuPost,
  MenuSep,
  ModalAction,
  Section,
} from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import { dateHeure, plage } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { nomPersonne } from "@/lib/personnel";
import { prisma } from "@/server/db";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";
import { chargerPersonne, couleurLibre } from "@/server/personnel";
import { ChampsPersonne } from "../page";

export const metadata = { title: "Personne de service - CityRésa" };

export default async function PersonnePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("personnel", "personnel");
  const id = idDeRoute((await params).id);
  const p = await chargerPersonne(id);
  if (!p) notFound();
  const now = new Date();
  const [aVenir, passees, epingles, couleur] = await Promise.all([
    prisma.vacation.findMany({
      where: { personnelId: id, endAt: { gte: now } },
      include: { site: { select: { name: true } } },
      orderBy: { startAt: "asc" },
      take: 30,
    }),
    prisma.vacation.count({ where: { personnelId: id, endAt: { lt: now } } }),
    prisma.creneau.findMany({
      where: { personnelId: id, status: "prevu", endAt: { gte: now } },
      include: {
        reservation: { select: { id: true, numero: true, title: true } },
        espace: { select: { name: true, site: { select: { name: true } } } },
      },
      orderBy: { startAt: "asc" },
      take: 30,
    }),
    couleurLibre(),
  ]);
  const { csrf, user } = page;
  const peutEditer = user.canEdit("personnel");
  const peutSupprimer = user.canDelete("personnel");
  const fiche = `/personnel/personnes/${id}`;
  const nom = nomPersonne(p);
  const lienIcs = p.icsToken ? `${user.settings.APP_BASE_URL}/ics/personnel/${p.icsToken}` : null;
  return (
    <>
      <Entete
        titre={
          <span className="d-inline-flex align-items-center gap-2">
            <span className="pastille-espace" style={{ background: p.color ?? "var(--faint)" }} />
            {nom}
          </span>
        }
        sousTitre={p.fonction ?? "Personnel de service"}
        retour="/personnel/personnes"
        badges={
          p.isActive ? null : (
            <Chip teinte="slate" classes="ms-2">
              Plus en service
            </Chip>
          )
        }
        actions={
          <>
            <a href={`/personnel?personne=${p.id}`} className="btn btn-outline-secondary">
              <Icone nom="calendar-days" taille={14} /> Son planning
            </a>
            {peutEditer ? (
              <BoutonOuvrir cible="modal-modifier" libelle="Modifier" icone="pencil" />
            ) : null}
          </>
        }
        menu={
          peutEditer
            ? [
                p.email ? (
                  <MenuPost
                    key="envoyer"
                    url={`${fiche}/envoyer_planning`}
                    csrf={csrf}
                    libelle="Envoyer son planning de la semaine"
                    icone="send"
                    champs={{ date: todayParisISO() }}
                  />
                ) : null,
                <MenuPost
                  key="actif"
                  url={`${fiche}/${p.isActive ? "desactiver" : "reactiver"}`}
                  csrf={csrf}
                  libelle={p.isActive ? "Plus en service" : "Remettre en service"}
                  icone={p.isActive ? "user-x" : "user-check"}
                />,
                peutSupprimer ? <MenuSep key="sep" /> : null,
                peutSupprimer ? (
                  <MenuPost
                    key="supprimer"
                    url={`${fiche}/supprimer`}
                    csrf={csrf}
                    libelle="Supprimer"
                    icone="trash-2"
                    danger
                    confirm={`Supprimer ${nom} et toutes ses vacations ?`}
                  />
                ) : null,
              ]
            : undefined
        }
      />

      <div className="fiche-colonnes">
        <div className="d-flex flex-column gap-3">
          <div className="data-card">
            <Section titre="Identité" icone="id-card">
              <Lus intitule="110px">
                <Lu label="Fonction" valeur={p.fonction} tiret />
                <Lu label="Courriel" valeur={p.email} tiret />
                <Lu label="Téléphone" valeur={p.phone} tiret />
                <Lu label="Note" valeur={p.note} pleine pre />
                <Lu label="Ajouté le" valeur={dateHeure(p.createdAt)} />
              </Lus>
            </Section>
            <Section titre="Calendrier (ICS)" icone="calendar" ouverte={!!lienIcs}>
              {lienIcs ? (
                <>
                  <p className="small text-muted mb-2">
                    À coller dans l'agenda de la personne (Outlook, Google Agenda, téléphone) : ses
                    vacations et les créneaux où elle est épinglée s'y mettent à jour seuls.
                  </p>
                  <code className="d-block mb-2" style={{ wordBreak: "break-all" }}>
                    {lienIcs}
                  </code>
                  {peutEditer ? (
                    <form method="POST" action={`${fiche}/ics_revoquer`} className="d-inline">
                      <input type="hidden" name="csrf_token" value={csrf} />
                      <button
                        type="submit"
                        className="btn btn-outline-danger btn-sm"
                        data-confirm="Révoquer ce lien ? L'agenda de la personne cessera de se mettre à jour."
                      >
                        <Icone nom="x" taille={14} /> Révoquer le lien
                      </button>
                    </form>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="small text-muted mb-2">
                    Aucun lien d'agenda. Générez-en un pour que la personne suive ses vacations dans
                    son propre calendrier.
                  </p>
                  {peutEditer ? (
                    <form method="POST" action={`${fiche}/ics_generer`} className="d-inline">
                      <input type="hidden" name="csrf_token" value={csrf} />
                      <button type="submit" className="btn btn-outline-secondary btn-sm">
                        <Icone nom="link" taille={14} /> Générer le lien ICS
                      </button>
                    </form>
                  ) : null}
                </>
              )}
            </Section>
          </div>
        </div>
        <div className="data-card">
          <Section titre="Vacations à venir" icone="calendar-clock" nb={aVenir.length}>
            {aVenir.length ? (
              <table className="table table-sm mb-2">
                <tbody>
                  {aVenir.map((v) => (
                    <tr key={v.id}>
                      <td className="text-nowrap">{plage(v.startAt, v.endAt)}</td>
                      <td>{v.site.name}</td>
                      <td className="text-muted small">
                        {v.note}
                        {v.serieId ? (
                          <span title="Vacation d'une série hebdomadaire">
                            {v.note ? " · " : ""}
                            <Icone nom="repeat" taille={12} /> chaque semaine
                          </span>
                        ) : null}
                      </td>
                      <td className="actions text-nowrap">
                        {peutEditer ? (
                          <a
                            href={`/personnel/vacations/${v.id}`}
                            className="btn btn-ghost btn-icone btn-sm"
                            title="Modifier cette vacation"
                            aria-label="Modifier cette vacation"
                          >
                            <Icone nom="pencil" taille={14} />
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted small mb-2">Aucune vacation à venir.</p>
            )}
            <p className="small text-muted mb-0">
              {passees} vacation{passees > 1 ? "s" : ""} passée{passees > 1 ? "s" : ""}.
            </p>
          </Section>
          <Section
            titre="Créneaux épinglés"
            icone="bookmark"
            nb={epingles.length}
            ouverte={epingles.length > 0}
          >
            {epingles.length ? (
              <table className="table table-sm mb-0">
                <tbody>
                  {epingles.map((c) => (
                    <tr key={c.id}>
                      <td className="text-nowrap">{plage(c.startAt, c.endAt)}</td>
                      <td>
                        <a href={`/reservations/${c.reservation.id}`}>{c.reservation.title}</a>
                        <div className="small text-muted">
                          {c.reservation.numero} · {c.espace.name} ({c.espace.site.name})
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted small mb-0">
                Aucun créneau épinglé : on épingle une personne sur un créneau précis depuis la
                fiche de la réservation.
              </p>
            )}
          </Section>
        </div>
      </div>

      {peutEditer ? (
        <ModalAction
          id="modal-modifier"
          titre="Modifier la fiche"
          action={`${fiche}/modifier`}
          csrf={csrf}
          icone="pencil"
        >
          <ChampsPersonne p={p} couleur={couleur} />
        </ModalAction>
      ) : null}
    </>
  );
}
