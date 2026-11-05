import { prisma } from "@/server/db";
import { require as exigerModule } from "@/server/features";
import { requireView } from "@/server/guards";
import { idDe, pasTrouve } from "@/server/http";
import { reponsePdf } from "@/server/pdf";
import { calculerValorisation, exerciceCourant, pdfAttestation } from "@/server/valorisation";

/** GET /valorisation/<orgId>/attestation.pdf?exercice= : l'attestation annuelle d'une organisation, à la volée. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerModule("subventions");
  await requireView("subventions");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  const ex = Number(new URL(req.url).searchParams.get("exercice"));
  const exercice = Number.isInteger(ex) && ex > 2000 ? ex : exerciceCourant();
  const ligne = (await calculerValorisation(exercice)).find((l) => l.organisationId === id);
  if (!ligne) return pasTrouve();
  const figee = await prisma.valorisation.findUnique({
    where: { organisationId_exercice: { organisationId: id, exercice } },
  });
  return reponsePdf(
    await pdfAttestation(ligne, exercice, figee),
    `attestation-${exercice}-${id}.pdf`,
  );
}
