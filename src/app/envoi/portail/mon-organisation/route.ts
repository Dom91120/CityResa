import { manquesSur, phraseManques } from "@/lib/dossier-usager";
import { champ, champOuNull, coche, parseDate } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireUsager } from "@/server/guards";
import { interdit, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const ICI = "/portail/mon-organisation";

/** POST /portail/mon-organisation : l'usager met à jour les coordonnées de son organisation. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      if (!user.organisationId) return interdit();
      const org = await prisma.organisation.findUnique({ where: { id: user.organisationId } });
      if (!org) return interdit();
      const particulier = org.type === "particulier";
      const nom = particulier ? org.name : champ(form, "name").slice(0, 160);
      if (!nom)
        return redirigerAvecMessage(ICI, "Indiquez le nom de votre organisation.", "danger");
      const site = champOuNull(form, "website");
      if (site && !/^https?:\/\//i.test(site))
        return redirigerAvecMessage(
          ICI,
          "Le site web doit commencer par http:// ou https://.",
          "danger",
        );
      const dateAg = champ(form, "legal_appointed_at");
      const nommeLe = parseDate(dateAg);
      if (dateAg && !nommeLe)
        return redirigerAvecMessage(ICI, "La date de l'AG de nomination est invalide.", "danger");
      if (nommeLe && nommeLe.getTime() > Date.now())
        return redirigerAvecMessage(
          ICI,
          "La date de l'AG de nomination ne peut pas être dans le futur.",
          "danger",
        );
      const data = {
        name: nom,
        address: champOuNull(form, "address")?.slice(0, 200) ?? null,
        postalCode: champOuNull(form, "postal_code")?.slice(0, 10) ?? null,
        city: champOuNull(form, "city")?.slice(0, 80) ?? null,
        email: champOuNull(form, "email")?.slice(0, 160) ?? null,
        phone: champOuNull(form, "phone")?.slice(0, 40) ?? null,
        ...(particulier
          ? {}
          : {
              website: site?.slice(0, 200) ?? null,
              legalFirstName: champOuNull(form, "legal_first_name")?.slice(0, 80) ?? null,
              legalLastName: champOuNull(form, "legal_last_name")?.slice(0, 80) ?? null,
              legalAppointedAt: org.type === "association" ? nommeLe : null,
              sportive: org.type === "association" ? coche(form, "sportive") : false,
              siret: champOuNull(form, "siret")?.slice(0, 20) ?? null,
              rna:
                org.type === "association"
                  ? (champOuNull(form, "rna")?.slice(0, 20) ?? null)
                  : org.rna,
            }),
      };
      // Les données exigées pour réserver doivent être présentes dès l'enregistrement.
      const manques = manquesSur("organisation", { ...org, ...data }, user);
      if (manques.length) return redirigerAvecMessage(ICI, phraseManques(manques), "danger");
      await prisma.organisation.update({ where: { id: org.id }, data });
      await auditRecord("modification organisation (portail)", nom, "usagers", user.email);
      return redirigerAvecMessage(ICI, "Coordonnées enregistrées", "success");
    },
    ICI,
  );
}
