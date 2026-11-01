import { getCurrentUser } from "@/server/guards";
import { json, verifierCsrf } from "@/server/http";
import { marquerLues } from "@/server/notifications";

/** POST /api/notifications/lues : marque toutes les notifications lues. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Authentification requise." }, 401);
  if (!(await verifierCsrf(req))) return json({ error: "CSRF" }, 400);
  await marquerLues(user.id);
  return json({ ok: true });
}
