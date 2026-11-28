import { redirect } from "next/navigation";
import { Icone } from "@/components/icones";
import { dateHeure } from "@/lib/libelles";
import { conditionsAAccepter } from "@/lib/portail";
import { Bloc, PageReglementaire, TexteLibre } from "@/modules/portail/reglementaire";
import { requireUsagerSansConditions } from "@/server/guards";
import { contexteAnonyme } from "@/server/page";

export const metadata = { title: "Conditions d'utilisation - CityRésa" };

/**
 * Les conditions d'utilisation, à lire et accepter par un usager dont le compte a été créé par
 * la collectivité : il y est conduit à sa première connexion, avant tout le reste de son
 * espace. Un usager qui les a déjà acceptées peut les relire ici.
 */
export default async function ConditionsPage() {
  const user = await requireUsagerSansConditions();
  const conditions = user.settings.PORTAIL_CONDITIONS;
  // Aucun texte saisi par la collectivité : rien à lire ni à accepter.
  if (!conditions.trim()) redirect("/portail/mes-reservations");
  const { csrf } = await contexteAnonyme();
  const aAccepter = conditionsAAccepter(user, conditions);
  return (
    <PageReglementaire
      titre="Conditions d'utilisation"
      sousTitre={
        aAccepter
          ? `Bienvenue ${user.firstName || user.name}. Avant d'utiliser votre espace, merci de lire et d'accepter les conditions fixées par ${user.settings.COLLECTIVITE_NOM}.`
          : undefined
      }
    >
      <Bloc titre="Conditions de réservation et d'utilisation du service">
        <TexteLibre texte={conditions} />
      </Bloc>
      {aAccepter ? (
        <form method="POST" action="/portail/conditions" data-double-envoi>
          <input type="hidden" name="csrf_token" value={csrf} />
          <div className="form-check mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              name="accepte"
              value="1"
              id="cgu-accepte"
              required
            />
            <label className="form-check-label" htmlFor="cgu-accepte">
              J'ai lu et j'accepte ces conditions. <span className="req">*</span>
            </label>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button type="submit" className="btn btn-primary">
              <Icone nom="check" taille={14} /> Accepter et continuer
            </button>
            <a href="/deconnexion" className="btn btn-outline-secondary">
              Se déconnecter
            </a>
          </div>
          <p className="small text-muted mt-3 mb-0">
            Vous ne souhaitez pas de compte ? Déconnectez-vous et écrivez à nos services : ils le
            supprimeront.
          </p>
        </form>
      ) : (
        <p className="small text-muted mb-0">
          <Icone nom="check" taille={13} /> Vous avez accepté ces conditions
          {user.acceptedCguAt ? ` le ${dateHeure(user.acceptedCguAt)}` : ""}.
        </p>
      )}
    </PageReglementaire>
  );
}
