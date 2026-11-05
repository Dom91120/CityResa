import { parseInt_ } from "@/lib/forms-util";
import { require as exigerModule } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { exerciceCourant, figerExercice, invaliderCacheValorisation } from "@/server/valorisation";

/** POST /valorisation/figer : arrête les montants de l'exercice et dépose les attestations. */
export async function POST(req: Request) {
  await exigerModule("subventions");
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireEdit("subventions");
      const exercice =
        parseInt_(form.get("exercice"), exerciceCourant(), 2001) ?? exerciceCourant();
      const n = await figerExercice(exercice, { name: user.name, email: user.email });
      invaliderCacheValorisation();
      return redirigerAvecMessage(
        `/valorisation?exercice=${exercice}`,
        n
          ? `Exercice ${exercice} figé : ${n} organisation(s), attestations déposées sur les fiches (visibles sur le portail).`
          : `Aucune organisation aidée sur l'exercice ${exercice} : rien à figer.`,
        n ? "success" : "info",
      );
    },
    "/valorisation",
  );
}
