import { parseInt_ } from "@/lib/forms-util";
import { require as exigerModule } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { calculerValorisation, deposerAttestation, exerciceCourant } from "@/server/valorisation";

/** POST /valorisation/<orgId>/attestation : dépose l'attestation de l'organisation sur sa fiche. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerModule("subventions");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireEdit("subventions");
      const exercice =
        parseInt_(form.get("exercice"), exerciceCourant(), 2001) ?? exerciceCourant();
      const retour = `/valorisation?exercice=${exercice}`;
      const ligne = (await calculerValorisation(exercice)).find((l) => l.organisationId === id);
      if (!ligne)
        return redirigerAvecMessage(retour, "Organisation sans aide sur cet exercice.", "warning");
      await deposerAttestation(ligne, exercice, { name: user.name, email: user.email });
      return redirigerAvecMessage(
        retour,
        `Attestation ${exercice} déposée sur la fiche de ${ligne.nom} : l'usager la trouve dans ses documents.`,
        "success",
      );
    },
    "/valorisation",
  );
}
