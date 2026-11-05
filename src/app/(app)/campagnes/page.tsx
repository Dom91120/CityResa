import { BoutonOuvrir, ModalAction } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Vide } from "@/components/liste";
import { dateCourte } from "@/lib/libelles";
import { ChampsCampagne, StatutCampagne } from "@/modules/campagnes/vues";
import { saisons } from "@/server/calendrier";
import { campagnes } from "@/server/campagnes";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Campagnes de créneaux - CityRésa" };

export default async function CampagnesPage() {
  const page = await contexteModule("reservations", "campagnes");
  const peutEditer = page.user.canEdit("reservations");
  const [liste, listeSaisons, espaces] = await Promise.all([
    campagnes(),
    saisons(),
    prisma.espace.findMany({
      where: { isActive: true },
      include: { site: true },
      orderBy: [{ site: { name: "asc" } }, { name: "asc" }],
    }),
  ]);
  const compte = (c: (typeof liste)[number], status: string) =>
    c.voeux.filter((v) => v.status === status).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Campagnes de créneaux <span className="page-count">{liste.length}</span>
          </h1>
          <p className="page-subtitle">
            Chaque saison, les usagers déposent leurs vœux de créneaux hebdomadaires ; la Ville
            arbitre les conflits par priorité et attribue en lot, un dossier par vœu retenu.
          </p>
        </div>
        <div className="page-actions">
          {peutEditer ? (
            <BoutonOuvrir
              cible="modal-campagne-nouvelle"
              libelle="Nouvelle campagne"
              icone="plus"
              classe="btn-primary"
            />
          ) : null}
        </div>
      </div>

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Campagne</th>
                <th>Saison</th>
                <th>État</th>
                <th>Date limite</th>
                <th>Espaces</th>
                <th>En attente</th>
                <th>Attribués</th>
                <th>Refusés</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {liste.length ? (
                liste.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-medium">
                      <a href={`/campagnes/${c.id}`}>{c.label}</a>
                    </td>
                    <td>{c.saison.label}</td>
                    <td>
                      <StatutCampagne status={c.status} />
                    </td>
                    <td>{c.closeDate ? dateCourte(c.closeDate) : "—"}</td>
                    <td>{c.espaces.length ? c.espaces.length : "Tous"}</td>
                    <td>{compte(c, "en_attente")}</td>
                    <td>{compte(c, "attribue")}</td>
                    <td>{compte(c, "refuse")}</td>
                    <td className="actions">
                      <a
                        href={`/campagnes/${c.id}`}
                        className="btn btn-ghost btn-icone btn-sm"
                        title="Ouvrir"
                        aria-label="Ouvrir"
                      >
                        <Icone nom="chevron-right" taille={14} />
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <Vide
                  colonnes={9}
                  message="Aucune campagne. Créez-en une pour la prochaine saison : les usagers déposeront leurs vœux depuis le portail."
                  icone="calendar-check"
                />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {peutEditer ? (
        <ModalAction
          id="modal-campagne-nouvelle"
          titre="Nouvelle campagne"
          action="/campagnes/nouvelle"
          csrf={page.csrf}
          bouton="Créer la campagne"
          icone="plus"
          taille="lg"
          aide="La campagne reste en brouillon : ouvrez le dépôt depuis sa fiche quand tout est prêt."
        >
          <ChampsCampagne
            c={null}
            saisons={listeSaisons}
            espaces={espaces.map((e) => ({ id: e.id, name: e.name, siteName: e.site.name }))}
          />
        </ModalAction>
      ) : null}
    </>
  );
}
