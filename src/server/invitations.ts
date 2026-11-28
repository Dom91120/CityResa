/**
 * Ouverture du portail : création des comptes des usagers tenus jusque-là sans compte, et
 * courriel d'invitation. Les règles (qui inviter, qui écarter) sont dans src/lib/invitations.ts.
 *
 * Aucun mot de passe ne circule : le compte reçoit un mot de passe aléatoire jamais communiqué,
 * et l'usager choisit le sien par un lien d'activation. Ce lien est un jeton de réinitialisation
 * Better Auth (table `verification`, identifiant « reset-password:<jeton> ») posé ici avec une
 * validité longue : un envoi en masse s'ouvre rarement dans l'heure.
 */
import { randomBytes } from "node:crypto";
import {
  type Ecartee,
  type OrganisationAInviter,
  type TriInvitations,
  trierInvitations,
  validiteEnClair,
} from "@/lib/invitations";
import { poserMotDePasse } from "@/server/amorcage";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { journal } from "@/server/log";
import { envoyerDepuisModele } from "@/server/mailer";

/** Validité du lien d'activation d'une invitation. */
export const INVITATION_VALIDITE_JOURS = 14;

async function trier(types: readonly string[] | null): Promise<TriInvitations> {
  const [orgs, comptes] = await Promise.all([
    prisma.organisation.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        email: true,
        legalFirstName: true,
        legalLastName: true,
        _count: { select: { users: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.user.findMany({ select: { email: true } }),
  ]);
  const aTrier: OrganisationAInviter[] = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    type: o.type,
    email: o.email,
    legalFirstName: o.legalFirstName,
    legalLastName: o.legalLastName,
    comptes: o._count.users,
  }));
  return trierInvitations(aTrier, new Set(comptes.map((c) => c.email.toLowerCase())), types);
}

/** Ce que ferait une invitation maintenant, sans rien créer (pour la fenêtre de confirmation). */
export async function apercuInvitations(
  types: readonly string[] | null = null,
): Promise<TriInvitations> {
  return trier(types);
}

export type BilanInvitations = {
  invites: number;
  /** Comptes créés dont le courriel n'est pas parti : à relancer par « Mot de passe oublié ». */
  echecs: string[];
  ecartees: Ecartee[];
};

/**
 * Crée les comptes des organisations qui n'en ont pas et envoie les invitations. Rejouable : une
 * organisation déjà pourvue d'un compte est laissée, on n'invite donc jamais deux fois.
 */
export async function inviterUsagers(
  types: readonly string[] | null,
  acteur: string,
): Promise<BilanInvitations> {
  const cfg = await getSettings();
  const tri = await trier(types);
  const bilan: BilanInvitations = { invites: 0, echecs: [], ecartees: tri.ecartees };
  const expiresAt = new Date(Date.now() + INVITATION_VALIDITE_JOURS * 86_400_000);
  for (const i of tri.invitations) {
    try {
      const nom = `${i.firstName} ${i.lastName}`.trim();
      const u = await prisma.user.create({
        data: {
          email: i.email,
          name: nom || i.organisation,
          firstName: i.firstName,
          lastName: i.lastName,
          kind: "usager",
          role: "usager",
          organisationId: i.organisationId,
        },
      });
      // Mot de passe aléatoire, jamais affiché ni envoyé : l'usager choisit le sien par le lien.
      await poserMotDePasse(u.id, `${randomBytes(18).toString("base64url")}a1`);
      const jeton = randomBytes(24).toString("base64url");
      await prisma.verification.create({
        data: { identifier: `reset-password:${jeton}`, value: u.id, expiresAt },
      });
      const parti = await envoyerDepuisModele("compte_invitation", i.email, {
        prenom: i.firstName || "Madame, Monsieur",
        organisation: i.organisation,
        lien_activation: `${cfg.APP_BASE_URL}/reinitialiser?token=${encodeURIComponent(jeton)}`,
        validite: validiteEnClair(INVITATION_VALIDITE_JOURS),
      });
      bilan.invites += 1;
      if (!parti) bilan.echecs.push(i.email);
    } catch (e) {
      journal.erreur("invitations", "compte non créé", { organisation: i.organisation, erreur: e });
      bilan.ecartees.push({
        id: i.organisationId,
        name: i.organisation,
        motif: "le compte n'a pas pu être créé",
      });
    }
  }
  await auditRecord(
    "invitation des usagers",
    `${bilan.invites} compte(s) créé(s), ${bilan.echecs.length} envoi(s) en échec, ${bilan.ecartees.length} organisation(s) laissée(s) de côté${types ? ` · types : ${types.join(", ")}` : ""}`,
    "usagers",
    acteur,
  );
  return bilan;
}

/** Ferme les sessions de tous les usagers (portail coupé). Renvoie leur nombre. */
export async function fermerSessionsUsagers(): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { user: { kind: "usager" } } });
  return count;
}
