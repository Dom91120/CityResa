import { Shell } from "@/components/shell";
import { prisma } from "@/server/db";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { urlLogo } from "@/server/logo";
import { contextePage } from "@/server/page";

/**
 * Enveloppe des pages du back-office. Si REQUIRE_2FA_ADMIN est actif, un administrateur
 * sans second facteur n'est admis que sur son profil (pour l'activer).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const page = await contextePage();
  const { user } = page;
  if (user.settings.REQUIRE_2FA_ADMIN && user.isAdmin && !user.hasTwoFactor) {
    if (!["/profil"].includes(page.pathname)) {
      redirigerAvecFlashDepuisRendu(
        "/profil",
        "Sécurité : activez la double authentification pour continuer (obligatoire pour les comptes administrateur).",
        "warning",
      );
    }
  }
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return (
    <Shell
      user={user}
      counts={page.counts}
      pathname={page.pathname}
      flashes={page.flashes}
      csrf={page.csrf}
      nonce={page.nonce}
      features={page.features}
      collectivite={user.settings.COLLECTIVITE_NOM}
      logo={urlLogo(user.settings)}
      notifications={notifications}
    >
      {children}
    </Shell>
  );
}
