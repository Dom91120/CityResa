/**
 * Usagers : lecture du formulaire d'une organisation, chargement d'une fiche, ajout d'un
 * membre (compte usager rattaché, mot de passe provisoire + courriel de bienvenue).
 */
import type { Referential } from "@/generated/prisma/client";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import { champ, champOuNull, idOuNull, parseDate } from "@/lib/forms-util";
import { lireEmailLibre, lireIdentite, motDePasseAleatoire } from "@/modules/utilisateurs/server";
import { poserMotDePasse } from "@/server/amorcage";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { envoyerDepuisModele } from "@/server/mailer";

export const INCLUDE_ORGANISATION = {
  profil: true,
  users: { orderBy: [{ lastName: "asc" as const }, { firstName: "asc" as const }] },
  _count: { select: { reservations: true, factures: true, subventions: true, documents: true } },
};

export async function chargerOrganisation(id: number) {
  return prisma.organisation.findUnique({ where: { id }, include: INCLUDE_ORGANISATION });
}

export type OrganisationComplete = NonNullable<Awaited<ReturnType<typeof chargerOrganisation>>>;

/** Les profils tarifaires actifs (référentiel). */
export async function profils(): Promise<Referential[]> {
  return prisma.referential.findMany({
    where: { kind: "profil", isActive: true },
    orderBy: [{ position: "asc" }, { label: "asc" }],
  });
}

export type OrganisationEntree = {
  type: string;
  name: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  siret: string | null;
  rna: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  legalFirstName: string | null;
  legalLastName: string | null;
  legalAppointedAt: Date | null;
  profilId: number | null;
  notes: string | null;
};

/** Les champs d'une organisation depuis un formulaire. */
export function lireOrganisation(form: FormData): OrganisationEntree {
  const type = champ(form, "type") in ORGANISATION_TYPES ? champ(form, "type") : "association";
  const name = champ(form, "name").slice(0, 160);
  if (!name && type !== "particulier")
    throw new UserFacingError("Indiquez le nom de l'organisation.");
  const borne = (n: string, max: number) => champOuNull(form, n)?.slice(0, max) ?? null;
  return {
    type,
    name,
    address: borne("address", 200),
    postalCode: borne("postal_code", 10),
    city: borne("city", 80),
    siret: borne("siret", 20),
    rna: borne("rna", 20),
    email: borne("email_org", 160)?.toLowerCase() ?? null,
    phone: borne("phone_org", 40),
    website: borne("website", 200),
    legalFirstName: borne("legal_first_name", 80),
    legalLastName: borne("legal_last_name", 80),
    legalAppointedAt: parseDate(form.get("legal_appointed_at")),
    profilId: idOuNull(form, "profil_id"),
    notes: champOuNull(form, "notes"),
  };
}

/** Ajoute un compte usager à une organisation. Renvoie l'identifiant et le mot de passe provisoire. */
export async function ajouterMembre(
  organisationId: number,
  form: FormData,
  acteur: string,
): Promise<{ id: string; motDePasse: string; email: string }> {
  const org = await prisma.organisation.findUnique({ where: { id: organisationId } });
  if (!org) throw new UserFacingError("Organisation introuvable.");
  const ident = lireIdentite(form);
  const email = await lireEmailLibre(form);
  const motDePasse = motDePasseAleatoire();
  const u = await prisma.user.create({
    data: {
      email,
      name: `${ident.firstName} ${ident.lastName}`,
      firstName: ident.firstName,
      lastName: ident.lastName,
      phone: ident.phone,
      fonction: ident.fonction,
      kind: "usager",
      role: "usager",
      organisationId,
    },
  });
  await poserMotDePasse(u.id, motDePasse);
  await auditRecord("ajout membre usager", `${email} · ${org.name}`, "usagers", acteur);
  const cfg = await getSettings();
  await envoyerDepuisModele("compte_cree", email, {
    prenom: ident.firstName,
    lien: `${cfg.APP_BASE_URL}/portail`,
  });
  return { id: u.id, motDePasse, email };
}

/** Le texte du flash qui affiche UNE fois un mot de passe provisoire. */
export function messageMotDePasse(email: string, motDePasse: string): string {
  return `Compte ${email} créé. Mot de passe provisoire (affiché une seule fois) : ${motDePasse}`;
}
