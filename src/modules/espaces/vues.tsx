/**
 * Sous-composants du module Espaces : formulaire complet, pastilles de statut et de
 * visibilité, avatars des gestionnaires, onglets de fiche.
 */
import {
  Champ,
  Coches,
  Grille,
  Interrupteur,
  SectionForm,
  Select,
  Zone,
} from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Avatar, Chip } from "@/components/macros";
import type { Espace, Referential } from "@/generated/prisma/client";
import { COULEURS_ESPACE, ESPACE_STATUS, JOURS_ISO } from "@/lib/constantes";
import { HORAIRES_DEFAUT, lireHoraires } from "@/lib/creneaux";
import type { SaisonHoraires } from "@/server/horaires";

/** La pastille de statut d'un espace (un espace désactivé est toujours « Inactif »). */
export function StatutEspace({ status, isActive }: { status: string; isActive: boolean }) {
  if (!isActive) return <Chip teinte="slate">Inactif</Chip>;
  const s = ESPACE_STATUS[status];
  return <Chip teinte={s?.teinte ?? "slate"}>{s?.label ?? status}</Chip>;
}

/** Public / interne, et les profils autorisés. */
export function Visibilite({
  isPublic,
  allowedProfiles,
  libelles,
}: {
  isPublic: boolean;
  allowedProfiles: string[];
  libelles: Map<string, string>;
}) {
  return (
    <span className="d-inline-flex flex-wrap gap-1">
      {isPublic ? (
        <Chip teinte="emerald" titre="Visible sur le portail public">
          <Icone nom="globe" taille={11} /> Public
        </Chip>
      ) : (
        <Chip teinte="slate" titre="Réservé au back-office">
          <Icone nom="eye-off" taille={11} /> Interne
        </Chip>
      )}
      {allowedProfiles.length ? (
        allowedProfiles.map((c) => (
          <Chip key={c} teinte="violet" titre="Profil autorisé à demander">
            {libelles.get(c) ?? c}
          </Chip>
        ))
      ) : (
        <Chip teinte="sky" titre="Tous les profils peuvent demander">
          Tous profils
        </Chip>
      )}
    </span>
  );
}

/** Les gestionnaires en avatars empilés. */
export function PileGestionnaires({
  gestionnaires,
}: {
  gestionnaires: { user: { firstName: string; lastName: string }; role: string }[];
}) {
  if (!gestionnaires.length) return <span className="text-faint small">—</span>;
  const visibles = gestionnaires.slice(0, 4);
  return (
    <span className="avatar-pile">
      {visibles.map((g, i) => {
        const nom = `${g.user.firstName} ${g.user.lastName}`.trim();
        return <Avatar key={i} nom={nom} taille="sm" agent titre={`${nom} · ${g.role}`} />;
      })}
      {gestionnaires.length > 4 ? (
        <span className="avatar avatar-sm" title={`${gestionnaires.length - 4} de plus`}>
          +{gestionnaires.length - 4}
        </span>
      ) : null}
    </span>
  );
}

/** La barre d'onglets d'une fiche (Bootstrap Tab + public/js/onglets.js). */
export function Onglets({
  onglets,
}: {
  onglets: { id: string; label: string; icone: string; nb?: number | null }[];
}) {
  return (
    <div className="nav nav-onglets" data-onglets role="tablist">
      {onglets.map((o, i) => (
        <button
          key={o.id}
          type="button"
          className={`nav-link${i === 0 ? " active" : ""}`}
          id={`ong-${o.id}`}
          data-bs-toggle="tab"
          data-bs-target={`#vol-${o.id}`}
          role="tab"
          aria-controls={`vol-${o.id}`}
          aria-selected={i === 0 ? "true" : "false"}
        >
          <Icone nom={o.icone} taille={14} />
          {o.label}
          {o.nb !== undefined && o.nb !== null ? <span className="nb">{o.nb}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Volet({
  id,
  premier = false,
  children,
}: {
  id: string;
  premier?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`tab-pane fade${premier ? " show active" : ""}`}
      id={`vol-${id}`}
      role="tabpanel"
      aria-labelledby={`ong-${id}`}
    >
      {children}
    </div>
  );
}

/** La grille des horaires d'ouverture (une plage par jour + case « Fermé »). `prefixe` : grille d'une saison. */
function GrilleHoraires({
  openHours,
  prefixe = "",
  titre = "Horaires d'ouverture",
  aide = true,
}: {
  openHours: unknown;
  prefixe?: string;
  titre?: string | null;
  aide?: boolean;
}) {
  const h = lireHoraires(openHours) ?? HORAIRES_DEFAUT;
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      {titre ? <div className="form-label">{titre}</div> : null}
      <div className="horaires-grille">
        <span className="jour text-muted">Jour</span>
        <span className="small text-muted">Ouverture</span>
        <span className="small text-muted">Fermeture</span>
        <span className="small text-muted">Fermé</span>
        {JOURS_ISO.map((j) => {
          const plages = h[String(j.iso)] ?? [];
          const ferme = plages.length === 0;
          const [ouv, ferm] = plages[0] ?? ["08:00", "22:00"];
          return (
            <HoraireLigne
              key={j.iso}
              iso={j.iso}
              jour={j.long}
              ouv={ouv}
              ferm={ferm}
              ferme={ferme}
              prefixe={prefixe}
            />
          );
        })}
      </div>
      {aide ? (
        <div className="form-text">
          Une plage par jour. Une fermeture à 00:00 signifie minuit. Les demandes hors horaires sont
          refusées.
        </div>
      ) : null}
    </div>
  );
}

/**
 * Les horaires particuliers par saison : pour chaque saison en cours ou à venir, un
 * interrupteur et, s'il est coché, une grille propre à la saison (sinon ceux de l'espace).
 */
function HorairesSaisons({ saisons, base }: { saisons: SaisonHoraires[]; base: unknown }) {
  if (!saisons.length) return null;
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div className="form-label">Horaires particuliers par saison</div>
      <div className="form-text mb-2">
        Pendant une saison cochée, ces horaires remplacent ceux de l'espace (période scolaire plus
        longue, été réduit…). Les saisons se gèrent dans Administration › Calendrier des saisons.
      </div>
      {saisons.map((s) => (
        <div key={s.id} className="mb-2">
          <Interrupteur
            label={`Saison ${s.label}`}
            name={`saison_${s.id}_actif`}
            coche={s.openHours !== null}
            attrs={{ "data-recurrence": `#horaires-saison-${s.id}` }}
          />
          <div id={`horaires-saison-${s.id}`} className="ms-4 mt-1">
            <GrilleHoraires
              openHours={s.openHours ?? base}
              prefixe={`s${s.id}_`}
              titre={null}
              aide={false}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function HoraireLigne({
  iso,
  jour,
  ouv,
  ferm,
  ferme,
  prefixe = "",
}: {
  iso: number;
  jour: string;
  ouv: string;
  ferm: string;
  ferme: boolean;
  prefixe?: string;
}) {
  return (
    <>
      <label className="jour" htmlFor={`f-${prefixe}ouv_${iso}`}>
        {jour}
      </label>
      <input
        type="time"
        name={`${prefixe}ouv_${iso}`}
        id={`f-${prefixe}ouv_${iso}`}
        className="form-control form-control-sm"
        defaultValue={ouv}
        step={300}
        aria-label={`${jour} : ouverture`}
      />
      <input
        type="time"
        name={`${prefixe}ferm_${iso}`}
        id={`f-${prefixe}ferm_${iso}`}
        className="form-control form-control-sm"
        defaultValue={ferm}
        step={300}
        aria-label={`${jour} : fermeture`}
      />
      <div className="form-check m-0">
        <input
          type="checkbox"
          name={`${prefixe}ferme_${iso}`}
          id={`f-${prefixe}ferme_${iso}`}
          className="form-check-input"
          defaultChecked={ferme}
          aria-label={`${jour} : fermé`}
        />
      </div>
    </>
  );
}

function ChoixCouleur({ valeur }: { valeur: string }) {
  const actuelle = COULEURS_ESPACE.includes(valeur) ? valeur : COULEURS_ESPACE[0];
  return (
    <div>
      <div className="form-label">Couleur dans le planning</div>
      <div className="choix-couleur">
        {COULEURS_ESPACE.map((c) => (
          <span key={c}>
            <input
              type="radio"
              name="color"
              value={c}
              id={`couleur-${c.slice(1)}`}
              defaultChecked={c === actuelle}
            />
            <label
              htmlFor={`couleur-${c.slice(1)}`}
              style={{ background: c, display: "inline-block" }}
              title={c}
              aria-label={`Couleur ${c}`}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

export function FormulaireEspace({
  espace,
  action,
  csrf,
  sites,
  parents,
  natures,
  profils,
  siteParDefaut,
  saisons = [],
}: {
  espace: Espace | null;
  action: string;
  csrf: string;
  sites: [string, string][];
  parents: { id: number; name: string; siteName: string }[];
  natures: Referential[];
  profils: Referential[];
  siteParDefaut?: number | null;
  /** Les saisons en cours ou à venir, avec leurs horaires particuliers éventuels. */
  saisons?: SaisonHoraires[];
}) {
  return (
    <form method="POST" id="form-principal" action={action} data-double-envoi>
      <input type="hidden" name="csrf_token" value={csrf} />
      <SectionForm titre="Identité" icone="door-open">
        <Grille colonnes={3}>
          <Champ
            label="Nom de l'espace"
            name="name"
            valeur={espace?.name}
            requis
            autoComplete="off"
          />
          <Champ
            label="Libellé court"
            name="short_name"
            valeur={espace?.shortName}
            aide="Affiché dans le planning et les zones étroites, à côté du site. Vide = le nom."
            autoComplete="off"
          />
          <Champ
            label="Adresse courte (slug)"
            name="slug"
            valeur={espace?.slug}
            aide="Proposée d'après le nom ; adresse de l'espace sur le portail."
            attrs={{ "data-slug-de": "#f-name", pattern: "[a-z0-9-]+" }}
          />
          <Select
            label="Nature"
            name="nature_id"
            options={natures.map((n) => [String(n.id), n.label])}
            valeur={espace?.natureId}
            blank="— Non précisée —"
          />
          <Select
            label="Site"
            name="site_id"
            options={sites}
            valeur={espace?.siteId ?? siteParDefaut ?? null}
            blank="— Choisir un site —"
            requis
          />
          <Select
            label="Espace parent"
            name="parent_id"
            options={parents.map((p) => [String(p.id), `${p.name} · ${p.siteName}`])}
            valeur={espace?.parentId}
            blank="— Aucun (espace entier) —"
            aide="Pour un sous-espace d'une salle modulable : réserver le parent bloque les sous-espaces."
          />
          <Champ
            label="Étage / niveau"
            name="floor"
            valeur={espace?.floor}
            placeholder="RDC, 1er…"
          />
          <Champ
            label="Capacité debout"
            name="capacity_standing"
            type="number"
            min={0}
            valeur={espace?.capacityStanding}
          />
          <Champ
            label="Capacité assise"
            name="capacity_seated"
            type="number"
            min={0}
            valeur={espace?.capacitySeated}
          />
          <Champ
            label="Surface (m²)"
            name="surface"
            type="number"
            min={0}
            step="0.1"
            valeur={espace?.surface}
          />
          <Zone
            label="Description"
            name="description"
            valeur={espace?.description}
            rows={4}
            placeholder="Présentation de l'espace, affichée sur le portail."
          />
          <ChoixCouleur valeur={espace?.color ?? COULEURS_ESPACE[0]} />
        </Grille>
      </SectionForm>

      <SectionForm
        titre="Visibilité"
        icone="eye"
        aide="Qui voit cet espace et qui peut le demander."
      >
        <Grille colonnes={2}>
          <Interrupteur
            label="Visible sur le portail public"
            name="is_public"
            coche={espace ? espace.isPublic : true}
            aide="Sinon, seuls les agents peuvent y créer des réservations."
          />
          <Interrupteur
            label="Demandes à valider par un agent"
            name="requires_validation"
            coche={espace ? espace.requiresValidation : true}
            aide="Décoché : une demande conforme est confirmée automatiquement."
          />
          <Coches
            label="Profils autorisés à demander (aucun coché = tous les profils)"
            name="profil"
            options={profils
              .filter((p) => p.code)
              .map((p) => ({ value: p.code as string, label: p.label }))}
            cochees={espace?.allowedProfiles ?? []}
          />
        </Grille>
      </SectionForm>

      <SectionForm
        titre="Règles de réservation"
        icone="clock"
        aide="Ces règles s'appliquent à chaque créneau demandé ; un agent peut passer outre le délai."
      >
        <Grille colonnes={4}>
          <GrilleHoraires openHours={espace?.openHours} />
          <HorairesSaisons saisons={saisons} base={espace?.openHours} />
          <Champ
            label="Pas des créneaux (min)"
            name="slot_step_min"
            type="number"
            min={5}
            step={5}
            valeur={espace?.slotStepMin ?? 30}
          />
          <Champ
            label="Durée minimale (min)"
            name="min_duration_min"
            type="number"
            min={0}
            step={5}
            valeur={espace?.minDurationMin ?? 60}
          />
          <Champ
            label="Durée maximale (min)"
            name="max_duration_min"
            type="number"
            min={0}
            step={5}
            valeur={espace?.maxDurationMin}
            aide="Vide = sans limite."
          />
          <Champ
            label="Caution (€)"
            name="caution_amount"
            type="number"
            min={0}
            step="0.01"
            valeur={espace?.cautionAmount ?? 0}
            aide="0 = aucune caution."
          />
          <Champ
            label="Valeur de référence (€/h)"
            name="valorisation_horaire"
            type="number"
            min={0}
            step="0.01"
            valeur={espace?.valorisationHoraire}
            aide="Pour la valorisation des avantages en nature (coût de revient ou valeur locative). Vide = grille tarifaire « tous profils »."
          />
          <Champ
            label="Délai minimal (jours)"
            name="delay_min_days"
            type="number"
            min={0}
            valeur={espace?.delayMinDays ?? 7}
            aide="Entre la demande et l'événement."
          />
          <Champ
            label="Horizon maximal (jours)"
            name="horizon_max_days"
            type="number"
            min={1}
            valeur={espace?.horizonMaxDays ?? 365}
            aide="Jusqu'où l'on peut réserver."
          />
          <Champ
            label="Montage avant (min)"
            name="buffer_before_min"
            type="number"
            min={0}
            step={5}
            valeur={espace?.bufferBeforeMin ?? 0}
          />
          <Champ
            label="Démontage après (min)"
            name="buffer_after_min"
            type="number"
            min={0}
            step={5}
            valeur={espace?.bufferAfterMin ?? 0}
          />
          <Champ
            label="Occupations simultanées"
            name="capacite_simultanee"
            type="number"
            min={1}
            valeur={espace?.capaciteSimultanee ?? 1}
            aide="1 = exclusif. Plus : espace partageable (pistes, couloirs de bassin, terrain multisport) ; un créneau est refusé seulement quand ce nombre de réservations se recouvrent déjà."
          />
          <Select
            label="Statut"
            name="status"
            options={Object.entries(ESPACE_STATUS).map(([k, v]) => [k, v.label])}
            valeur={espace?.status ?? "actif"}
            aide="« En travaux » et « Inactif » bloquent les nouvelles demandes."
          />
        </Grille>
        <Grille colonnes={2}>
          <Zone
            label="Règlement et conditions"
            name="rules"
            valeur={espace?.rules}
            rows={5}
            pleine={false}
            placeholder="Règles d'usage affichées à l'usager avant sa demande."
          />
          <Zone
            label="Consignes pratiques"
            name="instructions"
            valeur={espace?.instructions}
            rows={5}
            pleine={false}
            placeholder="Remise des clés, alarme, ménage… envoyées avec la confirmation."
          />
        </Grille>
      </SectionForm>
    </form>
  );
}
