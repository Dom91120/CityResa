import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/guards";
import { json } from "@/server/http";

/** GET /api/notifications/count : notifications non lues de l'utilisateur connecté. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ count: 0 });
  const count = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
  return json({ count });
}
