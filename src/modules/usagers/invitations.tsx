/**
 * La création des comptes des usagers à l'ouverture du portail : le contenu commun aux deux
 * fenêtres qui la proposent (Paramètres › Portail à l'ouverture, Usagers ensuite) et la lecture
 * des types d'organisation cochés.
 */
import { Icone } from "@/components/icones";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import { type TriInvitations, validiteEnClair } from "@/lib/invitations";
import { UserFacingError } from "@/server/errors";
import { INVITATION_VALIDITE_JOURS } from "@/server/invitations";

/** Les types cochés ; null = tous. Aucun coché : rien à inviter, on le dit. */
export function lireTypesInvites(form: FormData): string[] | null {
  const connus = Object.keys(ORGANISATION_TYPES);
  const coches = form
    .getAll("type_invite")
    .map(String)
    .filter((t) => connus.includes(t));
  if (!coches.length)
    throw new UserFacingError("Cochez au moins un type d'usager à inviter, ou n'invitez personne.");
  return coches.length === connus.length ? null : coches;
}

/** Les types à cocher avec le nombre de comptes à créer pour chacun, et les fiches écartées. */
export function ChampsInvitation({ apercu, prefixe }: { apercu: TriInvitations; prefixe: string }) {
  const parType = new Map<string, number>();
  for (const i of apercu.invitations) parType.set(i.type, (parType.get(i.type) ?? 0) + 1);
  const total = apercu.invitations.length;
  const montrees = apercu.ecartees.slice(0, 8);
  return (
    <>
      <div className="form-label">Types d'usagers à inviter</div>
      <div className="coches mb-2">
        {Object.entries(ORGANISATION_TYPES).map(([cle, label]) => (
          <label key={cle}>
            <input
              type="checkbox"
              name="type_invite"
              value={cle}
              id={`${prefixe}-${cle}`}
              defaultChecked={(parType.get(cle) ?? 0) > 0}
            />
            {label}
            <span className="text-faint"> ({parType.get(cle) ?? 0})</span>
          </label>
        ))}
      </div>
      <p className="small mb-2">
        {total ? (
          <>
            Tous types cochés : <strong>{total}</strong> compte{total > 1 ? "s" : ""} créé
            {total > 1 ? "s" : ""}, autant de courriels envoyés. Chaque compte est créé à l'adresse
            de l'organisation et au nom de son représentant ; aucun mot de passe n'est envoyé,
            l'usager choisit le sien par un lien valable{" "}
            {validiteEnClair(INVITATION_VALIDITE_JOURS)}.
          </>
        ) : (
          "Aucune organisation à inviter : toutes ont déjà un compte, ou il leur manque un courriel."
        )}
        {apercu.dejaPourvues
          ? ` ${apercu.dejaPourvues} organisation${apercu.dejaPourvues > 1 ? "s ont" : " a"} déjà un compte et ne ${apercu.dejaPourvues > 1 ? "seront" : "sera"} pas réinvitée${apercu.dejaPourvues > 1 ? "s" : ""}.`
          : ""}
      </p>
      {apercu.ecartees.length ? (
        <div className="alert alert-warning small mb-2">
          <strong>
            {apercu.ecartees.length} organisation{apercu.ecartees.length > 1 ? "s" : ""} ne
            {apercu.ecartees.length > 1 ? " seront" : " sera"} pas invitée
            {apercu.ecartees.length > 1 ? "s" : ""}
          </strong>{" "}
          tant que sa fiche n'est pas corrigée :
          <ul className="mb-0 mt-1">
            {montrees.map((e) => (
              <li key={e.id}>
                <a href={`/usagers/${e.id}`}>{e.name}</a> : {e.motif}
              </li>
            ))}
            {apercu.ecartees.length > montrees.length ? (
              <li>
                et {apercu.ecartees.length - montrees.length} autre
                {apercu.ecartees.length - montrees.length > 1 ? "s" : ""} (onglet « Sans compte » de
                la liste des usagers)
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      <p className="small text-muted mb-0">
        <Icone nom="shield-check" taille={13} /> Ces personnes n'ont pas demandé de compte : le
        courriel le leur explique et leur permet de le refuser. À leur première connexion, elles
        lisent et acceptent les conditions d'utilisation saisies dans Paramètres › Portail (si ce
        texte est vide, rien ne leur est demandé).
      </p>
    </>
  );
}
