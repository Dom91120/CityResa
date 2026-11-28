/**
 * Le portail coupé (réglage « Portail public actif ») : ce qu'il ferme, et à qui. PUR.
 *
 * Coupé, le portail est fermé à TOUS les usagers : ni catalogue, ni dépôt, ni espace personnel,
 * ni connexion. Les agents et les administrateurs ne sont jamais concernés : ils se connectent
 * par la même page et travaillent dans le back-office, où ils saisissent pour les usagers.
 * Seules les pages réglementaires (accessibilité, mentions légales, données personnelles)
 * restent lisibles par tous.
 */

/** Un compte de cette nature peut-il se connecter et garder sa session ? */
export function connexionOuverte(kind: string, portailActif: boolean): boolean {
  return kind !== "usager" || portailActif;
}

/** Le message opposé à un usager qui tente de se connecter portail coupé. */
export const MESSAGE_PORTAIL_FERME =
  "L'espace en ligne des usagers n'est pas ouvert pour le moment. Pour toute demande, contactez directement nos services.";

const PAGES_REGLEMENTAIRES = [
  "/portail/accessibilite",
  "/portail/mentions-legales",
  "/portail/donnees-personnelles",
];

/** La page reste-t-elle lisible portail coupé ? */
export function pageReglementaire(pathname: string): boolean {
  return PAGES_REGLEMENTAIRES.includes(pathname.replace(/\/+$/, ""));
}

/** Une page du portail s'affiche-t-elle ? */
export function pagePortailOuverte(pathname: string, portailActif: boolean): boolean {
  return portailActif || pageReglementaire(pathname);
}

/** La page où l'usager lit et accepte les conditions d'utilisation. */
export const PAGE_CONDITIONS = "/portail/conditions";

/**
 * L'usager doit-il encore accepter les conditions d'utilisation avant d'utiliser son espace ?
 * Oui s'il n'a aucune date d'acceptation (compte créé par un agent, invité à l'ouverture du
 * portail ou par un collègue) et que la collectivité a saisi des conditions. Sans texte, il n'y
 * a rien à accepter. Un agent n'est jamais concerné.
 */
export function conditionsAAccepter(
  compte: { kind: string; acceptedCguAt: Date | null },
  conditions: string | null | undefined,
): boolean {
  return compte.kind === "usager" && !compte.acceptedCguAt && Boolean(conditions?.trim());
}

const LIEN = /<a\b[^>]*\bhref="([^"]*)"[^>]*>[\s\S]*?<\/a>/gi;

function versPortail(href: string): boolean {
  try {
    const chemin = /^https?:\/\//i.test(href) ? new URL(href).pathname : href;
    return (
      chemin === "/portail" || chemin.startsWith("/portail/") || chemin.startsWith("/portail?")
    );
  } catch {
    return false;
  }
}

/** Les phrases d'un paragraphe : coupées après « . », « ! » ou « ? » suivis d'une espace. */
function phrases(html: string): string[] {
  const out: string[] = [];
  let courant = "";
  let dansBalise = false;
  let dansLien = 0;
  for (let i = 0; i < html.length; i++) {
    const c = html[i];
    courant += c;
    if (c === "<") {
      dansBalise = true;
      if (/^<a\b/i.test(html.slice(i, i + 3))) dansLien++;
      else if (/^<\/a>/i.test(html.slice(i, i + 4))) dansLien = Math.max(0, dansLien - 1);
    } else if (c === ">") dansBalise = false;
    else if (!dansBalise && !dansLien && /[.!?]/.test(c) && /\s/.test(html[i + 1] ?? "")) {
      out.push(courant);
      courant = "";
    }
  }
  if (courant.trim()) out.push(courant);
  return out;
}

/**
 * Le corps d'un courriel sans ses renvois au portail : chaque phrase qui porte un lien vers le
 * portail est retirée, et le paragraphe avec elle s'il n'en reste rien. Un courriel envoyé
 * portail coupé n'invite ainsi personne à entrer là où il ne peut pas aller. Les autres liens
 * (back-office, mot de passe) ne sont pas touchés.
 */
export function sansLiensPortail(html: string): string {
  const aRetirer = (bout: string) => [...bout.matchAll(LIEN)].some((m) => versPortail(m[1]));
  if (!aRetirer(html)) return html;
  return html.replace(/<(p|li)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (bloc, balise, attrs, contenu) => {
    if (!aRetirer(contenu)) return bloc;
    const reste = phrases(contenu)
      .filter((p) => !aRetirer(p))
      .join("")
      .trim();
    return reste ? `<${balise}${attrs}>${reste}</${balise}>` : "";
  });
}
