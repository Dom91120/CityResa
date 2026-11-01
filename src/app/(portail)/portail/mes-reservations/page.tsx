import { Icone } from "@/components/icones";
import { SegTabs } from "@/components/liste";
import { enCours, reservationsUsager } from "@/modules/portail/suivi";
import { BlocVide, CarteReservation } from "@/modules/portail/vues";
import { getSettings } from "@/server/config-store";
import { contexteUsager } from "@/server/page";

export const metadata = { title: "Mes réservations - CityRésa" };

export default async function MesReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const page = await contexteUsager();
  const [cfg, sp, toutes] = await Promise.all([
    getSettings(),
    searchParams,
    reservationsUsager(page.user),
  ]);
  const passees = sp.onglet === "passees";
  const actives = toutes.filter((r) => enCours(r.status));
  const closes = toutes
    .filter((r) => !enCours(r.status))
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
  const liste = passees ? closes : actives;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mes réservations</h1>
          <p className="page-subtitle">
            Suivez vos demandes, signez vos conventions et échangez avec la collectivité.
          </p>
        </div>
        <div className="page-actions">
          <a href="/portail" className="btn btn-primary">
            <Icone nom="plus" taille={14} /> Nouvelle demande
          </a>
        </div>
      </div>
      <SegTabs
        tabs={[
          {
            href: "/portail/mes-reservations",
            label: "En cours",
            count: actives.length,
            active: !passees,
          },
          {
            href: "/portail/mes-reservations?onglet=passees",
            label: "Passées et archivées",
            count: closes.length,
            active: passees,
            teinte: "muted",
          },
        ]}
      />
      <div className="data-card">
        {liste.length ? (
          liste.map((r) => <CarteReservation key={r.id} r={r} cfg={cfg} />)
        ) : (
          <BlocVide
            icone="clipboard-list"
            titre={passees ? "Aucune réservation passée" : "Aucune réservation en cours"}
            texte={
              passees
                ? "Vos réservations terminées, refusées ou annulées apparaîtront ici."
                : "Choisissez un espace dans le catalogue pour déposer votre première demande."
            }
            action={
              passees ? null : (
                <a href="/portail" className="btn btn-primary">
                  <Icone nom="door-open" taille={14} /> Voir les espaces
                </a>
              )
            }
          />
        )}
      </div>
    </>
  );
}
