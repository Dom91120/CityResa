import { prisma } from "@/server/db";

/** GET /healthz : l'application et sa base répondent. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "db_error" }, { status: 503 });
  }
}
