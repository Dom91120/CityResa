/**
 * Sous-composants du module Campagnes : pastille d'état, champs du formulaire d'une campagne,
 * tableau des vœux d'un espace avec conflits et décisions.
 */
import { Champ, Coches, Grille, Select, Zone } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import {
  CAMPAGNE_STATUS,
  type CampagneStatus,
  decrireCreneauHebdo,
  libellePriorite,
  prioriteDe,
  VOEU_STATUS,
  type VoeuStatus,
} from "@/lib/campagnes";
import { isoDate } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import type { CampagneComplete, VoeuComplet } from "@/server/campagnes";

export function StatutCampagne({ status, lg = false }: { status: string; lg?: boolean }) {
  const s = CAMPAGNE_STATUS[status as CampagneStatus] ?? {
    label: status,
    teinte: "slate",
    aide: "",
  };
  return (
    <Chip teinte={s.teinte} lg={lg} titre={s.aide}>
      {s.label}
    </Chip>
  );
}

export function StatutVoeu({ status }: { status: string }) {
  const s = VOEU_STATUS[status as VoeuStatus] ?? { label: status, teinte: "slate" };
  return <Chip teinte={s.teinte}>{s.label}</Chip>;
}

const TEINTES_PRIORITE: Record<number, string> = {
  1: "violet",
  2: "sky",
  3: "emerald",
  4: "lime",
  5: "slate",
};

export function ChipPriorite({ org }: { org: { type: string; conventionnee: boolean } }) {
  const n = prioriteDe(org);
  return (
    <Chip teinte={TEINTES_PRIORITE[n] ?? "slate"} titre={`Priorité ${n}`}>
      {n} · {libellePriorite(n)}
    </Chip>
  );
}

/** Les champs communs à la création et à la modification d'une campagne. */
export function ChampsCampagne({
  c,
  saisons,
  espaces,
}: {
  c: CampagneComplete | null;
  saisons: { id: number; label: string }[];
  espaces: { id: number; name: string; siteName: string }[];
}) {
  return (
    <Grille colonnes={2}>
      <Champ
        label="Nom de la campagne"
        name="label"
        valeur={c?.label}
        requis
        pleine
        placeholder="Ex. : Créneaux annuels 2026-2027"
      />
      <Select
        label="Saison"
        name="saison_id"
        valeur={c?.saisonId}
        options={saisons.map((s) => [String(s.id), s.label])}
        requis
        aide="Les créneaux attribués couvrent toute la saison."
      />
      <Champ
        label="Date limite de dépôt"
        name="close_date"
        type="date"
        valeur={isoDate(c?.closeDate ?? null)}
        aide="Indicative : le dépôt se clôt depuis la fiche."
      />
      <Zone
        label="Consignes aux demandeurs"
        name="consignes"
        valeur={c?.consignes}
        rows={3}
        placeholder="Pièces à fournir, critères d'attribution, calendrier…"
      />
      <Coches
        label="Espaces ouverts aux vœux (aucun coché = tous les espaces publics)"
        name="espace"
        options={espaces.map((e) => ({ value: e.id, label: `${e.name} · ${e.siteName}` }))}
        cochees={c ? c.espaces.map((e) => e.espaceId) : []}
      />
    </Grille>
  );
}

/** Le tableau des vœux d'un espace, avec les conflits et les décisions. */
export function TableauVoeux({
  c,
  voeux,
  conflits,
  peutDecider,
  csrf,
}: {
  c: CampagneComplete;
  voeux: VoeuComplet[];
  conflits: Map<number, number[]>;
  peutDecider: boolean;
  csrf: string;
}) {
  const instruction = c.status === "instruction";
  return (
    <div className="table-responsive">
      <table className="table table-hover align-middle">
        <thead>
          <tr>
            <th>Créneau souhaité</th>
            <th>Demandeur</th>
            <th>Activité</th>
            <th>Déposé le</th>
            <th>Décision</th>
            {peutDecider && instruction ? <th className="actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {voeux.map((v) => {
            const enConflit = conflits.get(v.id) ?? [];
            return (
              <tr key={v.id} className={v.status === "refuse" ? "text-muted" : undefined}>
                <td>
                  <div className="fw-medium">{decrireCreneauHebdo(v)}</div>
                  <div className="small text-muted">
                    {v.horsVacances ? "Hors vacances scolaires" : "Vacances comprises"}
                    {enConflit.length ? (
                      <>
                        {" · "}
                        <Chip teinte="amber" titre="Chevauche un autre vœu vivant">
                          <Icone nom="triangle-alert" taille={12} /> {enConflit.length} conflit
                          {enConflit.length > 1 ? "s" : ""}
                        </Chip>
                      </>
                    ) : null}
                  </div>
                </td>
                <td>
                  <a href={`/usagers/${v.organisationId}`}>{v.organisation.name}</a>
                  <div className="mt-1">
                    <ChipPriorite org={v.organisation} />
                  </div>
                </td>
                <td>
                  {v.title}
                  {v.participants ? (
                    <div className="small text-muted">{v.participants} participants</div>
                  ) : null}
                </td>
                <td className="text-nowrap">{dateCourte(v.createdAt)}</td>
                <td>
                  <StatutVoeu status={v.status} />
                  {v.reservation ? (
                    <div className="small">
                      <a href={`/reservations/${v.reservation.id}`}>{v.reservation.numero}</a>
                    </div>
                  ) : null}
                  {v.decisionNote ? <div className="small text-muted">{v.decisionNote}</div> : null}
                </td>
                {peutDecider && instruction ? (
                  <td className="actions text-nowrap">
                    {v.status !== "attribue" ? (
                      <form
                        method="POST"
                        action={`/campagnes/${c.id}/voeux/${v.id}/attribuer`}
                        className="d-inline"
                      >
                        <input type="hidden" name="csrf_token" value={csrf} />
                        <button
                          type="submit"
                          className="btn btn-ghost btn-icone btn-sm"
                          title="Attribuer : créer le dossier sur toute la saison"
                          aria-label="Attribuer"
                          data-confirm={`Attribuer « ${decrireCreneauHebdo(v)} » à ${v.organisation.name} ? Un dossier sera créé sur toute la saison.`}
                        >
                          <Icone nom="check" taille={14} />
                        </button>
                      </form>
                    ) : null}
                    {v.status === "en_attente" ? (
                      <form
                        method="POST"
                        action={`/campagnes/${c.id}/voeux/${v.id}/refuser`}
                        className="d-inline-flex align-items-center gap-1"
                      >
                        <input type="hidden" name="csrf_token" value={csrf} />
                        <input
                          type="text"
                          name="note"
                          className="form-control form-control-sm"
                          placeholder="Motif"
                          style={{ width: 160 }}
                          aria-label="Motif du refus"
                        />
                        <button
                          type="submit"
                          className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                          title="Refuser"
                          aria-label="Refuser"
                        >
                          <Icone nom="x" taille={14} />
                        </button>
                      </form>
                    ) : null}
                    {v.status === "refuse" || (v.status === "attribue" && !v.reservationId) ? (
                      <form
                        method="POST"
                        action={`/campagnes/${c.id}/voeux/${v.id}/attente`}
                        className="d-inline"
                      >
                        <input type="hidden" name="csrf_token" value={csrf} />
                        <button
                          type="submit"
                          className="btn btn-ghost btn-icone btn-sm"
                          title="Remettre en attente"
                          aria-label="Remettre en attente"
                        >
                          <Icone nom="rotate-ccw" taille={14} />
                        </button>
                      </form>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
