/**
 * Le panneau de droite des pages de connexion et d'inscription : une illustration des
 * écrans du portail au premier plan sur le dégradé vert, et une accroche.
 * L'illustration (public/img/illustration-cityresa.webp) est composée à partir de captures
 * du portail usager avec les données de démonstration.
 */
export function VisuelConnexion({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="login-visuel">
      <img
        src="/img/illustration-cityresa.webp"
        alt="Aperçu du portail CityRésa : catalogue des espaces, fiche d’une salle et suivi d’une réservation"
        className="login-illustration"
        width={2240}
        height={1260}
      />
      <div className="accroche">
        <h2>{titre}</h2>
        <p>{texte}</p>
      </div>
    </div>
  );
}
