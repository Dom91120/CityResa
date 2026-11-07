/**
 * Le menu du back-office, en un seul endroit. Deux domaines : GÉNÉRAL (le quotidien des
 * agents, thème Vert) et ADMINISTRATION (réservé aux administrateurs).
 * Chaque entrée : chemin, libellé, icône Lucide, catégorie de droit (`perm`, null =
 * toujours visible), clé du compteur de la barre latérale, interrupteur de module.
 */
import type { PermissionCategory } from "@/lib/constantes";
import type { FeatureName } from "@/server/features";

export type NavEntry = {
  href: string;
  label: string;
  icon: string;
  perm: PermissionCategory | null;
  count: string | null;
  feature?: FeatureName;
  admin?: boolean;
  /** Libellé « NOUV. » / « BÊTA » à droite. */
  tag?: string;
  /** Couleur de l'icône : une teinte de la palette des pastilles (rose, amber, sky…). */
  teinte?: string;
};

export type NavDomaine = { key: string; label: string; entries: NavEntry[] };

/** Une entrée avec la couleur de son icône. */
function t(teinte: string, entree: NavEntry): NavEntry {
  return { ...entree, teinte };
}

function e(
  href: string,
  label: string,
  icon: string,
  perm: PermissionCategory | null = null,
  count: string | null = null,
  feature?: FeatureName,
): NavEntry {
  return { href, label, icon, perm, count, feature };
}

export const GENERAL: NavDomaine = {
  key: "general",
  label: "Général",
  entries: [
    t("sky", e("/", "Tableau de bord", "layout-dashboard")),
    t("emerald", e("/reservations", "Réservations", "clipboard-list", "reservations", "a_traiter")),
    t("violet", e("/planning", "Planning", "calendar-days", "planning")),
    t("rose", e("/campagnes", "Campagnes", "calendar-check", "reservations", null, "campagnes")),
    t("red", e("/sites", "Sites", "map-pin", "espaces")),
    t("amber", e("/espaces", "Espaces", "door-open", "espaces")),
    t("lime", e("/materiel", "Matériel", "boxes", "materiel", null, "materiel")),
    t("sky", e("/messages", "Messages", "message-circle", "messages", "messages")),
    t("rose", e("/usagers", "Usagers", "users", "usagers", "usagers_a_valider")),
    t("violet", e("/equipe", "Mon équipe", "contact-round", "equipe")),
    t(
      "slate",
      e("/personnel", "Personnel", "shield", "personnel", "propositions_personnel", "personnel"),
    ),
    t(
      "emerald",
      e("/paiements", "Paiements", "credit-card", "paiements", "factures_a_payer", "paiements"),
    ),
    t(
      "amber",
      e(
        "/subventions",
        "Subventions",
        "hand-coins",
        "subventions",
        "subventions_a_traiter",
        "subventions",
      ),
    ),
    t("lime", e("/valorisation", "Valorisation", "handshake", "subventions", null, "subventions")),
    t("sky", e("/statistiques", "Statistiques", "chart-column")),
  ],
};

export const ADMINISTRATION: NavDomaine = {
  key: "administration",
  label: "Administration",
  entries: [
    { ...e("/parametres", "Paramètres", "settings"), admin: true, teinte: "slate" },
    { ...e("/utilisateurs", "Utilisateurs", "user-cog"), admin: true, teinte: "sky" },
    { ...e("/roles", "Rôles & permissions", "shield"), admin: true, teinte: "red" },
    { ...e("/referentiels", "Référentiels", "list"), admin: true, teinte: "amber" },
    {
      ...e("/calendrier", "Calendrier des saisons", "calendar-range"),
      admin: true,
      teinte: "violet",
    },
    { ...e("/modeles-courriel", "Modèles de courriel", "mail"), admin: true, teinte: "rose" },
    { ...e("/audit", "Journal d'audit", "notebook-text"), admin: true, teinte: "lime" },
    { ...e("/taches", "Tâches planifiées", "calendar-clock"), admin: true, teinte: "emerald" },
    { ...e("/sauvegardes", "Sauvegardes", "database"), admin: true, teinte: "slate" },
  ],
};

/** Pages sans entrée de menu mais appartenant à un domaine : chemin → (domaine, libellé). */
const ORPHELINS: Record<string, [string, string]> = {
  "/profil": ["administration", "Mon profil"],
  "/recherche": ["general", "Recherche"],
  "/notifications": ["general", "Notifications"],
};

export function tousDomaines(): NavDomaine[] {
  return [GENERAL, ADMINISTRATION];
}

/** (domaine, entrée) de la page courante d'après son chemin. */
export function entreeActive(pathname: string): [NavDomaine | null, NavEntry | null] {
  const p = pathname.replace(/\/+$/, "") || "/";
  for (const [prefix, [key]] of Object.entries(ORPHELINS)) {
    if (p === prefix || p.startsWith(`${prefix}/`)) {
      const dom = tousDomaines().find((d) => d.key === key) ?? null;
      return [dom, null];
    }
  }
  for (const dom of tousDomaines()) {
    for (const en of dom.entries) if (en.href === p) return [dom, en];
  }
  let meilleur: [NavDomaine, NavEntry] | null = null;
  for (const dom of tousDomaines()) {
    for (const en of dom.entries) {
      if (en.href === "/") continue;
      if (p.startsWith(`${en.href}/`)) {
        if (!meilleur || en.href.length > meilleur[1].href.length) meilleur = [dom, en];
      }
    }
  }
  return meilleur ?? [null, null];
}

/** Le fil d'Ariane d'une page : [{href, label}], racine comprise. */
export function filAriane(pathname: string): { href: string; label: string }[] {
  const [, entree] = entreeActive(pathname);
  const out = [{ href: "/", label: "Tableau de bord" }];
  if (entree && entree.href !== "/") out.push({ href: entree.href, label: entree.label });
  return out;
}

/** Le menu du portail usager (espace « Mon compte »). */
export const PORTAIL: NavEntry[] = [
  e("/portail", "Catalogue des espaces", "door-open"),
  e("/portail/mes-reservations", "Mes réservations", "clipboard-list"),
  e("/portail/mes-voeux", "Mes vœux", "calendar-check", null, null, "campagnes"),
  e("/portail/mes-messages", "Mes messages", "message-circle"),
  e("/portail/mon-organisation", "Mon organisation", "building-2"),
  e("/portail/mes-subventions", "Mes subventions", "hand-coins", null, null, "subventions"),
  e("/portail/mon-compte", "Mon compte", "circle-user"),
];
