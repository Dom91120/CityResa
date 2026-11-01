import { parseInt_ } from "@/lib/forms-util";
import { requireUser } from "@/server/guards";
import { redirigerAvecMessage, referer, traiterFormulaire } from "@/server/http";
import { marquerLues } from "@/server/notifications";

/** POST /notifications/lues : tout marquer lu (ou une seule avec `id`). */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUser();
      const id = parseInt_(form.get("id"), null);
      await marquerLues(user.id, id ?? undefined);
      return redirigerAvecMessage(
        referer(req, "/notifications"),
        id ? "Notification marquée lue." : "Toutes les notifications sont marquées lues.",
        "success",
      );
    },
    "/notifications",
  );
}
