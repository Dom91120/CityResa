/**
 * Journal applicatif structuré : une ligne JSON par événement en production (niveau,
 * module, message, identifiant de requête), un format lisible en développement. Les
 * clés sensibles sont masquées quoi qu'il arrive.
 */

type Niveau = "info" | "avert" | "erreur";
type Meta = Record<string, unknown>;

const CLES_SENSIBLES =
  /^(password|mot_?de_?passe|secret|token|jeton|cookie|authorization|session|api[_-]?key|cle|code)$/i;

function assainir(v: unknown, profondeur = 0): unknown {
  if (profondeur > 4) return "[…]";
  if (v instanceof Error) return { nom: v.name, message: v.message, pile: v.stack };
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => assainir(x, profondeur + 1));
  if (v && typeof v === "object") {
    const out: Meta = {};
    for (const [k, val] of Object.entries(v as Meta)) {
      out[k] = CLES_SENSIBLES.test(k) ? "[masqué]" : assainir(val, profondeur + 1);
    }
    return out;
  }
  return v;
}

function ecrire(niveau: Niveau, module: string, message: string, meta?: Meta): void {
  try {
    const base = { niveau, module, message, ...(meta ? (assainir(meta) as Meta) : {}) };
    const ligne =
      process.env.NODE_ENV === "production"
        ? JSON.stringify({ t: new Date().toISOString(), ...base })
        : `[${module}] ${message}${meta ? ` ${JSON.stringify(assainir(meta))}` : ""}`;
    if (niveau === "erreur") console.error(ligne);
    else if (niveau === "avert") console.warn(ligne);
    else console.log(ligne);
  } catch {
    // Un journal qui lève est pire que pas de journal.
  }
}

export const journal = {
  info: (module: string, message: string, meta?: Meta) => ecrire("info", module, message, meta),
  avert: (module: string, message: string, meta?: Meta) => ecrire("avert", module, message, meta),
  erreur: (module: string, message: string, meta?: Meta) => ecrire("erreur", module, message, meta),
};

export const _assainir = assainir;
