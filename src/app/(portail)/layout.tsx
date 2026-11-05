import { notFound } from "next/navigation";
import { Blason } from "@/components/blason";
import { Icone } from "@/components/icones";
import { ConfirmModal, ScriptDiffere, ScriptsPage } from "@/components/scripts";
import { FlashMessages } from "@/components/shell";
import { ETATS_ACCESSIBILITE } from "@/lib/accessibilite";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { allFlagsIn } from "@/server/features";
import { getCurrentUser } from "@/server/guards";
import { urlLogo } from "@/server/logo";
import { navCounts } from "@/server/nav";
import { contexteAnonyme } from "@/server/page";
import { whereUsager } from "@/server/reservations";

/**
 * La coque publique du portail : en-tête (marque, collectivité, navigation), messages
 * flash, contenu, pied de page. Pas de Shell du back-office. Un visiteur anonyme voit
 * le catalogue ; un usager connecté voit en plus son espace ; un agent connecté a un
 * raccourci vers le back-office.
 */
export default async function PortailLayout({ children }: { children: React.ReactNode }) {
  const [cfg, user, ctx] = await Promise.all([getSettings(), getCurrentUser(), contexteAnonyme()]);
  const estEspaceUsager = /^\/portail\/(mes-|mon-)/.test(ctx.pathname);
  if (!cfg.PORTAIL_ENABLED && !(user?.isUsager && estEspaceUsager)) notFound();
  const features = allFlagsIn(cfg);
  const usager = user?.isUsager ? user : null;
  const [counts, org, aSigner]: [Record<string, number>, { type: string } | null, number] = usager
    ? await Promise.all([
        navCounts(usager),
        usager.organisationId
          ? prisma.organisation.findUnique({
              where: { id: usager.organisationId },
              select: { type: true },
            })
          : null,
        prisma.reservation.count({ where: { AND: [whereUsager(usager), { status: "acceptee" }] } }),
      ])
    : [{}, null, 0];
  const nonLus = counts.messages ?? 0;

  type Lien = { href: string; label: string; icone: string; nb?: number };
  // « Espaces » mène au catalogue : inutile sur le catalogue lui-même pour un visiteur, dont
  // c'est la seule entrée du menu. Un usager connecté le garde (repère parmi ses pages).
  const surCatalogue = ctx.pathname === "/portail";
  const liens: Lien[] =
    user || !surCatalogue ? [{ href: "/portail", label: "Espaces", icone: "door-open" }] : [];
  if (usager) {
    liens.push({
      href: "/portail/mes-reservations",
      label: "Mes réservations",
      icone: "clipboard-list",
      nb: aSigner,
    });
    if (features.campagnes && org)
      liens.push({ href: "/portail/mes-voeux", label: "Mes vœux", icone: "calendar-check" });
    liens.push({
      href: "/portail/mes-messages",
      label: "Mes messages",
      icone: "message-circle",
      nb: nonLus,
    });
    liens.push({
      href: "/portail/mon-organisation",
      label: "Mon organisation",
      icone: "building-2",
    });
    if (features.subventions && org?.type === "association")
      liens.push({
        href: "/portail/mes-subventions",
        label: "Mes subventions",
        icone: "hand-coins",
      });
    liens.push({ href: "/portail/mon-compte", label: "Mon compte", icone: "circle-user" });
  }
  const actif = (href: string) =>
    href === "/portail"
      ? ctx.pathname === "/portail" || ctx.pathname.startsWith("/portail/espaces")
      : ctx.pathname === href || ctx.pathname.startsWith(`${href}/`);

  const lienNav = (l: Lien, classes = "") => (
    <a key={l.href} href={l.href} className={`${classes}${actif(l.href) ? " active" : ""}`}>
      <Icone nom={l.icone} taille={15} /> {l.label}
      {l.nb ? <span className="chip chip-primary ms-1">{l.nb}</span> : null}
    </a>
  );

  return (
    <div className="portail">
      <a href="#main-content" className="skip-link">
        Aller au contenu
      </a>
      <header className="portail-header">
        <div className="inner">
          <a href="/portail" className="portail-brand">
            {urlLogo(cfg) ? (
              <Blason logo={urlLogo(cfg)} taille={32} nom={cfg.COLLECTIVITE_NOM} />
            ) : (
              <Icone nom="calendar-check" taille={26} />
            )}
            <span>
              CityRésa
              <small>{cfg.COLLECTIVITE_NOM}</small>
            </span>
          </a>
          <nav className="portail-nav d-none d-lg-flex" aria-label="Navigation principale">
            {liens.map((l) => lienNav(l))}
            {user?.isAgent ? (
              <a href="/">
                <Icone nom="layout-dashboard" taille={15} /> Back-office
              </a>
            ) : null}
            {user ? (
              <a href="/deconnexion" className="text-muted">
                <Icone nom="log-out" taille={15} /> Déconnexion
              </a>
            ) : (
              <>
                <a href="/connexion">
                  <Icone nom="log-in" taille={15} /> Se connecter
                </a>
                {cfg.INSCRIPTION_ENABLED ? (
                  <a href="/inscription" className="btn btn-primary btn-sm ms-1 text-white">
                    Créer mon espace
                  </a>
                ) : null}
              </>
            )}
          </nav>
          <div className="dropdown ms-auto d-lg-none">
            <button
              type="button"
              className="btn btn-outline-secondary btn-icone"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              aria-label="Ouvrir le menu"
            >
              <Icone nom="menu" taille={18} />
              {nonLus || aSigner ? <span className="dot" /> : null}
            </button>
            <div className="dropdown-menu dropdown-menu-end">
              {liens.map((l) => lienNav(l, "dropdown-item"))}
              {liens.length ? <div className="dropdown-divider" /> : null}
              {user?.isAgent ? (
                <a href="/" className="dropdown-item">
                  <Icone nom="layout-dashboard" taille={14} /> Back-office
                </a>
              ) : null}
              {user ? (
                <a href="/deconnexion" className="dropdown-item">
                  <Icone nom="log-out" taille={14} /> Déconnexion
                </a>
              ) : (
                <>
                  <a href="/connexion" className="dropdown-item">
                    <Icone nom="log-in" taille={14} /> Se connecter
                  </a>
                  {cfg.INSCRIPTION_ENABLED ? (
                    <a href="/inscription" className="dropdown-item">
                      <Icone nom="user-plus" taille={14} /> Créer mon espace
                    </a>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="portail-main" id="main-content">
        <FlashMessages flashes={ctx.flashes} nonce={ctx.nonce} />
        {children}
      </main>

      <footer className="portail-footer">
        <div>
          <strong>{cfg.COLLECTIVITE_NOM}</strong>
          {cfg.COLLECTIVITE_ADRESSE ? ` · ${cfg.COLLECTIVITE_ADRESSE}` : ""}
        </div>
        <div className="mt-1">
          {cfg.COLLECTIVITE_EMAIL ? (
            <a href={`mailto:${cfg.COLLECTIVITE_EMAIL}`}>{cfg.COLLECTIVITE_EMAIL}</a>
          ) : null}
          {cfg.COLLECTIVITE_EMAIL && cfg.COLLECTIVITE_TELEPHONE ? " · " : ""}
          {cfg.COLLECTIVITE_TELEPHONE ? <span>{cfg.COLLECTIVITE_TELEPHONE}</span> : null}
          {cfg.COLLECTIVITE_SITE_WEB ? (
            <>
              {" · "}
              <a href={cfg.COLLECTIVITE_SITE_WEB} target="_blank" rel="noopener">
                Site de la collectivité
              </a>
            </>
          ) : null}
        </div>
        <nav className="mt-2" aria-label="Pages réglementaires">
          <a href="/portail/accessibilite">
            Accessibilité :{" "}
            {(ETATS_ACCESSIBILITE[cfg.ACCESSIBILITE_ETAT] ?? "non évalué").toLowerCase()}
          </a>
          {" · "}
          <a href="/portail/mentions-legales">Mentions légales</a>
          {" · "}
          <a href="/portail/donnees-personnelles">Données personnelles</a>
        </nav>
        <div className="mt-2 text-faint">Propulsé par CityRésa</div>
      </footer>

      <ConfirmModal csrf={ctx.csrf} nonce={ctx.nonce} />
      <ScriptsPage
        nonce={ctx.nonce}
        extra={<ScriptDiffere src="/js/portail.js" nonce={ctx.nonce} />}
      />
    </div>
  );
}
