import { Icone } from "@/components/icones";
import { SegTabs } from "@/components/liste";
import { Chip } from "@/components/macros";
import { dateCourte, nomCourt, plage } from "@/lib/libelles";
import { enCours, reservationsUsager } from "@/modules/portail/suivi";
import { BlocVide, CarteReservation } from "@/modules/portail/vues";
import { getSettings } from "@/server/config-store";
import { entreesDe } from "@/server/liste-attente";
import { contexteUsager } from "@/server/page";

export const metadata = { title: "Mes réservations - CityRésa" };

export default async function MesReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const page = await contexteUsager();
  const [cfg, sp, toutes, attente] = await Promise.all([
    getSettings(),
    searchParams,
    reservationsUsager(page.user),
    entreesDe(page.user),
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

      {attente.length ? (
        <div className="data-card p-4 mt-3" id="attente">
          <h2 className="h5 mb-2">
            <Icone nom="bell" taille={18} /> Liste d'attente
          </h2>
          <p className="text-muted small">
            Vous serez prévenu par courriel si l'un de ces créneaux se libère ; il faudra alors
            déposer votre demande.
          </p>
          <table className="table align-middle mb-0">
            <tbody>
              {attente.map((a) => (
                <tr key={a.id}>
                  <td className="fw-medium">{plage(a.startAt, a.endAt)}</td>
                  <td>{nomCourt(a.espace)}</td>
                  <td className="text-muted">{a.title}</td>
                  <td>
                    {a.notifiedAt ? (
                      <Chip teinte="emerald">
                        Créneau libéré, prévenu le {dateCourte(a.notifiedAt)}
                      </Chip>
                    ) : (
                      <Chip teinte="amber">En attente</Chip>
                    )}
                  </td>
                  <td className="actions">
                    <form
                      method="POST"
                      action={`/portail/liste-attente/${a.id}/retirer`}
                      className="d-inline"
                    >
                      <input type="hidden" name="csrf_token" value={page.csrf} />
                      <button type="submit" className="btn btn-ghost btn-ghost-danger btn-sm">
                        <Icone nom="x" taille={14} /> Retirer
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
