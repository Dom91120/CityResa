import { prisma } from "@/server/db";
import { requireUsager } from "@/server/guards";
import { idDe, pasTrouve } from "@/server/http";
import { reponsePdf } from "@/server/pdf";
import { pdfDossier } from "@/server/subventions-dossier";

/** GET /portail/mes-subventions/<id>/dossier.pdf : le dossier de l'association, rendu à la volée. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUsager();
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  const s = await prisma.subvention.findFirst({
    where: { id, organisationId: user.organisationId ?? -1 },
    select: { numero: true },
  });
  if (!s) return pasTrouve();
  const pdf = await pdfDossier(id);
  if (!pdf) return pasTrouve();
  return reponsePdf(pdf, `dossier-subvention-${s.numero}.pdf`);
}
