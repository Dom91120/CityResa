import { notFound } from "next/navigation";
import { BoutonOuvrir, Entete, MenuPost, MenuSep, ModalAction } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { VideBloc } from "@/components/liste";
import { CarteStat } from "@/components/stats";
import {
  type CampagneStatus,
  conflitsParVoeu,
  TRANSITION_CAMPAGNE_LIBELLES,
  TRANSITIONS_CAMPAGNE,
} from "@/lib/campagnes";
import { dateCourte, pluriel } from "@/lib/libelles";
import { ChampsCampagne, StatutCampagne, TableauVoeux } from "@/modules/campagnes/vues";
import { Onglets, Volet } from "@/modules/espaces/vues";
import { saisons } from "@/server/calendrier";
import { arbitrables, chargerCampagne, espacesDeCampagne } from "@/server/campagnes";
import { prisma } from "@/server/db";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Campagne de créneaux - CityRésa" };

export default async function CampagnePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("reservations", "campagnes");
  const { user, csrf } = page;
  const id = idDeRoute((await params).id);
  const c = await chargerCampagne(id);
  if (!c) notFound();
  const peutEditer = user.canEdit("reservations");
  const peutSupprimer = user.canDelete("reservations");
  const ici = `/campagnes/${c.id}`;
  const [listeSaisons, tousEspaces, ouverts] = await Promise.all([
    saisons(),
    prisma.espace.findMany({
      where: { isActive: true },
      include: { site: true },
      orderBy: [{ site: { name: "asc" } }, { name: "asc" }],
    }),
    espacesDeCampagne(c),
  ]);
  const conflits = conflitsParVoeu(arbitrables(c));
  const nb = (status: string) => c.voeux.filter((v) => v.status === status).length;
  const aPrevenir = c.voeux.filter((v) => v.status !== "en_attente" && !v.notifiedAt).length;
  const organisations = new Set(c.voeux.map((v) => v.organisationId)).size;
  const transitions = TRANSITIONS_CAMPAGNE[c.status as CampagneStatus] ?? [];
  // Les espaces qui ont des vœux d'abord, puis les autres espaces ouverts.
  const avecVoeux = new Map<number, typeof c.voeux>();
  for (const v of c.voeux) avecVoeux.set(v.espaceId, [...(avecVoeux.get(v.espaceId) ?? []), v]);
  const onglets = ouverts
    .filter((e) => avecVoeux.has(e.id) || c.status !== "cloturee")
    .map((e) => ({
      id: `e${e.id}`,
      label: e.name,
      icone: "door-open",
      nb: avecVoeux.get(e.id)?.length ?? 0,
    }));

  return (
    <>
      <Entete
        titre={c.label}
        badges={<StatutCampagne status={c.status} lg />}
        sousTitre={
          <>
            Saison {c.saison.label}
            {c.closeDate ? ` · dépôt jusqu'au ${dateCourte(c.closeDate)}` : ""} ·{" "}
            {pluriel(c.voeux.length, "vœu", "vœux")} de{" "}
            {pluriel(organisations, "organisation", "organisations")}
          </>
        }
        retour="/campagnes"
        actions={
          peutEditer ? (
            <>
              {c.status === "instruction" && nb("en_attente") ? (
                <form method="POST" action={`${ici}/arbitrer`} className="d-inline">
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    data-confirm={`Arbitrer automatiquement les ${nb("en_attente")} vœux en attente ? Les conflits sont tranchés par priorité puis ancienneté ; chaque vœu retenu crée un dossier sur toute la saison.`}
                  >
                    <Icone nom="gavel" taille={14} /> Arbitrer automatiquement
                  </button>
                </form>
              ) : null}
              {c.status !== "brouillon" && aPrevenir ? (
                <form method="POST" action={`${ici}/notifier`} className="d-inline">
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <button
                    type="submit"
                    className="btn btn-outline-primary"
                    data-confirm="Envoyer à chaque organisation un courriel récapitulant ses créneaux attribués et ses vœux refusés ?"
                  >
                    <Icone nom="send" taille={14} /> Prévenir les demandeurs ({aPrevenir})
                  </button>
                </form>
              ) : null}
              <BoutonOuvrir
                cible="modal-campagne"
                libelle="Modifier"
                icone="pencil"
                classe="btn-outline-secondary"
              />
            </>
          ) : undefined
        }
        menu={
          peutEditer
            ? [
                ...transitions.map((t) => (
                  <MenuPost
                    key={t}
                    url={`${ici}/statut`}
                    libelle={TRANSITION_CAMPAGNE_LIBELLES[t].label}
                    icone={TRANSITION_CAMPAGNE_LIBELLES[t].icone}
                    csrf={csrf}
                    champs={{ statut: t }}
                    confirm={
                      t === "ouverte"
                        ? "Ouvrir le dépôt : la campagne devient visible des usagers dans « Mes vœux »."
                        : t === "instruction"
                          ? "Clore le dépôt : les usagers ne pourront plus déposer ni retirer de vœu."
                          : undefined
                    }
                  />
                )),
                peutSupprimer ? <MenuSep key="sep" /> : null,
                peutSupprimer ? (
                  <MenuPost
                    key="supprimer"
                    url={`${ici}/supprimer`}
                    libelle="Supprimer la campagne"
                    icone="trash-2"
                    csrf={csrf}
                    danger
                    confirm="Supprimer cette campagne et tous ses vœux ?"
                  />
                ) : null,
              ]
            : undefined
        }
      />

      {/* Les mêmes cartes de synthèse que sur le tableau de bord. */}
      <div className="stat-grid">
        <CarteStat icone="hourglass" teinte="amber" label="En attente" valeur={nb("en_attente")} />
        <CarteStat icone="check" teinte="emerald" label="Attribués" valeur={nb("attribue")} />
        <CarteStat icone="x" teinte="red" label="Refusés" valeur={nb("refuse")} />
        <CarteStat icone="send" teinte="sky" label="À prévenir" valeur={aPrevenir} />
      </div>

      {c.consignes ? (
        <div className="astuce mb-3">
          <Icone nom="info" taille={18} />
          <div>
            <strong>Consignes aux demandeurs.</strong>
            <div style={{ whiteSpace: "pre-wrap" }}>{c.consignes}</div>
          </div>
        </div>
      ) : null}

      {c.status === "brouillon" ? (
        <div className="astuce mb-3">
          <Icone nom="lightbulb" taille={18} />
          <div>
            La campagne est en brouillon : vérifiez la saison, les espaces ouverts et les consignes,
            puis <strong>ouvrez le dépôt</strong> depuis le menu de la fiche.
          </div>
        </div>
      ) : null}

      {onglets.length ? (
        <div className="data-card">
          <Onglets onglets={onglets} />
          <div className="tab-content">
            {ouverts
              .filter((e) => onglets.some((o) => o.id === `e${e.id}`))
              .map((e, i) => {
                const voeux = avecVoeux.get(e.id) ?? [];
                return (
                  <Volet key={e.id} id={`e${e.id}`} premier={i === 0}>
                    {voeux.length ? (
                      <TableauVoeux
                        c={c}
                        voeux={voeux}
                        conflits={conflits}
                        peutDecider={peutEditer && user.gereEspace(e.id)}
                        csrf={csrf}
                      />
                    ) : (
                      <VideBloc
                        icone="inbox"
                        titre="Aucun vœu sur cet espace"
                        texte={
                          c.status === "ouverte"
                            ? "Le dépôt est ouvert : les vœux apparaîtront ici."
                            : undefined
                        }
                      />
                    )}
                  </Volet>
                );
              })}
          </div>
        </div>
      ) : (
        <div className="data-card">
          <VideBloc
            icone="door-open"
            titre="Aucun espace ouvert aux vœux"
            texte="Modifiez la campagne pour cocher des espaces, ou laissez la liste vide pour ouvrir tous les espaces publics."
          />
        </div>
      )}

      {peutEditer ? (
        <ModalAction
          id="modal-campagne"
          titre="Modifier la campagne"
          action={`${ici}/modifier`}
          csrf={csrf}
          bouton="Enregistrer"
          icone="check"
          taille="lg"
        >
          <ChampsCampagne
            c={c}
            saisons={listeSaisons}
            espaces={tousEspaces.map((e) => ({ id: e.id, name: e.name, siteName: e.site.name }))}
          />
        </ModalAction>
      ) : null}
    </>
  );
}
