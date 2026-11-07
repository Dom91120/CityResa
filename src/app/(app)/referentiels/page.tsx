import { BoutonOuvrir, ModalAction } from "@/components/fiche";
import { Champ, Grille, Interrupteur } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { VideBloc } from "@/components/liste";
import { Chip } from "@/components/macros";
import type { Referential } from "@/generated/prisma/client";
import { REFERENTIAL_KINDS } from "@/lib/constantes";
import { Onglets, Volet } from "@/modules/espaces/vues";
import { decrireUsage, totalUsage, type Usage, usages } from "@/modules/referentiels/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { contextePage } from "@/server/page";

export const metadata = { title: "Référentiels - CityRésa" };

const ICONES_KIND: Record<string, string> = {
  espace_nature: "door-open",
  evenement_nature: "party-popper",
  equipement: "wifi",
  profil: "users",
  materiel_categorie: "boxes",
  doc_categorie: "paperclip",
  contrat_type: "id-card",
  absence_motif: "calendar-x",
};

const AIDES: Record<string, string> = {
  espace_nature:
    "La nature d'un espace (salle, gymnase, terrain…) sert aux filtres et au catalogue du portail.",
  evenement_nature: "La nature de l'événement choisie par l'usager dans sa demande.",
  equipement:
    "Les équipements cochés sur chaque fiche d'espace. L'icône est un nom Lucide (wifi, mic…).",
  profil:
    "Le profil tarifaire d'un usager. Le CODE est stable : il sert aux profils autorisés d'un espace (ne pas le changer à la légère).",
  materiel_categorie: "Les catégories du matériel mobilisable.",
  doc_categorie: "Les catégories proposées au dépôt d'une pièce jointe.",
  contrat_type:
    "Le type de contrat d'une personne de service (titulaire, contractuel, vacataire…), à titre d'information sur sa fiche.",
  absence_motif:
    "Les motifs d'absence du personnel de service (congés, RTT, maladie, formation…). L'icône est un nom Lucide.",
};

export default async function ReferentielsPage() {
  const page = await contextePage();
  await requireAdmin();
  const rows = await prisma.referential.findMany({
    orderBy: [{ kind: "asc" }, { position: "asc" }, { label: "asc" }],
  });
  const u = await usages(
    rows.map((r) => r.id),
    rows.filter((r) => r.kind === "profil" && r.code).map((r) => r.code as string),
  );
  const kinds = Object.keys(REFERENTIAL_KINDS);
  const parKind = (k: string) => rows.filter((r) => r.kind === k);
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Référentiels</h1>
          <p className="page-subtitle">
            Les listes de valeurs de l'application. Une valeur utilisée se désactive ; une valeur
            inutilisée se supprime.
          </p>
        </div>
      </div>
      <Onglets
        onglets={kinds.map((k) => ({
          id: k,
          label: REFERENTIAL_KINDS[k],
          icone: ICONES_KIND[k] ?? "list",
          nb: parKind(k).length,
        }))}
      />
      <div className="tab-content">
        {kinds.map((k, i) => (
          <Volet key={k} id={k} premier={i === 0}>
            <Liste kind={k} valeurs={parKind(k)} usages={u} csrf={page.csrf} />
          </Volet>
        ))}
      </div>
      {kinds.map((k) => (
        <ModalAction
          key={k}
          id={`modal-ajout-${k}`}
          titre={`Ajouter · ${REFERENTIAL_KINDS[k]}`}
          action="/referentiels/nouveau"
          csrf={page.csrf}
          bouton="Ajouter"
          icone="plus"
        >
          <input type="hidden" name="kind" value={k} />
          <ChampsValeur valeur={null} suffixe={`new-${k}`} avecCode={k === "profil"} />
        </ModalAction>
      ))}
      {rows.map((r) => (
        <ModalAction
          key={r.id}
          id={`modal-ref-${r.id}`}
          titre={`Modifier « ${r.label} »`}
          action={`/referentiels/${r.id}/modifier`}
          csrf={page.csrf}
        >
          <input type="hidden" name="kind" value={r.kind} />
          <ChampsValeur valeur={r} suffixe={String(r.id)} avecCode={r.kind === "profil"} />
        </ModalAction>
      ))}
    </>
  );
}

function ChampsValeur({
  valeur,
  suffixe,
  avecCode,
}: {
  valeur: Referential | null;
  suffixe: string;
  avecCode: boolean;
}) {
  return (
    <Grille colonnes={2}>
      <Champ
        label="Libellé"
        name="label"
        id={`ref-label-${suffixe}`}
        valeur={valeur?.label}
        requis
        pleine
      />
      <Champ
        label="Code"
        name="code"
        id={`ref-code-${suffixe}`}
        valeur={valeur?.code}
        placeholder={avecCode ? "association_commune" : "facultatif"}
        aide={
          avecCode
            ? "Identifiant stable utilisé par les espaces (profils autorisés)."
            : "Identifiant technique facultatif."
        }
      />
      <Champ
        label="Icône (Lucide)"
        name="icon"
        id={`ref-icon-${suffixe}`}
        valeur={valeur?.icon}
        placeholder="wifi, mic, armchair…"
        aide="Nom d'une icône du sprite de l'application."
      />
      <Champ
        label="Couleur"
        name="color"
        id={`ref-color-${suffixe}`}
        type="color"
        valeur={valeur?.color ?? "#006e46"}
        aide="Facultative ; laissez telle quelle si inutile."
      />
      <Interrupteur
        label="Valeur active"
        name="is_active"
        id={`ref-active-${suffixe}`}
        coche={valeur ? valeur.isActive : true}
        aide="Une valeur inactive n'est plus proposée mais reste sur les fiches qui l'utilisent."
      />
    </Grille>
  );
}

function Liste({
  kind,
  valeurs,
  usages,
  csrf,
}: {
  kind: string;
  valeurs: Referential[];
  usages: Map<number, Usage>;
  csrf: string;
}) {
  const action = (id: number, a: string) => `/referentiels/${id}/${a}`;
  return (
    <div className="data-card">
      <div className="card-header-custom">
        <h6>
          <Icone nom={ICONES_KIND[kind] ?? "list"} taille={16} classes="text-primary" />{" "}
          {REFERENTIAL_KINDS[kind]}
        </h6>
        <BoutonOuvrir
          cible={`modal-ajout-${kind}`}
          libelle="Ajouter une valeur"
          icone="plus"
          classe="btn-primary btn-sm"
        />
      </div>
      {AIDES[kind] ? <div className="px-3 pt-2 text-muted small">{AIDES[kind]}</div> : null}
      {valeurs.length ? (
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Ordre</th>
                <th>Libellé</th>
                <th>Code</th>
                <th>Icône</th>
                <th>Couleur</th>
                <th>Utilisation</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {valeurs.map((r, i) => {
                const u = usages.get(r.id);
                const total = totalUsage(u);
                return (
                  <tr key={r.id} className={r.isActive ? "" : "text-muted"}>
                    <td>
                      <div className="row-actions justify-content-start">
                        <form method="POST" action={action(r.id, "monter")} className="d-inline">
                          <input type="hidden" name="csrf_token" value={csrf} />
                          <button
                            type="submit"
                            className="btn btn-ghost btn-icone btn-sm"
                            title="Monter"
                            aria-label="Monter"
                            disabled={i === 0}
                          >
                            <Icone nom="chevron-up" taille={14} />
                          </button>
                        </form>
                        <form method="POST" action={action(r.id, "descendre")} className="d-inline">
                          <input type="hidden" name="csrf_token" value={csrf} />
                          <button
                            type="submit"
                            className="btn btn-ghost btn-icone btn-sm"
                            title="Descendre"
                            aria-label="Descendre"
                            disabled={i === valeurs.length - 1}
                          >
                            <Icone nom="chevron-down" taille={14} />
                          </button>
                        </form>
                      </div>
                    </td>
                    <td
                      className="fw-medium"
                      style={{ color: r.isActive ? "var(--strong)" : undefined }}
                    >
                      {r.label}
                    </td>
                    <td>
                      {r.code ? <code>{r.code}</code> : <span className="text-faint">—</span>}
                    </td>
                    <td>
                      {r.icon ? (
                        <span className="d-inline-flex align-items-center gap-2">
                          <Icone nom={r.icon} taille={16} />{" "}
                          <small className="text-muted">{r.icon}</small>
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td>
                      {r.color ? (
                        <span className="d-inline-flex align-items-center gap-2">
                          <span className="pastille-espace" style={{ background: r.color }} />
                          <small className="text-muted">{r.color}</small>
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="small">
                      {total ? (
                        <span title={decrireUsage(u)}>{decrireUsage(u)}</span>
                      ) : (
                        <span className="text-faint">Non utilisé</span>
                      )}
                    </td>
                    <td>
                      {r.isActive ? (
                        <Chip teinte="emerald">Actif</Chip>
                      ) : (
                        <Chip teinte="slate">Inactif</Chip>
                      )}
                    </td>
                    <td className="actions">
                      <div className="row-actions">
                        <BoutonOuvrir
                          cible={`modal-ref-${r.id}`}
                          libelle="Modifier"
                          icone="pencil"
                          classe="btn-ghost btn-sm"
                          sansTexte
                        />
                        <form method="POST" action={action(r.id, "basculer")} className="d-inline">
                          <input type="hidden" name="csrf_token" value={csrf} />
                          <button
                            type="submit"
                            className="btn btn-ghost btn-icone btn-sm"
                            title={r.isActive ? "Désactiver" : "Activer"}
                            aria-label={r.isActive ? "Désactiver" : "Activer"}
                          >
                            <Icone nom={r.isActive ? "eye-off" : "eye"} taille={14} />
                          </button>
                        </form>
                        {total === 0 ? (
                          <form
                            method="POST"
                            action={action(r.id, "supprimer")}
                            className="d-inline"
                          >
                            <input type="hidden" name="csrf_token" value={csrf} />
                            <button
                              type="submit"
                              className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                              title="Supprimer"
                              aria-label="Supprimer"
                              data-confirm={`Supprimer « ${r.label} » ?`}
                            >
                              <Icone nom="trash-2" taille={14} />
                            </button>
                          </form>
                        ) : (
                          <span
                            className="btn btn-ghost btn-icone btn-sm disabled"
                            title="Valeur utilisée : désactivez-la plutôt"
                            aria-hidden="true"
                          >
                            <Icone nom="lock" taille={14} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <VideBloc
          icone={ICONES_KIND[kind] ?? "list"}
          titre="Liste vide"
          texte="Ajoutez la première valeur."
          action={
            <BoutonOuvrir
              cible={`modal-ajout-${kind}`}
              libelle="Ajouter une valeur"
              icone="plus"
              classe="btn-primary btn-sm"
            />
          }
        />
      )}
    </div>
  );
}
