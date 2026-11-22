import { notFound } from "next/navigation";
import { BoutonOuvrir, ModalAction } from "@/components/fiche";
import { Champ, Coches, Grille, Interrupteur, Select } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { SegTabs, VideBloc } from "@/components/liste";
import { Chip } from "@/components/macros";
import { decrireCondition, lireDefinition, lireObjet, OBJETS } from "@/lib/circuits";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import { isoDate } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import { contexteAdmin } from "@/modules/admin/server";
import { libellesDe, optionsCriteres, referentiel } from "@/server/circuits";
import { prisma } from "@/server/db";

export const metadata = { title: "Processus et circuits - CityRésa" };

const nom = (u: { firstName: string; lastName: string } | null | undefined) =>
  u ? `${u.firstName} ${u.lastName}`.trim() : "";

export default async function ProcessusPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const page = await contexteAdmin();
  if (!page.features.processus) notFound();
  const onglet = (await searchParams).onglet ?? "circuits";
  const [circuits, services, delegations, agents, ref, options] = await Promise.all([
    prisma.circuit.findMany({
      include: { versions: { orderBy: { numero: "desc" } } },
      orderBy: [{ objet: "asc" }, { parDefaut: "asc" }, { position: "asc" }, { id: "asc" }],
    }),
    prisma.service.findMany({
      include: {
        responsable: true,
        suppleant: true,
        membres: { include: { user: true } },
        _count: { select: { reservations: true, subventions: true } },
      },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    prisma.delegation.findMany({
      include: { user: true, suppleant: true },
      orderBy: { label: "asc" },
    }),
    prisma.user.findMany({
      where: { kind: "agent", isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    referentiel(),
    optionsCriteres(),
  ]);
  const libelles = libellesDe(options);
  const choixAgents = agents.map((a) => [a.id, `${nom(a)} · ${a.role}`] as [string, string]);
  const elus = agents.filter((a) => a.role === "elu");
  const choixElus = (elus.length ? elus : agents).map((a) => [a.id, nom(a)] as [string, string]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Processus et circuits</h1>
          <p className="page-subtitle">
            Les services de la collectivité, à qui chaque demande est confiée, et les étapes de
            relecture, d'avis ou de visa qui s'ajoutent avant une acceptation.
          </p>
        </div>
        <div className="page-actions">
          <a href="/processus/simulation" className="btn btn-outline-secondary">
            <Icone nom="flask-conical" taille={14} /> Simuler
          </a>
          {onglet === "services" ? (
            <BoutonOuvrir cible="modal-service-0" libelle="Nouveau service" icone="plus" />
          ) : onglet === "delegations" ? (
            <BoutonOuvrir cible="modal-delegation-0" libelle="Nouvelle délégation" icone="plus" />
          ) : (
            <BoutonOuvrir cible="modal-circuit" libelle="Nouveau circuit" icone="plus" />
          )}
        </div>
      </div>

      <SegTabs
        tabs={[
          {
            href: "/processus",
            label: "Circuits",
            count: circuits.length,
            active: onglet === "circuits",
          },
          {
            href: "/processus?onglet=services",
            label: "Services",
            count: services.length,
            active: onglet === "services",
          },
          {
            href: "/processus?onglet=delegations",
            label: "Délégations des élus",
            count: delegations.length,
            active: onglet === "delegations",
          },
        ]}
      />

      {onglet === "services" ? (
        <>
          <div className="data-card">
            {services.length ? (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Responsable</th>
                      <th>Membres</th>
                      <th>Suppléance</th>
                      <th className="text-end">Dossiers</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((s) => (
                      <tr key={s.id}>
                        <td className="col-souple col-souple--large">
                          <span className="cell2" style={{ whiteSpace: "normal" }}>
                            <strong>
                              {s.name}
                              {s.isActive ? null : (
                                <Chip teinte="slate" classes="ms-2">
                                  Inactif
                                </Chip>
                              )}
                            </strong>
                            <small>
                              {[s.email, s.phone, s.description].filter(Boolean).join(" · ") || "—"}
                            </small>
                          </span>
                        </td>
                        <td>{nom(s.responsable) || <span className="text-faint">—</span>}</td>
                        <td>
                          {s.membres.length ? (
                            <span title={s.membres.map((m) => nom(m.user)).join(", ")}>
                              {s.membres
                                .slice(0, 3)
                                .map((m) => nom(m.user))
                                .join(", ")}
                              {s.membres.length > 3 ? ` +${s.membres.length - 3}` : ""}
                            </span>
                          ) : (
                            <Chip teinte="amber">Aucun membre</Chip>
                          )}
                        </td>
                        <td>
                          {s.suppleant ? (
                            <span className="cell2">
                              <span>{s.suppleant.name}</span>
                              <small>
                                {s.suppleanceDu || s.suppleanceAu
                                  ? `du ${s.suppleanceDu ? dateCourte(s.suppleanceDu) : "…"} au ${s.suppleanceAu ? dateCourte(s.suppleanceAu) : "…"}`
                                  : "sans limite de date"}
                              </small>
                            </span>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                        <td className="text-end tabular">
                          {s._count.reservations + s._count.subventions}
                        </td>
                        <td className="text-end">
                          <BoutonOuvrir
                            cible={`modal-service-${s.id}`}
                            libelle={`Modifier ${s.name}`}
                            icone="pencil"
                            classe="btn-ghost btn-sm"
                            sansTexte
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <VideBloc
                icone="building-2"
                titre="Aucun service"
                texte="Créez les services de la collectivité (Service des sports, Vie associative, Service des fêtes…) : les circuits leur confient les demandes et leurs étapes."
              />
            )}
          </div>
          {[null, ...services].map((s) => (
            <ModalAction
              key={s?.id ?? 0}
              id={`modal-service-${s?.id ?? 0}`}
              titre={s ? `Modifier ${s.name}` : "Nouveau service"}
              action="/processus/services"
              csrf={page.csrf}
              taille="lg"
              bouton={s ? "Enregistrer" : "Créer le service"}
            >
              <input type="hidden" name="id" value={s?.id ?? ""} />
              <Grille colonnes={2}>
                <Champ
                  label="Nom"
                  name="name"
                  id={`s-name-${s?.id ?? 0}`}
                  requis
                  valeur={s?.name}
                />
                <Select
                  label="Responsable"
                  name="responsable_id"
                  id={`s-resp-${s?.id ?? 0}`}
                  options={choixAgents}
                  valeur={s?.responsableId}
                  blank="— aucun —"
                />
                <Champ
                  label="Courriel"
                  name="email"
                  id={`s-email-${s?.id ?? 0}`}
                  type="email"
                  valeur={s?.email}
                />
                <Champ
                  label="Téléphone"
                  name="phone"
                  id={`s-phone-${s?.id ?? 0}`}
                  valeur={s?.phone}
                />
                <Champ
                  label="Description"
                  name="description"
                  id={`s-desc-${s?.id ?? 0}`}
                  pleine
                  valeur={s?.description}
                  placeholder="Ce dont le service a la charge"
                />
                <Coches
                  label="Membres (comptes du back-office)"
                  name="membres"
                  options={agents.map((a) => ({ value: a.id, label: nom(a) }))}
                  cochees={s?.membres.map((m) => m.userId) ?? []}
                />
                <Coches
                  label="Usagers dont ce service est le référent (aucun coché = aucun)"
                  name="usager_types"
                  options={Object.entries(ORGANISATION_TYPES).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  cochees={s?.usagerTypes ?? []}
                />
                <Select
                  label="Parmi les associations"
                  name="usagers_sportifs"
                  id={`s-sportifs-${s?.id ?? 0}`}
                  options={[
                    ["1", "Les associations sportives seulement"],
                    ["0", "Les associations non sportives seulement"],
                  ]}
                  valeur={
                    s?.usagersSportifs === true ? "1" : s?.usagersSportifs === false ? "0" : null
                  }
                  blank="Toutes"
                  pleine
                  aide="Le service de référence valide la fiche de l'usager et suit ses pièces ; il est prévenu de son inscription."
                />
                <Select
                  label="Suppléé par"
                  name="suppleant_id"
                  id={`s-sup-${s?.id ?? 0}`}
                  options={services
                    .filter((x) => x.id !== s?.id)
                    .map((x) => [String(x.id), x.name] as [string, string])}
                  valeur={s?.suppleantId}
                  blank="— personne —"
                  aide="Pendant la période, les membres du service suppléant reçoivent aussi ses étapes."
                />
                <div className="d-flex gap-2">
                  <Champ
                    label="Du"
                    name="suppleance_du"
                    id={`s-du-${s?.id ?? 0}`}
                    type="date"
                    valeur={isoDate(s?.suppleanceDu)}
                  />
                  <Champ
                    label="Au"
                    name="suppleance_au"
                    id={`s-au-${s?.id ?? 0}`}
                    type="date"
                    valeur={isoDate(s?.suppleanceAu)}
                  />
                </div>
                <Interrupteur
                  label="Service actif"
                  name="is_active"
                  id={`s-actif-${s?.id ?? 0}`}
                  coche={s?.isActive ?? true}
                />
              </Grille>
            </ModalAction>
          ))}
        </>
      ) : onglet === "delegations" ? (
        <>
          <div className="data-card">
            {delegations.length ? (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Délégation</th>
                      <th>Élu</th>
                      <th>Suppléant</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {delegations.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <strong>{d.label}</strong>
                          {d.isActive ? null : (
                            <Chip teinte="slate" classes="ms-2">
                              Inactive
                            </Chip>
                          )}
                        </td>
                        <td>{nom(d.user) || <Chip teinte="amber">Aucun élu</Chip>}</td>
                        <td>{nom(d.suppleant) || <span className="text-faint">—</span>}</td>
                        <td className="text-end">
                          <BoutonOuvrir
                            cible={`modal-delegation-${d.id}`}
                            libelle={`Modifier ${d.label}`}
                            icone="pencil"
                            classe="btn-ghost btn-sm"
                            sansTexte
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <VideBloc
                icone="landmark"
                titre="Aucune délégation"
                texte="Une étape d'avis ou de visa s'adresse à une délégation (sports, vie associative, fêtes…), pas à une personne : l'élu peut changer sans toucher aux circuits."
              />
            )}
          </div>
          {[null, ...delegations].map((d) => (
            <ModalAction
              key={d?.id ?? 0}
              id={`modal-delegation-${d?.id ?? 0}`}
              titre={d ? `Modifier ${d.label}` : "Nouvelle délégation"}
              action="/processus/delegations"
              csrf={page.csrf}
              bouton={d ? "Enregistrer" : "Créer la délégation"}
            >
              <input type="hidden" name="id" value={d?.id ?? ""} />
              <Grille colonnes={2}>
                <Champ
                  label="Intitulé"
                  name="label"
                  id={`d-label-${d?.id ?? 0}`}
                  requis
                  pleine
                  valeur={d?.label}
                  placeholder="Vie associative"
                />
                <Select
                  label="Élu"
                  name="user_id"
                  id={`d-user-${d?.id ?? 0}`}
                  options={choixElus}
                  valeur={d?.userId}
                  blank="— à désigner —"
                />
                <Select
                  label="Suppléant"
                  name="suppleant_id"
                  id={`d-sup-${d?.id ?? 0}`}
                  options={choixElus}
                  valeur={d?.suppleantId}
                  blank="— aucun —"
                />
                <Interrupteur
                  label="Délégation active"
                  name="is_active"
                  id={`d-actif-${d?.id ?? 0}`}
                  coche={d?.isActive ?? true}
                />
              </Grille>
            </ModalAction>
          ))}
        </>
      ) : (
        <>
          <div className="astuce mb-3">
            <Icone nom="info" taille={16} />
            <span>
              À la création d'une demande, les circuits sont examinés dans l'ordre : le premier dont
              la règle s'applique la reçoit, le circuit par défaut prend le reste. Un dossier garde
              la version de son circuit jusqu'à sa clôture.
            </span>
          </div>
          <div className="data-card">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Ordre</th>
                    <th>Circuit</th>
                    <th>Reçoit</th>
                    <th>Service</th>
                    <th>Étapes</th>
                    <th>Version</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {circuits.map((c) => {
                    const publiee = c.versions.find((v) => v.status === "publiee");
                    const brouillon = c.versions.find((v) => v.status === "brouillon");
                    const def = lireDefinition((publiee ?? brouillon)?.definition);
                    const service = def.serviceId ? ref.services.get(def.serviceId) : null;
                    return (
                      <tr key={c.id}>
                        <td className="tabular">{c.parDefaut ? "—" : c.position}</td>
                        <td className="col-souple col-souple--large">
                          <span className="cell2" style={{ whiteSpace: "normal" }}>
                            <a href={`/processus/circuits/${c.id}`} className="fw-semibold">
                              {c.name}
                            </a>
                            <small>
                              {OBJETS[lireObjet(c.objet)]}
                              {c.description ? ` · ${c.description}` : ""}
                            </small>
                          </span>
                        </td>
                        <td style={{ minWidth: 190 }}>
                          {c.parDefaut ? (
                            <Chip teinte="slate">Par défaut : tout le reste</Chip>
                          ) : (
                            decrireCondition(def.condition, libelles, "Aucune règle")
                          )}
                        </td>
                        <td>{service?.name ?? <span className="text-faint">—</span>}</td>
                        <td>
                          {def.etapes.length ? (
                            def.etapes.map((e) => e.libelle).join(", ")
                          ) : (
                            <span className="text-faint">Aucune</span>
                          )}
                        </td>
                        <td className="text-nowrap">
                          {!c.isActive ? (
                            <Chip teinte="slate">Inactif</Chip>
                          ) : publiee ? (
                            <Chip teinte="emerald">v{publiee.numero} en service</Chip>
                          ) : (
                            <Chip teinte="amber">Jamais publié</Chip>
                          )}
                          {brouillon ? (
                            <Chip teinte="amber" classes="ms-1">
                              Brouillon v{brouillon.numero}
                            </Chip>
                          ) : null}
                        </td>
                        <td className="text-end">
                          <a
                            href={`/processus/circuits/${c.id}`}
                            className="btn btn-sm btn-outline-secondary"
                          >
                            Ouvrir
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <ModalAction
            id="modal-circuit"
            titre="Nouveau circuit"
            action="/processus/circuits"
            csrf={page.csrf}
            bouton="Créer le circuit"
            icone="plus"
            aide="Le circuit est créé en brouillon : vous réglez ensuite sa règle d'aiguillage, son service et ses étapes, puis vous le publiez."
          >
            <Grille colonnes={2}>
              <Select
                label="Type de dossier"
                name="objet"
                id="c-objet"
                pleine
                options={Object.entries(OBJETS)}
                valeur="reservation"
              />
              <Champ
                label="Nom"
                name="name"
                id="c-name"
                requis
                pleine
                placeholder="Salles · associations"
              />
              <Champ
                label="Description"
                name="description"
                id="c-desc"
                pleine
                placeholder="Ce que ce circuit prend en charge"
              />
            </Grille>
          </ModalAction>
        </>
      )}
    </>
  );
}
