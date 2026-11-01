import { Icone } from "@/components/icones";

/** Le blason de la collectivité : son logo s'il est configuré, sinon un pictogramme. */
export function Blason({
  logo,
  taille = 26,
  nom = "",
}: {
  logo: string | null;
  taille?: number;
  nom?: string;
}) {
  return (
    <span
      className={logo ? "blason blason--logo" : "blason"}
      style={{ width: taille, height: taille }}
    >
      {logo ? (
        <img src={logo} alt={nom} />
      ) : (
        <Icone nom="landmark" taille={Math.round(taille * 0.58)} />
      )}
    </span>
  );
}
