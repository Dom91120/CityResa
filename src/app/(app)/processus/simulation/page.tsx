import { notFound } from "next/navigation";
import { Lu, Lus, Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import {
  aiguiller,
  CRITERES,
  decrireCondition,
  etapesApplicables,
  libelleIntervenant,
  NATURES,
} from "@/lib/circuits";
import { plage } from "@/lib/libelles";
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
  const [r, recents, options, ref] = await Promise.all([
    numero
      ? prisma.reservation.findUnique({ where: { numero }, include: INCLUDE_RESERVATION })
      : null,
    prisma.reservation.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { numero: true, title: true, organisation: { select: { name: true, type: true } } },
    }),
    optionsCriteres(),
    referentiel(),
  ]);
  const libelles = libellesDe(options);
  const faits = r ? faitsReservation({ ...r, gratuit: gratuit || r.gratuit }) : null;
  const resultat = faits
    ? aiguiller(await circuitsEnService("reservation", brouillons), faits, libelles)
    : null;
  const retenu = resultat?.retenu ?? null;
  const etapes = retenu && faits ? etapesApplicables(retenu.definition, faits) : [];
  const ecartees =
    retenu && faits ? retenu.definition.etapes.filter((e) => !etapes.includes(e)) : [];
  const service = retenu?.definition.serviceId
    ? ref.services.get(retenu.definition.serviceId)
    : null;
  const attendus = await Promise.all(
    etapes.map((e) => personnesDe(e.intervenant, retenu?.definition.serviceId ?? null)),
  );

  return (
    <>
      <div className="page-header">
        <div>
          <a href="/processus" className="fil-retour">
            <Icone nom="arrow-left" taille={14} /> Processus et circuits
          </a>
          <h1 className="page-title">Simulation</h1>
          <p className="page-subtitle">
            Ce qui arriverait à un dossier s'il était créé maintenant : le circuit retenu, les
            étapes qui s'ouvriraient et les personnes sollicitées. Rien n'est enregistré.
          </p>
        </div>
      </div>

      <form method="GET" action="/processus/simulation" className="data-card p-3 mb-3">
        <div className="d-flex flex-wrap align-items-end gap-3">
          <div>
            <label className="form-label" htmlFor="sim-numero">
              Dossier de réservation
            </label>
            <input
              type="text"
              name="numero"
              id="sim-numero"
              className="form-control"
              defaultValue={numero}
              placeholder="R260017"
              list="sim-recents"
              required
            />
            <datalist id="sim-recents">
              {recents.map((x) => (
                <option key={x.numero} value={x.numero}>
                  {x.title} · {x.organisation?.name ?? ""}
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
            Comme si la gratuité était accordée
          </label>
          <button type="submit" className="btn btn-primary">
            <Icone nom="flask-conical" taille={14} /> Simuler
          </button>
        </div>
      </form>

      {numero && !r ? (
        <div className="alert alert-warning">Aucun dossier ne porte le numéro {numero}.</div>
      ) : null}

      {r && faits && resultat ? (
        <div className="fiche-colonnes">
          <div className="data-card">
            <Section titre="Résultat" icone="workflow">
              <Lus colonnes={1} intitule="120px">
                <Lu
                  label="Dossier"
                  valeur={
                    <a href={`/reservations/${r.id}`}>
                      {r.numero} · {r.title}
                    </a>
                  }
                />
                <Lu label="Créneau" valeur={`${r.espace.name} · ${plage(r.startAt, r.endAt)}`} />
                <Lu
                  label="Circuit retenu"
                  valeur={
                    retenu ? (
                      <a href={`/processus/circuits/${retenu.id}`}>{retenu.name}</a>
                    ) : (
                      <Chip teinte="red">Aucun circuit : publiez un circuit par défaut</Chip>
                    )
                  }
                />
                <Lu
                  label="Confié à"
                  valeur={service ? service.name : "Les agents chargés de l'espace"}
                />
              </Lus>
            </Section>

            <Section titre="Circuits examinés" icone="git-fork">
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
            </Section>

            <Section titre="Étapes qui s'ouvriraient" icone="list-checks" nb={etapes.length}>
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
                            : "personne — l'étape ne pourrait pas être demandée"}
                        </small>
                        <small>
                          {NATURES[e.nature].bloquante
                            ? "Retient l'acceptation jusqu'à la réponse."
                            : "Ne retient pas l'acceptation."}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted small mb-0">
                  Aucune : la demande s'accepterait sans étape préalable.
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
                {CRITERES.map((c) => (
                  <Lu
                    key={c.cle}
                    label={c.label}
                    valeur={dire(c.cle, faits[c.cle], libelles)}
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
