/**
 * Amorçage idempotent de la base : rôles, référentiels, modèles de courriel, compte
 * administrateur (mot de passe aléatoire affiché en console, ou ADMIN_INITIAL_PASSWORD),
 * configuration copiée du .env si la table est vide, logo de la collectivité livré avec le
 * dépôt si aucun n'est configuré, saison en cours avec ses jours fériés si aucune saison
 * n'existe. Appelé par `pnpm db:init` et au démarrage du serveur (instrumentation.ts).
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PERMISSION_CATEGORIES, REFERENTIAL_SEEDS, ROLE_SEEDS } from "@/lib/constantes";
import { seedSaison } from "@/server/calendrier";
import { getSettings, saveSettings, seedFromEnv } from "@/server/config-store";
import { prisma } from "@/server/db";
import { EMAIL_TEMPLATE_SEEDS } from "@/server/email-templates";
import { hashPassword, verifyPassword } from "@/server/password";

export async function seedRoles(): Promise<void> {
  for (const cfg of ROLE_SEEDS) {
    const role = await prisma.role.findUnique({ where: { name: cfg.name } });
    const perms = cfg.level
      ? Object.fromEntries(PERMISSION_CATEGORIES.map((c) => [c, cfg.level?.(c) ?? 0]))
      : {};
    if (!role) {
      await prisma.role.create({
        data: {
          name: cfg.name,
          label: cfg.label,
          description: cfg.description,
          isAdmin: cfg.isAdmin,
          isUsager: cfg.isUsager,
          permissions: perms,
        },
      });
    } else if (!role.isAdmin && cfg.level) {
      // Une catégorie nouvelle-née prend le niveau de départ du rôle.
      const actuel = { ...((role.permissions as Record<string, number> | null) ?? {}) };
      let missing = false;
      for (const c of PERMISSION_CATEGORIES) {
        if (!(c in actuel)) {
          actuel[c] = cfg.level(c);
          missing = true;
        }
      }
      if (missing)
        await prisma.role.update({ where: { id: role.id }, data: { permissions: actuel } });
    }
  }
}

/** Verse les valeurs de départ des listes administrables, seulement si la liste est vide. */
export async function seedReferentials(): Promise<void> {
  for (const [kind, items] of Object.entries(REFERENTIAL_SEEDS)) {
    const existe = await prisma.referential.findFirst({ where: { kind }, select: { id: true } });
    if (existe) continue;
    await prisma.referential.createMany({
      data: items.map((it, i) => ({
        kind,
        label: it.label,
        code: it.code ?? null,
        icon: it.icon ?? null,
        position: i,
      })),
    });
  }
}

/** Les modèles de courriel manquants sont créés ; ceux déjà édités sont laissés tels quels. */
export async function seedEmailTemplates(): Promise<void> {
  for (const s of EMAIL_TEMPLATE_SEEDS) {
    const existe = await prisma.emailTemplate.findUnique({ where: { key: s.key } });
    if (!existe)
      await prisma.emailTemplate.create({
        data: { key: s.key, label: s.label, subject: s.subject, body: s.body },
      });
  }
}

function annoncer(email: string, password: string, created: boolean): void {
  const action = created ? "créé" : "réinitialisé (mot de passe par défaut détecté)";
  console.log(`\n${"=".repeat(64)}`);
  console.log(`  COMPTE ADMINISTRATEUR ${action}`);
  console.log(`  Identifiant : ${email}`);
  console.log(`  Mot de passe: ${password}`);
  console.log("  -> Connectez-vous puis changez-le depuis votre profil.");
  console.log(`${"=".repeat(64)}\n`);
}

/** Crée ou met à jour l'identifiant Better Auth (table auth_account) d'un utilisateur. */
export async function poserMotDePasse(userId: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  const cred = await prisma.authAccount.findFirst({ where: { userId, providerId: "credential" } });
  if (cred) await prisma.authAccount.update({ where: { id: cred.id }, data: { password: hash } });
  else
    await prisma.authAccount.create({
      data: { accountId: userId, providerId: "credential", userId, password: hash },
    });
}

/** Le compte administrateur : créé avec un mot de passe aléatoire, ou réinitialisé s'il vaut encore « admin ». */
export async function seedDefaultUser(opts: { annoncer?: boolean } = {}): Promise<string | null> {
  const email = (process.env.ADMIN_EMAIL || "admin@localhost").toLowerCase();
  const nouveau = () => process.env.ADMIN_INITIAL_PASSWORD || randomBytes(9).toString("base64url");
  const admins = await prisma.user.count({ where: { role: "admin", kind: "agent" } });
  const admin = await prisma.user.findUnique({ where: { email } });
  if (!admin && admins === 0) {
    const password = nouveau();
    const u = await prisma.user.create({
      data: {
        email,
        name: "Administrateur",
        firstName: "Admin",
        lastName: "CityRésa",
        role: "admin",
        kind: "agent",
      },
    });
    await poserMotDePasse(u.id, password);
    if (opts.annoncer !== false) annoncer(email, password, true);
    return password;
  }
  if (admin) {
    const cred = await prisma.authAccount.findFirst({
      where: { userId: admin.id, providerId: "credential" },
    });
    if (!cred?.password || (await verifyPassword(cred.password, "admin"))) {
      const password = nouveau();
      await poserMotDePasse(admin.id, password);
      if (opts.annoncer !== false) annoncer(email, password, false);
      return password;
    }
  }
  return null;
}

/** Le logo de la collectivité livré avec le dépôt (déposé depuis Paramètres, exporté ici). */
export const FICHIER_LOGO = "prisma/assets/logo-collectivite.png";

/**
 * Installe le logo livré avec le dépôt si aucun logo n'est configuré. Un logo déposé
 * depuis Paramètres n'est jamais écrasé. Renvoie true si le logo a été posé.
 */
export async function seedLogo(): Promise<boolean> {
  const cfg = await getSettings();
  if (cfg.COLLECTIVITE_LOGO) return false;
  const chemin = resolve(process.cwd(), FICHIER_LOGO);
  if (!existsSync(chemin)) return false;
  const base64 = readFileSync(chemin).toString("base64");
  await saveSettings({ COLLECTIVITE_LOGO: `data:image/png;base64,${base64}` });
  return true;
}

/** Tout l'amorçage, dans l'ordre. */
export async function amorcer(opts: { annoncer?: boolean } = {}): Promise<void> {
  await seedRoles();
  await seedReferentials();
  await seedEmailTemplates();
  await seedDefaultUser(opts);
  await seedFromEnv();
  await seedLogo();
  await seedSaison();
}
