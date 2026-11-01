/**
 * Comptes usagers et organisations : inscription depuis le portail, création par un
 * agent, profil tarifaire par défaut, validation.
 */
import { emailValide } from "@/lib/forms-util";
import { poserMotDePasse } from "@/server/amorcage";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { envoyerDepuisModele } from "@/server/mailer";
import { notifierAgents } from "@/server/notifications";
import { reprocheMotDePasse } from "@/server/password";

/** Les codes postaux de la commune, déduits de l'adresse de la collectivité. */
export async function codesPostauxCommune(): Promise<string[]> {
  const cfg = await getSettings();
  const m = cfg.COLLECTIVITE_ADRESSE.match(/\b\d{5}\b/g);
  return m ? [...new Set(m)] : [];
}

/** Le profil tarifaire par défaut d'une organisation selon son type et son code postal. */
export async function profilParDefaut(
  type: string,
  postalCode: string | null,
): Promise<number | null> {
  const communes = await codesPostauxCommune();
  const local = Boolean(postalCode && communes.includes(postalCode.trim()));
  let code: string;
  if (type === "association") code = local ? "association_commune" : "association_exterieure";
  else if (type === "particulier") code = local ? "particulier_commune" : "particulier_exterieur";
  else if (type === "entreprise") code = "entreprise";
  else if (type === "service_interne") code = "service_interne";
  else if (type === "collectivite") code = "collectivite";
  else code = local ? "particulier_commune" : "particulier_exterieur";
  const p = await prisma.referential.findFirst({ where: { kind: "profil", code } });
  return p?.id ?? null;
}

export type Inscription = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  password: string;
  type: string;
  orgName: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  siret: string | null;
  rna: string | null;
  legalFirstName?: string | null;
  legalLastName?: string | null;
  legalAppointedAt?: Date | null;
  fonction?: string | null;
};

/** Crée l'organisation et le compte usager. Renvoie l'identifiant de l'utilisateur. */
export async function creerCompteUsager(
  e: Inscription,
  acteur: string,
  opts: { parAgent?: boolean; motDePasseTemporaire?: boolean } = {},
): Promise<string> {
  const cfg = await getSettings();
  const email = e.email.trim().toLowerCase();
  if (!emailValide(email)) throw new UserFacingError("Adresse de courriel invalide.");
  if (!e.firstName.trim() || !e.lastName.trim())
    throw new UserFacingError("Indiquez votre prénom et votre nom.");
  const reproche = reprocheMotDePasse(e.password, cfg.PASSWORD_MIN_LENGTH);
  if (reproche) throw new UserFacingError(reproche);
  if (await prisma.user.findUnique({ where: { email } }))
    throw new UserFacingError("Un compte existe déjà avec cette adresse.");
  const type =
    e.type in
    { association: 1, entreprise: 1, particulier: 1, service_interne: 1, collectivite: 1, autre: 1 }
      ? e.type
      : "particulier";
  const nomOrg =
    type === "particulier"
      ? `${e.firstName.trim()} ${e.lastName.trim()}`
      : (e.orgName ?? "").trim();
  if (!nomOrg) throw new UserFacingError("Indiquez le nom de votre organisation.");
  const profilId = await profilParDefaut(type, e.postalCode);
  const org = await prisma.organisation.create({
    data: {
      type,
      name: nomOrg.slice(0, 160),
      address: e.address,
      postalCode: e.postalCode,
      city: e.city,
      email,
      phone: e.phone,
      siret: e.siret,
      rna: e.rna,
      legalFirstName: e.legalFirstName?.trim().slice(0, 80) || null,
      legalLastName: e.legalLastName?.trim().slice(0, 80) || null,
      legalAppointedAt: e.legalAppointedAt ?? null,
      profilId,
      validatedAt: opts.parAgent || !cfg.VALIDATION_COMPTE_USAGER ? new Date() : null,
    },
  });
  const u = await prisma.user.create({
    data: {
      email,
      name: `${e.firstName.trim()} ${e.lastName.trim()}`,
      firstName: e.firstName.trim().slice(0, 80),
      lastName: e.lastName.trim().slice(0, 80),
      phone: e.phone,
      fonction: e.fonction ?? null,
      kind: "usager",
      role: "usager",
      organisationId: org.id,
      acceptedCguAt: opts.parAgent ? null : new Date(),
    },
  });
  await poserMotDePasse(u.id, e.password);
  await auditRecord(
    opts.parAgent ? "creation usager" : "inscription usager",
    `${email} · ${nomOrg}`,
    "usagers",
    acteur,
  );
  await envoyerDepuisModele("compte_cree", email, {
    prenom: e.firstName.trim(),
    lien: `${cfg.APP_BASE_URL}/portail`,
  });
  if (!opts.parAgent) {
    await notifierAgents(
      null,
      "usager",
      `Nouvel usager : ${nomOrg}`,
      `${e.firstName} ${e.lastName} · ${email}`,
      `/usagers/${org.id}`,
    );
  }
  return u.id;
}

/** Valide une organisation (accès aux tarifs de son profil). */
export async function validerOrganisation(id: number, acteur: string): Promise<void> {
  const org = await prisma.organisation.findUnique({ where: { id }, include: { users: true } });
  if (!org) throw new UserFacingError("Organisation introuvable.");
  await prisma.organisation.update({ where: { id }, data: { validatedAt: new Date() } });
  await auditRecord("validation organisation", org.name, "usagers", acteur);
  for (const u of org.users) {
    await envoyerDepuisModele("compte_valide", u.email, {
      prenom: u.firstName,
      organisation: org.name,
    });
  }
}
