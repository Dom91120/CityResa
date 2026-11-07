/**
 * La page autour du contenu du back-office : barre latérale (marque, collectivité,
 * menu Général, Administration repliée, bloc d'aide, utilisateur), barre du haut
 * (titre, recherche Ctrl K, astuces, ajout rapide, cloche, avatar), messages flash.
 */
import { Blason } from "@/components/blason";
import { Icone } from "@/components/icones";
import { Avatar } from "@/components/macros";
import { ConfirmModal, ScriptDiffere, ScriptsPage } from "@/components/scripts";
import { ROLE_LABELS } from "@/lib/constantes";
import { depuis } from "@/lib/libelles";
import { ADMINISTRATION, entreeActive, GENERAL } from "@/lib/navigation";
import type { FeatureFlags } from "@/server/features";
import type { Flash } from "@/server/flash";
import type { CurrentUser } from "@/server/guards";

const FLASH_ICONS: Record<string, string> = {
  success: "circle-check",
  danger: "octagon-alert",
  warning: "triangle-alert",
  info: "info",
};

/** La couleur de l'icône d'une entrée de menu (variable CSS lue par .sidebar-link .lucide). */
function teinte(nom?: string): React.CSSProperties | undefined {
  return nom ? ({ "--ico": `var(--${nom}-text)` } as React.CSSProperties) : undefined;
}

export function FlashMessages({ flashes, nonce }: { flashes: Flash[]; nonce?: string }) {
  if (!flashes.length) return null;
  return (
    <div className="mb-3 flash-zone">
      {flashes.map(([category, message], i) => {
        const cat = category in FLASH_ICONS ? category : "info";
        return (
          <div
            key={i}
            className={`alert alert-${cat} alert-dismissible fade show d-flex align-items-center gap-2 js-autodismiss`}
            role="alert"
          >
            <Icone nom={FLASH_ICONS[cat]} taille={16} />
            <div className="flex-grow-1">{message}</div>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="alert"
              aria-label="Fermer"
            />
          </div>
        );
      })}
      <script src="/js/flash-clear.js" nonce={nonce} />
    </div>
  );
}

export type NotifLigne = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export const NOTIF_ICONES: Record<string, [string, string]> = {
  reservation: ["clipboard-list", "rose"],
  message: ["message-circle", "sky"],
  signature: ["pen-line", "violet"],
  paiement: ["credit-card", "emerald"],
  usager: ["users", "amber"],
  subvention: ["hand-coins", "lime"],
  rappel: ["bell", "amber"],
  personnel: ["shield", "slate"],
  systeme: ["info", "slate"],
};

export function Cloche({
  notifications,
  nonLues,
  csrf,
  lienTout,
}: {
  notifications: NotifLigne[];
  nonLues: number;
  csrf: string;
  lienTout: string;
}) {
  return (
    <div className="dropdown">
      <button
        type="button"
        className="topbar-icone"
        id="notif-bouton"
        data-bs-toggle="dropdown"
        data-bs-auto-close="outside"
        aria-expanded="false"
        aria-label="Notifications"
        title="Notifications"
        data-csrf={csrf}
      >
        <Icone nom="bell" taille={18} />
        {nonLues ? <span className="dot" /> : null}
      </button>
      <div className="dropdown-menu dropdown-menu-end notif-menu">
        <div className="notif-head">
          <span>Notifications</span>
          {nonLues ? (
            <span className="chip chip-primary">
              {nonLues} non lue{nonLues > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
        <div className="notif-list">
          {notifications.length ? (
            notifications.map((n) => {
              const [ico, teinte] = NOTIF_ICONES[n.type] ?? NOTIF_ICONES.systeme;
              return (
                <a
                  key={n.id}
                  href={n.link ?? lienTout}
                  className={`notif${n.readAt ? "" : " non-lue"}`}
                >
                  <span className={`notif-ico chip-${teinte}`}>
                    <Icone nom={ico} taille={14} />
                  </span>
                  <span className="notif-texte">
                    <strong>{n.title}</strong>
                    {n.body ? <span className="d-block text-muted">{n.body}</span> : null}
                    <small>{depuis(n.createdAt)}</small>
                  </span>
                </a>
              );
            })
          ) : (
            <div className="p-4 text-center text-muted small">Aucune notification.</div>
          )}
        </div>
        <a
          href={lienTout}
          className="d-block text-center small py-2 border-top"
          style={{ borderColor: "var(--line)" }}
        >
          Tout voir
        </a>
      </div>
    </div>
  );
}

export type ShellProps = {
  user: CurrentUser;
  counts: Record<string, number>;
  pathname: string;
  flashes: Flash[];
  csrf: string;
  nonce?: string;
  features: FeatureFlags;
  collectivite: string;
  logo?: string | null;
  titre?: React.ReactNode;
  nb?: number | string | null;
  notifications: NotifLigne[];
  children: React.ReactNode;
  extraJs?: React.ReactNode;
};

export function Shell({
  user,
  counts,
  pathname,
  flashes,
  csrf,
  nonce,
  features,
  collectivite,
  logo = null,
  titre,
  nb,
  notifications,
  children,
  extraJs,
}: ShellProps) {
  const [domActif, entreeActif] = entreeActive(pathname);
  const adminOuvert = domActif?.key === "administration";
  const visible = (e: (typeof GENERAL.entries)[number]) =>
    (!e.feature || features[e.feature]) &&
    (!e.perm || user.canView(e.perm)) &&
    (!e.admin || user.isAdmin);
  const titrePage = titre ?? entreeActif?.label ?? "CityRésa";
  const nonLues = counts.notifications ?? 0;
  return (
    <>
      <a href="#main-content" className="skip-link">
        Aller au contenu
      </a>

      <div className="sidebar-backdrop" data-action="closeSidebar" />
      <div className="sidebar">
        <div className="sidebar-brand">
          <a href="/" className="sidebar-logo">
            {logo ? (
              <Blason logo={logo} taille={44} nom={collectivite} />
            ) : (
              <Icone nom="calendar-check" taille={36} />
            )}
            <span>
              CityRésa
              <small className="text-truncate">{collectivite}</small>
            </span>
          </a>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">{GENERAL.label}</div>
            {GENERAL.entries.filter(visible).map((e) => {
              const n = e.count ? counts[e.count] : 0;
              return (
                <a
                  key={e.href}
                  href={e.href}
                  className={`sidebar-link${entreeActif?.href === e.href ? " active" : ""}`}
                  style={teinte(e.teinte)}
                >
                  <Icone nom={e.icon} />
                  <span>{e.label}</span>
                  {n ? (
                    <span
                      className={`nb${e.count === "messages" || e.count === "a_traiter" ? "" : " nb-muted"}`}
                    >
                      {n}
                    </span>
                  ) : null}
                </a>
              );
            })}
          </div>
          {user.isAdmin ? (
            <details
              className="sidebar-section sidebar-section--repliable"
              data-section="administration"
              open={adminOuvert || undefined}
              {...(adminOuvert ? { "data-forced-open": "" } : {})}
            >
              <summary className="sidebar-section-title">
                {ADMINISTRATION.label}
                <Icone nom="chevron-right" taille={14} />
              </summary>
              {ADMINISTRATION.entries.filter(visible).map((e) => (
                <a
                  key={e.href}
                  href={e.href}
                  className={`sidebar-link${entreeActif?.href === e.href ? " active" : ""}`}
                  style={teinte(e.teinte)}
                >
                  <Icone nom={e.icon} />
                  <span>{e.label}</span>
                </a>
              ))}
            </details>
          ) : null}
        </nav>

        <div className="sidebar-footer">
          <details className="sidebar-user">
            <summary>
              <Avatar nom={user.name} agent />
              <span className="sidebar-user-text">
                <span className="sidebar-username">{user.name}</span>
                <span className="sidebar-role">{ROLE_LABELS[user.role] ?? user.role}</span>
              </span>
              <Icone nom="chevron-down" taille={14} classes="ms-auto text-muted" />
            </summary>
            <div className="sidebar-user-menu" role="menu">
              <a href="/profil" className="sidebar-user-item" role="menuitem">
                <Icone nom="circle-user" taille={14} /> Mon profil
              </a>
              <a href="/profil#securite" className="sidebar-user-item" role="menuitem">
                <Icone nom="shield-check" taille={14} /> Sécurité
              </a>
              <a
                href="/portail"
                className="sidebar-user-item"
                role="menuitem"
                target="_blank"
                rel="noopener"
              >
                <Icone nom="external-link" taille={14} /> Voir le portail
              </a>
              <span
                className="sidebar-user-item"
                role="menuitem"
                data-action="toggleTheme"
                tabIndex={0}
              >
                <span className="js-theme-icon" aria-hidden="true" />
                Thème clair / sombre
              </span>
              <div className="sidebar-user-sep" role="separator" />
              <a
                href="/deconnexion"
                className="sidebar-user-item sidebar-user-item--danger"
                role="menuitem"
              >
                <Icone nom="log-out" taille={14} /> Déconnexion
              </a>
            </div>
          </details>
        </div>
      </div>

      <header className="app-topbar">
        <button
          className="topbar-toggle"
          type="button"
          data-action="toggleSidebar"
          aria-label="Ouvrir le menu"
        >
          <Icone nom="menu" taille={20} />
        </button>
        <div className="topbar-title">
          <span className="text-truncate">{titrePage}</span>
          {nb !== undefined && nb !== null ? <span className="nb">{nb}</span> : null}
        </div>
        <div className="topbar-right">
          <form method="GET" action="/recherche" className="topbar-search" role="search">
            <Icone nom="search" taille={15} />
            <input
              type="search"
              name="q"
              id="recherche-globale"
              placeholder="Rechercher partout"
              autoComplete="off"
              aria-label="Rechercher partout (Ctrl K)"
            />
            <kbd aria-hidden="true">Ctrl K</kbd>
          </form>
          <a href="/aide" className="topbar-link">
            <Icone nom="lightbulb" taille={15} /> Astuces
          </a>
          {user.canEdit("reservations") ? (
            <a href="/reservations/nouvelle" className="topbar-link">
              <Icone nom="plus" taille={15} /> Nouvelle réservation
            </a>
          ) : null}
          <Cloche
            notifications={notifications}
            nonLues={nonLues}
            csrf={csrf}
            lienTout="/notifications"
          />
        </div>
      </header>

      <main className="main-content" id="main-content">
        <FlashMessages flashes={flashes} nonce={nonce} />
        {children}
      </main>

      <ConfirmModal csrf={csrf} nonce={nonce} />
      <ScriptsPage
        nonce={nonce}
        extra={
          <>
            <ScriptDiffere src="/js/notifications.js" nonce={nonce} rang={1} />
            {extraJs}
          </>
        }
      />
    </>
  );
}
