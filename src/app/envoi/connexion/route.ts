import { safeNext, seConnecter } from "@/server/connexion";
import { getCurrentUser } from "@/server/guards";
import { clientIp, redirection, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /connexion */
export async function POST(req: Request) {
  const deja = await getCurrentUser();
  if (deja) return redirection(deja.isAgent ? "/" : "/portail/mes-reservations");
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const retour = next ? `/connexion?next=${encodeURIComponent(next)}` : "/connexion";
  return traiterFormulaire(
    req,
    async (form) => {
      const email = String(form.get("email") ?? "");
      const password = String(form.get("password") ?? "");
      const res = await seConnecter(email, password, await clientIp(), next);
      if (!res.ok) return redirigerAvecMessage(retour, res.message, "danger");
      if (res.twoFactor) return redirection("/2fa");
      return redirection(next ?? (res.isAgent ? "/" : "/portail/mes-reservations"));
    },
    retour,
  );
}
