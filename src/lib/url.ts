/**
 * Adresses : un en-tête `Location` ne transporte que de l'ASCII. Un chemin qui contient un
 * accent (valeur de formulaire renvoyée dans la requête, paramètre `next` décodé) doit être
 * percent-encodé en UTF-8, sans toucher aux séquences déjà encodées. Logique PURE : url.test.ts.
 */

/** « /reserver?title=Entraînement d'été » → « /reserver?title=Entra%C3%AEnement%20d'%C3%A9t%C3%A9 ». */
export function emplacementAscii(location: string): string {
  return location.replace(/[^\x21-\x7e]/g, (c) => encodeURIComponent(c));
}
