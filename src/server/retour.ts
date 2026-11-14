import { headers } from "next/headers";
import { cheminInterne } from "@/lib/url";

/**
 * L'adresse où ramène la flèche de retour d'une fiche : la page d'où l'on vient (planning, semaine
 * type, planning de service…) si le middleware l'a retenue (`x-retour`, voir `retourMemorise`),
 * sinon la liste par défaut.
 */
export async function retourFiche(defaut: string): Promise<string> {
  const brut = (await headers()).get("x-retour");
  if (!brut) return defaut;
  try {
    return cheminInterne(decodeURIComponent(brut)) ?? defaut;
  } catch {
    return defaut;
  }
}
