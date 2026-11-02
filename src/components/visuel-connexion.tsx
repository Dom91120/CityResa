import { Icone } from "@/components/icones";

const ATOUTS = [
  {
    icone: "calendar-check",
    titre: "Disponibilités en temps réel",
    texte: "Consultez les créneaux libres des salles et équipements.",
  },
  {
    icone: "file-signature",
    titre: "Demande et signature en ligne",
    texte: "Déposez votre demande et signez la convention sans vous déplacer.",
  },
  {
    icone: "inbox",
    titre: "Suivi de vos réservations",
    texte: "Messages, factures et documents réunis dans votre espace.",
  },
];

/**
 * Le panneau de droite des pages de connexion et d'inscription : les points forts du
 * service et une accroche, sur le dégradé vert.
 */
export function VisuelConnexion({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="login-visuel">
      <ul className="login-atouts">
        {ATOUTS.map((a) => (
          <li key={a.titre}>
            <span className="ico">
              <Icone nom={a.icone} taille={18} />
            </span>
            <div>
              <strong>{a.titre}</strong>
              <span>{a.texte}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="accroche">
        <h2>{titre}</h2>
        <p>{texte}</p>
      </div>
    </div>
  );
}
