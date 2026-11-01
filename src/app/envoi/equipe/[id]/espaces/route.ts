import { champ, ids } from "@/lib/forms-util";
import { nomComplet } from "@/modules/utilisateurs/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const ROLES = new Set(["gestionnaire", "lecteur", "notifie"]);

/** POST /equipe/[id]/espaces : remplace le périmètre d'espaces d'un agent. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireEdit("equipe");
      const agent = await prisma.user.findFirst({ where: { id, kind: "agent" } });
      if (!agent) return pasTrouve();
      const role = ROLES.has(champ(form, "role")) ? champ(form, "role") : "gestionnaire";
      const voulus = ids(form, "espace_id");
      const existants = await prisma.espace.findMany({
        where: { id: { in: voulus } },
        select: { id: true },
      });
      await prisma.$transaction([
        prisma.espaceGestionnaire.deleteMany({ where: { userId: id } }),
        ...(existants.length
          ? [
              prisma.espaceGestionnaire.createMany({
                data: existants.map((e) => ({ espaceId: e.id, userId: id, role })),
              }),
            ]
          : []),
      ]);
      await auditRecord(
        "perimetre agent",
        `${nomComplet(agent)} : ${existants.length} espace(s) · ${role}`,
        "equipe",
        user.email,
      );
      return redirigerAvecMessage(
        "/equipe",
        existants.length
          ? `${nomComplet(agent)} : ${existants.length} espace(s) en charge (${role}).`
          : `${nomComplet(agent)} : aucun périmètre restreint, tous les espaces.`,
        "success",
      );
    },
    "/equipe",
  );
}
