import { notFound } from "next/navigation";
import { Entete } from "@/components/fiche";
import { StatutSubvention } from "@/components/macros";
import { estFiche } from "@/lib/dossier-subvention";
import { CorpsFiche } from "@/modules/subventions/dossier-page";
import { chargerSubvention, peutDecider } from "@/modules/subventions/server";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Dossier de demande de subvention - CityRésa" };

export default async function FicheDossierPage({
  params,
}: {
  params: Promise<{ id: string; fiche: string }>;
}) {
  const page = await contexteModule("subventions", "subventions");
  const p = await params;
  const id = idDeRoute(p.id);
  if (!estFiche(p.fiche)) notFound();
  const s = await chargerSubvention(id);
  if (!s) notFound();
  return (
    <>
      <Entete
        titre={`Dossier ${s.exercice} · ${s.organisation.name}`}
        sousTitre={
          s.status === "brouillon"
            ? "Dossier en cours de rédaction : les fiches se remplissent une à une."
            : `Dossier ${s.numero} en lecture.`
        }
        retour={`/subventions/${id}`}
        badges={<StatutSubvention status={s.status} />}
      />
      <CorpsFiche
        page={page}
        s={s}
        cle={p.fiche}
        base="/subventions"
        portail={false}
        peutEditer={peutDecider(page.user)}
      />
    </>
  );
}
