import { champ, champOuNull, coche, idOuNull } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import * as features from "@/server/features";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const RETOUR = "/processus?onglet=delegations";

/** POST /processus/delegations : création ou modification d'une délégation d'élu. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireEdit("processus");
      await features.require("processus");
      const id = idOuNull(form, "id");
      const label = champ(form, "label").slice(0, 120);
      if (!label)
        return redirigerAvecMessage(RETOUR, "Indiquez l'intitulé de la délégation.", "danger");
      const homonyme = await prisma.delegation.findFirst({
        where: {
          label: { equals: label, mode: "insensitive" },
          ...(id ? { id: { not: id } } : {}),
        },
      });
      if (homonyme)
        return redirigerAvecMessage(RETOUR, "Une délégation porte déjà cet intitulé.", "danger");
      const agents = new Set(
        (
          await prisma.user.findMany({
            where: { kind: "agent", isActive: true },
            select: { id: true },
          })
        ).map((a) => a.id),
      );
      const userId = champOuNull(form, "user_id");
      const suppleantId = champOuNull(form, "suppleant_id");
      const data = {
        label,
        userId: userId && agents.has(userId) ? userId : null,
        suppleantId:
          suppleantId && agents.has(suppleantId) && suppleantId !== userId ? suppleantId : null,
        isActive: coche(form, "is_active"),
      };
      if (id) await prisma.delegation.update({ where: { id }, data });
      else await prisma.delegation.create({ data });
      await auditRecord(
        id ? "modification delegation" : "creation delegation",
        label,
        "processus",
        admin.email,
      );
      return redirigerAvecMessage(
        RETOUR,
        id ? `Délégation « ${label} » modifiée.` : `Délégation « ${label} » créée.`,
        "success",
      );
    },
    RETOUR,
  );
}
