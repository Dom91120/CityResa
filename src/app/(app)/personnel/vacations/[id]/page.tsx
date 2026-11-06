import { notFound } from "next/navigation";
import { Entete } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { isoParis, plage } from "@/lib/libelles";
import { nomPersonne } from "@/lib/personnel";
import { ChampsVacation, valeursDe } from "@/modules/personnel/vues";
import { prisma } from "@/server/db";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";
import { INCLUDE_VACATION, personnes, sitesDuPerimetre } from "@/server/personnel";

export const metadata = { title: "Vacation - CityRésa" };

export default async function VacationPage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("personnel", "personnel");
  if (!page.user.canEdit("personnel"))
    redirigerAvecFlashDepuisRendu(
      "/personnel",
      "Vous ne pouvez pas modifier les vacations.",
      "danger",
    );
  const id = idDeRoute((await params).id);
  const v = await prisma.vacation.findUnique({ where: { id }, include: INCLUDE_VACATION });
  if (!v) notFound();
  const [toutes, sites] = await Promise.all([personnes(false), sitesDuPerimetre(page.user)]);
  const retour = `/personnel?date=${isoParis(v.startAt).date}&site=${v.siteId}`;
  const serie = v.serieId
    ? await prisma.vacation.count({ where: { serieId: v.serieId, startAt: { gte: v.startAt } } })
    : 0;
  const { csrf } = page;
  return (
    <>
      <Entete
        titre="Vacation"
        sousTitre={`${nomPersonne(v.personnel)} · ${v.site.name} · ${plage(v.startAt, v.endAt)}`}
        retour={retour}
      />
      <div className="fiche-colonnes">
        <div className="data-card p-3">
          <form method="POST" action={`/personnel/vacations/${id}/modifier`} data-double-envoi>
            <input type="hidden" name="csrf_token" value={csrf} />
            <input type="hidden" name="next" value={retour} />
            <ChampsVacation
              personnes={toutes.filter((p) => p.isActive || p.id === v.personnelId)}
              sites={sites.some((s) => s.id === v.siteId) ? sites : [...sites, v.site]}
              valeurs={valeursDe(v)}
              avecRepetition={false}
              prefixe="mod"
            />
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn btn-primary">
                <Icone nom="check" taille={14} /> Enregistrer
              </button>
              <a href={retour} className="btn btn-outline-secondary">
                Annuler
              </a>
            </div>
          </form>
        </div>
        <div className="data-card p-3">
          <h2 className="h6">Supprimer</h2>
          <p className="small text-muted">
            {serie > 1
              ? `Cette vacation fait partie d'une série hebdomadaire : ${serie} vacations restent à venir à partir de celle-ci.`
              : "La suppression est immédiate."}
          </p>
          <div className="d-flex flex-column gap-2">
            <form method="POST" action={`/personnel/vacations/${id}/supprimer`}>
              <input type="hidden" name="csrf_token" value={csrf} />
              <input type="hidden" name="next" value={retour} />
              <button
                type="submit"
                className="btn btn-outline-danger btn-sm"
                data-confirm={`Supprimer la vacation du ${plage(v.startAt, v.endAt)} ?`}
              >
                <Icone nom="trash-2" taille={14} /> Supprimer cette vacation
              </button>
            </form>
            {serie > 1 ? (
              <form method="POST" action={`/personnel/vacations/${id}/supprimer_serie`}>
                <input type="hidden" name="csrf_token" value={csrf} />
                <input type="hidden" name="next" value={retour} />
                <button
                  type="submit"
                  className="btn btn-outline-danger btn-sm"
                  data-confirm={`Supprimer cette vacation et les ${serie - 1} suivantes de la série ?`}
                >
                  <Icone nom="repeat" taille={14} /> Supprimer celle-ci et les suivantes
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
