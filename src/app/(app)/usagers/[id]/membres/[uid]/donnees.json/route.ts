import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireView } from "@/server/guards";
import { idDe, pasTrouve } from "@/server/http";
import { exportDonneesUsager, reponseJson } from "@/server/rgpd";

/** GET /usagers/[id]/membres/[uid]/donnees.json : les données d'un membre, pour répondre à une demande d'accès. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; uid: string }> },
) {
  const { id: raw, uid } = await params;
  const id = idDe(raw);
  if (!id) return pasTrouve();
  const user = await requireView("usagers");
  const membre = await prisma.user.findFirst({
    where: { id: uid, organisationId: id, kind: "usager" },
    select: { email: true },
  });
  if (!membre) return pasTrouve();
  const donnees = await exportDonneesUsager(uid);
  await auditRecord("export donnees usager", `${membre.email} (org #${id})`, "usagers", user.email);
  return reponseJson(donnees, `donnees-${membre.email.replace(/[^a-z0-9]+/gi, "-")}.json`);
}
