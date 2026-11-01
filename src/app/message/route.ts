import { flash } from "@/server/flash";
import { redirection } from "@/server/http";

/**
 * GET /message?vers=<chemin>&c=<catégorie>&m=<texte> : pose un message flash puis
 * redirige. Relais des gardes et des layouts, qui ne peuvent pas écrire de cookie.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const vers = url.searchParams.get("vers") ?? "/";
  const chemin = vers.startsWith("/") && !vers.startsWith("//") ? vers : "/";
  const m = url.searchParams.get("m");
  if (m) await flash(m, url.searchParams.get("c") ?? "info");
  return redirection(chemin);
}
