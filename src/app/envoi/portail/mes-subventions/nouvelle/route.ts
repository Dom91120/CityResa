import { SUBVENTION_TYPES } from "@/lib/constantes";
import { champ, champOuNull, coche, parseFloat_, parseInt_ } from "@/lib/forms-util";
import { montant } from "@/lib/libelles";
import { organisationDe } from "@/modules/portail/catalogue";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { require as requireFeature } from "@/server/features";
import { requireUsager } from "@/server/guards";
import { interdit, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { envoyerDepuisModele } from "@/server/mailer";
import { invalidateNavCounts } from "@/server/nav";
import { notifierAgents } from "@/server/notifications";
import { prochainNumero } from "@/server/numerotation";

const ICI = "/portail/mes-subventions/nouvelle";

/** POST /portail/mes-subventions/nouvelle : dépôt d'une demande de subvention par une association. */
export async function POST(req: Request) {
  await requireFeature("subventions");
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      const org = await organisationDe(user);
      if (org?.type !== "association") return interdit();
      const annee = new Date().getFullYear();
      const exercice = parseInt_(form.get("exercice"), annee) ?? annee;
      const type = champ(form, "type");
      const objet = champ(form, "objet").slice(0, 200);
      const demande = parseFloat_(form.get("montant_demande"), 0) ?? 0;
      if (!(type in SUBVENTION_TYPES))
        return redirigerAvecMessage(ICI, "Type de subvention inconnu.", "danger");
      if (!objet) return redirigerAvecMessage(ICI, "Indiquez l'objet de la demande.", "danger");
      if (!(demande > 0))
        return redirigerAvecMessage(ICI, "Indiquez le montant demandé.", "danger");
      if (exercice < annee - 1 || exercice > annee + 2)
        return redirigerAvecMessage(ICI, "Exercice invalide.", "danger");
      if (!coche(form, "exact"))
        return redirigerAvecMessage(
          ICI,
          "Merci de certifier l'exactitude des informations.",
          "danger",
        );
      const numero = await prochainNumero("SUB");
      const s = await prisma.subvention.create({
        data: {
          numero,
          organisationId: org.id,
          exercice,
          objet,
          description: champOuNull(form, "description"),
          type,
          montantDemande: demande,
          budgetTotal: parseFloat_(form.get("budget_total"), null),
          beneficiaires: parseInt_(form.get("beneficiaires"), null, 0),
          status: "deposee",
          depositedBy: user.name,
        },
      });
      invalidateNavCounts();
      await auditRecord("depot subvention", `${numero} · ${org.name}`, "subventions", user.email);
      await envoyerDepuisModele("subvention_recue", user.email, {
        prenom: user.firstName || user.name,
        numero,
        objet,
        montant: montant(demande),
        exercice,
      });
      await notifierAgents(
        null,
        "subvention",
        `Nouvelle demande de subvention ${numero}`,
        `${org.name} · ${objet} · ${montant(demande)}`,
        `/subventions/${s.id}`,
      );
      return redirigerAvecMessage(
        `/portail/mes-subventions/${s.id}`,
        "Demande déposée. Vous pouvez maintenant joindre vos pièces.",
        "success",
      );
    },
    ICI,
  );
}
