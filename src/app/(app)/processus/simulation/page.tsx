import { notFound } from "next/navigation";
import { FilRetour, Lu, Lus, Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import {
  aiguiller,
  CRITERES,
  criteresDe,
  decrireCondition,
  etapesApplicables,
  type Faits,
  INSERTION,
  libelleIntervenant,
  NATURES,
  type Objet,
} from "@/lib/circuits";
import { montant, plage } from "@/lib/libelles";
import { contexteAdmin } from "@/modules/admin/server";
import { PastilleNature } from "@/modules/processus/vues";
import {
  circuitsEnService,
  faitsReservation,
  libellesDe,
  optionsCriteres,
  personnesDe,
  referentiel,
} from "@/server/circuits";
import { faitsSubvention } from "@/server/circuits-subvention";
import { prisma } from "@/server/db";
import { INCLUDE_RESERVATION } from "@/server/reservations";

export const metadata = { title: "Simulation d'un circuit - CityRésa" };

/** La valeur d'un fait, en clair. */
function dire(cle: string, v: unknown, libelles: ReturnType<typeof libellesDe>): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  const c = CRITERES.find((x) => x.cle === cle);
  if (c?.type === "liste")
    return (
      c.options?.find(([k]) => k === String(v))?.[1] ?? libelles[cle]?.[String(v)] ?? String(v)
    );
  return `${v}${c?.unite ? ` ${c.unite}` : ""}`;
}

type Dossier = { objet: Objet; lien: string; titre: string; detail: string; faits: Faits };

/** Le dossier à simuler : une réservation (R…) ou une demande de subvention (S…, P…). */
async function trouver(numero: string, gratuit: boolean): Promise<Dossier | null> {
  if (/^[SP]/.test(numero)) {
    const s = await prisma.subvention.findUnique({
      where: { numero },
      include: { organisation: { select: { name: true, sportive: true, conventionnee: true } } },
    });
    return s
      ? {
          objet: "subvention",
          lien: `/subventions/${s.id}`,
          titre: `${s.numero} · ${s.objet}`,
          detail: `${s.organisation.name} · exercice ${s.exercice} · ${montant(s.montantDemande)} demandés`,
          faits: faitsSubvention(s),
        }
      : null;
  }
  const r = await prisma.reservation.findUnique({
    where: { numero },
    include: INCLUDE_RESERVATION,
  });
  return r
    ? {
        objet: "reservation",
        lien: `/reservations/${r.id}`,
        titre: `${r.numero} · ${r.title}`,
        detail: `${r.espace.name} · ${plage(r.startAt, r.endAt)}`,
        faits: faitsReservation({ ...r, gratuit: gratuit || r.gratuit }),
      }
    : null;
}

export default async function SimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ numero?: string; brouillons?: string; gratuit?: string }>;
}) {
  const page = await contexteAdmin();
  if (!page.features.processus) notFound();
  const sp = await searchParams;
  const numero = (sp.numero ?? "").trim().toUpperCase();
  const brouillons = sp.brouillons === "1";
  const gratuit = sp.gratuit === "1";
  const [d, recents, subventions, options, ref] = await Promise.all([
    numero ? trouver(numero, gratuit) : null,
    prisma.reservation.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { numero: true, title: true, organisation: { select: { name: true } } },
    }),
    prisma.subvention.findMany({
      where: { status: { not: "brouillon" } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { numero: true, objet: true, organisation: { select: { name: true } } },
    }),
    optionsCriteres(),
    referentiel(),
  ]);
  const libelles = libellesDe(options);
  const resultat = d
    ? aiguiller(await circuitsEnService(d.objet, brouillons), d.faits, libelles)
    : null;
  const retenu = resultat?.retenu ?? null;
  const etapes =
    retenu && d ? etapesApplicables(retenu.definition, d.faits, INSERTION[d.objet].moment) : [];
  const ecartees = retenu ? retenu.definition.etapes.filter((e) => !etapes.includes(e)) : [];
  const service = retenu?.definition.serviceId
    ? ref.services.get(retenu.definition.serviceId)
    : null;
  const attendus = await Promise.all(
    etapes.map((e) => personnesDe(e.intervenant, retenu?.definition.serviceId ?? null)),
  );
  const subvention = d?.objet === "subvention";

  return (
    <>
      <div className="page-header">
        <div>
          <FilRetour retour="/processus" />
          <h1 className="page-title">Simulation</h1>
          <p className="page-subtitle">
            Ce qui arriverait à un dossier s'il était créé maintenant : le circuit retenu, le
            service, les étapes et les personnes sollicitées. Rien n'est enregistré.
          </p>
        </div>
      </div>

      <form method="GET" action="/processus/simulation" className="data-card p-3 mb-3">
        <div className="d-flex flex-wrap align-items-end gap-3">
          <div>
            <label className="form-label" htmlFor="sim-numero">
              Réservation (R…) ou subvention (S…)
            </label>
            <input
              type="text"
              name="numero"
              id="sim-numero"
              className="form-control"
              defaultValue={numero}
              placeholder="R260017 ou S270001"
              list="sim-recents"
              required
            />
            <datalist id="sim-recents">
              {recents.map((x) => (
                <option key={x.numero} value={x.numero}>
                  {x.title} · {x.organisation?.name ?? ""}
                </option>
              ))}
              {subventions.map((x) => (
                <option key={x.numero} value={x.numero}>
                  {x.objet} · {x.organisation.name}
                </option>
              ))}
            </datalist>
          </div>
          <label className="form-check mb-2">
            <input
              type="checkbox"
              className="form-check-input"
              name="brouillons"
              value="1"
              defaultChecked={brouillons}
            />{" "}
            Avec les brouillons (avant publication)
          </label>
          <label className="form-check mb-2">
            <input
              type="checkbox"
              className="form-check-input"
              name="gratuit"
              value="1"
              defaultChecked={gratuit}
            />{" "}
            Réservation : comme si la gratuité était accordée
          </label>
          <button type="submit" className="btn btn-primary">
            <Icone nom="flask-conical" taille={14} /> Simuler
          </button>
        </div>
      </form>

      {numero && !d ? (
        <div className="alert alert-warning">Aucun dossier ne porte le numéro {numero}.</div>
      ) : null}

      {d && resultat ? (
        <div className="fiche-colonnes">
          <div className="data-card">
            <Section titre="Résultat" icone="workflow">
              <Lus colonnes={1} intitule="120px">
                <Lu label="Dossier" valeur={<a href={d.lien}>{d.titre}</a>} />
                <Lu label={subvention ? "Demande" : "Créneau"} valeur={d.detail} />
                <Lu
                  label="Circuit retenu"
                  valeur={
                    retenu ? (
                      <a href={`/processus/circuits/${retenu.id}`}>{retenu.name}</a>
                    ) : subvention ? (
                      <Chip teinte="slate">Aucun circuit : le dossier s'instruit comme avant</Chip>
                    ) : (
                      <Chip teinte="red">Aucun circuit : publiez un circuit par défaut</Chip>
                    )
                  }
                />
                <Lu
                  label={subvention ? "Instruit par" : "Confié à"}
                  valeur={
                    service
                      ? service.name
                      : subvention
                        ? "Les agents qui ont l'écriture sur les subventions"
                        : "Les agents chargés de l'espace"
                  }
                />
              </Lus>
            </Section>

            <Section titre="Circuits examinés" icone="git-fork">
              {resultat.examen.length ? (
                <ul className="liste-simple mb-0" style={{ margin: "0 -18px" }}>
                  {resultat.examen.map((x) => (
                    <li key={x.circuit.id}>
                      <span className="cell2" style={{ flex: 1, whiteSpace: "normal" }}>
                        <span>{x.circuit.name}</span>
                        <small>{x.raison}</small>
                      </span>
                      {x.retenu ? <Chip teinte="emerald">Retenu</Chip> : <Chip>Écarté</Chip>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted small mb-0">
                  Aucun circuit en service pour ce type de dossier.
                </p>
              )}
            </Section>

            <Section
              titre={subvention ? "Élus qui seraient consultés" : "Étapes qui s'ouvriraient"}
              icone="list-checks"
              nb={etapes.length}
            >
              {etapes.length ? (
                <ul className="liste-simple mb-0" style={{ margin: "0 -18px" }}>
                  {etapes.map((e, i) => (
                    <li key={e.cle}>
                      <span className="cell2" style={{ flex: 1, whiteSpace: "normal" }}>
                        <span>
                          <strong>{e.libelle}</strong> <PastilleNature nature={e.nature} />
                        </span>
                        <small>
                          {libelleIntervenant(e.intervenant, ref)} :{" "}
                          {attendus[i].length
                            ? attendus[i].map((p) => p.name).join(", ")
                            : "personne — l'étape resterait sans réponse"}
                        </small>
                        <small>
                          {subvention
                            ? "Prévenu à la soumission aux élus ; l'avis lui est réservé."
                            : NATURES[e.nature].bloquante
                              ? "Retient l'acceptation jusqu'à la réponse."
                              : "Ne retient pas l'acceptation."}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted small mb-0">
                  {subvention
                    ? "Aucun élu nommé : tout compte qui a l'écriture sur les subventions pourrait donner un avis."
                    : "Aucune : la demande s'accepterait sans étape préalable."}
                </p>
              )}
              {ecartees.length ? (
                <p className="text-muted small mt-2 mb-0">
                  Étapes du circuit qui ne s'appliquent pas à ce dossier :{" "}
                  {ecartees
                    .map((e) => `${e.libelle} (${decrireCondition(e.condition, libelles)})`)
                    .join(" ; ")}
                  .
                </p>
              ) : null}
            </Section>
          </div>

          <div className="data-card">
            <Section titre="Ce que les règles lisent du dossier" icone="info">
              <Lus colonnes={1} intitule="210px">
                {criteresDe(d.objet).map((c) => (
                  <Lu
                    key={c.cle}
                    label={c.label}
                    valeur={dire(c.cle, d.faits[c.cle], libelles)}
                    tiret
                  />
                ))}
              </Lus>
            </Section>
          </div>
        </div>
      ) : null}
    </>
  );
}
