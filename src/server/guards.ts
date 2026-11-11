/**
 * Session et droits.
 *
 * `getSession` est mémoïsée par requête (React.cache) ; `getCurrentUser` y ajoute la
 * fiche utilisateur complète, son rôle, son organisation, les espaces dont il a la
 * charge et la configuration vivante, pour répondre à `canView` / `canEdit` /
 * `canDelete` / `isAdmin` / `isAgent`.
 *
 * Deux populations : les AGENTS (back-office, droits par catégorie) et les USAGERS
 * (portail : ne voient que leurs propres dossiers).
 */
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Role as RoleRow, User as UserRow } from "@/generated/prisma/client";
import { PERMISSION_CATEGORIES, type PermissionCategory } from "@/lib/constantes";
import { auth } from "@/server/auth";
import { type AppSettings, getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { categoryEnabledIn } from "@/server/features";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";

const TOUCH_THROTTLE_MS = 60_000;

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

/** Lit la session Better Auth et applique le délai d'inactivité (SESSION_LIFETIME_MINUTES). */
async function readSession(): Promise<SessionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const lifetimeMs =
    (Number.parseInt(process.env.SESSION_LIFETIME_MINUTES ?? "480", 10) || 480) * 60_000;
  const lastSeen = session.session.updatedAt.getTime();
  if (Date.now() - lastSeen > lifetimeMs) {
    await prisma.session.deleteMany({ where: { id: session.session.id } });
    return null;
  }
  if (Date.now() - lastSeen >= TOUCH_THROTTLE_MS) {
    try {
      await prisma.session.update({
        where: { id: session.session.id },
        data: { updatedAt: new Date() },
      });
    } catch (e) {
      console.error("[guards] horodatage d'activité échoué :", e);
    }
  }
  return session;
}

export const getSession = cache(async () => readSession());

/** L'utilisateur connecté, avec ses droits. */
export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  fonction: string | null;
  role: string;
  roleObj: RoleRow | null;
  kind: string;
  isAgent: boolean;
  isUsager: boolean;
  isAdmin: boolean;
  organisationId: number | null;
  /** Secteur de l'agent (salle | sport) ; null = transversal. */
  secteur: string | null;
  hasTwoFactor: boolean;
  createdAt: Date;
  icsToken: string | null;
  dashboardPrefs: string | null;
  listPrefs: string | null;
  notifEmail: boolean;
  totpFailedCount: number;
  totpLockedUntil: Date | null;
  /**
   * Les espaces dont l'agent a la charge (vide = tous). Un agent d'un secteur sans aucun
   * rattachement a pour périmètre tous les espaces de son secteur.
   */
  espacesGeres: number[];
  /** Le périmètre vient de rattachements nominatifs (et non de tout le secteur, ou de tout). */
  perimetreExplicite: boolean;
  settings: AppSettings;
  permLevel: (category: string) => number;
  canView: (category?: string | null) => boolean;
  canEdit: (category?: string | null) => boolean;
  canDelete: (category: string) => boolean;
  /** L'agent peut-il décider sur cet espace (droit + périmètre) ? */
  gereEspace: (espaceId: number) => boolean;
  /** L'espace est-il dans le périmètre de l'agent (sans condition de droit) ? */
  voitEspace: (espaceId: number) => boolean;
};

export function buildCurrentUser(
  row: UserRow,
  roleObj: RoleRow | null,
  settings: AppSettings,
  espacesGeres: number[] = [],
  perimetreExplicite = espacesGeres.length > 0,
): CurrentUser {
  const isAdmin = roleObj ? Boolean(roleObj.isAdmin) : row.role === "admin";
  const isUsager = roleObj ? Boolean(roleObj.isUsager) : row.kind === "usager";
  const isAgent = !isUsager;
  const permLevel = (category: string): number => {
    if (isUsager) return 0;
    if (!categoryEnabledIn(settings, category)) return 0;
    if (roleObj) {
      if (roleObj.isAdmin) return 3;
      const perms = (roleObj.permissions as Record<string, number> | null) ?? {};
      return Number(perms[category] ?? 0) || 0;
    }
    return row.role === "admin" ? 3 : 1;
  };
  const canEdit = (category?: string | null): boolean => {
    if (category === undefined || category === null) {
      return isAdmin || PERMISSION_CATEGORIES.some((c) => permLevel(c) >= 2);
    }
    return permLevel(category) >= 2;
  };
  const name = `${row.firstName} ${row.lastName}`.trim() || row.name || row.email;
  return {
    id: row.id,
    email: row.email,
    name,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    fonction: row.fonction,
    role: row.role,
    roleObj,
    kind: row.kind,
    isAgent,
    isUsager,
    isAdmin,
    organisationId: row.organisationId,
    secteur: row.secteur ?? null,
    hasTwoFactor: Boolean(row.twoFactorEnabled),
    createdAt: row.createdAt,
    icsToken: row.icsToken,
    dashboardPrefs: row.dashboardPrefs,
    listPrefs: row.listPrefs,
    notifEmail: row.notifEmail,
    totpFailedCount: row.totpFailedCount,
    totpLockedUntil: row.totpLockedUntil,
    espacesGeres,
    perimetreExplicite,
    settings,
    permLevel,
    canView: (category) =>
      category === undefined || category === null ? isAgent : permLevel(category) >= 1,
    canEdit,
    canDelete: (category) => permLevel(category) >= 3,
    gereEspace: (espaceId) =>
      canEdit("reservations") && (espacesGeres.length === 0 || espacesGeres.includes(espaceId)),
    voitEspace: (espaceId) => espacesGeres.length === 0 || espacesGeres.includes(espaceId),
  };
}

/** Charge un utilisateur et son rôle en CurrentUser (hors requête : tâches, tests). */
export async function loadUser(userId: string): Promise<CurrentUser | null> {
  const [row, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getSettings(),
  ]);
  if (!row?.isActive) return null;
  const [roleObj, espaces] = await Promise.all([
    row.role ? prisma.role.findUnique({ where: { name: row.role } }) : null,
    prisma.espaceGestionnaire.findMany({ where: { userId }, select: { espaceId: true } }),
  ]);
  return buildCurrentUser(
    row,
    roleObj,
    settings,
    await perimetre(row, espaces),
    espaces.length > 0,
  );
}

/**
 * Le périmètre d'un agent : ses rattachements ; à défaut, tous les espaces de son secteur ;
 * sans secteur ni rattachement, tout (liste vide). Un secteur sans aucun espace ne donne accès
 * à rien : l'identifiant 0, qu'aucun espace ne porte, tient lieu de périmètre vide.
 */
async function perimetre(row: UserRow, rattachements: { espaceId: number }[]): Promise<number[]> {
  if (rattachements.length) return rattachements.map((e) => e.espaceId);
  if (row.kind !== "agent" || !row.secteur) return [];
  const duSecteur = await prisma.espace.findMany({
    where: { secteur: row.secteur },
    select: { id: true },
  });
  return duSecteur.length ? duSecteur.map((e) => e.id) : [0];
}

/** `current_user` : null si personne n'est connecté. Mémoïsé par requête. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;
  return loadUser(session.user.id);
});

/** Chemin courant, pour le paramètre `next` de la page de connexion. */
async function cheminCourant(): Promise<string> {
  const h = await headers();
  const p = h.get("x-pathname") ?? "/";
  const s = h.get("x-search") ?? "";
  return p + s;
}

/** Connexion requise : redirige vers /connexion sinon. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = await cheminCourant();
    redirect(next && next !== "/" ? `/connexion?next=${encodeURIComponent(next)}` : "/connexion");
  }
  return user;
}

/** Un AGENT connecté (back-office) ; un usager est renvoyé vers le portail. */
export async function requireAgent(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAgent) redirect("/portail/mes-reservations");
  return user;
}

/** Un USAGER connecté (portail) ; un agent est renvoyé vers le back-office. */
export async function requireUsager(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.isAgent) redirect("/");
  return user;
}

async function deny(
  message = "Vous n'avez pas les droits pour effectuer cette action.",
): Promise<never> {
  redirigerAvecFlashDepuisRendu("/", message, "danger");
}

/** Lecture d'une catégorie. */
export async function requireView(category: PermissionCategory | string): Promise<CurrentUser> {
  const user = await requireAgent();
  if (!user.canView(category)) await deny("Accès non autorisé à cette section.");
  return user;
}

/** Écriture sur une catégorie (ou n'importe laquelle si absente). */
export async function requireEdit(
  category?: PermissionCategory | string | null,
): Promise<CurrentUser> {
  const user = await requireAgent();
  if (!user.canEdit(category ?? null)) await deny();
  return user;
}

/** Suppression sur une catégorie. */
export async function requireDelete(category: PermissionCategory | string): Promise<CurrentUser> {
  const user = await requireAgent();
  if (!user.canDelete(category)) await deny();
  return user;
}

/** Réservé aux administrateurs. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAgent();
  if (!user.isAdmin) await deny("Accès réservé aux administrateurs.");
  return user;
}

/** Variante pour les routes API (route.ts) : lève au lieu de rediriger. */
export class ApiAuthError extends Error {
  constructor(
    readonly statut: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

export async function requireUserApi(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiAuthError(401, "Authentification requise.");
  return user;
}

export async function requireViewApi(category: string): Promise<CurrentUser> {
  const user = await requireUserApi();
  if (!user.canView(category)) throw new ApiAuthError(403, "Droits insuffisants.");
  return user;
}

export async function requireEditApi(category?: string | null): Promise<CurrentUser> {
  const user = await requireUserApi();
  if (!user.canEdit(category ?? null)) throw new ApiAuthError(403, "Droits insuffisants.");
  return user;
}

export async function requireAdminApi(): Promise<CurrentUser> {
  const user = await requireUserApi();
  if (!user.isAdmin) throw new ApiAuthError(403, "Accès réservé aux administrateurs.");
  return user;
}

/** Enveloppe d'une route API : convertit un refus en réponse HTTP. */
export async function reponseApi(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return Response.json({ error: e.message }, { status: e.statut });
    }
    throw e;
  }
}

/** Un identifiant de fiche depuis un paramètre de route ; 404 sinon. */
export function idDeRoute(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isInteger(n) || n <= 0) notFound();
  return n;
}
