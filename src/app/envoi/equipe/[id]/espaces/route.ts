import { champ, ids } from "@/lib/forms-util";
import { collegue, libelleSecteur, rattachable } from "@/lib/secteurs";
import { nomComplet } from "@/modules/utilisateurs/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireEdit } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const ROLES = new Set(["gestionnaire", "lecteur", "notifie"]);

/**
 * POST /equipe/[id]/espaces : remplace le périmètre d'espaces d'un agent.
 * Un agent d'un secteur ne reçoit que des espaces de ce secteur ; celui qui répartit, s'il a
 * lui-même un secteur, n'agit que sur ses collègues et sur les espaces de son secteur (les
 * rattachements de l'agent dans l'autre secteur ne sont ni vus ni touchés).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireEdit("equipe");
      const retour = user.isAdmin ? "/utilisateurs" : "/equipe";
      const agent = await prisma.user.findFirst({ where: { id, kind: "agent" } });
      if (!agent) return pasTrouve();
      try {
        if (!user.isAdmin && (agent.role === "admin" || !collegue(user.secteur, agent.secteur)))
          throw new UserFacingError("Cet agent n'est pas dans votre équipe.");
        const role = ROLES.has(champ(form, "role")) ? champ(form, "role") : "gestionnaire";
        const voulus = ids(form, "espace_id");
        const existants = await prisma.espace.findMany({
          where: { id: { in: voulus } },
          select: { id: true, name: true, secteur: true },
        });
        const refuses = existants.filter(
          (e) => !rattachable(agent.secteur, e.secteur) || !rattachable(user.secteur, e.secteur),
        );
        if (refuses.length)
          throw new UserFacingError(
            `${nomComplet(agent)} (${libelleSecteur(agent.secteur)}) ne peut pas être rattaché à ${refuses.map((e) => e.name).join(", ")} : espace${refuses.length > 1 ? "s" : ""} d'un autre secteur.`,
          );
        await prisma.$transaction([
          prisma.espaceGestionnaire.deleteMany({
            where: {
              userId: id,
              ...(user.secteur ? { espace: { secteur: user.secteur } } : {}),
            },
          }),
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
        const sansRattachement = agent.secteur
          ? `aucun rattachement, tous les espaces du secteur ${libelleSecteur(agent.secteur)}.`
          : "aucun périmètre restreint, tous les espaces.";
        return redirigerAvecMessage(
          retour,
          existants.length
            ? `${nomComplet(agent)} : ${existants.length} espace(s) en charge (${role}).`
            : `${nomComplet(agent)} : ${sansRattachement}`,
          "success",
        );
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
        throw e;
      }
    },
    "/equipe",
  );
}
