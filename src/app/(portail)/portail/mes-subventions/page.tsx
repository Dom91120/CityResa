import { notFound } from "next/navigation";
import { Icone } from "@/components/icones";
import { Chip, StatutSubvention } from "@/components/macros";
import { SUBVENTION_NATURES, SUBVENTION_TYPES } from "@/lib/constantes";
import { dateCourte, montant } from "@/lib/libelles";
import { organisationDe } from "@/modules/portail/catalogue";
import { BlocVide } from "@/modules/portail/vues";
import { CarteCampagne } from "@/modules/subventions/dossier-vues";
import { prisma } from "@/server/db";
import { contexteUsager } from "@/server/page";
import { brouillonCourant, contexteCampagne } from "@/server/subventions-dossier";

export const metadata = { title: "Mes subventions - CityRésa" };

export default async function MesSubventionsPage() {
  const page = await contexteUsager();
  if (!page.features.subventions) notFound();
  const org = await organisationDe(page.user);
  if (org?.type !== "association")
    return (
      <div className="data-card">
        <BlocVide
          icone="hand-coins"
          titre="Réservé aux associations"
          texte="Les demandes de subvention sont ouvertes aux associations. Si votre organisation est une association, demandez à la collectivité de corriger votre fiche."
          action={
            <a href="/portail/mon-organisation" className="btn btn-outline-primary">
              Mon organisation
            </a>
          }
        />
      </div>
    );
  const [subventions, { campagne, depotOuvert }] = await Promise.all([
    prisma.subvention.findMany({
      where: { organisationId: org.id },
      orderBy: [{ exercice: "desc" }, { createdAt: "desc" }],
    }),
    contexteCampagne(),
  ]);
  const brouillon = campagne ? await brouillonCourant(org.id, campagne.exercice) : null;
  const dejaDeposee = campagne
    ? subventions.find((s) => s.exercice === campagne.exercice && s.status !== "brouillon")
    : null;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Mes subventions <span className="page-count">{subventions.length}</span>
          </h1>
          <p className="page-subtitle">Les dossiers de demande de subvention de {org.name}.</p>
        </div>
      </div>

      <CarteCampagne
        c={campagne}
        depotOuvert={depotOuvert}
        actions={
          campagne ? (
            dejaDeposee ? (
              <a
                href={`/portail/mes-subventions/${dejaDeposee.id}`}
                className="btn btn-outline-primary"
              >
                <Icone nom="eye" taille={14} /> Voir mon dossier {campagne.exercice} (
                {dejaDeposee.numero})
              </a>
            ) : brouillon ? (
              <a
                href={`/portail/mes-subventions/${brouillon.id}/dossier/presentation`}
                className="btn btn-primary"
              >
                <Icone nom="pencil" taille={14} /> Reprendre mon dossier {campagne.exercice}
              </a>
            ) : depotOuvert ? (
              <form method="POST" action="/portail/mes-subventions/nouvelle" data-double-envoi>
                <input type="hidden" name="csrf_token" value={page.csrf} />
                <button type="submit" className="btn btn-primary">
                  <Icone nom="plus" taille={14} /> Commencer mon dossier {campagne.exercice}
                </button>
              </form>
            ) : null
          ) : null
        }
      />
      <div className="astuce mb-3">
        <Icone nom="lightbulb" taille={18} />
        <div>
          Le dossier se remplit fiche par fiche (présentation, bureau, effectifs, budget, actions,
          trésorerie, bilan), avec les pièces à joindre et l'attestation sur l'honneur signée par
          code. Vous pouvez l'enregistrer et le reprendre à tout moment avant le dépôt.
        </div>
      </div>

      <div className="data-card">
        {subventions.length ? (
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Dossier</th>
                  <th>Objet</th>
                  <th className="text-end">Demandé</th>
                  <th className="text-end">Accordé</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {subventions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="cell2">
                        <span className="fw-semibold">
                          {s.status === "brouillon" ? `Exercice ${s.exercice}` : s.numero}
                        </span>
                        <small>
                          {s.status === "brouillon"
                            ? "en rédaction"
                            : `exercice ${s.exercice} · déposé le ${dateCourte(s.recuAt ?? s.createdAt)}`}
                          {" · "}
                          {SUBVENTION_NATURES[s.nature] ?? s.nature}
                        </small>
                      </span>
                    </td>
                    <td>
                      <span className="cell2">
                        <span>{s.objet}</span>
                        <small>{SUBVENTION_TYPES[s.type] ?? s.type}</small>
                      </span>
                    </td>
                    <td className="text-end tabular">
                      {s.montantDemande ? montant(s.montantDemande) : "—"}
                    </td>
                    <td className="text-end tabular">
                      {s.montantAccorde != null ? montant(s.montantAccorde) : "—"}
                    </td>
                    <td>
                      <StatutSubvention status={s.status} />
                      {s.verseAt ? <Chip teinte="slate">le {dateCourte(s.verseAt)}</Chip> : null}
                    </td>
                    <td className="text-end">
                      <a
                        href={
                          s.status === "brouillon"
                            ? `/portail/mes-subventions/${s.id}/dossier/presentation`
                            : `/portail/mes-subventions/${s.id}`
                        }
                        className="btn btn-sm btn-outline-secondary"
                      >
                        {s.status === "brouillon" ? "Reprendre" : "Voir"}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <BlocVide
            icone="hand-coins"
            titre="Aucun dossier de subvention"
            texte={
              depotOuvert
                ? "Commencez votre dossier pour la campagne en cours : il est pré-rempli depuis la fiche de votre association."
                : "Le dépôt s'ouvre pendant la campagne annuelle ; vous serez informés de son ouverture."
            }
          />
        )}
      </div>
    </>
  );
}
