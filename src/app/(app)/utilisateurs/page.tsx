import { contexteAdmin } from "@/modules/admin/server";
import { ListeComptes } from "@/modules/utilisateurs/liste";

export const metadata = { title: "Comptes - CityRésa" };

/** « Comptes » : tous les comptes du back-office, pour l'administrateur. */
export default async function ComptesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteAdmin();
  return <ListeComptes page={page} params={await searchParams} admin />;
}
