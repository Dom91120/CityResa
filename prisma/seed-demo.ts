/**
 * Jeu de données de démonstration : la Ville de Châtillon (92320) avec ses sites, ses
 * espaces (photos générées), ses tarifs, son matériel, ses usagers, ses réservations à
 * tous les statuts, ses factures, ses demandes de subvention.
 *
 *   pnpm db:init             (d'abord : rôles, référentiels, modèles, administrateur)
 *   pnpm db:demo             (idempotent : ne fait rien si un site existe déjà)
 *   pnpm db:demo --reset     (vide les tables métier et recharge le jeu de démonstration ;
 *                             l'administrateur, les rôles, les référentiels, la configuration
 *                             et les modèles de courriel sont conservés)
 *
 * Les dates sont relatives au jour du lancement (−3 mois / +3 mois) ; les horaires sont
 * ronds en heure de Paris. Les dossiers sont écrits directement avec Prisma (aucun courriel
 * n'est envoyé) mais chaque créneau est vérifié avec `verifierDisponibilite` et chaque
 * montant calculé avec `deviser`, comme le ferait l'application. Les conventions PDF ne
 * sont pas générées (pas de navigateur dans un script).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import "dotenv/config";
import { Prisma } from "@/generated/prisma/client";
import { saisonDe } from "@/lib/calendrier";
import { datesParDefaut, labelCampagne } from "@/lib/campagne-subvention";
import type { ReservationStatus } from "@/lib/constantes";
import { COULEURS_ESPACE, FACTURE_TYPES, RESERVATION_STATUS } from "@/lib/constantes";
import { bornes, developperRecurrence, type Intervalle, type Recurrence } from "@/lib/creneaux";
import { parseYmdUtc } from "@/lib/date-utc";
import { type DossierSubvention, dossierVide } from "@/lib/dossier-subvention";
import { montant, plage } from "@/lib/libelles";
import {
  addParisDays,
  minutesDe,
  parisMidnight,
  parisParts,
  parisWallToInstant,
  todayParisISO,
  toParisWall,
} from "@/lib/paris-time";
import type { Montants } from "@/lib/plan-budget";
import { affecterCreneaux, reverifierAffectations } from "@/server/affectation";
import { amorcer, poserMotDePasse } from "@/server/amorcage";
import { creerSaison, joursExclus, saisons } from "@/server/calendrier";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { deposerDocument } from "@/server/documents";
import { prochainNumero } from "@/server/numerotation";
import { deviser, verifierDisponibilite } from "@/server/reservations";
import { profilParDefaut } from "@/server/usagers";
import { VACANCES_ZONE_C } from "./calendrier-zone-c";
import { ASSOCIATIONS_SPORTIVES, type OrgSpec } from "./seed-associations";

const MOT_DE_PASSE = "Demo-2026!!";
/** Code de signature posé sur les dossiers « acceptée » : l'usager peut signer avec. */
const CODE_SIGNATURE = "123456";
const RESET = process.argv.includes("--reset");

const now = new Date();
const minuit = parisMidnight(todayParisISO(now));
const limite = new Date(now.getTime() - 3_600_000);

// ── Petits outils ──

/** Générateur pseudo-aléatoire déterministe : le même jeu à chaque lancement. */
let graine = 20_260_101;
function alea(): number {
  graine = (graine * 1_103_515_245 + 12_345) % 2_147_483_648;
  return graine / 2_147_483_648;
}
function entre(a: number, b: number): number {
  return a + Math.floor(alea() * (b - a + 1));
}
function choix<T>(xs: readonly T[]): T {
  return xs[Math.floor(alea() * xs.length)];
}

/** L'instant « jour J + offset à HH:MM » en heure de Paris. */
function a(offset: number, hm: string): Date {
  const w = toParisWall(addParisDays(minuit, offset));
  const min = minutesDe(hm);
  if (min === null) throw new Error(`Heure invalide : ${hm}`);
  return parisWallToInstant(w.y, w.mo, w.da, min);
}
function ymd(offset: number): string {
  return parisParts(addParisDays(minuit, offset)).dateKey;
}
/** Le premier offset ≥ `apres` qui tombe un jour ISO donné (1 = lundi … 7 = dimanche). */
function js(iso: number, apres: number): number {
  for (let o = apres; o < apres + 7; o++)
    if (parisParts(addParisDays(minuit, o)).weekday === iso) return o;
  return apres;
}
function ilYA(jours: number, heures = 0): Date {
  return new Date(now.getTime() - jours * 86_400_000 - heures * 3_600_000);
}
function plusTot(d: Date, borne: Date = limite): Date {
  return d < borne ? d : borne;
}
function plusTard(d: Date, borne: Date): Date {
  return d > borne ? d : borne;
}
function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function assombrir(hex: string, f: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  const r = c((n >> 16) & 255);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Photos : un dégradé à la couleur de l'espace, un pictogramme, le nom ──

const PICTOS: Record<string, string> = {
  scene:
    '<rect x="-120" y="20" width="240" height="60" rx="8"/><circle cx="-70" cy="-50" r="22"/><circle cx="0" cy="-62" r="22"/><circle cx="70" cy="-50" r="22"/>',
  ballon:
    '<circle cx="0" cy="0" r="90" fill="none" stroke="#fff" stroke-width="10"/><path d="M-90 0h180M0 -90v180M-64 -64q64 40 128 0M-64 64q64 -40 128 0" fill="none" stroke="#fff" stroke-width="8"/>',
  tatami:
    '<rect x="-110" y="-70" width="105" height="65" rx="6"/><rect x="5" y="-70" width="105" height="65" rx="6"/><rect x="-110" y="5" width="105" height="65" rx="6"/><rect x="5" y="5" width="105" height="65" rx="6"/>',
  terrain:
    '<rect x="-120" y="-80" width="240" height="160" rx="10" fill="none" stroke="#fff" stroke-width="10"/><line x1="0" y1="-80" x2="0" y2="80" stroke="#fff" stroke-width="8"/><circle cx="0" cy="0" r="30" fill="none" stroke="#fff" stroke-width="8"/>',
  cadre:
    '<rect x="-110" y="-80" width="220" height="160" rx="6" fill="none" stroke="#fff" stroke-width="12"/><rect x="-70" y="-45" width="140" height="90" rx="4"/>',
  table:
    '<rect x="-120" y="-30" width="240" height="26" rx="8"/><rect x="-100" y="-4" width="18" height="80"/><rect x="82" y="-4" width="18" height="80"/>',
  micro:
    '<rect x="-28" y="-100" width="56" height="120" rx="28"/><path d="M-60 -10a60 60 0 0 0 120 0" fill="none" stroke="#fff" stroke-width="12"/><rect x="-8" y="50" width="16" height="40"/><rect x="-40" y="88" width="80" height="12" rx="6"/>',
  batiment:
    '<rect x="-110" y="-40" width="220" height="130" rx="6"/><path d="M-130 -40L0 -120L130 -40Z"/><rect x="-25" y="20" width="50" height="70" fill="rgba(0,0,0,.25)"/>',
};

/**
 * Le titre d'une photo : un « - » coupe le nom sur deux lignes (le tiret n'est pas affiché),
 * et chaque ligne est réduite pour tenir dans la largeur de l'image (1 100 px utiles).
 */
function titrePhoto(titre: string): {
  lignes: string[];
  taille: number;
  base: number;
  ySousTitre: number;
} {
  const lignes = titre
    .split(" - ")
    .map((l) => l.trim())
    .filter(Boolean);
  // Arial gras : environ 0,58 em par caractère.
  const taille = Math.min(64, ...lignes.map((l) => Math.floor(1100 / (0.58 * l.length))));
  const interligne = Math.round(taille * 1.15);
  const hauteur = (lignes.length - 1) * interligne;
  const base = 560 - Math.round(hauteur / 2);
  return { lignes, taille, base, ySousTitre: base + hauteur + 60 };
}

function lignesTitre(titre: string): string {
  const t = titrePhoto(titre);
  return t.lignes
    .map(
      (l, i) =>
        `<text x="600" y="${t.base + i * Math.round(t.taille * 1.15)}" font-family="Arial, Helvetica, sans-serif" font-size="${t.taille}" font-weight="700" fill="#fff" text-anchor="middle">${echapper(l)}</text>`,
    )
    .join("\n");
}

// ── Photos réelles livrées avec le dépôt (prisma/assets/photos) ──
// Clé « site:<cle> » ou « espace:<cle> » → fichiers (JPEG, 1 600 px de large) et titres. Les
// sites et espaces absents d'ici gardent une image générée. Les originaux sont copiés dans
// Documents/ (hors dépôt) et réduits avec sharp avant d'être déposés ici.
const DOSSIER_PHOTOS = "prisma/assets/photos";
const PHOTOS_REELLES: Record<string, { fichier: string; titre: string }[]> = {
  "site:maison-blanche": [{ fichier: "site-maison-blanche-1.jpg", titre: "Façade" }],
  // Pas encore de photo des salles de réunion : la façade en attendant.
  "espace:mb-reunion-1": [
    { fichier: "site-maison-blanche-1.jpg", titre: "Façade de l'Espace Maison Blanche" },
  ],
  "espace:mb-reunion-2": [
    { fichier: "site-maison-blanche-1.jpg", titre: "Façade de l'Espace Maison Blanche" },
  ],
  "espace:mb-reunion-3": [
    { fichier: "site-maison-blanche-1.jpg", titre: "Façade de l'Espace Maison Blanche" },
  ],
  "espace:mb-polyvalente": [
    { fichier: "espace-mb-polyvalente-1.jpg", titre: "Vue d'ensemble" },
    { fichier: "espace-mb-polyvalente-3.jpg", titre: "Configuration banquet, scène" },
    { fichier: "espace-mb-polyvalente-2.jpg", titre: "Cuisine attenante" },
  ],
  "site:folie-desmares": [{ fichier: "espace-folie-desmares-3.jpg", titre: "Entrée" }],
  "espace:folie-desmares": [
    { fichier: "espace-folie-desmares-1.jpg", titre: "Vue d'ensemble en configuration conférence" },
    { fichier: "espace-folie-desmares-2.jpg", titre: "Fête de fin d'année" },
    { fichier: "espace-folie-desmares-3.jpg", titre: "Entrée du bâtiment" },
  ],
  "site:doret": [{ fichier: "espace-doret-1.jpg", titre: "La salle" }],
  "espace:doret": [
    { fichier: "espace-doret-1.jpg", titre: "Cours de danse enfants" },
    { fichier: "espace-doret-2.jpg", titre: "Spectacle de fin d'année" },
    { fichier: "espace-doret-3.jpg", titre: "Le public" },
  ],
  "site:chalet": [{ fichier: "espace-chalet-1.jpg", titre: "Le chalet" }],
  "espace:chalet": [{ fichier: "espace-chalet-1.jpg", titre: "Vue extérieure" }],
  "site:republique": [{ fichier: "espace-republique-1.jpg", titre: "Le gymnase" }],
  "espace:republique": [
    { fichier: "espace-republique-1.jpg", titre: "Vue d'ensemble, tournoi de judo" },
    { fichier: "espace-republique-2.jpg", titre: "Tournoi de judo" },
    { fichier: "espace-republique-3.jpg", titre: "Tatamis" },
  ],
  "site:langevin": [{ fichier: "espace-langevin-1.jpg", titre: "Le gymnase" }],
  "espace:langevin": [
    { fichier: "espace-langevin-1.jpg", titre: "Vue d'ensemble, badminton" },
    { fichier: "espace-langevin-2.jpg", titre: "Mur d'escalade" },
    { fichier: "espace-langevin-3.jpg", titre: "Cours collectif sur tatamis" },
  ],
  "site:roland-garros": [{ fichier: "espace-roland-garros-1.jpg", titre: "Le gymnase" }],
  "espace:roland-garros": [
    { fichier: "espace-roland-garros-1.jpg", titre: "Vue d'ensemble, initiation au badminton" },
    { fichier: "espace-roland-garros-2.jpg", titre: "Configuration salon" },
    { fichier: "espace-roland-garros-3.jpg", titre: "Entraînement" },
  ],
  "site:gambetta": [{ fichier: "espace-gambetta-1.jpg", titre: "Le gymnase" }],
  "espace:gambetta": [
    { fichier: "espace-gambetta-1.jpg", titre: "Vue d'ensemble" },
    { fichier: "espace-gambetta-2.jpg", titre: "Côté mezzanine" },
    { fichier: "espace-gambetta-3.jpg", titre: "Séance de parkour" },
  ],
  "site:sablons": [{ fichier: "espace-sablons-2.jpg", titre: "Le gymnase" }],
  "espace:sablons": [
    { fichier: "espace-sablons-1.jpg", titre: "Vue d'ensemble, match de volley-ball" },
    { fichier: "espace-sablons-2.jpg", titre: "Côté mezzanine" },
    { fichier: "espace-sablons-3.jpg", titre: "Côté baies vitrées" },
  ],
  "site:henri-matisse": [{ fichier: "site-henri-matisse-1.jpg", titre: "" }],
  "espace:henri-matisse": [
    { fichier: "espace-henri-matisse-1.jpg", titre: "Vue d'ensemble" },
    { fichier: "espace-henri-matisse-2.jpg", titre: "Deuxième salle" },
    { fichier: "espace-henri-matisse-3.jpg", titre: "Troisième salle" },
  ],
  "site:moquet": [{ fichier: "espace-moquet-1.jpg", titre: "Vue aérienne" }],
  "espace:moquet": [
    { fichier: "espace-moquet-1.jpg", titre: "Vue aérienne du terrain synthétique et de la piste" },
  ],
  "site:gabriel-peri": [{ fichier: "espace-gabriel-peri-1.jpg", titre: "La salle" }],
  "espace:gabriel-peri": [
    { fichier: "espace-gabriel-peri-1.jpg", titre: "Vue d'ensemble" },
    { fichier: "espace-gabriel-peri-3.jpg", titre: "Exposition-vente" },
    { fichier: "espace-gabriel-peri-2.jpg", titre: "Réunion en cercle" },
  ],
  "site:terrain-multisport": [
    { fichier: "espace-terrain-multisport-1.jpg", titre: "Vue d'ensemble" },
  ],
  "espace:terrain-multisport": [
    {
      fichier: "espace-terrain-multisport-1.jpg",
      titre: "Terrain de basket 3x3 et station d'éveil sportif",
    },
    { fichier: "espace-terrain-multisport-3.jpg", titre: "Partie d'échecs sur la station de jeux" },
    { fichier: "espace-terrain-multisport-2.jpg", titre: "Terrain de basket 3x3" },
  ],
};

/** Les photos réelles d'un site ou d'un espace lues sur le disque ; vide si aucune. */
function photosReelles(cle: string): { nom: string; titre: string; octets: Buffer }[] {
  return (PHOTOS_REELLES[cle] ?? [])
    .map((p) => ({ ...p, chemin: path.join(DOSSIER_PHOTOS, p.fichier) }))
    .filter((p) => existsSync(p.chemin))
    .map((p) => ({ nom: p.fichier, titre: p.titre, octets: readFileSync(p.chemin) }));
}

async function photo(
  couleur: string,
  picto: string,
  titre: string,
  sousTitre: string,
  variante: number,
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const [x2, y2] = [
    ["1", "1"],
    ["0", "1"],
    ["1", "0"],
  ][variante % 3];
  const fonce = assombrir(couleur, variante === 1 ? 0.55 : 0.38);
  const motif =
    variante === 2
      ? '<g fill="rgba(255,255,255,0.07)"><circle cx="150" cy="650" r="180"/><circle cx="1050" cy="120" r="140"/><circle cx="980" cy="700" r="90"/></g>'
      : variante === 1
        ? '<rect x="0" y="560" width="1200" height="240" fill="rgba(0,0,0,0.18)"/>'
        : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
<defs><linearGradient id="g" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${couleur}"/><stop offset="1" stop-color="${fonce}"/></linearGradient></defs>
<rect width="1200" height="800" fill="url(#g)"/>${motif}
<g transform="translate(600,300)" fill="rgba(255,255,255,0.85)">${PICTOS[picto] ?? PICTOS.batiment}</g>
${lignesTitre(titre)}
<text x="600" y="${titrePhoto(titre).ySousTitre}" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="rgba(255,255,255,0.85)" text-anchor="middle">${echapper(sousTitre)}</text>
<text x="1170" y="770" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="rgba(255,255,255,0.5)" text-anchor="end">Image de démonstration · CityRésa</text>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

// ── Remise à zéro ──

const EMAILS_AGENTS_DEMO = [
  "sophie.martin@exemple.fr",
  "karim.benali@exemple.fr",
  "pierre.durand@exemple.fr",
];

async function remettreAZero(): Promise<void> {
  console.log("→ Remise à zéro des tables métier…");
  // Les comptes de démonstration d'abord (sessions et identifiants suivent en cascade).
  await prisma.user.deleteMany({
    where: { OR: [{ kind: "usager" }, { email: { in: EMAILS_AGENTS_DEMO } }] },
  });
  // TRUNCATE sans CASCADE : la table `user` référence `organisation`, un CASCADE la viderait
  // (administrateur compris). Toutes les tables qui se référencent entre elles sont listées.
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE paiement, facture, subvention_history, subvention_avis, subvention, campagne_subvention, message, reservation_history,
     reservation_option, reservation_materiel, mouvement_materiel, avenant, etat_des_lieux, voeu,
     campagne_espace, campagne, liste_attente, brouillon_demande, valorisation, creneau,
     document_content, document, reservation, notification, mail_log, action_log, scheduler_run,
     indisponibilite, espace_gestionnaire, horaires_saison, vacation, absence, personnel_site,
     personnel,
     tarif, "option", espace_equipement, espace, site, materiel, sequence RESTART IDENTITY`,
  );
  await prisma.organisation.deleteMany({});
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE organisation_id_seq RESTART WITH 1`);
}

// ── Calendrier des saisons ──

/**
 * Les saisons qui couvrent la fenêtre du jeu (−3 mois / +3 mois), avec leurs jours fériés,
 * et les vacances scolaires de la zone C connues pour ces saisons (sinon importées depuis
 * l'écran Calendrier). Ne touche pas aux saisons et périodes déjà présentes.
 */
async function creerCalendrier(): Promise<void> {
  console.log("→ Saisons, vacances scolaires zone C, jours fériés…");
  const voulues = new Set([saisonDe(ymd(-100)).label, saisonDe(ymd(100)).label]);
  let existantes = await saisons();
  for (const label of voulues) {
    if (existantes.some((s) => s.label === label)) continue;
    const p = saisonDe(`${label.slice(0, 4)}-09-01`);
    await creerSaison({ ...p, isActive: false });
    compter("saisons");
  }
  existantes = await saisons();
  const courante = existantes.find((s) => s.debut <= ymd(0) && s.fin >= ymd(0));
  if (courante && !existantes.some((s) => s.isActive))
    await prisma.saison.update({ where: { id: courante.id }, data: { isActive: true } });
  for (const s of existantes) {
    const connues = VACANCES_ZONE_C[s.label];
    if (!connues) continue;
    const deja = await prisma.periodeCalendrier.count({
      where: {
        kind: "vacances",
        startDate: { lte: parseYmdUtc(s.fin) },
        endDate: { gte: parseYmdUtc(s.debut) },
      },
    });
    if (deja) continue;
    await prisma.periodeCalendrier.createMany({
      data: connues.map((v) => ({
        kind: "vacances",
        label: v.label,
        startDate: parseYmdUtc(v.debut),
        endDate: parseYmdUtc(v.fin),
        source: "import",
        zone: "Zone C",
      })),
    });
    compter("périodes de vacances", connues.length);
  }
}

// ── Référentiels ──

type Ref = { id: number; label: string; code: string | null };
const REF: Record<string, Map<string, Ref>> = {};
async function chargerReferentiels(): Promise<void> {
  const rows = await prisma.referential.findMany();
  for (const r of rows) {
    REF[r.kind] ??= new Map();
    REF[r.kind].set(r.code ?? r.label, { id: r.id, label: r.label, code: r.code });
  }
}
function ref(kind: string, cle: string): number {
  const r = REF[kind]?.get(cle);
  if (!r) throw new Error(`Référentiel ${kind} : « ${cle} » introuvable (lancez pnpm db:init).`);
  return r.id;
}
function refOuNull(kind: string, cle: string | null | undefined): number | null {
  return cle ? (REF[kind]?.get(cle)?.id ?? null) : null;
}

// ── Sites et espaces ──

type Horaires = Record<string, [string, string][]>;
const H = (plages: Record<string, string>): Horaires =>
  Object.fromEntries(
    Object.entries(plages).map(([jours, plage]) => [
      jours,
      plage.split(",").map((p) => p.split("-") as [string, string]),
    ]),
  );
function horaires(semaine: string, samedi?: string | null, dimanche?: string | null): Horaires {
  const out: Horaires = {};
  for (const j of ["1", "2", "3", "4", "5"]) out[j] = H({ x: semaine }).x;
  if (samedi) out["6"] = H({ x: samedi }).x;
  if (dimanche) out["7"] = H({ x: dimanche }).x;
  return out;
}

type TarifSpec = { profil: string | null; unite: string; montant: number; label?: string };
type OptionSpec = {
  cle: string;
  label: string;
  description?: string;
  montant: number;
  unite: string;
  mandatory?: boolean;
};
type EspaceSpec = {
  cle: string;
  site: string;
  parent?: string;
  name: string;
  /** Libellé court pour le planning ; `null` = aucun ; absent = la partie avant « - » du nom. */
  court?: string | null;
  nature: string | null;
  description: string;
  standing?: number;
  seated?: number;
  surface?: number;
  floor?: string;
  couleur: number;
  picto: string;
  photos: number;
  horaires: Horaires;
  slotStepMin?: number;
  minDurationMin?: number;
  maxDurationMin?: number | null;
  delayMinDays?: number;
  horizonMaxDays?: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  cautionAmount?: number;
  rules?: string;
  instructions?: string;
  allowedProfiles?: string[];
  requiresValidation?: boolean;
  equipements: string[];
  tarifs: TarifSpec[];
  options?: OptionSpec[];
};

// Les salles et équipements sportifs de la ville (données réelles, coordonnées approchées).
const SITES: {
  cle: string;
  name: string;
  description: string;
  address: string;
  postalCode: string;
  city: string;
  lat: number;
  lng: number;
  phone: string | null;
  email: string | null;
  accessInfo: string;
  picto: string;
}[] = [
  // ── Salles ──
  {
    cle: "maison-blanche",
    name: "Espace Maison Blanche",
    description:
      "Le centre de la vie associative et culturelle de la ville : une grande salle polyvalente de 600 m² et trois salles de réunion aux étages.",
    address: "2 avenue de Saint-Exupéry",
    postalCode: "92320",
    city: "Châtillon",
    lat: 48.8071,
    lng: 2.2938,
    phone: "01 46 57 01 10",
    email: "maison-blanche@exemple.fr",
    accessInfo:
      "Métro ligne 13 (Châtillon-Montrouge) puis bus 194. Parking gratuit. Accès PMR par l'entrée principale, ascenseur vers les étages.",
    picto: "batiment",
  },
  {
    cle: "gabriel-peri",
    name: "Salle Gabriel Péri",
    description:
      "Salle de 107 m² en centre-ville, pour les réunions, fêtes familiales et activités associatives.",
    address: "25 rue Gabriel Péri",
    postalCode: "92320",
    city: "Châtillon",
    lat: 48.8046,
    lng: 2.2902,
    phone: null,
    email: "vie-associative@exemple.fr",
    accessInfo:
      "Centre-ville, à 10 min à pied du métro Châtillon-Montrouge. Stationnement en zone bleue. Badge d'accès remis par le service Vie associative.",
    picto: "table",
  },
  {
    cle: "henri-matisse",
    name: "Parc Henri Matisse",
    description:
      "À l'entrée du Parc. Une salle de 106 m² lumineuse, adaptée aux expositions, ateliers et réunions d'associations.",
    address: "13 rue de Bagneux",
    postalCode: "92320",
    city: "Châtillon",
    lat: 48.8012,
    lng: 2.2965,
    phone: null,
    email: "vie-associative@exemple.fr",
    accessInfo: "Bus 194, arrêt Bagneux. Accès de plain-pied. Stationnement rue de Bagneux.",
    picto: "cadre",
  },
  {
    cle: "folie-desmares",
    name: "Salle de la Folie Desmares",
    description:
      "La plus grande des salles de quartier : 164 m² dans le parc de la Folie Desmares, pour les assemblées générales, conférences et réceptions.",
    address: "13 rue de la Gare",
    postalCode: "92320",
    city: "Châtillon",
    lat: 48.8098,
    lng: 2.2962,
    phone: null,
    email: "vie-associative@exemple.fr",
    accessInfo:
      "À 5 min à pied du métro Châtillon-Montrouge. Parking de la gare. Accès PMR par le parc.",
    picto: "micro",
  },
  {
    cle: "chalet",
    name: "Chalet des quatre vents",
    description:
      "Petit chalet de 35 m² au cœur du quartier des quatre vents, pour les réunions de voisinage et les ateliers en petit groupe.",
    address: "31 rue Jean Bouin",
    postalCode: "92320",
    city: "Châtillon",
    lat: 48.7962,
    lng: 2.2868,
    phone: null,
    email: "vie-associative@exemple.fr",
    accessInfo: "Bus 294, arrêt Jean Bouin. Stationnement sur rue.",
    picto: "table",
  },
  // ── Équipements sportifs ──
  {
    cle: "terrain-multisport",
    name: "Terrain multisport",
    description:
      "Terrain de proximité en accès libre (football, basket, handball), réservable par créneau pour les clubs et les animations.",
    address: "rue Henri Gatinot",
    postalCode: "92320",
    city: "Châtillon",
    lat: 48.7991,
    lng: 2.2831,
    phone: null,
    email: "sports@exemple.fr",
    accessInfo: "Ouvert de 9 h à 21 h. Accès libre en dehors des créneaux réservés.",
    picto: "terrain",
  },
  {
    cle: "sablons",
    name: "Gymnase les Sablons",
    description:
      "Gymnase omnisports : plateau homologué basket, handball, volley et badminton, tribunes et vestiaires.",
    address: "25 villa des Paroseaux",
    postalCode: "92320",
    city: "Châtillon",
    lat: 48.8035,
    lng: 2.2812,
    phone: "01 46 29 38 56",
    email: "sports@exemple.fr",
    accessInfo: "Bus 194, arrêt Sablons. Parking de 40 places. Vestiaires accessibles PMR.",
    picto: "ballon",
  },
  {
    cle: "gambetta",
    name: "Gymnase Gambetta",
    description:
      "Gymnase de quartier pour les sports collectifs, la gymnastique et les arts martiaux.",
    address: "Square de l'Europe",
    postalCode: "92320",
    city: "Châtillon",
    lat: 48.8058,
    lng: 2.2871,
    phone: "01 46 55 81 03",
    email: "sports@exemple.fr",
    accessInfo: "Square de l'Europe, à proximité du centre-ville. Stationnement en zone bleue.",
    picto: "ballon",
  },
  {
    cle: "doret",
    name: "Salle sportive Marcel Doret",
    description:
      "Salle sportive polyvalente : tatamis, miroirs et vestiaires, pour le judo, la danse, le yoga et la gymnastique douce.",
    address: "18-20 rue Gay Lussac",
    postalCode: "92320",
    city: "Châtillon",
    lat: 48.7998,
    lng: 2.2894,
    phone: "01 42 53 17 60",
    email: "sports@exemple.fr",
    accessInfo: "Bus 294, arrêt Gay Lussac. Accès PMR de plain-pied.",
    picto: "tatami",
  },
  {
    cle: "moquet",
    name: "Stade Guy Môquet",
    description:
      "Le stade de la ville : terrain d'honneur, terrain synthétique éclairé, piste d'athlétisme et vestiaires.",
    address: "35 avenue Clément Perrière",
    postalCode: "92320",
    city: "Châtillon",
    lat: 48.7955,
    lng: 2.2925,
    phone: "01 79 71 23 17",
    email: "sports@exemple.fr",
    accessInfo:
      "Du lundi au vendredi de 8 h à 22 h 30 ; samedi, dimanche et jours fériés de 8 h à 20 h 30. Parking de 80 places. Se présenter au gardien.",
    picto: "terrain",
  },
  {
    cle: "roland-garros",
    name: "Complexe sportif Roland Garros",
    description:
      "Complexe sportif avec gymnase, salle de musculation et courts de tennis couverts.",
    address: "Rue Roland Garros",
    postalCode: "92320",
    city: "Châtillon",
    lat: 48.7938,
    lng: 2.2858,
    phone: "06 31 67 61 42",
    email: "sports@exemple.fr",
    accessInfo: "Bus 294, arrêt Roland Garros. Parking sur place.",
    picto: "ballon",
  },
  {
    cle: "langevin",
    name: "Complexe sportif Langevin Wallon",
    description:
      "Gymnase et salles annexes attenants au groupe scolaire Langevin Wallon, prioritairement scolaires en journée.",
    address: "9 rue Henri Gatinot",
    postalCode: "92320",
    city: "Châtillon",
    lat: 48.7986,
    lng: 2.2838,
    phone: "01 46 55 43 84",
    email: "sports@exemple.fr",
    accessInfo: "Accès par la rue Henri Gatinot. Créneaux scolaires prioritaires en semaine.",
    picto: "ballon",
  },
  {
    cle: "republique",
    name: "Gymnase République",
    description: "Gymnase de quartier avec plateau sportif, mur d'escalade et vestiaires.",
    address: "11 impasse de la Liberté",
    postalCode: "92320",
    city: "Châtillon",
    lat: 48.8082,
    lng: 2.2889,
    phone: "01 46 56 92 05",
    email: "sports@exemple.fr",
    accessInfo: "Métro Châtillon-Montrouge à 8 min à pied. Stationnement impasse de la Liberté.",
    picto: "ballon",
  },
];

const TARIFS_SALLE: TarifSpec[] = [
  { profil: "particulier_commune", unite: "heure", montant: 25 },
  { profil: "particulier_commune", unite: "demi_journee", montant: 90 },
  { profil: "particulier_commune", unite: "journee", montant: 150 },
  { profil: "particulier_exterieur", unite: "demi_journee", montant: 180 },
  { profil: "particulier_exterieur", unite: "journee", montant: 300 },
  {
    profil: "association_commune",
    unite: "journee",
    montant: 0,
    label: "Mise à disposition gracieuse",
  },
  { profil: "association_exterieure", unite: "journee", montant: 120 },
  { profil: "entreprise", unite: "heure", montant: 60 },
  { profil: "entreprise", unite: "journee", montant: 380 },
  { profil: "service_interne", unite: "journee", montant: 0 },
];

const TARIFS_REUNION: TarifSpec[] = [
  { profil: null, unite: "heure", montant: 12 },
  { profil: null, unite: "demi_journee", montant: 45 },
  { profil: null, unite: "journee", montant: 80 },
  { profil: "association_commune", unite: "heure", montant: 0 },
  { profil: "service_interne", unite: "heure", montant: 0 },
];

const TARIFS_GYMNASE: TarifSpec[] = [
  { profil: "association_commune", unite: "heure", montant: 0 },
  { profil: "association_exterieure", unite: "heure", montant: 25 },
  { profil: "association_exterieure", unite: "journee", montant: 180 },
  { profil: "particulier_commune", unite: "heure", montant: 30 },
  { profil: "particulier_exterieur", unite: "heure", montant: 45 },
  { profil: "entreprise", unite: "heure", montant: 60 },
  { profil: "entreprise", unite: "journee", montant: 400 },
  { profil: "service_interne", unite: "heure", montant: 0 },
  { profil: "collectivite", unite: "heure", montant: 20 },
];

const EQUIPEMENTS_GYMNASE = ["Vestiaires", "Douches", "Parking", "Accès PMR", "Chauffage"];
const HORAIRES_GYMNASE = horaires("08:00-23:00", "08:00-20:00", "08:00-18:00");
const HORAIRES_SALLE = horaires("08:00-23:00", "08:00-00:00", "09:00-22:00");

const ESPACES: EspaceSpec[] = [
  // ── Espace Maison Blanche ──
  {
    cle: "mb-polyvalente",
    site: "maison-blanche",
    name: "Salle EMB - Rez de chaussée",
    court: null,
    nature: "Salle des fêtes",
    description:
      "La grande salle de la ville : 600 m² modulables avec scène, sonorisation et éclairage scénique, cuisine professionnelle attenante et accès direct sur le parc. Pour les galas, repas, lotos, spectacles et grandes assemblées.",
    standing: 500,
    seated: 300,
    surface: 600,
    floor: "Rez-de-chaussée",
    couleur: 0,
    picto: "scene",
    photos: 3,
    horaires: HORAIRES_SALLE,
    slotStepMin: 30,
    minDurationMin: 180,
    delayMinDays: 21,
    bufferBeforeMin: 60,
    bufferAfterMin: 60,
    cautionAmount: 1000,
    rules:
      "Capacité maximale 500 personnes debout, 300 assises. Fin de la sonorisation à minuit (2 h le samedi). Interdiction de fumer et de confettis. Les lieux sont restitués propres, mobilier rangé ; un état des lieux est fait à la remise et à la restitution des clés.",
    instructions:
      "Clés à retirer à l'accueil de l'Espace Maison Blanche la veille avant 17 h. Code d'alarme communiqué à la remise des clés. Sortie des poubelles dans le local à droite de la cuisine.",
    equipements: [
      "Scène",
      "Sonorisation",
      "Micro",
      "Cuisine",
      "Réfrigérateur",
      "Tables",
      "Chaises",
      "Parking",
      "Accès PMR",
      "Chauffage",
      "Vestiaires",
    ],
    tarifs: [
      { profil: "particulier_commune", unite: "journee", montant: 450 },
      { profil: "particulier_commune", unite: "weekend", montant: 750 },
      { profil: "particulier_commune", unite: "soiree", montant: 350 },
      { profil: "particulier_exterieur", unite: "journee", montant: 900 },
      { profil: "particulier_exterieur", unite: "weekend", montant: 1400 },
      { profil: "particulier_exterieur", unite: "soiree", montant: 650 },
      {
        profil: "association_commune",
        unite: "journee",
        montant: 0,
        label: "Mise à disposition gracieuse",
      },
      { profil: "association_exterieure", unite: "journee", montant: 400 },
      { profil: "association_exterieure", unite: "weekend", montant: 650 },
      { profil: "entreprise", unite: "heure", montant: 180 },
      { profil: "entreprise", unite: "demi_journee", montant: 700 },
      { profil: "entreprise", unite: "journee", montant: 1200 },
      { profil: "service_interne", unite: "journee", montant: 0 },
      { profil: "collectivite", unite: "journee", montant: 600 },
    ],
    options: [
      {
        cle: "fetes:sono",
        label: "Sonorisation et éclairage scénique",
        description: "Mise en service de la régie par un technicien, réglages avant l'événement.",
        montant: 150,
        unite: "forfait",
      },
      {
        cle: "fetes:tables",
        label: "Mise en place tables et chaises",
        description: "Disposition du mobilier selon votre plan de salle, avant votre arrivée.",
        montant: 120,
        unite: "forfait",
      },
      {
        cle: "fetes:cuisine",
        label: "Cuisine équipée",
        description: "Accès à la cuisine professionnelle (four, chambre froide, lave-vaisselle).",
        montant: 90,
        unite: "forfait",
      },
    ],
  },
  {
    cle: "mb-reunion-1",
    site: "maison-blanche",
    name: "Salle EMB - 1er étage",
    court: null,
    nature: "Salle de réunion",
    description:
      "Salle de 53 m² : 20 places autour d'une table en U, vidéoprojecteur et écran, tableau blanc, Wi-Fi. Pour un conseil d'administration, une formation ou un entretien.",
    seated: 20,
    standing: 30,
    surface: 53,
    floor: "1er étage",
    couleur: 8,
    picto: "table",
    photos: 1,
    horaires: horaires("08:00-20:00", "09:00-13:00", null),
    minDurationMin: 60,
    delayMinDays: 2,
    horizonMaxDays: 180,
    cautionAmount: 0,
    requiresValidation: true,
    equipements: ["Wi-Fi", "Vidéoprojecteur", "Écran", "Tableau blanc", "Climatisation"],
    tarifs: TARIFS_REUNION,
  },
  {
    cle: "mb-reunion-2",
    site: "maison-blanche",
    name: "Salle EMB - 2e étage",
    court: null,
    nature: "Salle de réunion",
    description:
      "60 m² réservés aux associations de la ville pour leurs activités régulières : cours, ateliers, permanences. Tables et chaises empilables, placard fermé par association.",
    seated: 25,
    standing: 35,
    surface: 60,
    floor: "2e étage",
    couleur: 2,
    picto: "table",
    photos: 2,
    horaires: horaires("08:00-23:00", "08:00-23:00", "09:00-18:00"),
    minDurationMin: 60,
    delayMinDays: 3,
    cautionAmount: 150,
    allowedProfiles: ["association_commune", "association_exterieure", "service_interne"],
    rules:
      "Réservée aux associations. Le matériel personnel est rangé dans le placard attribué ; rien ne reste dans la salle.",
    equipements: ["Wi-Fi", "Tables", "Chaises", "Tableau blanc", "Chauffage"],
    tarifs: [
      { profil: "association_commune", unite: "heure", montant: 0 },
      { profil: "association_exterieure", unite: "heure", montant: 10 },
      { profil: "association_exterieure", unite: "journee", montant: 60 },
      { profil: "service_interne", unite: "heure", montant: 0 },
    ],
  },
  {
    cle: "mb-reunion-3",
    site: "maison-blanche",
    name: "Salle EMB - 3e étage",
    court: null,
    nature: "Salle de réunion",
    description:
      "Petite salle de 35 m² sous les toits : 12 places autour d'une table, écran de visioconférence, Wi-Fi. Pour un bureau, un entretien ou un petit atelier.",
    seated: 12,
    standing: 18,
    surface: 35,
    floor: "3e étage",
    couleur: 5,
    picto: "table",
    photos: 1,
    horaires: horaires("08:00-20:00", "09:00-13:00", null),
    minDurationMin: 60,
    delayMinDays: 2,
    horizonMaxDays: 180,
    cautionAmount: 0,
    equipements: ["Wi-Fi", "Écran", "Tableau blanc", "Climatisation"],
    tarifs: TARIFS_REUNION,
  },
  // ── Salles de quartier ──
  {
    cle: "gabriel-peri",
    site: "gabriel-peri",
    name: "Salle Gabriel Péri",
    nature: "Salle polyvalente",
    description:
      "Salle de 107 m² en centre-ville avec cuisine équipée, vaisselle pour 80 couverts, sonorisation d'ambiance et accès de plain-pied. La salle des fêtes familiales et des repas associatifs.",
    standing: 100,
    seated: 60,
    surface: 107,
    floor: "Rez-de-chaussée",
    couleur: 1,
    picto: "table",
    photos: 3,
    horaires: horaires("08:00-22:30", "09:00-22:30", "09:00-19:00"),
    minDurationMin: 120,
    delayMinDays: 10,
    bufferBeforeMin: 30,
    bufferAfterMin: 30,
    cautionAmount: 400,
    rules:
      "Fin des festivités à 22 h 30 (19 h le dimanche). Le voisinage est résidentiel : portes et fenêtres fermées dès 20 h.",
    instructions: "Badge d'accès remis par le service Vie associative aux heures d'ouverture.",
    equipements: [
      "Cuisine",
      "Réfrigérateur",
      "Tables",
      "Chaises",
      "Sonorisation",
      "Wi-Fi",
      "Accès PMR",
    ],
    tarifs: [
      { profil: "particulier_commune", unite: "heure", montant: 35 },
      { profil: "particulier_commune", unite: "demi_journee", montant: 120 },
      { profil: "particulier_commune", unite: "journee", montant: 200 },
      { profil: "particulier_exterieur", unite: "demi_journee", montant: 240 },
      { profil: "particulier_exterieur", unite: "journee", montant: 400 },
      { profil: "association_commune", unite: "journee", montant: 0 },
      { profil: "association_exterieure", unite: "journee", montant: 150 },
      { profil: "entreprise", unite: "heure", montant: 70 },
      { profil: "entreprise", unite: "demi_journee", montant: 260 },
      { profil: "entreprise", unite: "journee", montant: 450 },
      { profil: "service_interne", unite: "journee", montant: 0 },
    ],
    options: [
      {
        cle: "polyvalente:vaisselle",
        label: "Vaisselle (80 couverts)",
        montant: 45,
        unite: "forfait",
      },
      { cle: "polyvalente:sono", label: "Sonorisation d'ambiance", montant: 40, unite: "forfait" },
    ],
  },
  {
    cle: "henri-matisse",
    site: "henri-matisse",
    name: "Salle Henri Matisse",
    nature: "Salle polyvalente",
    description:
      "106 m² de cimaises et de lumière naturelle, pour une exposition de peinture ou de photographie, un salon associatif, un atelier ou une réunion. Grilles et éclairage sur rail compris.",
    standing: 100,
    seated: 60,
    surface: 106,
    floor: "Rez-de-chaussée",
    couleur: 7,
    picto: "cadre",
    photos: 2,
    horaires: {
      "2": [["10:00", "19:00"]],
      "3": [["10:00", "19:00"]],
      "4": [["10:00", "19:00"]],
      "5": [["10:00", "19:00"]],
      "6": [["10:00", "19:00"]],
    },
    slotStepMin: 60,
    minDurationMin: 240,
    delayMinDays: 14,
    cautionAmount: 300,
    rules:
      "Fermée le lundi et le dimanche. Accrochage sur cimaises uniquement (aucun perçage). Gardiennage à la charge de l'exposant pendant les heures d'ouverture au public.",
    equipements: ["Wi-Fi", "Accès PMR", "Tables", "Chaises", "Chauffage"],
    tarifs: [
      { profil: null, unite: "journee", montant: 120 },
      { profil: "association_commune", unite: "journee", montant: 0 },
      { profil: "entreprise", unite: "journee", montant: 350 },
    ],
    options: [
      {
        cle: "expo:vernissage",
        label: "Vernissage (tables hautes et verrerie)",
        montant: 80,
        unite: "forfait",
      },
    ],
  },
  {
    cle: "folie-desmares",
    site: "folie-desmares",
    name: "Salle de la Folie Desmares",
    nature: "Auditorium",
    description:
      "164 m² dans le parc de la Folie Desmares : 120 places assises en configuration conférence, estrade, sonorisation, vidéoprojecteur et écran 4 m, piano droit. Pour les assemblées générales, conférences, concerts de musique de chambre et réceptions.",
    seated: 120,
    standing: 160,
    surface: 164,
    floor: "Rez-de-chaussée",
    couleur: 4,
    picto: "micro",
    photos: 2,
    horaires: {
      "2": [["09:00", "23:00"]],
      "3": [["09:00", "23:00"]],
      "4": [["09:00", "23:00"]],
      "5": [["09:00", "23:00"]],
      "6": [["09:00", "23:00"]],
      "7": [["10:00", "20:00"]],
    },
    minDurationMin: 120,
    delayMinDays: 14,
    bufferBeforeMin: 30,
    bufferAfterMin: 30,
    cautionAmount: 600,
    rules:
      "Fermée le lundi. Aucune boisson ni nourriture près du piano. Jauge 160 personnes, issues de secours dégagées. Le parc ferme à 22 h : accès par la rue de la Gare ensuite.",
    instructions:
      "Rendez-vous technique avec le régisseur au moins 8 jours avant l'événement (01 46 57 01 12).",
    equipements: [
      "Sonorisation",
      "Micro",
      "Vidéoprojecteur",
      "Écran",
      "Chaises",
      "Accès PMR",
      "Piano",
      "Chauffage",
    ],
    tarifs: [
      { profil: null, unite: "demi_journee", montant: 200 },
      { profil: null, unite: "journee", montant: 350 },
      { profil: null, unite: "soiree", montant: 280 },
      { profil: "association_commune", unite: "demi_journee", montant: 0 },
      { profil: "association_commune", unite: "journee", montant: 0 },
      { profil: "association_commune", unite: "soiree", montant: 0 },
      { profil: "entreprise", unite: "demi_journee", montant: 600 },
      { profil: "entreprise", unite: "journee", montant: 1000 },
      { profil: "service_interne", unite: "journee", montant: 0 },
    ],
    options: [
      {
        cle: "auditorium:regie",
        label: "Régisseur son et vidéo",
        description: "Technicien de la ville en régie pendant l'événement.",
        montant: 45,
        unite: "heure",
      },
      {
        cle: "auditorium:captation",
        label: "Captation vidéo",
        description: "Enregistrement 2 caméras, fichier remis sous 8 jours.",
        montant: 350,
        unite: "forfait",
      },
    ],
  },
  {
    cle: "chalet",
    site: "chalet",
    name: "Chalet des quatre vents",
    nature: "Salle polyvalente",
    description:
      "Chalet de 35 m² avec coin cuisine, tables et chaises, pour une réunion de voisinage, un atelier en petit groupe ou un goûter d'anniversaire.",
    standing: 30,
    seated: 20,
    surface: 35,
    floor: "Rez-de-chaussée",
    couleur: 6,
    picto: "table",
    photos: 1,
    horaires: horaires("09:00-22:00", "09:00-22:00", "09:00-19:00"),
    minDurationMin: 120,
    delayMinDays: 7,
    cautionAmount: 150,
    rules: "Fin des activités à 22 h (19 h le dimanche). Pas de sonorisation extérieure.",
    equipements: ["Cuisine", "Réfrigérateur", "Tables", "Chaises", "Chauffage"],
    tarifs: TARIFS_SALLE,
  },
  // ── Équipements sportifs ──
  {
    cle: "terrain-multisport",
    site: "terrain-multisport",
    name: "Terrain multisport",
    nature: "Stade / terrain",
    description:
      "Terrain de proximité en revêtement synthétique, buts de football et de handball, paniers de basket. Ouvert de 9 h à 21 h ; réservable par créneau pour les clubs, centres de loisirs et animations.",
    standing: 60,
    couleur: 9,
    picto: "terrain",
    photos: 1,
    horaires: horaires("09:00-21:00", "09:00-21:00", "09:00-21:00"),
    minDurationMin: 60,
    delayMinDays: 3,
    cautionAmount: 0,
    rules:
      "Chaussures de sport uniquement. Le terrain reste accessible au public hors créneaux réservés.",
    equipements: [],
    tarifs: [
      { profil: "association_commune", unite: "heure", montant: 0 },
      { profil: "association_exterieure", unite: "heure", montant: 15 },
      { profil: "service_interne", unite: "heure", montant: 0 },
    ],
  },
  {
    cle: "sablons",
    site: "sablons",
    name: "Gymnase les Sablons",
    nature: "Gymnase",
    description:
      "Plateau de 44 × 24 m homologué basket, handball, volley et badminton, tribunes télescopiques de 300 places, tableau d'affichage, 4 vestiaires avec douches.",
    standing: 500,
    seated: 300,
    surface: 1200,
    couleur: 3,
    picto: "ballon",
    photos: 3,
    horaires: HORAIRES_GYMNASE,
    minDurationMin: 60,
    delayMinDays: 7,
    bufferBeforeMin: 15,
    bufferAfterMin: 15,
    cautionAmount: 500,
    rules:
      "Chaussures de sport propres obligatoires sur le plateau. Les créneaux scolaires (lundi-vendredi 8 h-17 h en période scolaire) sont prioritaires.",
    instructions: "Se présenter au gardien à l'entrée principale 15 minutes avant le créneau.",
    equipements: [...EQUIPEMENTS_GYMNASE, "Sonorisation"],
    tarifs: TARIFS_GYMNASE,
    options: [
      {
        cle: "gymnase:tribunes",
        label: "Tribunes télescopiques déployées",
        montant: 100,
        unite: "forfait",
      },
      {
        cle: "gymnase:gardien",
        label: "Gardiennage week-end",
        description: "Présence d'un gardien en dehors des horaires habituels.",
        montant: 28,
        unite: "heure",
      },
    ],
  },
  {
    cle: "gambetta",
    site: "gambetta",
    name: "Gymnase Gambetta",
    nature: "Gymnase",
    description:
      "Plateau multisports de 40 × 20 m, salle annexe de gymnastique, 2 vestiaires. Priorité aux écoles en journée.",
    standing: 200,
    seated: 80,
    surface: 800,
    couleur: 3,
    picto: "ballon",
    photos: 2,
    horaires: HORAIRES_GYMNASE,
    minDurationMin: 60,
    delayMinDays: 7,
    cautionAmount: 300,
    rules: "Chaussures de sport propres obligatoires. Créneaux scolaires prioritaires en semaine.",
    equipements: EQUIPEMENTS_GYMNASE,
    tarifs: TARIFS_GYMNASE,
  },
  {
    cle: "doret",
    site: "doret",
    name: "Salle sportive Marcel Doret",
    nature: "Dojo",
    description:
      "200 m² de tatamis (judo, karaté, aïkido, yoga, pilates), miroirs sur un mur, vestiaires attenants. Chauffage au sol.",
    standing: 80,
    surface: 200,
    couleur: 6,
    picto: "tatami",
    photos: 2,
    horaires: horaires("08:00-22:00", "08:00-20:00", null),
    minDurationMin: 60,
    delayMinDays: 7,
    cautionAmount: 200,
    rules:
      "Fermée le dimanche. Pieds nus ou chaussons sur les tatamis. Pas de chaussures de ville au-delà du vestiaire.",
    equipements: ["Vestiaires", "Douches", "Chauffage", "Accès PMR"],
    tarifs: [
      { profil: null, unite: "heure", montant: 15 },
      { profil: "association_commune", unite: "heure", montant: 0 },
      { profil: "entreprise", unite: "heure", montant: 40 },
    ],
  },
  {
    cle: "moquet",
    site: "moquet",
    name: "Stade Guy Môquet",
    nature: "Stade / terrain",
    description:
      "Terrain de football à 11 en gazon synthétique dernière génération, éclairage LED pour les séances en soirée, piste d'athlétisme, vestiaires et local matériel. Peut se réserver en moitié de terrain pour le football à 7.",
    standing: 300,
    surface: 7000,
    couleur: 9,
    picto: "terrain",
    photos: 2,
    horaires: horaires("08:00-22:30", "08:00-20:30", "08:00-20:30"),
    minDurationMin: 60,
    delayMinDays: 5,
    cautionAmount: 0,
    rules:
      "Du lundi au vendredi de 8 h à 22 h 30 ; samedi, dimanche et jours fériés de 8 h à 20 h 30. Crampons moulés uniquement. Le terrain est fermé en cas de neige ou de gel annoncé.",
    equipements: ["Vestiaires", "Douches", "Parking"],
    tarifs: [
      { profil: "association_commune", unite: "heure", montant: 0 },
      { profil: "association_exterieure", unite: "heure", montant: 35 },
      { profil: "particulier_commune", unite: "heure", montant: 40 },
      { profil: "particulier_exterieur", unite: "heure", montant: 60 },
      { profil: "entreprise", unite: "heure", montant: 80 },
      { profil: "service_interne", unite: "heure", montant: 0 },
    ],
    options: [
      { cle: "terrain:eclairage", label: "Éclairage nocturne", montant: 12, unite: "heure" },
    ],
  },
  {
    cle: "roland-garros",
    site: "roland-garros",
    name: "Complexe sportif Roland Garros",
    nature: "Gymnase",
    description:
      "Gymnase omnisports de 40 × 20 m avec salle de musculation et 2 courts de tennis couverts. Vestiaires et parking.",
    standing: 250,
    seated: 100,
    surface: 900,
    couleur: 3,
    picto: "ballon",
    photos: 2,
    horaires: HORAIRES_GYMNASE,
    minDurationMin: 60,
    delayMinDays: 7,
    cautionAmount: 300,
    rules:
      "Chaussures de sport propres obligatoires. Courts de tennis réservés aux adhérents du club en priorité.",
    equipements: EQUIPEMENTS_GYMNASE,
    tarifs: TARIFS_GYMNASE,
  },
  {
    cle: "langevin",
    site: "langevin",
    name: "Complexe sportif Langevin Wallon",
    nature: "Gymnase",
    description:
      "Gymnase de 40 × 20 m attenant au groupe scolaire, salle de danse et 2 vestiaires. Réservé aux écoles en journée, ouvert aux clubs le soir et le week-end.",
    standing: 200,
    seated: 60,
    surface: 800,
    couleur: 3,
    picto: "ballon",
    photos: 2,
    horaires: horaires("17:00-23:00", "08:00-20:00", "08:00-18:00"),
    minDurationMin: 60,
    delayMinDays: 7,
    cautionAmount: 300,
    rules:
      "Réservé aux écoles du lundi au vendredi jusqu'à 17 h. Chaussures de sport propres obligatoires.",
    equipements: EQUIPEMENTS_GYMNASE,
    tarifs: TARIFS_GYMNASE,
  },
  {
    cle: "republique",
    site: "republique",
    name: "Gymnase République",
    nature: "Gymnase",
    description:
      "Plateau sportif de 36 × 18 m, mur d'escalade de 8 m avec 12 voies, 2 vestiaires. Escalade réservée aux encadrants diplômés.",
    standing: 150,
    seated: 50,
    surface: 650,
    couleur: 3,
    picto: "ballon",
    photos: 2,
    horaires: HORAIRES_GYMNASE,
    minDurationMin: 60,
    delayMinDays: 7,
    cautionAmount: 300,
    rules:
      "Chaussures de sport propres obligatoires. Le mur d'escalade n'est utilisable qu'avec un encadrant diplômé et le matériel vérifié.",
    equipements: EQUIPEMENTS_GYMNASE,
    tarifs: TARIFS_GYMNASE,
  },
];

const OPTIONS_GLOBALES: OptionSpec[] = [
  {
    cle: "*:menage",
    label: "Ménage",
    description: "Nettoyage après l'événement par le prestataire de la ville.",
    montant: 80,
    unite: "forfait",
  },
  {
    cle: "*:montage",
    label: "Montage / démontage",
    description: "Installation et rangement du mobilier par les services techniques.",
    montant: 120,
    unite: "forfait",
  },
  {
    cle: "*:regisseur",
    label: "Régisseur",
    description: "Présence d'un agent technique pendant l'événement.",
    montant: 35,
    unite: "heure",
  },
  {
    cle: "*:tables",
    label: "Tables et chaises supplémentaires",
    description: "Par table de 6 avec ses chaises, livrée sur place.",
    montant: 1.5,
    unite: "unite",
  },
];

const MATERIELS = [
  {
    cle: "chaises",
    name: "Chaises pliantes",
    categorie: "Mobilier",
    description: "Chaises pliantes coque polypropylène, livrées par chariots de 50.",
    stockTotal: 300,
    montant: 0.5,
    unite: "unite",
  },
  {
    cle: "tables",
    name: "Tables rectangulaires 6 places",
    categorie: "Mobilier",
    description: "Tables pliantes 180 × 80 cm.",
    stockTotal: 60,
    montant: 3,
    unite: "unite",
  },
  {
    cle: "videoprojecteur",
    name: "Vidéoprojecteur",
    categorie: "Électronique",
    description: "Vidéoprojecteur 4000 lumens avec écran sur pied 2 m et câble HDMI.",
    stockTotal: 4,
    montant: 25,
    unite: "jour",
  },
  {
    cle: "sono",
    name: "Sonorisation portable",
    categorie: "Électronique",
    description: "Enceinte amplifiée sur batterie, 2 micros HF, entrée Bluetooth.",
    stockTotal: 3,
    montant: 40,
    unite: "jour",
  },
  {
    cle: "barnum",
    name: "Barnum 3 × 3 m",
    categorie: "Autre",
    description: "Tente pliante avec 3 parois, lestage fourni.",
    stockTotal: 8,
    montant: 30,
    unite: "jour",
  },
  {
    cle: "grilles",
    name: "Grilles d'exposition",
    categorie: "Signalétique",
    description: "Grilles caddie 1 × 2 m avec pieds et crochets.",
    stockTotal: 40,
    montant: 0,
    unite: "gratuit",
  },
];

// ── Usagers ──

// Les associations au dossier de subvention « sportif » : celles du fichier des associations
// sportives, hors danse et yoga (dossier associatif).
const SPORTIVES = new Set(
  ASSOCIATIONS_SPORTIVES.filter(
    (a) => !["arounddance", "espace-yoga", "scmc-yoga"].includes(a.cle),
  ).map((a) => a.cle),
);

const ORGS: OrgSpec[] = [
  ...ASSOCIATIONS_SPORTIVES,
  {
    cle: "atelier",
    type: "entreprise",
    name: "Atelier Numérique SAS",
    siret: "901 234 567 00012",
    address: "41 avenue de Paris",
    postalCode: "92320",
    city: "Châtillon",
    email: "contact@atelier-numerique.exemple.fr",
    phone: "01 46 57 45 67",
    website: "https://atelier-numerique.exemple.fr",
    contact: "Julien Bernard",
    notes: "Agence web de 12 salariés installée à Châtillon.",
    valide: true,
    user: {
      prenom: "Julien",
      nom: "Bernard",
      email: "julien.bernard@exemple.fr",
      phone: "06 67 90 23 45",
      fonction: "Gérant",
    },
  },
  {
    cle: "mederic",
    type: "entreprise",
    name: "Médéric Formation",
    siret: "812 345 678 00021",
    address: "120 route de la Reine",
    postalCode: "92100",
    city: "Boulogne-Billancourt",
    email: "contact@mederic-formation.exemple.fr",
    phone: "01 41 10 56 78",
    contact: "Isabelle Roux",
    notes: "Organisme de formation professionnelle : séminaires et formations d'une journée.",
    valide: true,
    user: {
      prenom: "Isabelle",
      nom: "Roux",
      email: "isabelle.roux@exemple.fr",
      phone: "06 78 01 34 56",
      fonction: "Responsable formation",
    },
  },
  {
    cle: "dupont",
    type: "particulier",
    name: "Martine Dupont",
    address: "9 rue Pierre-Brossolette",
    postalCode: "92320",
    city: "Châtillon",
    email: "martine.dupont@exemple.fr",
    phone: "06 89 12 45 67",
    contact: "Martine Dupont",
    valide: true,
    user: {
      prenom: "Martine",
      nom: "Dupont",
      email: "martine.dupont@exemple.fr",
      phone: "06 89 12 45 67",
    },
  },
  {
    cle: "garcia",
    type: "particulier",
    name: "Antoine Garcia",
    address: "33 rue Jean-Bleuzen",
    postalCode: "92170",
    city: "Vanves",
    email: "antoine.garcia@exemple.fr",
    phone: "06 90 23 56 78",
    contact: "Antoine Garcia",
    valide: true,
    user: {
      prenom: "Antoine",
      nom: "Garcia",
      email: "antoine.garcia@exemple.fr",
      phone: "06 90 23 56 78",
    },
  },
  {
    cle: "culture",
    type: "service_interne",
    name: "Service Culturel",
    address: "1 place de la Libération",
    postalCode: "92320",
    city: "Châtillon",
    email: "culture@exemple.fr",
    phone: "01 46 57 00 40",
    contact: "Léa Fontaine",
    notes: "Service de la ville : programmation culturelle, conseil municipal, cérémonies.",
    valide: true,
    user: {
      prenom: "Léa",
      nom: "Fontaine",
      email: "lea.fontaine@exemple.fr",
      phone: "06 11 22 33 44",
      fonction: "Chargée de programmation",
    },
  },
];

const AGENTS = [
  {
    cle: "sophie",
    prenom: "Sophie",
    nom: "Martin",
    email: "sophie.martin@exemple.fr",
    role: "gestionnaire",
    fonction: "Responsable Vie associative et location de salles",
    phone: "01 46 57 03 31",
  },
  {
    cle: "karim",
    prenom: "Karim",
    nom: "Benali",
    email: "karim.benali@exemple.fr",
    role: "agent",
    fonction: "Responsable des équipements sportifs",
    phone: "01 46 57 02 21",
  },
  {
    cle: "pierre",
    prenom: "Pierre",
    nom: "Durand",
    email: "pierre.durand@exemple.fr",
    role: "elu",
    fonction: "Adjoint au maire chargé de la vie associative et des sports",
    phone: "01 46 57 00 02",
  },
];

// ── Réservations ──

type MessageSpec = { qui: "usager" | "agent" | "note"; texte: string; lu?: boolean };
type ResaSpec = {
  espace: string;
  org: string;
  titre: string;
  nature?: string;
  jour: number;
  de: string;
  a: string;
  statut: ReservationStatus;
  recurrence?: Recurrence;
  options?: [string, number][];
  materiels?: [string, number][];
  participants?: number;
  description?: string;
  gratuit?: boolean;
  public?: boolean;
  source?: "portail" | "backoffice";
  /** Jours écoulés depuis le dépôt (par défaut : 21 pour l'avenir, l'âge du créneau + 25 pour le passé). */
  depuis?: number;
  motif?: string;
  messages?: MessageSpec[];
};

function reservations(): ResaSpec[] {
  const mardi = js(2, -75);
  const mercredi = js(3, -60);
  const samedi = js(6, -50);
  const jeudi = js(4, -40);
  return [
    // ── Récurrences hebdomadaires (confirmées) ──
    {
      espace: "sablons",
      org: "ascb",
      titre: "Entraînement seniors masculins",
      nature: "Activité sportive",
      jour: mardi,
      de: "18:00",
      a: "20:00",
      statut: "confirmee",
      participants: 24,
      public: false,
      recurrence: {
        freq: "weekly",
        interval: 1,
        byWeekday: [2],
        until: ymd(85),
        horsVacances: true,
        horsFeries: true,
      },
      description: "Créneau annuel du club, hors vacances scolaires et jours fériés.",
      depuis: 95,
      messages: [
        {
          qui: "usager",
          texte:
            "Bonjour, pourrions-nous disposer des tribunes le mardi où nous recevons Bagneux (match amical) ?",
          lu: true,
        },
        {
          qui: "agent",
          texte:
            "Bonjour Nadia, oui : indiquez-nous la date une semaine avant et Karim fera déployer les tribunes.",
          lu: true,
        },
      ],
    },
    {
      espace: "mb-reunion-2",
      org: "ttmc",
      titre: "Entraînement jeunes et adultes",
      nature: "Activité culturelle",
      jour: mercredi,
      de: "14:00",
      a: "18:00",
      statut: "confirmee",
      participants: 30,
      recurrence: {
        freq: "weekly",
        interval: 1,
        byWeekday: [3],
        until: ymd(88),
        except: [ymd(js(3, 50))],
      },
      depuis: 80,
    },
    {
      espace: "gabriel-peri",
      org: "arounddance",
      titre: "Éveil à la danse des tout-petits",
      nature: "Activité culturelle",
      jour: samedi,
      de: "09:30",
      a: "11:30",
      statut: "confirmee",
      participants: 18,
      recurrence: { freq: "weekly", interval: 2, byWeekday: [6], until: ymd(84) },
      depuis: 70,
      messages: [
        {
          qui: "note",
          texte:
            "Association sérieuse, salle toujours rendue impeccable. Priorité sur le samedi matin.",
          lu: true,
        },
      ],
    },
    {
      espace: "folie-desmares",
      org: "sgdt",
      titre: "Entraînement twirling et acrodanse",
      nature: "Activité culturelle",
      jour: jeudi,
      de: "20:00",
      a: "22:30",
      statut: "confirmee",
      participants: 45,
      recurrence: { freq: "weekly", interval: 1, byWeekday: [4], until: ymd(80) },
      depuis: 60,
    },
    // ── À traiter (récentes) ──
    {
      espace: "mb-polyvalente",
      org: "dupont",
      titre: "Mariage de Claire et Mehdi",
      nature: "Fête familiale",
      jour: js(6, 62),
      de: "14:00",
      a: "23:30",
      statut: "a_traiter",
      participants: 180,
      depuis: 1,
      source: "portail",
      options: [
        ["fetes:cuisine", 1],
        ["fetes:tables", 1],
        ["*:menage", 1],
      ],
      materiels: [
        ["tables", 30],
        ["chaises", 180],
      ],
      description: "Vin d'honneur à 15 h, dîner à 20 h. Traiteur extérieur.",
      messages: [
        {
          qui: "usager",
          texte: "Bonjour, est-il possible de venir décorer la salle le vendredi soir ?",
          lu: false,
        },
      ],
    },
    {
      espace: "folie-desmares",
      org: "mederic",
      titre: "Séminaire annuel des formateurs",
      nature: "Séminaire",
      jour: js(4, 45),
      de: "09:00",
      a: "17:30",
      statut: "a_traiter",
      participants: 120,
      depuis: 2,
      source: "portail",
      options: [["auditorium:regie", 1]],
      materiels: [["videoprojecteur", 1]],
    },
    {
      espace: "gabriel-peri",
      org: "garcia",
      titre: "Anniversaire 50 ans",
      nature: "Fête familiale",
      jour: js(6, 34),
      de: "18:00",
      a: "22:30",
      statut: "a_traiter",
      participants: 60,
      depuis: 3,
      source: "portail",
      options: [["polyvalente:vaisselle", 1]],
    },
    {
      espace: "moquet",
      org: "atelier",
      titre: "Tournoi de football inter-entreprises",
      nature: "Activité sportive",
      jour: js(6, 27),
      de: "09:00",
      a: "13:00",
      statut: "a_traiter",
      participants: 80,
      depuis: 2,
      source: "portail",
      options: [["terrain:eclairage", 1]],
      materiels: [["barnum", 2]],
    },
    {
      espace: "henri-matisse",
      org: "gama",
      titre: "Démonstration et initiation à l'aïkido",
      nature: "Activité sportive",
      jour: js(2, 40),
      de: "10:00",
      a: "19:00",
      statut: "a_traiter",
      participants: 100,
      depuis: 4,
      source: "portail",
      recurrence: { freq: "daily", interval: 1, count: 5 },
      materiels: [["grilles", 20]],
      messages: [
        {
          qui: "usager",
          texte: "Nous attendons la validation de notre compte pour finaliser. Merci !",
          lu: false,
        },
      ],
    },
    {
      espace: "mb-reunion-1",
      org: "ttmc",
      titre: "Conseil d'administration",
      nature: "Réunion",
      jour: js(2, 9),
      de: "19:00",
      a: "21:00",
      statut: "a_traiter",
      participants: 12,
      depuis: 1,
      source: "portail",
    },
    {
      espace: "doret",
      org: "garcia",
      titre: "Stage de yoga",
      nature: "Activité sportive",
      jour: js(6, 20),
      de: "09:00",
      a: "12:00",
      statut: "a_traiter",
      participants: 15,
      depuis: 5,
      source: "portail",
    },
    // ── En traitement ──
    {
      espace: "mb-polyvalente",
      org: "atelier",
      titre: "Soirée des 10 ans de l'agence",
      nature: "Autre",
      jour: js(5, 55),
      de: "18:00",
      a: "23:00",
      statut: "en_traitement",
      participants: 150,
      depuis: 9,
      source: "portail",
      options: [
        ["fetes:sono", 1],
        ["fetes:cuisine", 1],
        ["*:menage", 1],
      ],
      messages: [
        {
          qui: "agent",
          texte:
            "Bonjour, pouvez-vous nous transmettre votre attestation d'assurance responsabilité civile et préciser si un traiteur interviendra en cuisine ?",
          lu: true,
        },
        {
          qui: "usager",
          texte:
            "Bonjour, oui un traiteur sera présent. Je vous envoie l'attestation d'ici vendredi.",
          lu: false,
        },
        {
          qui: "note",
          texte:
            "Dossier à surveiller : la soirée se termine à 23 h, rappeler la règle sur la sonorisation.",
          lu: true,
        },
      ],
    },
    {
      espace: "sablons",
      org: "mederic",
      titre: "Journée de cohésion (olympiades)",
      nature: "Séminaire",
      jour: js(5, 38),
      de: "09:00",
      a: "17:00",
      statut: "en_traitement",
      participants: 90,
      depuis: 12,
      source: "portail",
      options: [["gymnase:tribunes", 1]],
      materiels: [
        ["sono", 1],
        ["tables", 6],
      ],
    },
    {
      espace: "gabriel-peri",
      org: "gama",
      titre: "Repas de fin d'année du club",
      nature: "Autre",
      jour: js(7, 50),
      de: "11:00",
      a: "17:00",
      statut: "en_traitement",
      participants: 90,
      depuis: 6,
      source: "portail",
      messages: [
        {
          qui: "agent",
          texte:
            "Bonjour, votre fiche d'organisation doit d'abord être validée (statuts et attestation d'assurance à déposer). Nous instruisons ensuite la demande.",
          lu: false,
        },
      ],
    },
    {
      espace: "folie-desmares",
      org: "arounddance",
      titre: "Spectacle de fin d'année des enfants",
      nature: "Spectacle",
      jour: js(6, 48),
      de: "14:00",
      a: "19:00",
      statut: "en_traitement",
      participants: 180,
      depuis: 15,
      source: "portail",
      public: true,
      options: [
        ["auditorium:regie", 1],
        ["auditorium:captation", 1],
      ],
    },
    // ── Acceptées (convention à signer, code 123456) ──
    {
      espace: "mb-polyvalente",
      org: "garcia",
      titre: "Repas de famille (baptême)",
      nature: "Fête familiale",
      jour: js(7, 30),
      de: "11:00",
      a: "19:00",
      statut: "acceptee",
      participants: 70,
      depuis: 20,
      source: "portail",
      options: [
        ["fetes:cuisine", 1],
        ["*:menage", 1],
      ],
      materiels: [
        ["tables", 12],
        ["chaises", 70],
      ],
      messages: [
        {
          qui: "agent",
          texte:
            "Votre demande est acceptée : la convention est prête à être signée depuis votre espace.",
          lu: true,
        },
      ],
    },
    {
      espace: "folie-desmares",
      org: "atelier",
      titre: "Conférence « IA et collectivités »",
      nature: "Conférence",
      jour: js(3, 25),
      de: "18:30",
      a: "21:30",
      statut: "acceptee",
      participants: 150,
      depuis: 18,
      source: "portail",
      public: true,
      options: [["auditorium:regie", 1]],
    },
    {
      espace: "gabriel-peri",
      org: "dupont",
      titre: "Fête de départ en retraite",
      nature: "Fête familiale",
      jour: js(6, 41),
      de: "17:00",
      a: "22:30",
      statut: "acceptee",
      participants: 50,
      depuis: 14,
      source: "portail",
      options: [
        ["polyvalente:vaisselle", 1],
        ["polyvalente:sono", 1],
      ],
    },
    {
      espace: "sablons",
      org: "gama",
      titre: "Stage de ken jutsu",
      nature: "Activité sportive",
      jour: js(7, 36),
      de: "10:00",
      a: "18:00",
      statut: "acceptee",
      participants: 120,
      depuis: 24,
      source: "portail",
      options: [["gymnase:gardien", 1]],
    },
    // ── Signées (acompte attendu) ──
    {
      espace: "mb-polyvalente",
      org: "mederic",
      titre: "Convention annuelle Médéric Formation",
      nature: "Séminaire",
      jour: js(5, 19),
      de: "08:30",
      a: "18:00",
      statut: "signee",
      participants: 200,
      depuis: 35,
      source: "portail",
      options: [
        ["fetes:sono", 1],
        ["fetes:tables", 1],
        ["*:regisseur", 1],
      ],
      materiels: [["videoprojecteur", 2]],
    },
    {
      espace: "gabriel-peri",
      org: "garcia",
      titre: "Baby shower",
      nature: "Fête familiale",
      jour: js(7, 23),
      de: "14:00",
      a: "19:00",
      statut: "signee",
      participants: 35,
      depuis: 22,
      source: "portail",
      options: [["polyvalente:vaisselle", 1]],
    },
    {
      espace: "henri-matisse",
      org: "atelier",
      titre: "Salon des créateurs numériques",
      nature: "Exposition",
      jour: js(5, 60),
      de: "10:00",
      a: "19:00",
      statut: "signee",
      participants: 200,
      depuis: 40,
      source: "portail",
      recurrence: { freq: "daily", interval: 1, count: 2 },
      options: [["expo:vernissage", 1]],
      materiels: [
        ["grilles", 30],
        ["tables", 10],
      ],
    },
    // ── Confirmées (à venir) ──
    {
      espace: "folie-desmares",
      org: "culture",
      titre: "Conseil municipal",
      nature: "Réunion",
      jour: js(3, 12),
      de: "19:00",
      a: "23:00",
      statut: "confirmee",
      participants: 80,
      depuis: 30,
      source: "backoffice",
      public: true,
      options: [["auditorium:regie", 1]],
      recurrence: { freq: "monthly", interval: 1, count: 3 },
    },
    {
      espace: "mb-polyvalente",
      org: "arounddance",
      titre: "Gala de fin d'année d'Around dance",
      nature: "Fête familiale",
      jour: js(6, 55),
      de: "14:00",
      a: "20:00",
      statut: "confirmee",
      participants: 220,
      depuis: 45,
      source: "portail",
      public: true,
      options: [
        ["fetes:sono", 1],
        ["fetes:tables", 1],
      ],
      materiels: [
        ["chaises", 150],
        ["barnum", 2],
      ],
      messages: [
        {
          qui: "usager",
          texte:
            "Merci pour la confirmation ! Pouvons-nous installer un stand crêpes sur la terrasse ?",
          lu: false,
        },
      ],
    },
    {
      espace: "sablons",
      org: "culture",
      titre: "Forum des associations",
      nature: "Autre",
      jour: js(6, 70),
      de: "09:00",
      a: "18:00",
      statut: "confirmee",
      participants: 600,
      depuis: 60,
      source: "backoffice",
      public: true,
      options: [
        ["gymnase:tribunes", 1],
        ["*:montage", 1],
      ],
      materiels: [
        ["tables", 50],
        ["chaises", 120],
        ["barnum", 6],
        ["grilles", 10],
      ],
    },
    {
      espace: "gabriel-peri",
      org: "dupont",
      titre: "Repas de quartier des Pierrelais",
      nature: "Fête familiale",
      jour: js(7, 16),
      de: "12:00",
      a: "18:30",
      statut: "confirmee",
      participants: 80,
      depuis: 28,
      source: "portail",
      options: [
        ["polyvalente:vaisselle", 1],
        ["*:menage", 1],
      ],
      materiels: [
        ["tables", 14],
        ["chaises", 80],
      ],
    },
    {
      espace: "mb-reunion-1",
      org: "sgdt",
      titre: "Assemblée générale de Sport Gym Danse Twirling",
      nature: "Assemblée générale",
      jour: js(2, 14),
      de: "19:00",
      a: "21:30",
      statut: "confirmee",
      participants: 20,
      depuis: 10,
      source: "portail",
    },
    {
      espace: "moquet",
      org: "ascb",
      titre: "Entraînement physique sur terrain",
      nature: "Activité sportive",
      jour: js(6, 8),
      de: "10:00",
      a: "12:00",
      statut: "confirmee",
      participants: 20,
      depuis: 9,
      source: "portail",
      gratuit: true,
    },
    // ── Terminées (passées) ──
    {
      espace: "mb-polyvalente",
      org: "dupont",
      titre: "Noces d'or",
      nature: "Fête familiale",
      jour: js(6, -45),
      de: "12:00",
      a: "23:00",
      statut: "terminee",
      participants: 120,
      source: "portail",
      options: [
        ["fetes:cuisine", 1],
        ["fetes:tables", 1],
        ["*:menage", 1],
      ],
      materiels: [
        ["tables", 20],
        ["chaises", 120],
      ],
    },
    {
      espace: "folie-desmares",
      org: "mederic",
      titre: "Formation « Management de proximité »",
      nature: "Formation",
      jour: js(3, -60),
      de: "09:00",
      a: "17:00",
      statut: "terminee",
      participants: 60,
      source: "portail",
      options: [["auditorium:regie", 1]],
      materiels: [["videoprojecteur", 1]],
    },
    {
      espace: "sablons",
      org: "mederic",
      titre: "Team building sportif",
      nature: "Séminaire",
      jour: js(5, -31),
      de: "14:00",
      a: "18:00",
      statut: "terminee",
      participants: 70,
      source: "portail",
      options: [["gymnase:tribunes", 1]],
      materiels: [["sono", 1]],
    },
    {
      espace: "gabriel-peri",
      org: "garcia",
      titre: "Communion",
      nature: "Fête familiale",
      jour: js(7, -24),
      de: "12:00",
      a: "18:00",
      statut: "terminee",
      participants: 45,
      source: "portail",
      options: [["polyvalente:vaisselle", 1]],
    },
    {
      espace: "henri-matisse",
      org: "sgdt",
      titre: "Exposition « Le twirling à Châtillon »",
      nature: "Exposition",
      jour: js(2, -55),
      de: "10:00",
      a: "19:00",
      statut: "terminee",
      participants: 300,
      source: "backoffice",
      public: true,
      recurrence: { freq: "daily", interval: 1, count: 5 },
      materiels: [["grilles", 25]],
    },
    {
      espace: "chalet",
      org: "atelier",
      titre: "Lancement produit",
      nature: "Conférence",
      jour: js(4, -18),
      de: "17:00",
      a: "22:00",
      statut: "terminee",
      participants: 120,
      source: "portail",
      options: [
        ["*:regisseur", 1],
        ["*:menage", 1],
      ],
      materiels: [
        ["videoprojecteur", 1],
        ["chaises", 120],
      ],
    },
    {
      espace: "doret",
      org: "garcia",
      titre: "Atelier self-défense",
      nature: "Activité sportive",
      jour: js(6, -12),
      de: "14:00",
      a: "17:00",
      statut: "terminee",
      participants: 12,
      source: "portail",
    },
    {
      espace: "moquet",
      org: "atelier",
      titre: "Match de gala clients",
      nature: "Activité sportive",
      jour: js(4, -9),
      de: "18:00",
      a: "20:00",
      statut: "terminee",
      participants: 40,
      source: "portail",
      options: [["terrain:eclairage", 1]],
    },
    {
      espace: "mb-reunion-1",
      org: "arounddance",
      titre: "Réunion de rentrée des parents",
      nature: "Réunion",
      jour: js(2, -50),
      de: "18:30",
      a: "20:30",
      statut: "terminee",
      participants: 18,
      source: "portail",
    },
    // ── Refusées ──
    {
      espace: "mb-polyvalente",
      org: "garcia",
      titre: "Soirée dansante privée",
      nature: "Autre",
      jour: js(6, 48),
      de: "20:00",
      a: "02:00",
      statut: "refusee",
      participants: 250,
      depuis: 16,
      source: "portail",
      motif:
        "La salle des fêtes est déjà réservée ce soir-là pour le gala de fin d'année d'Around dance ; la fin à 2 h du matin dépasse par ailleurs les horaires autorisés.",
    },
    {
      espace: "sablons",
      org: "gama",
      titre: "Vide-grenier du club",
      nature: "Vide-grenier / brocante",
      jour: js(7, 29),
      de: "08:00",
      a: "18:00",
      statut: "refusee",
      participants: 400,
      depuis: 20,
      source: "portail",
      motif:
        "Le gymnase n'accueille pas de brocante (sol sportif). Orientez-vous vers le terrain synthétique ou le parvis de la Maison Blanche.",
    },
    {
      espace: "mb-reunion-2",
      org: "atelier",
      titre: "Formation interne",
      nature: "Formation",
      jour: js(4, 15),
      de: "09:00",
      a: "17:00",
      statut: "refusee",
      participants: 10,
      depuis: 8,
      source: "portail",
      motif:
        "Salle réservée aux associations de la commune. La salle de réunion du 1er étage est disponible à ces dates.",
    },
    // ── Annulées ──
    {
      espace: "gabriel-peri",
      org: "arounddance",
      titre: "Bourse aux costumes de danse",
      nature: "Vide-grenier / brocante",
      jour: js(7, -6),
      de: "09:00",
      a: "17:00",
      statut: "annulee",
      participants: 100,
      source: "portail",
      motif: "Annulée par l'association : manque de bénévoles.",
    },
    {
      espace: "folie-desmares",
      org: "culture",
      titre: "Ciné-club de novembre",
      nature: "Spectacle",
      jour: js(3, 33),
      de: "20:00",
      a: "22:30",
      statut: "annulee",
      participants: 120,
      depuis: 25,
      source: "backoffice",
      motif: "Film non disponible à la date prévue ; séance reportée.",
    },
    {
      espace: "mb-reunion-1",
      org: "mederic",
      titre: "Entretiens de recrutement",
      nature: "Réunion",
      jour: js(2, 6),
      de: "09:00",
      a: "13:00",
      statut: "annulee",
      participants: 4,
      depuis: 7,
      source: "portail",
      motif: "Annulée par l'usager depuis son espace.",
    },
    // ── Archivées (anciennes) ──
    {
      espace: "mb-polyvalente",
      org: "sgdt",
      titre: "Gala de printemps",
      nature: "Spectacle",
      jour: js(6, -88),
      de: "15:00",
      a: "23:00",
      statut: "archivee",
      participants: 350,
      source: "backoffice",
      public: true,
      options: [
        ["fetes:sono", 1],
        ["*:menage", 1],
      ],
    },
    {
      espace: "sablons",
      org: "ascb",
      titre: "Tournoi de fin de saison",
      nature: "Activité sportive",
      jour: js(6, -80),
      de: "09:00",
      a: "19:00",
      statut: "archivee",
      participants: 200,
      source: "portail",
      options: [["gymnase:tribunes", 1]],
      materiels: [
        ["tables", 6],
        ["sono", 1],
      ],
    },
    {
      espace: "gabriel-peri",
      org: "ttmc",
      titre: "Open de tennis de table de Châtillon",
      nature: "Activité culturelle",
      jour: js(7, -85),
      de: "09:00",
      a: "19:00",
      statut: "archivee",
      participants: 90,
      source: "portail",
      materiels: [
        ["tables", 25],
        ["chaises", 100],
      ],
    },
    {
      espace: "mb-reunion-3",
      org: "dupont",
      titre: "Cocktail d'anniversaire",
      nature: "Fête familiale",
      jour: js(6, -70),
      de: "17:00",
      a: "22:00",
      statut: "archivee",
      participants: 40,
      source: "portail",
      options: [["*:menage", 1]],
    },
  ];
}

// ── Chargement ──

type EspaceRow = {
  id: number;
  name: string;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  siteName: string;
  cle: string;
};

const compteurs: Record<string, number> = {};
function compter(cle: string, n = 1): void {
  compteurs[cle] = (compteurs[cle] ?? 0) + n;
}

async function creerSitesEtEspaces(): Promise<{
  espaces: Map<string, EspaceRow>;
  options: Map<string, number>;
  materiels: Map<string, number>;
}> {
  console.log("→ Sites, espaces, tarifs, options, photos…");
  const sites = new Map<string, { id: number; name: string }>();
  for (const [i, s] of SITES.entries()) {
    const site = await prisma.site.create({
      data: {
        name: s.name,
        slug: slug(s.name),
        description: s.description,
        address: s.address,
        postalCode: s.postalCode,
        city: s.city,
        lat: s.lat,
        lng: s.lng,
        phone: s.phone,
        email: s.email,
        accessInfo: s.accessInfo,
        position: i,
      },
    });
    sites.set(s.cle, { id: site.id, name: site.name });
    compter("sites");
    const reellesSite = photosReelles(`site:${s.cle}`);
    const photosSite = reellesSite.length
      ? reellesSite
      : [
          {
            nom: "photo-1.jpg",
            titre: "Façade",
            octets: await photo(
              COULEURS_ESPACE[(i * 3) % COULEURS_ESPACE.length],
              s.picto,
              s.name,
              `${s.address} · ${s.city}`,
              i,
            ),
          },
        ];
    for (const p of photosSite) {
      await deposerDocument({
        kind: "site",
        parentId: site.id,
        fichier: { nom: p.nom, mime: "image/jpeg", octets: p.octets },
        docKind: "photo",
        title: p.titre || null,
        isPublic: true,
      });
      compter("photos");
    }
  }

  const espaces = new Map<string, EspaceRow>();
  const options = new Map<string, number>();
  const materiels = new Map<string, number>();
  for (const [i, e] of ESPACES.entries()) {
    const site = sites.get(e.site);
    if (!site) throw new Error(`Site inconnu : ${e.site}`);
    const parent = e.parent ? espaces.get(e.parent) : undefined;
    const couleur = COULEURS_ESPACE[e.couleur % COULEURS_ESPACE.length];
    const row = await prisma.espace.create({
      data: {
        siteId: site.id,
        parentId: parent?.id ?? null,
        name: e.name,
        // « Salle polyvalente - Espace Maison Blanche » → libellé court « Salle polyvalente ».
        shortName:
          e.court !== undefined
            ? e.court
            : e.name.includes(" - ")
              ? e.name.split(" - ")[0].trim()
              : null,
        slug: slug(e.name),
        natureId: refOuNull("espace_nature", e.nature),
        secteur: ["Gymnase", "Stade / terrain", "Piscine", "Dojo"].includes(e.nature ?? "")
          ? "sport"
          : "salle",
        description: e.description,
        capacityStanding: e.standing ?? null,
        capacitySeated: e.seated ?? null,
        surface: e.surface ?? null,
        floor: e.floor ?? null,
        color: couleur,
        isPublic: true,
        allowedProfiles: e.allowedProfiles ?? [],
        requiresValidation: e.requiresValidation ?? true,
        openHours: e.horaires,
        slotStepMin: e.slotStepMin ?? 30,
        minDurationMin: e.minDurationMin ?? 60,
        maxDurationMin: e.maxDurationMin ?? null,
        delayMinDays: e.delayMinDays ?? 7,
        horizonMaxDays: e.horizonMaxDays ?? 365,
        bufferBeforeMin: e.bufferBeforeMin ?? 0,
        bufferAfterMin: e.bufferAfterMin ?? 0,
        cautionAmount: e.cautionAmount ?? 0,
        rules: e.rules ?? null,
        instructions: e.instructions ?? null,
        position: i,
        equipements: {
          create: e.equipements.map((label) => ({ equipementId: ref("equipement", label) })),
        },
        tarifs: {
          create: e.tarifs.map((t, j) => ({
            profilId: t.profil ? ref("profil", t.profil) : null,
            unite: t.unite,
            montant: t.montant,
            label: t.label ?? null,
            position: j,
          })),
        },
      },
    });
    espaces.set(e.cle, {
      id: row.id,
      name: row.name,
      bufferBeforeMin: row.bufferBeforeMin,
      bufferAfterMin: row.bufferAfterMin,
      siteName: site.name,
      cle: e.cle,
    });
    compter("espaces");
    compter("tarifs", e.tarifs.length);
    for (const [j, o] of (e.options ?? []).entries()) {
      const opt = await prisma.option.create({
        data: {
          espaceId: row.id,
          label: o.label,
          description: o.description ?? null,
          montant: o.montant,
          unite: o.unite,
          mandatory: o.mandatory ?? false,
          position: j,
        },
      });
      options.set(o.cle, opt.id);
      compter("options");
    }
    const sousTitres = ["Vue d'ensemble", "Configuration conférence", "Détail de l'équipement"];
    const reelles = photosReelles(`espace:${e.cle}`);
    const photosEspace = reelles.length ? reelles : [];
    if (!reelles.length)
      for (let v = 0; v < e.photos; v++)
        photosEspace.push({
          nom: `photo-${v + 1}.jpg`,
          titre: sousTitres[v],
          octets: await photo(couleur, e.picto, e.name, `${site.name} · ${sousTitres[v]}`, v),
        });
    for (const p of photosEspace) {
      await deposerDocument({
        kind: "espace",
        parentId: row.id,
        fichier: { nom: p.nom, mime: "image/jpeg", octets: p.octets },
        docKind: "photo",
        title: p.titre || null,
        isPublic: true,
      });
      compter("photos");
    }
  }
  // Règlement intérieur joint à la salle des fêtes (pièce publique).
  const fetes = espaces.get("mb-polyvalente");
  if (fetes) {
    const texte = `# Règlement intérieur de la salle polyvalente de l'Espace Maison Blanche\n\n1. La salle est mise à disposition pour l'objet déclaré dans la convention, et pour lui seul.\n2. Capacité maximale : 500 personnes debout, 300 assises. Les issues de secours restent dégagées.\n3. Fin de la sonorisation à minuit (2 h le samedi). Le voisinage est résidentiel.\n4. Confettis, bougies et fumigènes sont interdits. Aucune fixation sur les murs.\n5. Les lieux sont restitués propres et le mobilier rangé ; un état des lieux est fait à la remise et à la restitution des clés.\n6. La caution est encaissée en cas de dégradation ou de nettoyage non effectué.\n7. L'occupant est responsable de la sécurité des participants et déclare être assuré en responsabilité civile.\n\nVille de Châtillon · Service Vie associative et location de salles`;
    await deposerDocument({
      kind: "espace",
      parentId: fetes.id,
      fichier: {
        nom: "reglement-interieur.md",
        mime: "text/markdown",
        octets: Buffer.from(texte, "utf8"),
      },
      docKind: "reglement",
      title: "Règlement intérieur",
      isPublic: true,
    });
    compter("documents");
  }
  for (const [j, o] of OPTIONS_GLOBALES.entries()) {
    const opt = await prisma.option.create({
      data: {
        espaceId: null,
        label: o.label,
        description: o.description ?? null,
        montant: o.montant,
        unite: o.unite,
        position: j,
      },
    });
    options.set(o.cle, opt.id);
    compter("options");
  }
  for (const m of MATERIELS) {
    const row = await prisma.materiel.create({
      data: {
        name: m.name,
        categorieId: refOuNull("materiel_categorie", m.categorie),
        description: m.description,
        stockTotal: m.stockTotal,
        montant: m.montant,
        unite: m.unite,
      },
    });
    materiels.set(m.cle, row.id);
    compter("materiels");
  }
  // Indisponibilités à venir.
  const indispos: [string, number, string, number, string, string][] = [
    ["sablons", 21, "08:00", 27, "23:00", "Travaux : reprise du sol sportif"],
    ["mb-polyvalente", 47, "08:00", 47, "23:00", "Usage municipal : cérémonie des vœux"],
    ["folie-desmares", 5, "09:00", 5, "18:00", "Maintenance de la régie lumière"],
  ];
  for (const [cle, j1, h1, j2, h2, motif] of indispos) {
    const e = espaces.get(cle);
    if (!e) continue;
    await prisma.indisponibilite.create({
      data: {
        espaceId: e.id,
        startAt: a(j1, h1),
        endAt: a(j2, h2),
        motif,
        createdBy: "sophie.martin@exemple.fr",
      },
    });
    compter("indisponibilites");
  }
  return { espaces, options, materiels };
}

type Compte = { id: string; nom: string; email: string; phone: string | null };
type OrgRow = {
  id: number;
  name: string;
  profilId: number | null;
  user: Compte;
  cle: string;
  sportive: boolean;
  address: string | null;
  postalCode: string;
  city: string;
  email: string | null;
  phone: string | null;
};

async function creerAgents(espaces: Map<string, EspaceRow>): Promise<Map<string, Compte>> {
  console.log("→ Agents…");
  const out = new Map<string, Compte>();
  for (const ag of AGENTS) {
    const u = await prisma.user.create({
      data: {
        email: ag.email,
        name: `${ag.prenom} ${ag.nom}`,
        firstName: ag.prenom,
        lastName: ag.nom,
        phone: ag.phone,
        fonction: ag.fonction,
        kind: "agent",
        role: ag.role,
        lastLoginAt: ilYA(entre(0, 3), entre(1, 9)),
      },
    });
    await poserMotDePasse(u.id, MOT_DE_PASSE);
    out.set(ag.cle, { id: u.id, nom: u.name, email: u.email, phone: u.phone });
    compter("agents");
  }
  const karim = out.get("karim");
  if (karim) {
    for (const cle of SPORT) {
      const e = espaces.get(cle);
      if (e)
        await prisma.espaceGestionnaire.create({
          data: { espaceId: e.id, userId: karim.id, role: "gestionnaire" },
        });
    }
  }
  const sophie = out.get("sophie");
  if (sophie) {
    for (const cle of SALLES) {
      const e = espaces.get(cle);
      if (e)
        await prisma.espaceGestionnaire.create({
          data: { espaceId: e.id, userId: sophie.id, role: "gestionnaire" },
        });
    }
  }
  return out;
}

async function creerUsagers(): Promise<Map<string, OrgRow>> {
  console.log("→ Organisations et comptes usagers…");
  const out = new Map<string, OrgRow>();
  for (const o of ORGS) {
    const profilId = await profilParDefaut(o.type, o.postalCode);
    const creeIlYA = entre(40, 400);
    const org = await prisma.organisation.create({
      data: {
        type: o.type,
        name: o.name,
        siret: o.siret ?? null,
        rna: o.rna ?? null,
        address: o.address ?? null,
        postalCode: o.postalCode,
        city: o.city,
        email: o.email ?? null,
        phone: o.phone ?? null,
        website: o.website ?? null,
        legalFirstName: o.contact?.split(" ")[0] ?? null,
        legalLastName: o.contact?.split(" ").slice(1).join(" ") || null,
        legalAppointedAt:
          o.type === "association" ? new Date(Date.UTC(2025, entre(0, 11), entre(1, 28))) : null,
        profilId,
        sportive: SPORTIVES.has(o.cle),
        notes: o.notes ?? null,
        validatedAt: o.valide ? ilYA(creeIlYA - 2) : null,
        createdAt: ilYA(creeIlYA),
      },
    });
    const u = await prisma.user.create({
      data: {
        email: o.user.email,
        name: `${o.user.prenom} ${o.user.nom}`,
        firstName: o.user.prenom,
        lastName: o.user.nom,
        phone: o.user.phone ?? null,
        fonction: o.user.fonction ?? null,
        kind: "usager",
        role: "usager",
        organisationId: org.id,
        acceptedCguAt: ilYA(creeIlYA),
        lastLoginAt: ilYA(entre(0, 20), entre(0, 12)),
        createdAt: ilYA(creeIlYA),
      },
    });
    await poserMotDePasse(u.id, MOT_DE_PASSE);
    out.set(o.cle, {
      id: org.id,
      name: org.name,
      profilId,
      user: { id: u.id, nom: u.name, email: u.email, phone: u.phone },
      cle: o.cle,
      sportive: org.sportive,
      address: org.address,
      postalCode: o.postalCode,
      city: o.city,
      email: org.email,
      phone: org.phone,
    });
    compter("organisations");
    compter("usagers");
  }
  // Statuts déposés par l'ASCB (pièce de la fiche organisation).
  const basket = out.get("ascb");
  if (basket) {
    const texte =
      "STATUTS DE L'ASSOCIATION « ASSOCIATION SPORTIVE CHÂTILLON BASKET »\n\nArticle 1 : Il est fondé entre les adhérents aux présents statuts une association régie par la loi du 1er juillet 1901, ayant pour titre Association sportive Châtillon Basket.\nArticle 2 : L'association a pour objet la pratique et la promotion du basket-ball à Châtillon.\nArticle 3 : Le siège social est fixé 35 avenue Clément Perrière, 92320 Châtillon.\n\n(Document de démonstration.)";
    await deposerDocument({
      kind: "organisation",
      parentId: basket.id,
      fichier: { nom: "statuts.txt", mime: "text/plain", octets: Buffer.from(texte, "utf8") },
      docKind: "statuts",
      title: "Statuts de l'association",
      categoryId: refOuNull("doc_categorie", "Statuts"),
      uploadedById: basket.user.id,
    });
    compter("documents");
  }
  return out;
}

type Contexte = {
  espaces: Map<string, EspaceRow>;
  options: Map<string, number>;
  materiels: Map<string, number>;
  orgs: Map<string, OrgRow>;
  agents: Map<string, Compte>;
  admin: Compte;
  tva: number;
};

// Les clés des équipements sportifs (suivis par Karim) et des salles (suivies par Sophie).
const SPORT = new Set([
  "terrain-multisport",
  "sablons",
  "gambetta",
  "doret",
  "moquet",
  "roland-garros",
  "langevin",
  "republique",
]);
const SALLES = [
  "mb-polyvalente",
  "mb-reunion-1",
  "mb-reunion-2",
  "mb-reunion-3",
  "gabriel-peri",
  "henri-matisse",
  "folie-desmares",
  "chalet",
];

async function creerReservations(ctx: Contexte): Promise<Map<ReservationStatus, number[]>> {
  console.log("→ Réservations, factures, messages…");
  const parStatut = new Map<ReservationStatus, number[]>();
  const sophie = ctx.agents.get("sophie");
  const karim = ctx.agents.get("karim");
  if (!sophie || !karim) throw new Error("Agents de démonstration absents.");
  for (const s of reservations()) {
    const espace = ctx.espaces.get(s.espace);
    const org = ctx.orgs.get(s.org);
    if (!espace || !org)
      throw new Error(`Réservation « ${s.titre} » : espace ou organisation inconnu.`);
    const premier: Intervalle = { startAt: a(s.jour, s.de), endAt: a(s.jour, s.a) };
    if (premier.endAt <= premier.startAt)
      premier.endAt = new Date(premier.endAt.getTime() + 86_400_000);
    const creneaux = developperRecurrence(
      premier,
      s.recurrence ?? null,
      await joursExclus(premier, s.recurrence ?? null),
    );
    const conflitsTrouves = await verifierDisponibilite(espace, creneaux);
    if (conflitsTrouves.length) {
      const c = conflitsTrouves[0];
      console.log(
        `   ⚠ « ${s.titre} » ignorée : ${plage(c.demande.startAt, c.demande.endAt)} chevauche « ${c.existant.libelle} ».`,
      );
      compter("reservations ignorées (conflit)");
      continue;
    }
    const options = (s.options ?? []).map(([cle, quantite]) => {
      const optionId = ctx.options.get(cle);
      if (!optionId) throw new Error(`Option inconnue : ${cle}`);
      return { optionId, quantite };
    });
    const materiels = (s.materiels ?? []).map(([cle, quantite]) => {
      const materielId = ctx.materiels.get(cle);
      if (!materielId) throw new Error(`Matériel inconnu : ${cle}`);
      return { materielId, quantite };
    });
    const devis = await deviser(
      espace.id,
      org.profilId,
      creneaux,
      options,
      materiels,
      s.gratuit ?? false,
    );
    const b = bornes(creneaux);
    const depuis = s.depuis ?? (s.jour < 0 ? -s.jour + 25 : 21);
    const createdAt = plusTot(
      ilYA(depuis, entre(8, 18)),
      new Date(b.startAt.getTime() - 3 * 86_400_000),
    );
    const agent = SPORT.has(s.espace) ? karim : sophie;
    const traite = !["a_traiter"].includes(s.statut);
    const annule = s.statut === "refusee" || s.statut === "annulee";
    const [opts, mats] = await Promise.all([
      options.length
        ? prisma.option.findMany({ where: { id: { in: options.map((o) => o.optionId) } } })
        : [],
      materiels.length
        ? prisma.materiel.findMany({ where: { id: { in: materiels.map((m) => m.materielId) } } })
        : [],
    ]);

    // Chronologie du dossier : chaque étape suit la précédente, sans dépasser maintenant.
    const histo: {
      action: string;
      comment: string | null;
      performedBy: string;
      performedAt: Date;
    }[] = [];
    let curseur = createdAt;
    const etape = (heures: number) => {
      curseur = plusTot(new Date(curseur.getTime() + heures * 3_600_000));
      return curseur;
    };
    histo.push({
      action: "Demande déposée",
      comment: `${creneaux.length} créneau(x) · ${RESERVATION_STATUS.a_traiter.label}`,
      performedBy: s.source === "backoffice" ? agent.nom : org.user.nom,
      performedAt: createdAt,
    });
    let decisionAt: Date | null = null;
    let signatureSentAt: Date | null = null;
    let signedAt: Date | null = null;
    let confirmeeAt: Date | null = null;
    let archivedAt: Date | null = null;
    if (s.statut === "en_traitement")
      histo.push({
        action: RESERVATION_STATUS.en_traitement.label,
        comment: s.messages?.find((m) => m.qui === "agent")?.texte ?? null,
        performedBy: agent.nom,
        performedAt: etape(entre(20, 50)),
      });
    if (["acceptee", "signee", "confirmee", "terminee", "archivee"].includes(s.statut)) {
      decisionAt = etape(entre(24, 72));
      histo.push({
        action: RESERVATION_STATUS.acceptee.label,
        comment: null,
        performedBy: agent.nom,
        performedAt: decisionAt,
      });
      if (devis.ttc > 0 || s.statut === "acceptee") {
        signatureSentAt = etape(entre(1, 30));
        histo.push({
          action: "Code de signature envoyé",
          comment: org.user.phone ? `par SMS au ${org.user.phone}` : "par courriel",
          performedBy: "système",
          performedAt: signatureSentAt,
        });
      }
    }
    if (["signee", "confirmee", "terminee", "archivee"].includes(s.statut)) {
      signedAt = etape(entre(2, 40));
      histo.push({
        action: RESERVATION_STATUS.signee.label,
        comment: `par ${org.user.nom}`,
        performedBy: org.user.nom,
        performedAt: signedAt,
      });
    }
    if (["confirmee", "terminee", "archivee"].includes(s.statut)) {
      confirmeeAt = etape(entre(12, 96));
      histo.push({
        action: RESERVATION_STATUS.confirmee.label,
        comment: null,
        performedBy: devis.acompte > 0 ? agent.nom : "automatique",
        performedAt: confirmeeAt,
      });
    }
    if (["terminee", "archivee"].includes(s.statut)) {
      const fin = plusTot(new Date(b.endAt.getTime() + 2 * 3_600_000));
      histo.push({
        action: RESERVATION_STATUS.terminee.label,
        comment: null,
        performedBy: "système",
        performedAt: plusTard(fin, curseur),
      });
      curseur = plusTard(fin, curseur);
    }
    if (s.statut === "archivee") {
      archivedAt = plusTot(new Date(curseur.getTime() + 30 * 86_400_000));
      histo.push({
        action: RESERVATION_STATUS.archivee.label,
        comment: "Archivage automatique",
        performedBy: "système",
        performedAt: archivedAt,
      });
    }
    if (s.statut === "refusee") {
      decisionAt = etape(entre(24, 96));
      histo.push({
        action: RESERVATION_STATUS.refusee.label,
        comment: s.motif ?? null,
        performedBy: agent.nom,
        performedAt: decisionAt,
      });
    }
    if (s.statut === "annulee") {
      const parUsager =
        (s.motif ?? "").includes("usager") || (s.motif ?? "").includes("association");
      histo.push({
        action: RESERVATION_STATUS.annulee.label,
        comment: s.motif ?? null,
        performedBy: parUsager ? org.user.nom : agent.nom,
        performedAt: etape(entre(24, 200)),
      });
    }
    const derniere = histo[histo.length - 1].performedAt;

    const annee = createdAt.getFullYear();
    const numero = await prochainNumero("RES", annee);
    const r = await prisma.reservation.create({
      data: {
        numero,
        espaceId: espace.id,
        organisationId: org.id,
        userId: org.user.id,
        agentId: traite ? agent.id : null,
        title: s.titre,
        natureId: refOuNull("evenement_nature", s.nature),
        description: s.description ?? null,
        participants: s.participants ?? null,
        isPublicEvent: s.public ?? false,
        status: s.statut,
        startAt: b.startAt,
        endAt: b.endAt,
        recurrence: s.recurrence ? JSON.parse(JSON.stringify(s.recurrence)) : undefined,
        setupMin: espace.bufferBeforeMin,
        teardownMin: espace.bufferAfterMin,
        decisionAt,
        decisionBy: decisionAt ? agent.nom : null,
        refusalReason: s.statut === "refusee" ? (s.motif ?? null) : null,
        cancelReason: s.statut === "annulee" ? (s.motif ?? null) : null,
        internalNotes: s.messages?.find((m) => m.qui === "note")?.texte ?? null,
        montantHt: devis.ht,
        montantTtc: devis.ttc,
        acompte: devis.acompte,
        caution: devis.caution,
        gratuit: devis.gratuit,
        signatureChannel: signatureSentAt ? (org.user.phone ? "sms" : "email") : null,
        signatureSentAt,
        signatureExpiresAt: signatureSentAt
          ? new Date(signatureSentAt.getTime() + 72 * 3_600_000)
          : null,
        signedAt,
        signerName: signedAt ? org.user.nom : null,
        signerIp: signedAt ? `92.154.${entre(1, 250)}.${entre(1, 250)}` : null,
        source: s.source ?? "portail",
        archivedAt,
        createdAt,
        updatedAt: derniere,
        creneaux: {
          create: creneaux.map((c) => ({
            espaceId: espace.id,
            startAt: c.startAt,
            endAt: c.endAt,
            status: annule ? "annule" : "prevu",
          })),
        },
        options: {
          create: options.map((o) => ({
            optionId: o.optionId,
            quantite: o.quantite,
            montant:
              devis.lignes.find(
                (l) =>
                  l.type === "option" && l.libelle === opts.find((x) => x.id === o.optionId)?.label,
              )?.montant ?? 0,
          })),
        },
        materiels: {
          create: materiels.map((m) => ({
            materielId: m.materielId,
            quantite: m.quantite,
            montant:
              devis.lignes.find(
                (l) =>
                  l.type === "materiel" &&
                  l.libelle === mats.find((x) => x.id === m.materielId)?.name,
              )?.montant ?? 0,
          })),
        },
        histories: { create: histo },
      },
    });
    compter("réservations");
    compter("créneaux", creneaux.length);
    parStatut.set(s.statut, [...(parStatut.get(s.statut) ?? []), r.id]);

    // Un dossier accepté porte un vrai code de signature (123456) : la démonstration peut signer.
    if (s.statut === "acceptee") {
      try {
        const { hmacSign } = await import("@/server/crypto");
        await prisma.reservation.update({
          where: { id: r.id },
          data: {
            signatureCodeHash: hmacSign("signature-convention", `${r.id}:${CODE_SIGNATURE}`),
            signatureExpiresAt: new Date(now.getTime() + 72 * 3_600_000),
            signatureAttempts: 0,
          },
        });
      } catch (e) {
        console.warn("   (code de signature non posé :", e instanceof Error ? e.message : e, ")");
      }
    }

    // Factures et paiements des dossiers signés, confirmés, terminés ou archivés.
    if (devis.ttc > 0 && ["signee", "confirmee", "terminee", "archivee"].includes(s.statut)) {
      const passe = s.statut === "terminee" || s.statut === "archivee";
      const emission = signedAt ?? decisionAt ?? createdAt;
      const facture = async (
        type: "acompte" | "solde" | "caution",
        ttc: number,
        status: string,
        emiseLe: Date,
        payeLe: Date | null,
        mode: string,
      ) => {
        if (ttc <= 0) return;
        const ht = type === "caution" ? ttc : Math.round((ttc / (1 + ctx.tva / 100)) * 100) / 100;
        const numeroF = await prochainNumero("FAC", emiseLe.getFullYear());
        const f = await prisma.facture.create({
          data: {
            numero: numeroF,
            reservationId: r.id,
            organisationId: org.id,
            type,
            libelle: `${FACTURE_TYPES[type]} · ${espace.name} · ${plage(b.startAt, b.endAt)}`,
            montantHt: ht,
            tva: type === "caution" ? 0 : Math.round((ttc - ht) * 100) / 100,
            montantTtc: ttc,
            status,
            dueAt:
              type === "solde"
                ? new Date(b.endAt.getTime() + 30 * 86_400_000)
                : new Date(b.startAt.getTime() - 7 * 86_400_000),
            paidAt: payeLe,
            createdBy: agent.nom,
            createdAt: emiseLe,
            updatedAt: payeLe ?? emiseLe,
          },
        });
        compter("factures");
        await prisma.reservationHistory.create({
          data: {
            reservationId: r.id,
            action: `${FACTURE_TYPES[type]} ${numeroF} émise`,
            comment: montant(ttc),
            performedBy: agent.nom,
            performedAt: emiseLe,
          },
        });
        if (payeLe) {
          await prisma.paiement.create({
            data: {
              factureId: f.id,
              montant: ttc,
              mode,
              reference:
                mode === "cheque"
                  ? `CHQ ${entre(1_000_000, 9_999_999)}`
                  : mode === "virement"
                    ? `VIR ${numeroF}`
                    : null,
              paidAt: payeLe,
              recordedById: sophie.id,
            },
          });
          compter("paiements");
          await prisma.reservationHistory.create({
            data: {
              reservationId: r.id,
              action: `Paiement reçu · ${numeroF}`,
              comment: `${montant(ttc)} · facture soldée`,
              performedBy: sophie.nom,
              performedAt: payeLe,
            },
          });
        }
      };
      const acompte = devis.acompte;
      const solde = Math.round((devis.ttc - acompte) * 100) / 100;
      const modeOrg = s.org === "culture" ? "mandat" : choix(["virement", "cheque", "regie"]);
      if (s.statut === "signee") {
        await facture("acompte", acompte, "a_payer", emission, null, modeOrg);
      } else if (s.statut === "confirmee") {
        await facture("acompte", acompte, "payee", emission, confirmeeAt, modeOrg);
        await facture("solde", solde, "a_payer", confirmeeAt ?? emission, null, modeOrg);
        if (devis.caution > 0)
          await facture(
            "caution",
            devis.caution,
            "a_payer",
            confirmeeAt ?? emission,
            null,
            "cheque",
          );
      } else if (passe) {
        const apres = plusTot(new Date(b.endAt.getTime() + entre(3, 12) * 86_400_000));
        await facture("acompte", acompte, "payee", emission, confirmeeAt, modeOrg);
        await facture("solde", solde, "payee", confirmeeAt ?? emission, apres, modeOrg);
        if (devis.caution > 0)
          await facture(
            "caution",
            devis.caution,
            s.statut === "archivee" ? "remboursee" : "payee",
            confirmeeAt ?? emission,
            confirmeeAt,
            "cheque",
          );
      }
    }

    // Fil de discussion.
    let quand = new Date(createdAt.getTime() + 3_600_000);
    for (const m of s.messages ?? []) {
      quand = plusTot(new Date(quand.getTime() + entre(2, 30) * 3_600_000));
      await prisma.message.create({
        data: {
          reservationId: r.id,
          authorId: m.qui === "usager" ? org.user.id : agent.id,
          authorKind: m.qui === "usager" ? "usager" : "agent",
          body: m.texte,
          isInternal: m.qui === "note",
          readAt: m.lu === false ? null : new Date(quand.getTime() + 3_600_000),
          createdAt: quand,
        },
      });
      compter("messages");
    }
  }
  return parStatut;
}

/**
 * La caution d'un dossier acquis entre dans son cycle, comme à l'acceptation dans
 * l'application : attendue, ou encaissée quand sa facture de caution est payée.
 */
async function cyclerCautions(): Promise<void> {
  await prisma.reservation.updateMany({
    where: {
      caution: { gt: 0 },
      cautionStatus: "aucune",
      status: { in: ["acceptee", "signee", "confirmee"] },
    },
    data: { cautionStatus: "attendue" },
  });
  const payees = await prisma.facture.findMany({
    where: { type: "caution", status: "payee", reservation: { cautionStatus: "attendue" } },
    select: { reservationId: true, paidAt: true },
  });
  for (const f of payees)
    if (f.reservationId)
      await prisma.reservation.update({
        where: { id: f.reservationId },
        data: { cautionStatus: "encaissee", cautionEncaisseeAt: f.paidAt ?? new Date() },
      });
}

async function creerSubventions(ctx: Contexte): Promise<void> {
  console.log("→ Demandes de subvention…");
  const pierre = ctx.agents.get("pierre");
  const sophie = ctx.agents.get("sophie");
  const annee = toParisWall(now).y;
  const specs = [
    {
      org: "ascb",
      exercice: annee,
      type: "fonctionnement",
      objet: "Subvention de fonctionnement du club",
      montant: 4500,
      accorde: 4000,
      status: "votee",
      budget: 38_000,
      beneficiaires: 320,
      description:
        "Participation aux frais d'engagement des équipes en championnat, formation des entraîneurs et achat de matériel pédagogique pour l'école de basket.",
      note: "Subvention votée au conseil municipal : 4 000 € (dotation réduite de 500 € au regard de la trésorerie disponible).",
      avis: [
        {
          qui: "pierre",
          avis: "favorable",
          montant: 4000,
          commentaire:
            "Club structurant pour la jeunesse de la ville ; proposer 4 000 € compte tenu de la réserve de trésorerie.",
        },
      ],
      depuis: 140,
    },
    {
      org: "sgdt",
      exercice: annee,
      type: "exceptionnelle",
      objet: "Renouvellement du matériel (tapis et bâtons)",
      montant: 2500,
      accorde: 2500,
      status: "versee",
      budget: 6200,
      beneficiaires: 45,
      description:
        "Achat de tapis d'acrodanse et de bâtons de twirling de compétition pour la nouvelle saison.",
      note: "Versée par mandat administratif.",
      avis: [
        {
          qui: "pierre",
          avis: "favorable",
          montant: 2500,
          commentaire: "Avis favorable, matériel nécessaire aux compétitions.",
        },
      ],
      depuis: 160,
    },
    {
      org: "arounddance",
      exercice: annee + 1,
      type: "fonctionnement",
      objet: "Ateliers d'éveil à la danse et gala de fin d'année",
      montant: 3000,
      accorde: null,
      status: "avis",
      budget: 9500,
      beneficiaires: 60,
      description:
        "Rémunération de l'intervenante en éveil à la danse, achat de petit matériel, location de costumes pour le gala.",
      note: null,
      avis: [
        {
          qui: "pierre",
          avis: "reserve",
          montant: 2000,
          commentaire:
            "Demande en hausse de 50 % par rapport à l'an dernier ; proposer 2 000 € et demander le bilan du gala 2026.",
        },
      ],
      depuis: 25,
    },
    {
      org: "ttmc",
      exercice: annee + 1,
      type: "projet",
      objet: "Open de tennis de table de Châtillon",
      montant: 1800,
      accorde: null,
      status: "deposee",
      budget: 5400,
      beneficiaires: 120,
      description:
        "Organisation d'un open homologué FFTT sur un week-end : arbitrage, dotation, communication.",
      note: null,
      avis: [],
      depuis: 4,
    },
  ] as const;
  const NATURES: Record<string, "premiere" | "renouvellement"> = {
    ascb: "renouvellement",
    sgdt: "renouvellement",
    arounddance: "renouvellement",
    ttmc: "premiere",
  };
  // Les campagnes : celle de l'exercice en cours (close) et celle de l'exercice suivant (ouverte).
  const campagnes = new Map<number, number>();
  for (const [exercice, status] of [
    [annee, "cloturee"],
    [annee + 1, "ouverte"],
  ] as const) {
    const d = datesParDefaut(exercice);
    const c = await prisma.campagneSubvention.create({
      data: {
        exercice,
        label: labelCampagne(exercice),
        ouvertureDate: parseYmdUtc(d.ouverture),
        clotureDate: parseYmdUtc(d.cloture),
        status,
        consignes:
          status === "ouverte"
            ? "Un dossier incomplet ou déposé après la clôture n'est pas instruit. Pensez à joindre le procès-verbal de la dernière assemblée générale, les comptes approuvés et un RIB récent."
            : null,
        createdBy: sophie?.nom ?? null,
        createdAt: ilYA(exercice === annee ? 400 : 60),
      },
    });
    campagnes.set(exercice, c.id);
    compter("campagnes_subvention");
  }
  for (const s of specs) {
    const org = ctx.orgs.get(s.org);
    if (!org) continue;
    const createdAt = ilYA(s.depuis, entre(1, 10));
    const numero = await prochainNumero("SUB", s.exercice);
    const decision = ["votee", "versee", "refusee"].includes(s.status)
      ? plusTot(new Date(createdAt.getTime() + 60 * 86_400_000))
      : null;
    const nature = NATURES[s.org] ?? "renouvellement";
    const dossier = dossierDemo(s, org, nature);
    const signeAt = new Date(createdAt.getTime() - 3_600_000);
    const sub = await prisma.subvention.create({
      data: {
        numero,
        organisationId: org.id,
        campagneId: campagnes.get(s.exercice) ?? null,
        exercice: s.exercice,
        nature,
        objet: s.objet,
        description: s.description,
        type: s.type,
        montantDemande: s.montant,
        montantAccorde: s.accorde,
        status: s.status,
        budgetTotal: s.budget,
        beneficiaires: s.beneficiaires,
        decisionAt: decision,
        decisionNote: s.note,
        verseAt:
          s.status === "versee" && decision ? new Date(decision.getTime() + 30 * 86_400_000) : null,
        instructeur: s.status === "deposee" ? null : (sophie?.nom ?? null),
        depositedBy: org.user.nom,
        recuAt: createdAt,
        dossier: dossier as unknown as Prisma.InputJsonValue,
        signeAt,
        signeNom: org.user.nom,
        signeQualite: "Président(e)",
        signeChannel: "sms",
        signeIp: `92.154.${entre(1, 250)}.${entre(1, 250)}`,
        createdAt: new Date(createdAt.getTime() - 5 * 86_400_000),
        updatedAt: decision ?? createdAt,
        histories: {
          create: [
            {
              action: "Dossier commencé",
              performedBy: org.user.nom,
              performedAt: new Date(createdAt.getTime() - 5 * 86_400_000),
            },
            {
              action: "Attestation signée",
              comment: `par ${org.user.nom}`,
              performedBy: org.user.nom,
              performedAt: signeAt,
            },
            { action: "Dossier déposé", performedBy: org.user.nom, performedAt: createdAt },
            ...(s.status !== "deposee"
              ? [
                  {
                    action: "En instruction",
                    performedBy: sophie?.nom ?? "agent",
                    performedAt: plusTot(new Date(createdAt.getTime() + 7 * 86_400_000)),
                  },
                ]
              : []),
            ...(decision
              ? [
                  {
                    action:
                      s.status === "versee" ? "Votée" : s.status === "votee" ? "Votée" : "Refusée",
                    comment: s.accorde !== null ? montant(s.accorde) : null,
                    performedBy: sophie?.nom ?? "agent",
                    performedAt: decision,
                  },
                ]
              : []),
          ],
        },
      },
    });
    compter("subventions");
    for (const av of s.avis) {
      await prisma.subventionAvis.create({
        data: {
          subventionId: sub.id,
          authorId: pierre?.id ?? null,
          avis: av.avis,
          montant: av.montant,
          commentaire: av.commentaire,
          createdAt: plusTot(new Date(createdAt.getTime() + 20 * 86_400_000)),
        },
      });
      compter("avis");
    }
    // Les pièces : complètes pour les dossiers instruits, partielles pour le dossier tout juste déposé.
    const pieces: [string, string, string][] = [
      ["pv_ag", "pv-assemblee-generale.txt", "Procès-verbal de l'assemblée générale"],
      ["comptes", "comptes-approuves.csv", "Comptes approuvés"],
      ["rib", "rib.txt", "RIB de l'association"],
      ["compte_rendu", "compte-rendu-actions.txt", "Compte rendu des actions subventionnées"],
    ];
    const aFournir =
      s.status === "deposee"
        ? pieces.slice(0, 2)
        : nature === "premiere"
          ? pieces.slice(0, 3)
          : pieces;
    for (const [kind, nom, titre] of aFournir) {
      await deposerDocument({
        kind: "subvention",
        parentId: sub.id,
        fichier: {
          nom,
          mime: nom.endsWith(".csv") ? "text/csv" : "text/plain",
          octets: Buffer.from(
            `${titre} · ${org.name} · exercice ${s.exercice - 1} (document de démonstration)\n`,
            "utf8",
          ),
        },
        docKind: kind,
        title: titre,
        uploadedById: org.user.id,
      });
      compter("documents");
    }
  }
  // Un dossier en cours de rédaction sur la campagne ouverte (association non sportive).
  const yoga = ctx.orgs.get("espace-yoga");
  if (yoga) {
    const d = dossierDemo(
      {
        org: "espace-yoga",
        exercice: annee + 1,
        type: "fonctionnement",
        objet: "Ateliers de yoga adapté pour les seniors",
        montant: 1200,
        budget: 7800,
        beneficiaires: 40,
        description: "",
      },
      yoga,
      "premiere",
    );
    d.budget.charges = {};
    d.tresorerie.soldeFin = null;
    d.attestation = {
      ...d.attestation,
      obligationsAJour: false,
      informationsSinceres: false,
      cumulAides: "",
      engagementRepublicain: false,
    };
    await prisma.subvention.create({
      data: {
        numero: `prov-${annee + 1}-${yoga.id}-1234`,
        organisationId: yoga.id,
        campagneId: campagnes.get(annee + 1) ?? null,
        exercice: annee + 1,
        nature: "premiere",
        objet: "Ateliers de yoga adapté pour les seniors",
        type: "fonctionnement",
        montantDemande: 1200,
        status: "brouillon",
        depositedBy: yoga.user.nom,
        dossier: d as unknown as Prisma.InputJsonValue,
        createdAt: ilYA(3),
        histories: {
          create: [
            { action: "Dossier commencé", performedBy: yoga.user.nom, performedAt: ilYA(3) },
          ],
        },
      },
    });
    compter("subventions");
  }
}

type SpecDossier = {
  org: string;
  exercice: number;
  type: string;
  objet: string;
  montant: number;
  budget: number | null;
  beneficiaires: number | null;
  description: string;
};

/** Un dossier de demande rempli de façon plausible à partir de la demande de démonstration. */
function dossierDemo(
  s: SpecDossier,
  org: OrgRow,
  nature: "premiere" | "renouvellement",
): DossierSubvention {
  const sportive = org.sportive;
  const d = dossierVide(sportive);
  const [prenom, ...nomParts] = org.user.nom.split(" ");
  const budget = s.budget ?? 10_000;
  const r = (x: number) => Math.round(x);
  d.presentation = {
    ...d.presentation,
    sigle: org.name.includes(" - ") ? (org.name.split(" - ").pop() ?? "") : "",
    dateJo: `${2005 + (org.id % 15)}-0${1 + (org.id % 9)}-15`,
    affiliation: sportive ? "Fédération française de la discipline" : "",
    commissaireAuxComptes: false,
    changementDepuisDerniereDemande: false,
  };
  d.bureau.president = {
    nom: nomParts.join(" ") || org.user.nom,
    prenom,
    adresse: org.address ?? "",
    codePostal: org.postalCode,
    commune: org.city,
    telephone: org.phone ?? "",
    courriel: org.email ?? "",
  };
  d.bureau.tresorier = {
    ...d.bureau.tresorier,
    nom: "Lemoine",
    prenom: "Claire",
    courriel: `tresorerie.${org.id}@exemple.fr`,
  };
  d.bureau.secretaire = { ...d.bureau.secretaire, nom: "Petit", prenom: "Marc" };
  d.bureau.chargeDossier = {
    nom: org.user.nom,
    fonction: "Président(e)",
    adresse: "",
    telephone: org.phone ?? "",
    courriel: org.user.email,
  };
  const adherents = s.beneficiaires ?? 60;
  d.effectifs = {
    ...d.effectifs,
    benevoles: r(adherents / 10) + 2,
    volontaires: 0,
    salaries: sportive ? 1 : 0,
    etpt: sportive ? 0.5 : 0,
    adherents,
    exercicePrecedent: {
      total: adherents,
      chatillonnais: r(adherents * 0.7),
      exterieurs: r(adherents * 0.3),
      majeurs: r(adherents * 0.6),
      mineurs: r(adherents * 0.4),
      hommes: r(adherents * 0.45),
      femmes: r(adherents * 0.55),
      licencies: sportive ? r(adherents * 0.9) : null,
    },
    previsionnel: {
      total: r(adherents * 1.05),
      chatillonnais: r(adherents * 0.72),
      exterieurs: r(adherents * 0.33),
      majeurs: null,
      mineurs: null,
      hommes: null,
      femmes: null,
      licencies: sportive ? r(adherents * 0.95) : null,
    },
    cotisations: [
      { libelle: "Adultes", montant: sportive ? 180 : 120, nombre: r(adherents * 0.6) },
      {
        libelle: "Jeunes (moins de 18 ans)",
        montant: sportive ? 140 : 90,
        nombre: r(adherents * 0.4),
      },
    ],
  };
  d.rayonnement = {
    orientations: `${s.description || "Activité ouverte à tous les publics châtillonnais."} Accueil des jeunes et des seniors, tarifs réduits pour les familles, participation aux temps forts de la Ville.`,
    participation: {
      forum: true,
      feteDuSport: sportive,
      reunionAssociationsSportives: sportive,
      solidarite: "Séances découvertes gratuites",
      inclusion: "Accueil adapté sur demande",
      handicap: "",
      culturel: sportive ? "" : "Spectacle de fin d'année",
      autres: "",
    },
    moyens: {
      locaux: [
        {
          designation: "Salle municipale (créneaux hebdomadaires)",
          heures: 160,
          par: "La commune",
        },
      ],
      personnel: [],
      transport: [],
      documents: [
        { designation: "Affiches et programme", heures: null, par: "Service communication" },
      ],
    },
  };
  const produits: Montants = sportive
    ? {
        subv_commune: s.montant,
        cotisations_adherents: r(budget * 0.55),
        parrainage: r(budget * 0.1),
        champ_buvette: r(budget * 0.05),
      }
    : {
        subv_commune: s.montant,
        cotisations: r(budget * 0.55),
        ventes: r(budget * 0.1),
        subv_departement: r(budget * 0.05),
      };
  const charges: Montants = sportive
    ? {
        licences: r(budget * 0.25),
        achat_materiel: r(budget * 0.15),
        champ_deplacements: r(budget * 0.2),
        salaire_entraineur: r(budget * 0.25),
        assurances: r(budget * 0.05),
      }
    : {
        locations: r(budget * 0.1),
        honoraires: r(budget * 0.35),
        achats_matieres: r(budget * 0.2),
        assurance: r(budget * 0.05),
        publicite: r(budget * 0.1),
      };
  d.budget = {
    exerciceDebut: `${s.exercice}-01-01`,
    exerciceFin: `${s.exercice}-12-31`,
    charges,
    produits,
    contributions: { benevolat: r(budget * 0.2), personnel_benevole: r(budget * 0.2) },
    financeurs: sportive ? "Conseil départemental des Hauts-de-Seine (demande en cours)" : "",
  };
  d.motivation = {
    justification:
      s.description || "Couvrir les charges de fonctionnement et maintenir des tarifs accessibles.",
    explicationsPostes: "",
    actions:
      s.type === "projet" || s.type === "exceptionnelle"
        ? [
            {
              intitule: s.objet,
              descriptif: s.description,
              date: `${s.exercice}`,
              lieu: "Châtillon",
              public: "Adhérents et public",
              beneficiaires: s.beneficiaires,
              cout: r(budget * 0.4),
              recettes: "Entrées et buvette",
            },
          ]
        : [],
  };
  d.tresorerie = {
    ...d.tresorerie,
    soldeDebut: r(budget * 0.3),
    resultat: r(budget * 0.02),
    soldeFin: r(budget * 0.32),
    compteCourant: r(budget * 0.25),
    epargne: r(budget * 0.07),
    caisse: 0,
    natures: "Livret A",
  };
  const realise = Object.fromEntries(
    Object.entries({ ...charges, ...produits }).map(([k, v]) => [k, r(v * 0.95)]),
  );
  d.bilan = {
    subventionPrecedente: nature === "renouvellement" ? r(s.montant * 0.9) : null,
    justification:
      nature === "renouvellement"
        ? "Subvention employée au fonctionnement courant conformément à la demande."
        : "",
    actions: [],
    exerciceDebut: `${s.exercice - 1}-01-01`,
    exerciceFin: `${s.exercice - 1}-12-31`,
    budget: { ...charges, ...produits },
    realise,
    contributionsBudget: {},
    contributionsRealise: {},
    synthese:
      nature === "renouvellement"
        ? "Année conforme aux prévisions ; effectifs stables, bilan financier équilibré, rapport moral approuvé à l'unanimité."
        : "",
  };
  d.attestation = {
    obligationsAJour: true,
    informationsSinceres: true,
    cumulAides: "inf",
    engagementRepublicain: true,
    mandataire: false,
    signataireNom: org.user.nom,
    signataireQualite: "Président(e)",
  };
  return d;
}

// ── Personnel de service ──

type PersonnelSpec = {
  cle: string;
  prenom: string;
  nom: string;
  fonction: string;
  email: string | null;
  phone: string | null;
  color: string;
  note: string | null;
  /** Code du type de contrat (référentiel contrat_type). */
  contrat: string;
  quotite: number;
  heures: number | null;
  /** Cycle hebdomadaire d'horaires ; null = affectable à toute heure. */
  horaires: Horaires | null;
  /** Mots des sites d'intervention (le premier est le principal). */
  sites: string[];
};

const SOIRS_SEMAINE: Horaires = Object.fromEntries(
  ["1", "2", "3", "4", "5"].map((j) => [j, [["16:30", "23:30"]]]),
);
const MATINS_SEMAINE: Horaires = Object.fromEntries(
  ["1", "2", "3", "4", "5", "6"].map((j) => [j, [["08:30", "12:00"]]]),
);
const JEUDI_DIMANCHE: Horaires = {
  "4": [["14:00", "23:00"]],
  "5": [["14:00", "23:00"]],
  "6": [["08:00", "13:00"]],
  "7": [["08:00", "13:00"]],
};

const PERSONNEL: PersonnelSpec[] = [
  {
    cle: "ali",
    prenom: "Ali",
    nom: "Keita",
    fonction: "Gardien",
    email: "ali.keita@exemple.fr",
    phone: "06 12 34 56 78",
    color: "#3b82f6",
    note: "Clés de la Maison Blanche et du gymnase. Astreinte téléphonique le week-end.",
    contrat: "titulaire",
    quotite: 100,
    heures: 35,
    horaires: SOIRS_SEMAINE,
    sites: ["maison blanche", "gabriel"],
  },
  {
    cle: "nadia",
    prenom: "Nadia",
    nom: "Benmoussa",
    fonction: "Gardienne",
    email: "nadia.benmoussa@exemple.fr",
    phone: "06 23 45 67 89",
    color: "#10b981",
    note: "À 80 % : du jeudi au dimanche.",
    contrat: "cdi",
    quotite: 80,
    heures: 28,
    horaires: JEUDI_DIMANCHE,
    sites: ["sablons", "folie"],
  },
  {
    cle: "lucas",
    prenom: "Lucas",
    nom: "Perrin",
    fonction: "Agent d'accueil",
    email: "lucas.perrin@exemple.fr",
    phone: null,
    color: "#f59e0b",
    note: "Accueil du public, ouverture le matin.",
    contrat: "vacataire",
    quotite: 60,
    heures: 21,
    horaires: MATINS_SEMAINE,
    sites: ["maison blanche", "gabriel"],
  },
  {
    cle: "fatou",
    prenom: "Fatou",
    nom: "Diallo",
    fonction: "Vacataire",
    email: null,
    phone: "07 98 76 54 32",
    color: "#8b5cf6",
    note: "Renfort sur les événements ; joignable par SMS uniquement.",
    contrat: "vacataire",
    quotite: 100,
    heures: null,
    horaires: null,
    sites: [
      "sablons",
      "gambetta",
      "doret",
      "môquet",
      "roland",
      "langevin",
      "république",
      "maison blanche",
      "gabriel",
      "folie",
    ],
  },
];

/**
 * Le personnel de service et ses vacations : une série hebdomadaire du gardien (soirées de
 * semaine à la Maison Blanche), les week-ends du gymnase, l'accueil du matin, quelques
 * renforts ; deux créneaux épinglés. Les autres sites restent sans vacation : des créneaux
 * « à couvrir » apparaissent dans le planning et sur le tableau de bord.
 */
async function creerPersonnel(): Promise<void> {
  console.log("→ Personnel de service et vacations…");
  const sites = await prisma.site.findMany({ orderBy: { position: "asc" } });
  const siteDe = (motif: string) =>
    sites.find((s) => s.name.toLowerCase().includes(motif)) ?? sites[0];
  const maisonBlanche = siteDe("maison blanche");
  const gymnase = siteDe("sablons");
  const personnes = new Map<string, { id: number; email: string | null }>();
  const contrats = new Map(
    (await prisma.referential.findMany({ where: { kind: "contrat_type" } })).map((r) => [
      r.code,
      r.id,
    ]),
  );
  const motifs = new Map(
    (await prisma.referential.findMany({ where: { kind: "absence_motif" } })).map((r) => [
      r.code,
      r.id,
    ]),
  );
  for (const p of PERSONNEL) {
    const row = await prisma.personnel.create({
      data: {
        firstName: p.prenom,
        lastName: p.nom,
        fonction: p.fonction,
        email: p.email,
        phone: p.phone,
        color: p.color,
        note: p.note,
        icsToken: p.cle === "ali" ? "demo-ali-keita-planning-de-service-0001" : null,
        contratTypeId: contrats.get(p.contrat) ?? null,
        quotite: p.quotite,
        heuresHebdo: p.heures,
        contratDebut: parseYmdUtc(`${new Date().getUTCFullYear() - 1}-09-01`),
        horaires: p.horaires ?? Prisma.DbNull,
        sites: {
          create: p.sites.map((motif, i) => ({ siteId: siteDe(motif).id, principal: i === 0 })),
        },
      },
    });
    personnes.set(p.cle, { id: row.id, email: row.email });
    compter("personnel de service");
  }
  // La Maison Blanche affecte d'office ; les autres sites proposent au gestionnaire.
  await prisma.site.update({ where: { id: maisonBlanche.id }, data: { affectationAuto: true } });
  // Absences : Nadia en congés la semaine prochaine, Lucas en formation mercredi prochain.
  const lundiProchain = js(1, 1);
  await prisma.absence.createMany({
    data: [
      {
        personnelId: personnes.get("nadia")?.id as number,
        motifId: motifs.get("conges") ?? null,
        startAt: a(lundiProchain + 3, "00:00"),
        endAt: a(lundiProchain + 7, "00:00"),
        note: "Congés posés en septembre",
        createdBy: "sophie.martin@exemple.fr",
      },
      {
        personnelId: personnes.get("lucas")?.id as number,
        motifId: motifs.get("formation") ?? null,
        startAt: a(lundiProchain + 2, "08:00"),
        endAt: a(lundiProchain + 2, "12:30"),
        note: "Formation accueil du public",
        createdBy: "sophie.martin@exemple.fr",
      },
    ],
  });
  compter("absences", 2);
  const id = (cle: string) => personnes.get(cle)?.id as number;
  const lundi = js(1, -7);
  const vac = async (
    cle: string,
    siteId: number,
    offset: number,
    de: string,
    a_: string,
    extra: { serieId?: string; note?: string } = {},
  ) => {
    const startAt = a(offset, de);
    let endAt = a(offset, a_);
    if (endAt <= startAt) endAt = new Date(endAt.getTime() + 86_400_000);
    await prisma.vacation.create({
      data: {
        personnelId: id(cle),
        siteId,
        startAt,
        endAt,
        serieId: extra.serieId ?? null,
        note: extra.note ?? null,
        createdBy: "sophie.martin@exemple.fr",
      },
    });
    compter("vacations");
  };
  // Ali : chaque soir de semaine à la Maison Blanche, huit semaines à partir de lundi dernier.
  for (let semaine = 0; semaine < 8; semaine++) {
    for (let j = 0; j < 5; j++) {
      await vac("ali", maisonBlanche.id, lundi + semaine * 7 + j, "17:00", "23:30", {
        serieId: "demo-serie-ali-soirs",
        note: "Ouverture, fermeture et remise des clés",
      });
    }
  }
  // Nadia : les week-ends au gymnase, quatre semaines.
  for (let semaine = 0; semaine < 4; semaine++) {
    await vac("nadia", gymnase.id, lundi + semaine * 7 + 5, "08:00", "20:00", {
      serieId: "demo-serie-nadia-we",
    });
    await vac("nadia", gymnase.id, lundi + semaine * 7 + 6, "08:00", "18:00", {
      serieId: "demo-serie-nadia-we",
    });
  }
  // Lucas : l'accueil du matin à la Maison Blanche, cette semaine et la suivante.
  for (let semaine = 0; semaine < 2; semaine++) {
    for (let j = 0; j < 5; j++) {
      await vac("lucas", maisonBlanche.id, lundi + semaine * 7 + j, "08:30", "13:00");
    }
  }
  // Fatou : deux renforts ponctuels au gymnase en soirée.
  await vac("fatou", gymnase.id, lundi + 2, "18:00", "22:30", { note: "Renfort match" });
  await vac("fatou", gymnase.id, lundi + 9, "18:00", "22:30", { note: "Renfort match" });

  // Deux créneaux fermes à venir épinglés : un sur la Maison Blanche (état des lieux), un ailleurs.
  const fermes = await prisma.creneau.findMany({
    where: {
      status: "prevu",
      startAt: { gte: now },
      reservation: { status: { in: ["acceptee", "signee", "confirmee"] } },
    },
    include: { espace: { select: { siteId: true } } },
    orderBy: { startAt: "asc" },
    take: 60,
  });
  const surMaisonBlanche = fermes.find((c) => c.espace.siteId === maisonBlanche.id);
  const ailleurs = fermes.find(
    (c) => c.espace.siteId !== maisonBlanche.id && c.espace.siteId !== gymnase.id,
  );
  for (const [c, cle] of [
    [surMaisonBlanche, "lucas"],
    [ailleurs, "nadia"],
  ] as const) {
    if (!c) continue;
    await prisma.creneau.update({ where: { id: c.id }, data: { personnelId: id(cle) } });
    compter("créneaux épinglés");
  }
  // Un épinglage incompatible avec le contrat ou une absence est retiré, comme dans l'application.
  for (const cle of ["lucas", "nadia"]) await reverifierAffectations(id(cle), "démonstration");
  // L'affectation automatique ou proposée sur les 30 prochains jours, comme la tâche quotidienne.
  const bilan = await affecterCreneaux({ de: now, a: addParisDays(now, 30) }, "démonstration");
  compter("créneaux affectés d'office", bilan.affectes);
  compter("propositions d'affectation", bilan.proposes);
}

async function creerNotificationsEtJournal(
  ctx: Contexte,
  parStatut: Map<ReservationStatus, number[]>,
): Promise<void> {
  console.log("→ Notifications et journal…");
  const sophie = ctx.agents.get("sophie");
  const karim = ctx.agents.get("karim");
  const destinataires = [ctx.admin, sophie, karim].filter((x): x is Compte => Boolean(x));
  const aTraiter = await prisma.reservation.findMany({
    where: { id: { in: parStatut.get("a_traiter") ?? [] } },
    include: { espace: true, user: true },
    orderBy: { createdAt: "desc" },
  });
  const espacesSportifs = new Set(
    [...SPORT].map((cle) => ctx.espaces.get(cle)?.id).filter((id): id is number => Boolean(id)),
  );
  for (const [i, r] of aTraiter.entries()) {
    for (const d of destinataires) {
      // Karim ne suit que les équipements sportifs.
      if (d === karim && !espacesSportifs.has(r.espaceId)) continue;
      await prisma.notification.create({
        data: {
          userId: d.id,
          type: "reservation",
          title: `Nouvelle demande ${r.numero}`,
          body: `${r.espace.name} · ${plage(r.startAt, r.endAt)} · ${r.user?.name ?? ""}`,
          link: `/reservations/${r.id}`,
          readAt: i < 3 ? null : new Date(r.createdAt.getTime() + 7_200_000),
          createdAt: r.createdAt,
        },
      });
      compter("notifications");
    }
  }
  const nonLus = await prisma.message.findMany({
    where: { readAt: null, authorKind: "usager" },
    include: { reservation: true, author: true },
  });
  for (const m of nonLus) {
    for (const d of destinataires.slice(0, 2)) {
      await prisma.notification.create({
        data: {
          userId: d.id,
          type: "message",
          title: `Message de ${m.author?.name ?? "un usager"} sur ${m.reservation.numero}`,
          body: m.body.slice(0, 200),
          link: `/reservations/${m.reservationId}`,
          createdAt: m.createdAt,
        },
      });
      compter("notifications");
    }
  }
  const signees = await prisma.reservation.findMany({
    where: { id: { in: parStatut.get("signee") ?? [] } },
  });
  for (const r of signees) {
    for (const d of destinataires.slice(0, 2)) {
      await prisma.notification.create({
        data: {
          userId: d.id,
          type: "signature",
          title: `Convention ${r.numero} signée`,
          body: `par ${r.signerName}`,
          link: `/reservations/${r.id}`,
          readAt: new Date(),
          createdAt: r.signedAt ?? r.createdAt,
        },
      });
      compter("notifications");
    }
  }
  const gama = ctx.orgs.get("gama");
  if (gama) {
    for (const d of destinataires.slice(0, 2)) {
      await prisma.notification.create({
        data: {
          userId: d.id,
          type: "usager",
          title: `Nouvel usager : ${gama.name}`,
          body: `${gama.user.nom} · ${gama.user.email}`,
          link: `/usagers/${gama.id}`,
          createdAt: ilYA(5),
        },
      });
      compter("notifications");
    }
  }
  const sub = await prisma.subvention.findFirst({ where: { status: "deposee" } });
  if (sub) {
    await prisma.notification.create({
      data: {
        userId: ctx.admin.id,
        type: "subvention",
        title: `Nouvelle demande de subvention ${sub.numero}`,
        body: sub.objet,
        link: `/subventions/${sub.id}`,
        createdAt: sub.createdAt,
      },
    });
    compter("notifications");
  }
  // Quelques notifications côté usagers (cloche du portail).
  const acceptees = await prisma.reservation.findMany({
    where: { id: { in: parStatut.get("acceptee") ?? [] } },
  });
  for (const r of acceptees) {
    if (!r.userId) continue;
    await prisma.notification.create({
      data: {
        userId: r.userId,
        type: "reservation",
        title: `Demande ${r.numero} acceptée`,
        body: "Convention à signer depuis votre espace.",
        link: `/portail/mes-reservations/${r.id}`,
        createdAt: r.decisionAt ?? r.createdAt,
      },
    });
    compter("notifications");
  }

  const journal: [string, string, string, string, number][] = [
    [sophie?.email ?? "admin", "creation site", "Espace Maison Blanche", "espaces", 120],
    [
      sophie?.email ?? "admin",
      "creation espace",
      "Salle polyvalente - Espace Maison Blanche",
      "espaces",
      119,
    ],
    [karim?.email ?? "admin", "creation espace", "Gymnase les Sablons", "espaces", 118],
    [
      sophie?.email ?? "admin",
      "validation organisation",
      "Association sportive Châtillon Basket - ASCB",
      "usagers",
      95,
    ],
    [
      sophie?.email ?? "admin",
      "reservation acceptee",
      "Conférence « IA et collectivités »",
      "reservations",
      12,
    ],
    [karim?.email ?? "admin", "reservation refusee", "Vide-grenier du club", "reservations", 11],
    [
      sophie?.email ?? "admin",
      "emission facture",
      "Acompte · Gala de fin d'année d'Around dance",
      "paiements",
      9,
    ],
    [
      sophie?.email ?? "admin",
      "paiement",
      "Repas de quartier des Pierrelais · virement",
      "paiements",
      4,
    ],
    [
      ctx.admin.email,
      "modification parametres",
      "Modèle de courriel « Demande acceptée »",
      "parametres",
      2,
    ],
    [sophie?.email ?? "admin", "connexion", "", "securite", 0],
  ];
  for (const [username, action, detail, category, jours] of journal) {
    await prisma.actionLog.create({
      data: {
        username,
        action,
        detail: detail || null,
        category,
        createdAt: ilYA(jours, entre(1, 9)),
      },
    });
    compter("journal");
  }
}

// ── Programme principal ──

async function main(): Promise<void> {
  console.log("CityRésa · jeu de données de démonstration (Ville de Châtillon)\n");
  await amorcer({ annoncer: false });
  if (RESET) await remettreAZero();
  if ((await prisma.site.count()) > 0) {
    console.log("Jeu de démonstration déjà présent (un site existe) : rien à faire.");
    console.log("Pour repartir de zéro : pnpm db:demo --reset");
    return;
  }
  await chargerReferentiels();
  await creerCalendrier();
  const cfg = await getSettings();
  const adminRow = await prisma.user.findFirst({
    where: { kind: "agent", role: "admin" },
    orderBy: { createdAt: "asc" },
  });
  if (!adminRow) throw new Error("Aucun administrateur : lancez d'abord pnpm db:init.");
  const admin: Compte = {
    id: adminRow.id,
    nom: adminRow.name,
    email: adminRow.email,
    phone: adminRow.phone,
  };

  const { espaces, options, materiels } = await creerSitesEtEspaces();
  const agents = await creerAgents(espaces);
  const orgs = await creerUsagers();
  const ctx: Contexte = {
    espaces,
    options,
    materiels,
    orgs,
    agents,
    admin,
    tva: cfg.TVA_TAUX || 0,
  };
  const parStatut = await creerReservations(ctx);
  await cyclerCautions();
  await creerPersonnel();
  await creerSubventions(ctx);
  await creerNotificationsEtJournal(ctx, parStatut);

  console.log(`\n${"=".repeat(64)}`);
  console.log(`  COMPTES DE DÉMONSTRATION   (mot de passe commun : ${MOT_DE_PASSE})`);
  console.log(`${"-".repeat(64)}`);
  console.log(`  Administrateur    ${admin.email}   (mot de passe affiché par pnpm db:init)`);
  for (const ag of AGENTS)
    console.log(`  ${ag.role.padEnd(16)}  ${ag.email}   ${ag.prenom} ${ag.nom}`);
  console.log(`${"-".repeat(64)}`);
  for (const o of ORGS)
    console.log(
      `  ${o.type.padEnd(16)}  ${o.user.email.padEnd(32)} ${o.name}${o.valide ? "" : "  (fiche à valider)"}`,
    );
  console.log(`${"-".repeat(64)}`);
  console.log(`  Code de signature des conventions « acceptées » : ${CODE_SIGNATURE}`);
  console.log(`${"=".repeat(64)}\n`);
  console.log("  Objets créés :");
  for (const [k, v] of Object.entries(compteurs)) console.log(`   · ${k.padEnd(32)} ${v}`);
  const statuts = await prisma.reservation.groupBy({ by: ["status"], _count: { _all: true } });
  console.log("  Réservations par statut :");
  for (const s of statuts) console.log(`   · ${s.status.padEnd(16)} ${s._count._all}`);
  console.log("\n✓ Jeu de démonstration chargé.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? `✗ ${e.stack ?? e.message}` : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
