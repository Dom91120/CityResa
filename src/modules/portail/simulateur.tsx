/**
 * Simulateur de tarif public : un formulaire GET sur la page d'un espace (date, heures,
 * profil, options), le devis calculé par les mêmes règles que la demande, le verdict de
 * disponibilité et un lien vers la demande pré-remplie. Règles pures : src/lib/simulateur.ts.
 */
import { Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import { reglesAuCreneau, verifierRegles } from "@/lib/creneaux";
import { montant, plage } from "@/lib/libelles";
import { lienDemande, lireSimulation, type Params, verdict } from "@/lib/simulateur";
import type { EspacePortail } from "@/modules/portail/catalogue";
import { prisma } from "@/server/db";
import { horairesSaisonDe } from "@/server/horaires";
import { deviser, verifierDisponibilite } from "@/server/reservations";

export async function Simulateur({
  espace,
  profils,
  profilConnecte,
  params,
}: {
  espace: EspacePortail;
  profils: { id: number; label: string }[];
  /** Le profil de l'usager connecté (imposé) ; null pour un visiteur, qui choisit. */
  profilConnecte: { id: number; label: string } | null;
  params: Params;
}) {
  const options = await prisma.option.findMany({
    where: { isActive: true, OR: [{ espaceId: espace.id }, { espaceId: null }] },
    orderBy: [{ position: "asc" }, { label: "asc" }],
  });
  const lu = lireSimulation(params);
  const sim = typeof lu === "object" && lu !== null ? lu : null;
  const erreurSaisie = typeof lu === "string" ? lu : null;
  const profilId = profilConnecte ? profilConnecte.id : (sim?.profilId ?? null);
  let resultat: {
    devis: Awaited<ReturnType<typeof deviser>>;
    verdict: ReturnType<typeof verdict>;
  } | null = null;
  if (sim) {
    const periodes = await horairesSaisonDe(espace.id);
    const erreurs = verifierRegles(reglesAuCreneau(espace, periodes, sim.creneau), sim.creneau);
    const conflits = await verifierDisponibilite(espace, [sim.creneau]);
    const devis = await deviser(
      espace.id,
      profilId,
      [sim.creneau],
      sim.optionIds
        .filter((id) => options.some((o) => o.id === id))
        .map((id) => ({ optionId: id, quantite: 1 })),
      [],
      false,
    );
    resultat = { devis, verdict: verdict(erreurs, conflits.length) };
  }
  const pas = (espace.slotStepMin || 30) * 60;
  const lignes = resultat?.devis.lignes.filter((l) => l.type !== "caution") ?? [];
  return (
    <Section titre="Simulateur de tarif" icone="calculator" id="simulateur">
      <p className="text-muted small">
        Estimez le coût d'une occupation avant de déposer votre demande : mêmes règles et mêmes
        grilles que la demande elle-même.
      </p>
      <form method="GET" action={`/portail/espaces/${espace.slug}#simulateur`}>
        <div className="grille grille-3">
          <div>
            <label className="form-label" htmlFor="sim-date">
              Date
            </label>
            <input
              type="date"
              name="sim_date"
              id="sim-date"
              className="form-control"
              required
              defaultValue={sim?.date ?? ""}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="sim-debut">
              Début
            </label>
            <input
              type="time"
              name="sim_debut"
              id="sim-debut"
              className="form-control"
              required
              step={pas}
              defaultValue={sim?.debut ?? ""}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="sim-fin">
              Fin
            </label>
            <input
              type="time"
              name="sim_fin"
              id="sim-fin"
              className="form-control"
              required
              step={pas}
              defaultValue={sim?.fin ?? ""}
            />
          </div>
          {profilConnecte ? (
            <p className="small text-muted mb-0" style={{ gridColumn: "1 / -1" }}>
              Tarif de votre profil : <strong>{profilConnecte.label}</strong>.
            </p>
          ) : (
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="sim-profil">
                Vous êtes
              </label>
              <select
                name="sim_profil"
                id="sim-profil"
                className="form-select"
                defaultValue={sim?.profilId ? String(sim.profilId) : ""}
              >
                <option value="">Tarif de base (tous profils)</option>
                {profils.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {options.length ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <span className="form-label d-block">Options</span>
              <div className="d-flex flex-wrap gap-3">
                {options.map((o) => (
                  <div className="form-check" key={o.id}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="sim_opt"
                      value={o.id}
                      id={`sim-opt-${o.id}`}
                      defaultChecked={sim?.optionIds.includes(o.id) ?? false}
                    />
                    <label className="form-check-label" htmlFor={`sim-opt-${o.id}`}>
                      {o.label}
                      {o.montant ? (
                        <span className="text-muted"> · {montant(o.montant)}</span>
                      ) : null}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <button type="submit" className="btn btn-outline-primary mt-2">
          <Icone nom="calculator" taille={14} /> Calculer
        </button>
      </form>

      {erreurSaisie ? <p className="text-danger small mt-3 mb-0">{erreurSaisie}</p> : null}
      {sim && resultat ? (
        <div className="mt-3 p-3 rounded border bg-body-tertiary">
          <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
            <strong>{plage(sim.creneau.startAt, sim.creneau.endAt)}</strong>
            <Chip teinte={resultat.verdict.teinte}>{resultat.verdict.texte}</Chip>
          </div>
          {lignes.length ? (
            <table className="table table-sm mt-2 mb-2">
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={`${l.type}-${i}`}>
                    <td>{l.libelle}</td>
                    <td className="text-end text-nowrap">{montant(l.montant)}</td>
                  </tr>
                ))}
                <tr className="fw-semibold">
                  <td>
                    Total TTC
                    {resultat.devis.tva ? ` (dont TVA ${montant(resultat.devis.tva)})` : ""}
                  </td>
                  <td className="text-end text-nowrap">{montant(resultat.devis.ttc)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="mt-2 mb-2">
              <strong>Gratuit</strong> pour ce profil.
            </p>
          )}
          <p className="small text-muted mb-2">
            {resultat.devis.acompte
              ? `Acompte à la signature : ${montant(resultat.devis.acompte)}. `
              : ""}
            {resultat.devis.caution
              ? `Caution : ${montant(resultat.devis.caution)}, restituée après l'événement. `
              : ""}
            Estimation indicative : le devis définitif est établi avec votre demande.
          </p>
          <a href={lienDemande(espace.slug, sim)} className="btn btn-primary btn-sm">
            <Icone nom="send" taille={14} /> Déposer une demande pour ce créneau
          </a>
        </div>
      ) : null}
    </Section>
  );
}
