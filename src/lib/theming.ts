/**
 * Couleur principale personnalisable de l'interface : une couleur hex stockée en
 * configuration (UI_PRIMARY_COLOR, vide = thème Vert).
 */

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Retourne la couleur hex normalisée ('' si invalide/vide). */
export function normalizeColor(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return HEX_RE.test(v) ? v.toLowerCase() : "";
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Mélange avec du blanc (ratio > 0) ou du noir (ratio < 0). */
export function colorMix(hex: string, ratio: number): string {
  const target = ratio >= 0 ? 255 : 0;
  const amount = Math.abs(ratio);
  const parts = rgb(hex).map((v) => Math.round(v + (target - v) * amount));
  return `#${parts.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Contenu du bloc <style> de surcharge des variables primaires ('' si défaut). */
export function primaryCssOverride(hexColor: string | null | undefined): string {
  const c = normalizeColor(hexColor);
  if (!c) return "";
  const dark = colorMix(c, -0.18);
  const rgbs = rgb(c).join(",");
  const l1 = colorMix(c, 0.35);
  const l2 = colorMix(c, 0.15);
  const lrgb = rgb(l1).join(",");
  return (
    `:root:root{--primary:${c};--primary-dark:${dark};--primary-rgb:${rgbs};--ring:0 0 0 3px rgba(${rgbs},.3);}` +
    `:root:root[data-theme="dark"]{--primary:${l1};--primary-dark:${l2};--primary-rgb:${lrgb};--ring:0 0 0 3px rgba(${lrgb},.35);}`
  );
}

/** Texte lisible (noir ou blanc) sur une couleur de fond. */
export function contraste(hex: string): string {
  const c = normalizeColor(hex);
  if (!c) return "#1f2937";
  const [r, g, b] = rgb(c);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1f2937" : "#ffffff";
}
