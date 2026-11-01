/**
 * Icônes Lucide depuis le sprite embarqué (public/vendor/lucide.svg). Une icône de
 * module se dessine PARTOUT de la même façon : `<Icone nom="calendar-days" />`.
 */
export const LUCIDE_SPRITE = "/vendor/lucide.svg";

type Taille = number | string;

export function Icone({
  nom,
  taille = 16,
  classes = "",
  style,
  titre,
}: {
  nom: string;
  taille?: Taille;
  classes?: string;
  style?: React.CSSProperties;
  titre?: string;
}) {
  return (
    <svg
      className={`lucide lucide-${nom}${classes ? ` ${classes}` : ""}`}
      width={taille}
      height={taille}
      style={style}
      aria-hidden={titre ? undefined : "true"}
      role={titre ? "img" : undefined}
      aria-label={titre}
    >
      <use href={`${LUCIDE_SPRITE}#${nom}`} />
    </svg>
  );
}

/** Icône dans une pastille colorée (cartes de statistiques, notifications). */
export function IconePastille({
  nom,
  teinte = "rose",
  taille = 18,
  classes = "",
}: {
  nom: string;
  teinte?: string;
  taille?: number;
  classes?: string;
}) {
  return (
    <span className={`stat-ico chip-${teinte}${classes ? ` ${classes}` : ""}`}>
      <Icone nom={nom} taille={taille} />
    </span>
  );
}
