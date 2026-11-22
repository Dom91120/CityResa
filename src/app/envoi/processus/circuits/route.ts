import type { Prisma } from "@/generated/prisma/client";
import { DEFINITION_VIDE, lireObjet } from "@/lib/circuits";
import { champ, champOuNull } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import * as features from "@/server/features";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /processus/circuits : création d'un circuit, en brouillon. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireEdit("processus");
      await features.require("processus");
      const name = champ(form, "name").slice(0, 120);
      if (!name) return redirigerAvecMessage("/processus", "Indiquez le nom du circuit.", "danger");
      const objet = lireObjet(champ(form, "objet"));
      const dernier = await prisma.circuit.aggregate({
        where: { objet },
        _max: { position: true },
      });
      const c = await prisma.circuit.create({
        data: {
          objet,
          name,
          description: champOuNull(form, "description")?.slice(0, 400) ?? null,
          position: (dernier._max.position ?? 0) + 10,
          versions: {
            create: {
              numero: 1,
              status: "brouillon",
              definition: DEFINITION_VIDE as unknown as Prisma.InputJsonValue,
              createdBy: admin.name,
            },
          },
        },
      });
      await auditRecord("creation circuit", name, "processus", admin.email);
      return redirigerAvecMessage(
        `/processus/circuits/${c.id}`,
        `Circuit « ${name} » créé en brouillon : réglez son aiguillage et ses étapes, puis publiez-le.`,
        "success",
      );
    },
    "/processus",
  );
}
