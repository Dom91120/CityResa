import { notFound } from "next/navigation";
import { Icone } from "@/components/icones";
import { StatutSubvention } from "@/components/macros";
import { SUBVENTION_TYPES } from "@/lib/constantes";
import { montant } from "@/lib/libelles";
import { organisationDe } from "@/modules/portail/catalogue";
import { BlocVide } from "@/modules/portail/vues";
import { prisma } from "@/server/db";
import { contexteUsager } from "@/server/page";

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
  const subventions = await prisma.subvention.findMany({
    where: { organisationId: org.id },
    orderBy: [{ exercice: "desc" }, { createdAt: "desc" }],
  });
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Mes subventions <span className="page-count">{subventions.length}</span>
          </h1>
          <p className="page-subtitle">Les demandes de subvention de {org.name}.</p>
        </div>
        <div className="page-actions">
          <a href="/portail/mes-subventions/nouvelle" className="btn btn-primary">
            <Icone nom="plus" taille={14} /> Nouvelle demande
          </a>
        </div>
      </div>
      <div className="data-card">
        {subventions.length ? (
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Exercice</th>
                  <th>Type</th>
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
                    <td className="fw-semibold">{s.numero}</td>
                    <td>{s.exercice}</td>
                    <td>{SUBVENTION_TYPES[s.type] ?? s.type}</td>
                    <td>{s.objet}</td>
                    <td className="text-end">{montant(s.montantDemande)}</td>
                    <td className="text-end">
                      {s.montantAccorde != null ? montant(s.montantAccorde) : "—"}
                    </td>
                    <td>
                      <StatutSubvention status={s.status} />
                    </td>
                    <td className="text-end">
                      <a
                        href={`/portail/mes-subventions/${s.id}`}
                        className="btn btn-sm btn-outline-secondary"
                      >
                        Voir
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
            titre="Aucune demande de subvention"
            texte="Déposez votre première demande : objet, montant, budget et pièces justificatives."
            action={
              <a href="/portail/mes-subventions/nouvelle" className="btn btn-primary">
                <Icone nom="plus" taille={14} /> Déposer une demande
              </a>
            }
          />
        )}
      </div>
    </>
  );
}
