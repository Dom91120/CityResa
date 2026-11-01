/**
 * Comptes (agents et usagers) : mot de passe provisoire, création d'un agent, lien de
 * réinitialisation, suppression sûre. Partagé par les écrans Utilisateurs, Usagers,
 * Équipe et Profil.
 */
import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import type { Role } from "@/generated/prisma/client";
import { champ, champOuNull, emailValide } from "@/lib/forms-util";
import { poserMotDePasse } from "@/server/amorcage";
import { auditRecord } from "@/server/audit";
import { auth } from "@/server/auth";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { envoyerDepuisModele } from "@/server/mailer";

/** Un mot de passe provisoire lisible (lettres et chiffres, sans caractères ambigus). */
export function motDePasseAleatoire(longueur = 12): string {
  const lettres = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const chiffres = "23456789";
  const tout = lettres + chiffres;
  const tirer = (s: string) => s[randomInt(s.length)];
  const chars = [tirer(lettres), tirer(chiffres), tirer(lettres), tirer(chiffres)];
  while (chars.length < longueur) chars.push(tirer(tout));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function nomComplet(u: {
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
}): string {
  return `${u.firstName} ${u.lastName}`.trim() || u.name || u.email;
}

export type Identite = {
  firstName: string;
  lastName: string;
  phone: string | null;
  fonction: string | null;
};

/** Les champs d'identité d'un formulaire (prénom, nom, téléphone, fonction). */
export function lireIdentite(form: FormData): Identite {
  const firstName = champ(form, "first_name").slice(0, 80);
  const lastName = champ(form, "last_name").slice(0, 80);
  if (!firstName || !lastName) throw new UserFacingError("Indiquez le prénom et le nom.");
  return {
    firstName,
    lastName,
    phone: champOuNull(form, "phone")?.slice(0, 40) ?? null,
    fonction: champOuNull(form, "fonction")?.slice(0, 120) ?? null,
  };
}

/** Une adresse de courriel propre, unique dans la base (sauf pour `saufId`). */
export async function lireEmailLibre(form: FormData, saufId?: string): Promise<string> {
  const email = champ(form, "email").toLowerCase();
  if (!emailValide(email)) throw new UserFacingError("Adresse de courriel invalide.");
  const existe = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existe && existe.id !== saufId)
    throw new UserFacingError("Un compte existe déjà avec cette adresse.");
  return email;
}

/** Les rôles de la collectivité (hors rôle usager). */
export async function rolesAgents(): Promise<Role[]> {
  return prisma.role.findMany({ where: { isUsager: false }, orderBy: { id: "asc" } });
}

/** Crée un compte agent avec un mot de passe provisoire ; envoie le courriel de bienvenue. */
export async function creerAgent(
  e: Identite & { email: string; role: string },
  acteur: string,
): Promise<{ id: string; motDePasse: string }> {
  const role = await prisma.role.findUnique({ where: { name: e.role } });
  if (!role || role.isUsager) throw new UserFacingError("Choisissez un rôle valide.");
  const motDePasse = motDePasseAleatoire();
  const u = await prisma.user.create({
    data: {
      email: e.email,
      name: `${e.firstName} ${e.lastName}`,
      firstName: e.firstName,
      lastName: e.lastName,
      phone: e.phone,
      fonction: e.fonction,
      kind: "agent",
      role: role.name,
    },
  });
  await poserMotDePasse(u.id, motDePasse);
  await auditRecord("creation agent", `${e.email} · ${role.label}`, "utilisateurs", acteur);
  const cfg = await getSettings();
  await envoyerDepuisModele("compte_cree", e.email, {
    prenom: e.firstName,
    lien: `${cfg.APP_BASE_URL}/connexion`,
  });
  return { id: u.id, motDePasse };
}

/** Envoie le lien de réinitialisation du mot de passe (Better Auth). */
export async function envoyerLienReinitialisation(email: string): Promise<void> {
  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/reinitialiser" },
      headers: await headers(),
    });
  } catch (e) {
    console.error("[utilisateurs] lien de réinitialisation impossible :", e);
    throw new UserFacingError("L'envoi du lien de réinitialisation a échoué.");
  }
}

/** Ce qui retient un compte en base (0 partout = suppression possible). */
export async function donneesLiees(userId: string): Promise<{ label: string; n: number }[]> {
  const [reservations, assignees, messages, documents, avis, paiements] = await Promise.all([
    prisma.reservation.count({ where: { userId } }),
    prisma.reservation.count({ where: { agentId: userId } }),
    prisma.message.count({ where: { authorId: userId } }),
    prisma.document.count({ where: { uploadedById: userId } }),
    prisma.subventionAvis.count({ where: { authorId: userId } }),
    prisma.paiement.count({ where: { recordedById: userId } }),
  ]);
  return [
    { label: "réservation(s) déposée(s)", n: reservations },
    { label: "réservation(s) assignée(s)", n: assignees },
    { label: "message(s)", n: messages },
    { label: "pièce(s) déposée(s)", n: documents },
    { label: "avis sur subvention", n: avis },
    { label: "paiement(s) enregistré(s)", n: paiements },
  ].filter((x) => x.n > 0);
}

/** Les espaces gérés par un agent, avec leur site. */
export async function espacesGeresPar(userId: string) {
  return prisma.espaceGestionnaire.findMany({
    where: { userId },
    include: {
      espace: {
        select: { id: true, name: true, shortName: true, site: { select: { name: true } } },
      },
    },
  });
}
