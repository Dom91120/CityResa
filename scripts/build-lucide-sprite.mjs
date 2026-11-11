/**
 * Construit le sprite SVG Lucide (public/vendor/lucide.svg) à partir du paquet
 * `lucide-static`, pour les seules icônes que l'application utilise : un <symbol>
 * par icône, référencé par <use href="/vendor/lucide.svg#nom">.
 *
 *   node scripts/build-lucide-sprite.mjs
 *
 * Ajouter une icône = l'ajouter à ICONES puis relancer le script.
 * Une icône dessinée pour l'application (absente de Lucide) se déclare dans MAISON : son nom et
 * l'intérieur du SVG, sur la grille 24 × 24 et au trait de 2 comme les autres.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICONES = [
  "bold",
  "italic",
  "quote",
  "pilcrow",
  "circle-alert",
  "award",
  "user-round",
  "compass",
  "arrow-down-right",
  "arrow-up-right",
  "lock-open",
  // Navigation et modules
  "layout-dashboard",
  "calendar-days",
  "calendar-range",
  "calendar-clock",
  "calendar-check",
  "bookmark",
  "package-check",
  "calculator",
  "save",
  "calendar-x",
  "calendar-minus",
  "thermometer",
  "briefcase",
  "wand-sparkles",
  "calendar-plus",
  "calendar",
  "clipboard-list",
  "clipboard-check",
  "building-2",
  "building",
  "door-open",
  "map-pin",
  "map",
  "users",
  "user",
  "user-plus",
  "user-x",
  "user-check",
  "user-cog",
  "circle-user",
  "contact-round",
  "id-card",
  "message-circle",
  "message-square",
  "messages-square",
  "credit-card",
  "wallet",
  "banknote",
  "coins",
  "piggy-bank",
  "receipt",
  "hand-coins",
  "landmark",
  "settings",
  "sliders-horizontal",
  "shield",
  "shield-check",
  "key-round",
  "lock",
  "lock-keyhole",
  "unlock",
  "log-in",
  "log-out",
  "bell",
  "bell-off",
  "search",
  "lightbulb",
  "sparkles",
  "menu",
  "sun",
  "moon",
  "home",
  "store",
  "warehouse",
  "boxes",
  "package",
  "wrench",
  "puzzle",
  "plug",
  "layers",
  "database",
  "activity",
  "chart-column",
  "chart-pie",
  "trending-up",
  "trending-down",
  "gauge",
  "history",
  "notebook-text",
  "scroll-text",
  "book-open",
  "archive",
  "inbox",
  "table",
  "list",
  "grid-2x2",
  "kanban",
  "sticky-note",
  "ticket",
  "flag",
  "star",
  "heart",
  "tag",
  "hash",
  "percent",
  "timer",
  "hourglass",
  "repeat",
  "rotate-ccw",
  "undo-2",
  "qr-code",
  "smartphone",
  "megaphone",
  "handshake",
  "party-popper",
  "graduation-cap",
  "music",
  "palette",
  "theater",
  "mic",
  "projector",
  "wifi",
  "coffee",
  "utensils",
  "car",
  "accessibility",
  "baby",
  "bus",
  "dumbbell",
  "waves",
  "trees",
  "sofa",
  "bed",
  "flame",
  "snowflake",
  "lamp",
  "monitor",
  "tv",
  "speaker",
  "volume-2",
  "plug-zap",
  "armchair",
  "image",
  "camera",
  // Actions
  "plus",
  "circle-plus",
  "minus",
  "circle-minus",
  "check",
  "check-check",
  "circle-check",
  "square-check",
  "square",
  "x",
  "circle-x",
  "pencil",
  "square-pen",
  "pen-line",
  "signature",
  "stamp",
  "trash-2",
  "send",
  "send-horizontal",
  "paperclip",
  "file-text",
  "file-check",
  "file-down",
  "file-up",
  "file-signature",
  "download",
  "upload",
  "printer",
  "copy",
  "link",
  "external-link",
  "refresh-cw",
  "filter",
  "funnel",
  "eye",
  "eye-off",
  "ellipsis",
  "grip-vertical",
  "arrow-left",
  "arrow-right",
  "arrow-down-up",
  "arrow-up-down",
  "chevron-down",
  "chevron-up",
  "chevron-left",
  "chevron-right",
  "chevrons-left",
  "chevrons-right",
  "mail",
  "mail-check",
  "phone",
  "globe",
  "clock",
  "euro",
  "info",
  "triangle-alert",
  "octagon-alert",
  "ban",
  "loader-circle",
  "badge-check",
  "scale",
  "gavel",
  "clipboard",
  "mail-open",
  "ellipsis-vertical",
  "maximize-2",
  "minimize-2",
  "move",
];

/**
 * Icônes maison : nom → intérieur du SVG (grille 24 × 24, trait hérité du sprite). Un motif
 * repris de Lucide à échelle réduite garde un trait lisible grâce à son propre stroke-width.
 */
const MAISON = {
  // Personnel de service : une personne, la clé du gardien (en haut à gauche, agrandie d'un
  // quart) et le balai de l'entretien (le « broom » de Lucide réduit et redressé, debout à droite).
  "personnel-service":
    '<circle cx="12.5" cy="6.25" r="4" /><path d="M5.75 19.25a6.75 6.75 0 0 1 8.85-6.41" />' +
    '<g transform="translate(3.75 1.75) scale(1.25) translate(-4.25 -1.75)" stroke-width="1.5">' +
    '<circle cx="4.25" cy="7" r="1.25" /><path d="M4.25 1.75v4" /><path d="M4.25 3.1h1.6" /></g>' +
    '<g transform="translate(18.55 16.56) scale(0.625) rotate(-45) translate(-12 -12)" stroke-width="2.6">' +
    '<path d="M13.5 10.5 22 2" />' +
    '<path d="M14.734 13.841a2 2 0 00-.314-2.42L12.58 9.58a2 2 0 00-2.421-.314l-7.657 4.461A1 1 0 002.3 15.3l6.403 6.403a1 1 0 001.571-.204z" />' +
    '<path d="m5 18 2-2" /><path d="m7.699 10.7 5.602 5.601" /></g>',
};

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dossier = path.join(racine, "node_modules", "lucide-static", "icons");
const symboles = [];
const manquants = [];
for (const nom of [...new Set(ICONES)].sort()) {
  let svg;
  try {
    svg = readFileSync(path.join(dossier, `${nom}.svg`), "utf8");
  } catch {
    manquants.push(nom);
    continue;
  }
  const interieur = svg
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  symboles.push(`<symbol id="${nom}" viewBox="0 0 24 24">${interieur}</symbol>`);
}
for (const [nom, interieur] of Object.entries(MAISON))
  symboles.push(`<symbol id="${nom}" viewBox="0 0 24 24">${interieur}</symbol>`);
const sprite =
  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none">\n` +
  `${symboles.join("\n")}\n</svg>\n`;
writeFileSync(path.join(racine, "public", "vendor", "lucide.svg"), sprite);
console.log(`${symboles.length} icônes écrites dans public/vendor/lucide.svg`);
if (manquants.length) console.warn(`Icônes introuvables : ${manquants.join(", ")}`);
