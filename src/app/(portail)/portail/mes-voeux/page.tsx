import { notFound } from "next/navigation";
import { Champ, Interrupteur, Select, Zone } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import { decrireCreneauHebdo } from "@/lib/campagnes";
import { JOURS_ISO } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import { StatutVoeu } from "@/modules/campagnes/vues";
import { organisationDe } from "@/modules/portail/catalogue";
import { BlocVide } from "@/modules/portail/vues";
import { campagneOuverte, espacesDeCampagne, voeuxDe } from "@/server/campagnes";
import { contexteUsager } from "@/server/page";

export const metadata = { title: "Mes vœux de créneaux - CityRésa" };

export default async function MesVoeuxPage() {
  const page = await contexteUsager();
  if (!page.features.campagnes) notFound();
  const { user, csrf } = page;
  const org = await organisationDe(user);
  const [ouverte, voeux] = await Promise.all([
    campagneOuverte(),
    org ? voeuxDe(org.id) : Promise.resolve([]),
  ]);
  const espaces = ouverte ? await espacesDeCampagne(ouverte) : [];
  const enCours = ouverte ? voeux.filter((v) => v.campagneId === ouverte.id) : [];
  const autres = voeux.filter((v) => !ouverte || v.campagneId !== ouverte.id);
  // Regroupés par campagne, les plus récentes d'abord (l'ordre de voeuxDe).
  const parCampagne = new Map<number, typeof autres>();
  for (const v of autres)
    parCampagne.set(v.campagneId, [...(parCampagne.get(v.campagneId) ?? []), v]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mes vœux de créneaux</h1>
          <p className="page-subtitle">
            Chaque saison, déposez vos souhaits de créneaux hebdomadaires ; la collectivité arbitre
            et vous répond par courriel.
          </p>
        </div>
      </div>

      {!org ? (
        <div className="data-card">
          <BlocVide
            icone="building-2"
            titre="Aucune organisation rattachée à votre compte"
            texte="Les vœux de créneaux se déposent au nom d'une association ou d'une structure."
          />
        </div>
      ) : ouverte ? (
        <>
          <div className="astuce mb-3">
            <Icone nom="megaphone" taille={18} />
            <div>
              <strong>{ouverte.label}</strong> · saison {ouverte.saison.label}
              {ouverte.closeDate ? ` · dépôt jusqu'au ${dateCourte(ouverte.closeDate)}` : ""}
              {ouverte.consignes ? (
                <div style={{ whiteSpace: "pre-wrap" }}>{ouverte.consignes}</div>
              ) : null}
            </div>
          </div>

          <div className="data-card p-4 mb-3" id="voeux">
            <h2 className="h5 mb-3">
              <Icone nom="calendar-check" taille={18} /> Vos vœux pour {ouverte.label}
            </h2>
            {enCours.length ? (
              <table className="table align-middle">
                <tbody>
                  {enCours.map((v) => (
                    <tr key={v.id}>
                      <td className="fw-medium">{decrireCreneauHebdo(v)}</td>
                      <td>{v.espace.shortName || v.espace.name}</td>
                      <td>{v.title}</td>
                      <td className="small text-muted">
                        {v.horsVacances ? "Hors vacances" : "Vacances comprises"}
                      </td>
                      <td>
                        <StatutVoeu status={v.status} />
                      </td>
                      <td className="actions">
                        {v.status === "en_attente" ? (
                          <form
                            method="POST"
                            action={`/portail/mes-voeux/${v.id}/retirer`}
                            className="d-inline"
                          >
                            <input type="hidden" name="csrf_token" value={csrf} />
                            <button
                              type="submit"
                              className="btn btn-ghost btn-ghost-danger btn-sm"
                              data-confirm="Retirer ce vœu ?"
                            >
                              <Icone nom="x" taille={14} /> Retirer
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted mb-0">Aucun vœu déposé pour l'instant.</p>
            )}
          </div>

          <form
            method="POST"
            action="/portail/mes-voeux/nouveau"
            className="data-card p-4 mb-3"
            data-double-envoi
          >
            <input type="hidden" name="csrf_token" value={csrf} />
            <h2 className="h5 mb-3">
              <Icone nom="plus" taille={18} /> Nouveau vœu
            </h2>
            <div className="grille grille-3">
              <Select
                label="Espace souhaité"
                name="espace_id"
                options={espaces.map((e) => [String(e.id), `${e.name} · ${e.siteName}`])}
                requis
                blank="Choisir…"
              />
              <Select
                label="Jour"
                name="weekday"
                options={JOURS_ISO.map((j) => [String(j.iso), j.long])}
                requis
                blank="Choisir…"
              />
              <div>
                <label className="form-label" htmlFor="v-debut">
                  Horaire <span className="req">*</span>
                </label>
                <div className="d-flex align-items-center gap-2">
                  <input
                    type="time"
                    name="heure_debut"
                    id="v-debut"
                    className="form-control"
                    required
                    step={900}
                    aria-label="Heure de début"
                  />
                  <span className="text-muted">–</span>
                  <input
                    type="time"
                    name="heure_fin"
                    className="form-control"
                    required
                    step={900}
                    aria-label="Heure de fin"
                  />
                </div>
              </div>
              <Champ
                label="Activité"
                name="title"
                requis
                pleine
                placeholder="Ex. : Entraînement seniors, cours de danse…"
              />
              <Champ label="Participants habituels" name="participants" type="number" min={1} />
              <Zone
                label="Précisions"
                name="description"
                rows={2}
                placeholder="Matériel, contraintes, public accueilli…"
              />
              <div style={{ gridColumn: "1 / -1" }}>
                <Interrupteur
                  label="Hors vacances scolaires"
                  name="hors_vacances"
                  coche
                  aide="Décoché, le créneau est aussi demandé pendant les vacances."
                />
              </div>
            </div>
            <div className="mt-3">
              <button type="submit" className="btn btn-primary">
                <Icone nom="send" taille={14} /> Déposer ce vœu
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="astuce mb-3">
          <Icone nom="info" taille={18} />
          <div>Aucune campagne n'est ouverte au dépôt pour l'instant.</div>
        </div>
      )}

      {[...parCampagne].map(([cid, liste]) => {
        const camp = liste[0].campagne;
        return (
          <div key={cid} className="data-card p-4 mb-3">
            <h2 className="h5 mb-3">
              <Icone nom="calendar-range" taille={18} /> {camp.label}{" "}
              <Chip teinte="slate">saison {camp.saison.label}</Chip>
            </h2>
            <table className="table align-middle mb-0">
              <tbody>
                {liste.map((v) => (
                  <tr key={v.id}>
                    <td className="fw-medium">{decrireCreneauHebdo(v)}</td>
                    <td>{v.espace.shortName || v.espace.name}</td>
                    <td>{v.title}</td>
                    <td>
                      <StatutVoeu status={v.status} />
                      {v.reservation ? (
                        <div className="small">
                          <a href={`/portail/mes-reservations/${v.reservation.id}`}>
                            Dossier {v.reservation.numero}
                          </a>
                        </div>
                      ) : null}
                      {v.decisionNote && v.status === "refuse" ? (
                        <div className="small text-muted">{v.decisionNote}</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
