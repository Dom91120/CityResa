import { notFound } from "next/navigation";
import { EnteteForm, PiedForm, SectionForm, Select } from "@/components/formulaire";
import { contexteAdmin } from "@/modules/admin/server";
import { chargerCircuit } from "@/modules/processus/server";
import { ChampsCondition } from "@/modules/processus/vues";
import { optionsCriteres } from "@/server/circuits";
import { prisma } from "@/server/db";
import { idDeRoute } from "@/server/guards";

export const metadata = { title: "Aiguillage du circuit - CityRésa" };

export default async function AiguillagePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteAdmin();
  if (!page.features.processus) notFound();
  const c = await chargerCircuit(idDeRoute((await params).id));
  if (!c) notFound();
  const [options, services] = await Promise.all([
    optionsCriteres(),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
  ]);
  const retour = `/processus/circuits/${c.id}`;
  return (
    <>
      <EnteteForm
        titre={`Aiguillage · ${c.name}`}
        retour={retour}
        sousTitre="Quels dossiers ce circuit reçoit, et à quel service il les confie."
      />
      <form method="POST" action={retour} id="form-principal" data-double-envoi>
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <input type="hidden" name="action" value="aiguillage" />
        <div className="data-card">
          <SectionForm
            titre="Service"
            icone="building-2"
            aide="Le service auquel les dossiers de ce circuit sont confiés. Il figure sur le dossier et reçoit les étapes adressées « au service du dossier »."
          >
            <Select
              label="Confier les dossiers à"
              name="service_id"
              options={services.map((s) => [String(s.id), s.name])}
              valeur={c.definition.serviceId}
              blank="— aucun service : les agents chargés de l'espace —"
            />
          </SectionForm>
          {c.parDefaut ? (
            <SectionForm titre="Règle d'aiguillage" icone="git-fork">
              <p className="text-muted mb-0">
                Ce circuit est le circuit par défaut : il reçoit tout dossier qu'aucun autre circuit
                ne prend, et ne porte donc pas de règle.
              </p>
            </SectionForm>
          ) : (
            <SectionForm
              titre="Règle d'aiguillage"
              icone="git-fork"
              aide="Ne renseignez que les critères qui comptent ; les autres restent « Indifférent »."
            >
              <ChampsCondition condition={c.definition.condition} options={options} />
            </SectionForm>
          )}
        </div>
        <PiedForm retour={retour} />
      </form>
    </>
  );
}
