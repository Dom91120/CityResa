import { constater } from "@/modules/planning/routes";
import { traiterFormulaire } from "@/server/http";

/** POST /planning/presences : constat de présence d'un créneau passé (saisie rapide). */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => constater(form), "/planning/presences");
}
