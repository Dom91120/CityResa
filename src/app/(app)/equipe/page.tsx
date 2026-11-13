import { redirect } from "next/navigation";
import { ListeComptes } from "@/modules/utilisateurs/liste";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Mon équipe - CityRésa" };

/** « Mon équipe » : les collègues et leurs espaces. L'administrateur passe par « Comptes ». */
export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteModule("equipe");
  if (page.user.isAdmin) redirect("/utilisateurs");
  return <ListeComptes page={page} params={await searchParams} admin={false} />;
}
