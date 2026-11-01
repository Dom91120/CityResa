import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { primaryCssOverride } from "@/lib/theming";
import { getSettings } from "@/server/config-store";

export const metadata: Metadata = {
  title: "CityRésa",
  description: "Réservation des salles et équipements de la collectivité.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export const dynamic = "force-dynamic";

/** Une version qui change avec le fichier, pour forcer le rechargement de la feuille. */
const CSS_VERSION = (() => {
  try {
    const octets = readFileSync(path.join(process.cwd(), "public", "css", "cityresa.css"));
    return createHash("sha256").update(octets).digest("hex").slice(0, 10);
  } catch {
    return "1";
  }
})();

// Anti-FOUC : applique le thème avant le premier rendu.
const BOOT =
  "(function(){try{var t=new URLSearchParams(location.search).get('theme')||localStorage.getItem('theme')||'light';var h=document.documentElement;h.setAttribute('data-theme',t);h.style.backgroundColor=t==='dark'?'#0f1420':'#f7f7f9';}catch(e){}})();";
const ONGLET = "if(location.hash)document.documentElement.classList.add('onglet-a-rouvrir');";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const nonce = h.get("x-nonce") ?? undefined;
  const settings = await getSettings();
  const surcharge = primaryCssOverride(settings.UI_PRIMARY_COLOR);
  return (
    <html lang="fr" data-theme="light" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script inline statique, sans donnée externe. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: BOOT }} suppressHydrationWarning />
        <script
          nonce={nonce}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: script inline statique, sans donnée externe.
          dangerouslySetInnerHTML={{ __html: ONGLET }}
          suppressHydrationWarning
        />
        <link href="/vendor/bootstrap.min.css" rel="stylesheet" />
        <link href="/vendor/fonts/poppins.css" rel="stylesheet" />
        <link href={`/css/cityresa.css?v=${CSS_VERSION}`} rel="stylesheet" />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS calculée côté serveur depuis une couleur validée (#rrggbb). */}
        {surcharge ? <style dangerouslySetInnerHTML={{ __html: surcharge }} /> : null}
        <link rel="icon" href="/img/favicon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
