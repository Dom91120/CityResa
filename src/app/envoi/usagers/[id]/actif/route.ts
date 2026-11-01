import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /usagers/[id]/actif : désactive ou réactive l'organisation (et ses comptes). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("usagers");
    const org = await prisma.organisation.findUnique({ where: { id } });
    if (!org) return pasTrouve();
    const actif = !org.isActive;
    await prisma.organisation.update({ where: { id }, data: { isActive: actif } });
    await prisma.user.updateMany({ where: { organisationId: id }, data: { isActive: actif } });
    if (!actif) await prisma.session.deleteMany({ where: { user: { organisationId: id } } });
    await auditRecord(
      actif ? "reactivation organisation" : "desactivation organisation",
      `${org.name} (#${id})`,
      "usagers",
      user.email,
    );
    invalidateNavCounts();
    return redirigerAvecMessage(
      `/usagers/${id}`,
      actif
        ? "Organisation réactivée : ses membres peuvent de nouveau se connecter."
        : "Organisation désactivée : ses membres ne peuvent plus se connecter.",
      "success",
    );
  });
}
