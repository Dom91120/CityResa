import { prisma } from "@/server/db";
import { pdfFacture } from "@/server/factures";
import { require as exigerModule } from "@/server/features";
import { requireView } from "@/server/guards";
import { idDe, pasTrouve } from "@/server/http";
import { reponsePdf } from "@/server/pdf";

/** GET /paiements/[id]/pdf : la facture en PDF (générée à la volée). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerModule("paiements");
  await requireView("paiements");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  const f = await prisma.facture.findUnique({ where: { id }, select: { numero: true } });
  if (!f) return pasTrouve();
  const pdf = await pdfFacture(id);
  if (!pdf) return pasTrouve();
  return reponsePdf(pdf, `${f.numero}.pdf`);
}
