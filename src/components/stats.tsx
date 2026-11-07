import { Icone, IconePastille } from "@/components/icones";

/**
 * Une carte de synthèse : sur la première ligne l'icône, centrée sur le libellé et le chiffre,
 * puis à droite une flèche (carte cliquable) ou un indicateur d'évolution ; le détail en dessous,
 * sur toute la largeur.
 */
export function CarteStat({
  href,
  icone,
  teinte,
  label,
  valeur,
  detail,
  droite,
}: {
  href?: string;
  icone: string;
  teinte: string;
  label: string;
  valeur: React.ReactNode;
  detail?: React.ReactNode;
  droite?: React.ReactNode;
}) {
  const corps = (
    <>
      <div className="stat-haut">
        <IconePastille nom={icone} teinte={teinte} />
        <div className="stat-texte">
          <div className="stat-label">{label}</div>
          <div className="stat-number">{valeur}</div>
        </div>
        <span className="stat-droite">
          {droite ?? (href ? <Icone nom="arrow-right" taille={14} classes="text-faint" /> : null)}
        </span>
      </div>
      {detail ? <div className="stat-detail text-muted small">{detail}</div> : null}
    </>
  );
  return href ? (
    <a href={href} className="stat-card stat-card--ligne">
      {corps}
    </a>
  ) : (
    <div className="stat-card stat-card--ligne">{corps}</div>
  );
}
