/**
 * Adresses : un en-tête `Location` ne transporte que de l'ASCII. Un chemin qui contient un
 * accent (valeur de formulaire renvoyée dans la requête, paramètre `next` décodé) doit être
 * percent-encodé en UTF-8, sans toucher aux séquences déjà encodées. Logique PURE : url.test.ts.
 */

/** « /reserver?title=Entraînement d'été » → « /reserver?title=Entra%C3%AEnement%20d'%C3%A9t%C3%A9 ». */
export function emplacementAscii(location: string): string {
  return location.replace(/[^\x21-\x7e]/g, (c) => encodeURIComponent(c));
}

/**
 * Une adresse de retour reçue en paramètre (`?retour=`) si c'est un chemin de l'application, sinon
 * null : un chemin absolu, sans domaine (« //site »), sans barre inversée ni caractère de contrôle,
 * pour qu'un lien fabriqué ne puisse pas renvoyer hors du site.
 */
export function cheminInterne(v: string | null | undefined): string | null {
  if (!v?.startsWith("/") || v.startsWith("//") || v.includes("\\")) return null;
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return null;
  }
  return v;
}

/** Ajoute `retour=…` à une adresse interne, avant son ancre : « /espaces/3?retour=%2Fplanning#onglet ». */
export function avecRetour(href: string, retour: string | null | undefined): string {
  if (!retour) return href;
  const i = href.indexOf("#");
  const base = i < 0 ? href : href.slice(0, i);
  const ancre = i < 0 ? "" : href.slice(i);
  return `${base}${base.includes("?") ? "&" : "?"}retour=${encodeURIComponent(retour)}${ancre}`;
}

/** L'infobulle de la flèche de retour d'une fiche selon l'endroit où elle ramène. */
export function libelleRetour(retour: string): string {
  if (/^\/planning\/semaine-type([/?#]|$)/.test(retour)) return "Retour à la semaine type";
  if (/^\/personnel\/personnes\/\d+([/?#]|$)/.test(retour))
    return "Retour à la fiche de la personne";
  if (/^\/personnel\/personnes([/?#]|$)/.test(retour)) return "Retour";
  if (/^\/planning([/?#]|$)/.test(retour)) return "Retour au planning";
  if (/^\/personnel([/?#]|$)/.test(retour)) return "Retour au planning de service";
  return "Retour";
}

/** Le chemin d'une fiche dont la flèche de retour suit l'origine (espace, dossier, personne). */
export function cheminFiche(pathname: string): string | null {
  return /^\/(espaces|reservations|personnel\/personnes)\/\d+$/.test(pathname) ? pathname : null;
}

/**
 * L'origine d'une fiche, gardée le temps qu'on y travaille : l'adresse ne porte `?retour=` qu'à
 * l'arrivée, puis une action (accepter, modifier…) recharge la fiche sans lui. Un cookie de session
 * retient donc « fiche|origine ». Il vaut tant qu'on reste sur la fiche ou ses sous-pages (le
 * référent en fait foi) ; arriver d'ailleurs sans `?retour=` l'efface, pour qu'une fiche rouverte
 * depuis la liste ne ramène pas à un planning quitté depuis longtemps.
 *
 * Rend l'origine à utiliser et le cookie à poser (chaîne), à effacer (null) ou à laisser (undefined).
 */
export function retourMemorise(d: {
  /** Le chemin demandé (une fiche, voir `cheminFiche`). */
  fiche: string;
  /** Le paramètre `?retour=` de l'adresse. */
  param: string | null | undefined;
  /** La valeur actuelle du cookie. */
  cookie: string | null | undefined;
  /** Le chemin de la page d'où l'on vient (en-tête Referer), s'il est connu. */
  referent: string | null | undefined;
}): { retour: string | null; cookie?: string | null } {
  const demande = cheminInterne(d.param);
  if (demande) {
    const valeur = `${d.fiche}|${demande}`;
    return { retour: demande, cookie: valeur === d.cookie ? undefined : valeur };
  }
  if (!d.cookie) return { retour: null };
  const i = d.cookie.indexOf("|");
  const garde = i < 0 ? null : cheminInterne(d.cookie.slice(i + 1));
  const surLaFiche =
    !!d.referent && (d.referent === d.fiche || d.referent.startsWith(`${d.fiche}/`));
  if (garde && d.cookie.slice(0, i) === d.fiche && surLaFiche) return { retour: garde };
  return { retour: null, cookie: null };
}
