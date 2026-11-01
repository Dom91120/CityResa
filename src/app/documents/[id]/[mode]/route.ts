import { prisma } from "@/server/db";
import { peutLire, reponseDocument } from "@/server/documents";
import { getCurrentUser } from "@/server/guards";
import { idDe, interdit, pasTrouve } from "@/server/http";

/** GET /documents/<id>/download | view | thumb */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; mode: string }> },
) {
  const { id: raw, mode } = await params;
  const id = idDe(raw);
  if (!id || !["download", "view", "thumb"].includes(mode)) return pasTrouve();
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return pasTrouve();
  const user = await getCurrentUser();
  if (!(await peutLire(user, doc)))
    return user
      ? interdit()
      : new Response(null, { status: 303, headers: { Location: "/connexion" } });
  const r = await reponseDocument(
    id,
    mode as "download" | "view" | "thumb",
    req.headers.get("if-none-match"),
  );
  return r ?? pasTrouve();
}
