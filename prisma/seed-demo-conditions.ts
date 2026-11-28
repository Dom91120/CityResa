/**
 * Les conditions d'utilisation du jeu de démonstration (réglage PORTAIL_CONDITIONS, modifiable
 * dans Paramètres › Portail). Elles s'affichent à l'inscription et sur le formulaire de demande,
 * et un usager dont le compte a été créé par la collectivité les accepte à sa première
 * connexion. Texte d'exemple : la Ville le remplace par le sien.
 */
import { getSettings, saveSettings } from "@/server/config-store";

export const CONDITIONS_DEMO = `Conditions d'utilisation du service de réservation en ligne

1. Objet
Ce service permet de consulter les espaces municipaux (salles, équipements sportifs), de déposer une demande de réservation et de suivre son dossier. Une demande n'est pas une réservation : elle le devient quand la collectivité l'a acceptée et, s'il y a lieu, quand la convention de mise à disposition est signée.

2. Votre compte
Le compte est personnel. Vous êtes responsable de l'exactitude des informations saisies (coordonnées, représentant légal, pièces justificatives) et de leur mise à jour. Une association ou une entreprise désigne les personnes habilitées à déposer des demandes en son nom.

3. Demandes et réponses
La collectivité instruit les demandes dans l'ordre de leur dépôt, en tenant compte de ses propres besoins, qui restent prioritaires. Elle peut demander des précisions, proposer un autre créneau ou refuser une demande, en indiquant le motif.

4. Utilisation des espaces
L'occupant utilise l'espace pour l'objet déclaré, dans la limite de la capacité autorisée et des horaires convenus. Il respecte le règlement intérieur de l'espace et les consignes de sécurité, rend les lieux propres et rangés, et signale tout dégât. La sous-location et la mise à disposition à un tiers sont interdites.

5. Assurance
L'occupant justifie d'une assurance de responsabilité civile couvrant l'activité pour toute la durée de l'occupation.

6. Tarifs, acompte et caution
Les tarifs sont ceux votés par le conseil municipal ; ils dépendent du profil de l'occupant. Un acompte et une caution peuvent être demandés. La caution est restituée après l'état des lieux de sortie, déduction faite des dégradations constatées.

7. Annulation
Une réservation peut être annulée sans frais jusqu'au délai indiqué sur le dossier. Passé ce délai, des frais peuvent rester dus selon le barème en vigueur. La collectivité peut annuler ou déplacer une réservation pour un motif d'intérêt général (sécurité, travaux, événement municipal) ; elle en informe l'occupant dès que possible.

8. Données personnelles
Les données recueillies servent à la gestion des réservations et des demandes de subvention. Elles sont conservées pendant la durée indiquée à la page « Données personnelles », où figurent aussi vos droits et la façon de les exercer.

9. Acceptation
L'utilisation du service vaut acceptation des présentes conditions. Elles peuvent évoluer ; la version en vigueur est celle affichée sur cette page.`;

/**
 * Pose les conditions de démonstration si la collectivité n'en a saisi aucune ; un texte déjà
 * présent n'est jamais remplacé. Renvoie vrai si le texte a été posé.
 */
export async function poserConditionsDemo(): Promise<boolean> {
  if ((await getSettings()).PORTAIL_CONDITIONS.trim()) return false;
  await saveSettings({ PORTAIL_CONDITIONS: CONDITIONS_DEMO });
  return true;
}
