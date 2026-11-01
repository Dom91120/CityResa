import { toutMarquerLu } from "@/modules/messages/server";
import { auditRecord } from "@/server/audit";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, suite } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

export async function toutLu(form: FormData): Promise<Response> {
  const user = await requireEdit("messages");
  const retour = suite(form, "/messages");
  const n = await toutMarquerLu(user);
  invalidateNavCounts();
  if (n) await auditRecord("messages marques lus", `${n} message(s)`, "messages", user.email);
  return redirigerAvecMessage(
    retour,
    n
      ? `${n} message${n > 1 ? "s" : ""} marqué${n > 1 ? "s" : ""} lu${n > 1 ? "s" : ""}.`
      : "Aucun message à marquer lu.",
    n ? "success" : "info",
  );
}
