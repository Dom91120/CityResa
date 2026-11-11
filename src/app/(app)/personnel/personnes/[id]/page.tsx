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
import { heuresAttendues, heuresDuCycle, libellePlages, plagesDuJour } from "@/lib/affectation";
import { JOURS_ISO } from "@/lib/constantes";
import { lireHoraires } from "@/lib/creneaux";
import { dateCourte, dateHeure, plage } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { libelleAbsence, nomPersonne } from "@/lib/personnel";
import { ChampsAbsence, ChampsContrat } from "@/modules/personnel/vues";
import { prisma } from "@/server/db";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";
import {
  absencesDe,
  chargerPersonneComplete,
  couleurLibre,
  referentiel,
  sitesDuPerimetre,
} from "@/server/personnel";
import { ChampsPersonne } from "../page";

export const metadata = { title: "Personne de service - CityRésa" };

export default async function PersonnePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("personnel", "personnel");
  const id = idDeRoute((await params).id);
  const p = await chargerPersonneComplete(id);
  if (!p) notFound();
  const now = new Date();
  const [aVenir, passees, epingles, proposes, absences, couleur, types, motifs, sites] =
    await Promise.all([
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
      prisma.creneau.count({
        where: {
          personnelProposeId: id,
          proposeAt: { not: null },
          status: "prevu",
          endAt: { gte: now },
        },
      }),
      absencesDe(id, new Date(now.getTime() - 30 * 86_400_000)),
      couleurLibre(),
      referentiel("contrat_type"),
      referentiel("absence_motif"),
      sitesDuPerimetre(page.user),
    ]);
  const { csrf, user } = page;
  const peutEditer = user.canEdit("personnel");
  const peutSupprimer = user.canDelete("personnel");
  const fiche = `/personnel/personnes/${id}`;
  const nom = nomPersonne(p);
  const lienIcs = p.icsToken ? `${user.settings.APP_BASE_URL}/ics/personnel/${p.icsToken}` : null;
  const horaires = lireHoraires(p.horaires);
  const heuresCycle = heuresDuCycle(horaires);
  const attendues = heuresAttendues({
    quotite: p.quotite,
    heuresHebdo: p.heuresHebdo === null ? null : Number(p.heuresHebdo),
  });
  const ecart = horaires ? Math.round((heuresCycle - attendues) * 10) / 10 : 0;
  const aujourdhui = todayParisISO();
  return (
    <>
      <Entete
        titre={
          <span className="d-inline-flex align-items-center gap-2">
            <span className="pastille-espace" style={{ background: p.color ?? "var(--faint)" }} />
            {nom}
          </span>
        }
        sousTitre={[
          p.fonction ?? "Personnel de service",
          p.contratType ? `${p.contratType.label} · ${p.quotite} %` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
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
              <BoutonOuvrir
                cible="modal-absence"
                libelle="Ajouter une absence"
                icone="calendar-x"
                classe="btn-outline-secondary"
              />
            ) : null}
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
                  confirm={
                    p.isActive
                      ? `${nom} ne sera plus proposé(e) ; ses affectations à venir seront retirées. Continuer ?`
                      : undefined
                  }
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
              <Lus intitule="68px">
                <Lu label="Fonction" valeur={p.fonction} tiret />
                <Lu label="Courriel" valeur={p.email} tiret />
                <Lu label="Téléphone" valeur={p.phone} tiret />
                <Lu label="Note" valeur={p.note} pleine pre />
                <Lu label="Ajouté le" valeur={dateHeure(p.createdAt)} />
              </Lus>
            </Section>
            <Section titre="Contrat et temps de travail" icone="briefcase">
              <Lus intitule="68px">
                <Lu label="Contrat" valeur={p.contratType?.label} tiret />
                <Lu
                  label="Quotité"
                  valeur={`${p.quotite} %${p.heuresHebdo !== null ? ` · ${String(p.heuresHebdo).replace(".", ",")} h / semaine` : ""}`}
                />
                <Lu
                  label="Période"
                  valeur={
                    p.contratDebut || p.contratFin
                      ? `${p.contratDebut ? `du ${dateCourte(p.contratDebut)}` : ""}${p.contratFin ? ` au ${dateCourte(p.contratFin)}` : " sans terme"}`.trim()
                      : null
                  }
                  tiret
                />
                <Lu
                  label="Horaires"
                  valeur={
                    horaires ? (
                      <>
                        <table
                          className="table table-sm mb-1 table-compacte"
                          style={{ maxWidth: 420 }}
                        >
                          <tbody>
                            {JOURS_ISO.map((j) => {
                              const plages = plagesDuJour(horaires, j.iso);
                              return (
                                <tr key={j.iso}>
                                  <td className="text-muted text-nowrap" style={{ width: "1%" }}>
                                    {j.long}
                                  </td>
                                  <td>
                                    {plages.length ? (
                                      libellePlages(plages)
                                    ) : (
                                      <span className="text-faint">Repos</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <span className="small text-muted">
                          {String(heuresCycle).replace(".", ",")} h par semaine
                          {ecart ? (
                            <Chip
                              teinte="amber"
                              classes="ms-2"
                              titre="Écart avec la quotité (information)"
                            >
                              {ecart > 0 ? "+" : ""}
                              {String(ecart).replace(".", ",")} h par rapport aux{" "}
                              {String(attendues).replace(".", ",")} h attendues
                            </Chip>
                          ) : null}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">
                        Pas de cycle fixe : affectable à toute heure, hors absences.
                      </span>
                    )
                  }
                  pleine
                />
              </Lus>
            </Section>
            <Section titre="Sites d'intervention" icone="map-pin" nb={p.sites.length}>
              {p.sites.length ? (
                <div className="d-flex flex-wrap gap-1">
                  {p.sites.map((s) => (
                    <Chip
                      key={s.siteId}
                      teinte={s.principal ? "emerald" : "slate"}
                      titre={s.principal ? "Site principal" : undefined}
                    >
                      {s.principal ? <Icone nom="star" taille={11} /> : null} {s.site.name}
                    </Chip>
                  ))}
                </div>
              ) : (
                <p className="text-muted small mb-0">
                  Aucun site : la personne ne peut pas être affectée. Cochez ses sites dans «
                  Modifier ».
                </p>
              )}
            </Section>
            <Section titre="Calendrier (ICS)" icone="calendar" ouverte={!!lienIcs}>
              {lienIcs ? (
                <>
                  <p className="small text-muted mb-2">
                    À coller dans l'agenda de la personne (Outlook, Google Agenda, téléphone) : ses
                    vacations et les créneaux où elle est affectée s'y mettent à jour seuls.
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
          <Section titre="Absences" icone="calendar-x" nb={absences.length}>
            {absences.length ? (
              <table className="table table-sm mb-2">
                <tbody>
                  {absences.map((a) => (
                    <tr key={a.id} className={a.endAt < now ? "text-muted" : undefined}>
                      <td className="text-nowrap">{libelleAbsence(a)}</td>
                      <td>
                        {a.motif ? (
                          <Chip teinte="amber">
                            {a.motif.icon ? <Icone nom={a.motif.icon} taille={11} /> : null}{" "}
                            {a.motif.label}
                          </Chip>
                        ) : (
                          <span className="text-faint">Sans motif</span>
                        )}
                      </td>
                      <td className="text-muted small">{a.note}</td>
                      <td className="actions text-nowrap">
                        {peutEditer ? (
                          <form
                            method="POST"
                            action={`${fiche}/absences_supprimer`}
                            className="d-inline"
                          >
                            <input type="hidden" name="csrf_token" value={csrf} />
                            <input type="hidden" name="absence_id" value={a.id} />
                            <button
                              type="submit"
                              className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                              title="Supprimer cette absence"
                              aria-label="Supprimer cette absence"
                              data-confirm={`Supprimer l'absence du ${plage(a.startAt, a.endAt)} ?`}
                            >
                              <Icone nom="x" taille={14} />
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted small mb-2">Aucune absence récente ou à venir.</p>
            )}
            <p className="small text-muted mb-0">
              Une absence retire la personne des créneaux où elle était affectée ou proposée ; ils
              repassent en affectation.
            </p>
          </Section>
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
            titre="Créneaux affectés"
            icone="bookmark"
            nb={epingles.length}
            ouverte={epingles.length > 0}
          >
            {epingles.length ? (
              <table className="table table-sm mb-2">
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
              <p className="text-muted small mb-2">
                Aucun créneau affecté : l'affectation se fait automatiquement ou sur proposition
                (planning de service), ou à la main depuis la fiche de la réservation.
              </p>
            )}
            {proposes ? (
              <p className="small text-muted mb-0">
                <a href="/personnel?onglet=propositions">
                  {proposes} proposition{proposes > 1 ? "s" : ""} en attente de validation
                </a>
                .
              </p>
            ) : null}
          </Section>
        </div>
      </div>

      {peutEditer ? (
        <>
          <ModalAction
            id="modal-modifier"
            titre="Modifier la fiche"
            action={`${fiche}/modifier`}
            csrf={csrf}
            icone="pencil"
            taille="lg"
          >
            <ChampsPersonne p={p} couleur={couleur} />
            <ChampsContrat p={p} types={types} sites={sites} />
          </ModalAction>
          <ModalAction
            id="modal-absence"
            titre={`Ajouter une absence · ${nom}`}
            action={`${fiche}/absences_ajouter`}
            csrf={csrf}
            bouton="Ajouter"
            icone="calendar-x"
            aide="Congés, RTT, maladie, formation… La personne n'est pas proposée sur la période ; ses affectations déjà posées sont retirées et remises en affectation."
          >
            <ChampsAbsence motifs={motifs} aujourdhui={aujourdhui} />
          </ModalAction>
        </>
      ) : null}
    </>
  );
}
