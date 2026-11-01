/**
 * Champs partagés par la saisie d'une réservation et le panneau d'approbation : options
 * (option_<id>), matériel (materiel_<id>), bloc de récurrence, règles d'un espace.
 */
import { Icone } from "@/components/icones";
import type { Option } from "@/generated/prisma/client";
import { JOURS_ISO, MATERIEL_UNITES, OPTION_UNITES, TARIF_UNITES } from "@/lib/constantes";
import { lireHoraires } from "@/lib/creneaux";
import { montant, montantOuGratuit } from "@/lib/libelles";
import type { EspaceSaisie, MaterielDispo } from "@/modules/reservations/saisie";

/** Les options cochables : case (forfait, par heure) ou quantité (par unité). */
export function ChoixOptions({
  options,
  choisies,
  vide = "Aucune option proposée pour cet espace.",
}: {
  options: Option[];
  choisies: Map<number, number>;
  vide?: string;
}) {
  if (!options.length) return <p className="text-muted small mb-0">{vide}</p>;
  return (
    <div className="d-flex flex-column gap-2">
      {options.map((o) => {
        const q = choisies.get(o.id) ?? 0;
        const parUnite = o.unite === "unite";
        const ident = `option-${o.id}`;
        return (
          <div key={o.id} className="d-flex align-items-center gap-3">
            {parUnite ? (
              <input
                type="number"
                name={`option_${o.id}`}
                id={ident}
                className="form-control form-control-sm"
                style={{ width: 84 }}
                min={0}
                step={1}
                defaultValue={q || (o.mandatory ? 1 : "")}
                placeholder="0"
                aria-label={`Quantité · ${o.label}`}
              />
            ) : (
              <div className="form-check mb-0">
                <input
                  type="checkbox"
                  className="form-check-input"
                  name={`option_${o.id}`}
                  id={ident}
                  value="1"
                  defaultChecked={q > 0 || o.mandatory}
                />
              </div>
            )}
            <label htmlFor={ident} className="flex-grow-1 mb-0" style={{ cursor: "pointer" }}>
              <span className="d-block fw-medium" style={{ color: "var(--strong)" }}>
                {o.label}
                {o.mandatory ? <span className="chip chip-amber ms-2">Obligatoire</span> : null}
                {o.espaceId === null ? (
                  <span className="text-faint small ms-2">option commune</span>
                ) : null}
              </span>
              {o.description ? <small className="text-muted d-block">{o.description}</small> : null}
            </label>
            <span className="text-nowrap small" style={{ color: "var(--strong)" }}>
              {montantOuGratuit(o.montant)}
              <span className="text-muted"> · {OPTION_UNITES[o.unite] ?? o.unite}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Le matériel mobilisable : quantité bornée par le stock disponible. */
export function ChoixMateriel({
  materiels,
  choisis,
  fenetreConnue,
}: {
  materiels: MaterielDispo[];
  choisis: Map<number, number>;
  fenetreConnue: boolean;
}) {
  if (!materiels.length)
    return <p className="text-muted small mb-0">Aucun matériel mobilisable.</p>;
  return (
    <div className="d-flex flex-column gap-2">
      {materiels.map(({ materiel: m, dispo }) => {
        const q = choisis.get(m.id) ?? 0;
        const max = Math.max(dispo + q, 0);
        const ident = `materiel-${m.id}`;
        return (
          <div key={m.id} className="d-flex align-items-center gap-3">
            <input
              type="number"
              name={`materiel_${m.id}`}
              id={ident}
              className="form-control form-control-sm"
              style={{ width: 84 }}
              min={0}
              max={max}
              step={1}
              defaultValue={q || ""}
              placeholder="0"
              disabled={max === 0}
              aria-label={`Quantité · ${m.name}`}
            />
            <label htmlFor={ident} className="flex-grow-1 mb-0" style={{ cursor: "pointer" }}>
              <span className="d-block fw-medium" style={{ color: "var(--strong)" }}>
                {m.name}
              </span>
              <small className={`d-block ${max === 0 ? "text-danger" : "text-muted"}`}>
                {max === 0
                  ? "Plus de stock sur ces dates"
                  : `${max} disponible${max > 1 ? "s" : ""}${fenetreConnue ? " sur ces dates" : " (stock total)"}`}
              </small>
            </label>
            <span className="text-nowrap small" style={{ color: "var(--strong)" }}>
              {m.unite === "gratuit" ? "Gratuit" : montant(m.montant)}
              {m.unite !== "gratuit" ? (
                <span className="text-muted"> · {MATERIEL_UNITES[m.unite] ?? m.unite}</span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Le bloc de récurrence (recurrence, freq, interval, until, weekday, except). */
export function BlocRecurrence({ id = "bloc-recurrence" }: { id?: string }) {
  return (
    <>
      <div className="form-check form-switch" style={{ gridColumn: "1 / -1" }}>
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          name="recurrence"
          id="f-recurrence"
          data-recurrence={`#${id}`}
        />
        <label className="form-check-label" htmlFor="f-recurrence">
          Répéter ce créneau (cours hebdomadaire, réunion mensuelle…)
        </label>
      </div>
      <div id={id} className="d-none" style={{ gridColumn: "1 / -1" }}>
        <div className="grille grille-3">
          <div>
            <label className="form-label" htmlFor="f-freq">
              Fréquence
            </label>
            <select name="freq" id="f-freq" className="form-select" defaultValue="weekly">
              <option value="daily">Chaque jour</option>
              <option value="weekly">Chaque semaine</option>
              <option value="monthly">Chaque mois</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="f-interval">
              Toutes les…
            </label>
            <input
              type="number"
              name="interval"
              id="f-interval"
              className="form-control"
              min={1}
              max={12}
              defaultValue={1}
            />
            <div className="form-text">1 = chaque fois, 2 = une fois sur deux.</div>
          </div>
          <div>
            <label className="form-label" htmlFor="f-until">
              Jusqu'au <span className="req">*</span>
            </label>
            <input type="date" name="until" id="f-until" className="form-control" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="form-label">Jours (récurrence hebdomadaire)</div>
            <div className="coches">
              {JOURS_ISO.map((j) => (
                <label key={j.iso}>
                  <input type="checkbox" name="weekday" value={j.iso} />
                  {j.long}
                </label>
              ))}
            </div>
            <div className="form-text">Aucun jour coché = le jour du premier créneau.</div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="form-label">Dates exclues (vacances, jours fériés)</div>
            <div className="d-flex gap-2 flex-wrap">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  type="date"
                  name="except"
                  className="form-control"
                  style={{ maxWidth: 170 }}
                  aria-label={`Date exclue ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Les règles de réservation et la grille tarifaire d'un espace, en rappel. */
export function RappelEspace({ espace }: { espace: EspaceSaisie }) {
  const horaires = lireHoraires(espace.openHours);
  const jours = horaires
    ? JOURS_ISO.filter((j) => (horaires[String(j.iso)] ?? []).length).map(
        (j) =>
          `${j.court} ${(horaires[String(j.iso)] ?? []).map(([a, b]) => `${a}–${b}`).join(", ")}`,
      )
    : [];
  const profils = new Map<string, { label: string; lignes: string[] }>();
  for (const t of espace.tarifs) {
    const cle = t.profil?.code ?? t.profil?.label ?? "tous";
    const p = profils.get(cle) ?? { label: t.profil?.label ?? "Tous profils", lignes: [] };
    p.lignes.push(
      `${t.label || TARIF_UNITES[t.unite] || t.unite} : ${montantOuGratuit(t.montant)}`,
    );
    profils.set(cle, p);
  }
  return (
    <div className="data-card">
      <div className="card-header-custom">
        <h6>
          <Icone nom="door-open" taille={16} classes="text-primary" /> {espace.name}
        </h6>
        <a href={`/espaces/${espace.id}`} className="btn btn-ghost btn-sm">
          Fiche
        </a>
      </div>
      <div className="card-body-custom p-3 small">
        <div className="text-muted mb-2">{espace.site.name}</div>
        <ul className="list-unstyled mb-3 d-flex flex-column gap-1">
          <li>
            <Icone nom="clock" taille={13} classes="text-muted" /> Pas de {espace.slotStepMin} min ·
            durée minimale {Math.round(espace.minDurationMin / 60)} h
            {espace.maxDurationMin ? ` · maximale ${Math.round(espace.maxDurationMin / 60)} h` : ""}
          </li>
          <li>
            <Icone nom="calendar-clock" taille={13} classes="text-muted" /> Délai{" "}
            {espace.delayMinDays} j · horizon {espace.horizonMaxDays} j
          </li>
          {espace.bufferBeforeMin || espace.bufferAfterMin ? (
            <li>
              <Icone nom="timer" taille={13} classes="text-muted" /> Montage{" "}
              {espace.bufferBeforeMin} min · démontage {espace.bufferAfterMin} min
            </li>
          ) : null}
          {espace.capacityStanding || espace.capacitySeated ? (
            <li>
              <Icone nom="users" taille={13} classes="text-muted" /> Capacité{" "}
              {[
                espace.capacitySeated ? `${espace.capacitySeated} assis` : null,
                espace.capacityStanding ? `${espace.capacityStanding} debout` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </li>
          ) : null}
          {espace.cautionAmount ? (
            <li>
              <Icone nom="shield" taille={13} classes="text-muted" /> Caution{" "}
              {montant(espace.cautionAmount)}
            </li>
          ) : null}
          {!espace.requiresValidation ? (
            <li>
              <Icone nom="badge-check" taille={13} classes="text-muted" /> Confirmation automatique
              (pas de validation)
            </li>
          ) : null}
        </ul>
        {jours.length ? (
          <>
            <div className="form-label mb-1">Horaires d'ouverture</div>
            <ul className="list-unstyled text-muted mb-3">
              {jours.map((j) => (
                <li key={j}>{j}</li>
              ))}
            </ul>
          </>
        ) : null}
        <div className="form-label mb-1">Tarifs</div>
        {profils.size ? (
          [...profils.values()].map((p) => (
            <div key={p.label} className="mb-2">
              <div className="fw-medium" style={{ color: "var(--strong)" }}>
                {p.label}
              </div>
              <div className="text-muted">{p.lignes.join(" · ")}</div>
            </div>
          ))
        ) : (
          <p className="text-muted mb-0">Aucun tarif : mise à disposition gratuite.</p>
        )}
      </div>
    </div>
  );
}
