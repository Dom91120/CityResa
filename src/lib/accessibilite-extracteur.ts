/**
 * L'extracteur d'instantané d'accessibilité : une fonction SANS dépendance, exécutée dans la
 * page par Puppeteer (`page.evaluate(extraireInstantane)`), qui résume le DOM pour les règles
 * pures de src/lib/accessibilite.ts. Tout ce qu'elle utilise vient de `document` et `window`.
 */
import type { Instantane } from "@/lib/accessibilite";

export function extraireInstantane(): Instantane {
  const d = document;
  const w = window;
  const visible = (el: Element): boolean => {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (!r.width && !r.height) return false;
    const st = w.getComputedStyle(el);
    return st.display !== "none" && st.visibility !== "hidden";
  };
  const texteDe = (el: Element | null): string =>
    (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const nomAccessible = (el: Element): string => {
    const aria = el.getAttribute("aria-label");
    if (aria?.trim()) return aria.trim();
    const par = el.getAttribute("aria-labelledby");
    if (par) {
      const t = par
        .split(/\s+/)
        .map((id) => texteDe(d.getElementById(id)))
        .join(" ")
        .trim();
      if (t) return t;
    }
    const t = texteDe(el);
    if (t) return t;
    const img = el.querySelector("img[alt]");
    if (img?.getAttribute("alt")?.trim()) return (img.getAttribute("alt") as string).trim();
    const svg = el.querySelector("svg[aria-label], svg title");
    if (svg) return texteDe(svg) || (svg.getAttribute("aria-label") ?? "");
    const title = el.getAttribute("title");
    if (title?.trim()) return title.trim();
    const value = (el as HTMLInputElement).value;
    return typeof value === "string" &&
      ["submit", "button", "reset"].includes((el as HTMLInputElement).type)
      ? value
      : "";
  };
  const decrire = (el: Element): string => {
    const id = el.id ? `#${el.id}` : "";
    const name = el.getAttribute("name") ? `[name=${el.getAttribute("name")}]` : "";
    const cls =
      el.className && typeof el.className === "string"
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
        : "";
    return `${el.tagName.toLowerCase()}${id}${name}${cls}`;
  };
  const fond = (el: Element): string => {
    let cur: Element | null = el;
    while (cur) {
      const st = w.getComputedStyle(cur);
      // Un dégradé ou une image de fond : la couleur réelle est inconnue, on ne juge pas.
      if (st.backgroundImage && st.backgroundImage !== "none") return "";
      const bg = st.backgroundColor;
      const m = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(bg);
      if (m && (m[1] === undefined || Number(m[1]) >= 1)) return bg;
      // Fond semi-transparent : la couleur composée est inconnue, on ne juge pas.
      if (m && Number(m[1]) > 0) return "";
      cur = cur.parentElement;
    }
    return "rgb(255, 255, 255)";
  };

  const titres = Array.from(d.querySelectorAll("h1, h2, h3, h4, h5, h6"))
    .filter(visible)
    .map((h) => ({ niveau: Number(h.tagName[1]), texte: texteDe(h).slice(0, 60) }));
  const images = Array.from(d.querySelectorAll("img")).map((i) => ({
    src: i.getAttribute("src") ?? "",
    alt: i.hasAttribute("alt") ? (i.getAttribute("alt") as string) : null,
  }));
  const champs = Array.from(d.querySelectorAll("input, select, textarea"))
    .filter(
      (c) =>
        !["hidden", "submit", "button", "reset", "image"].includes((c as HTMLInputElement).type),
    )
    .filter(visible)
    .map((c) => {
      const id = c.id;
      const libelle =
        Boolean(id && d.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
        Boolean(c.closest("label")) ||
        Boolean(c.getAttribute("aria-label")?.trim()) ||
        Boolean(c.getAttribute("aria-labelledby")) ||
        Boolean(c.getAttribute("title")?.trim());
      return { desc: decrire(c), libelle };
    });
  const liens = Array.from(d.querySelectorAll("a[href]"))
    .filter(visible)
    .map((a) => ({ href: a.getAttribute("href") ?? "", nom: nomAccessible(a) }));
  const boutons = Array.from(
    d.querySelectorAll("button, [role=button], input[type=submit], input[type=button]"),
  )
    .filter(visible)
    .map((b) => ({ desc: decrire(b), nom: nomAccessible(b) }));
  const ids = Array.from(d.querySelectorAll("[id]")).map((e) => e.id);
  const vus = new Set<string>();
  const idsDoublons = new Set<string>();
  for (const id of ids) {
    if (vus.has(id)) idsDoublons.add(id);
    vus.add(id);
  }
  const iframes = Array.from(d.querySelectorAll("iframe")).map((f) => ({
    src: f.getAttribute("src") ?? "",
    title: f.getAttribute("title"),
  }));
  const tabindexPositifs = Array.from(d.querySelectorAll("[tabindex]"))
    .filter((e) => Number(e.getAttribute("tabindex")) > 0)
    .map(decrire);
  const textes: Instantane["textes"] = [];
  const marche = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
  let n: Node | null = marche.nextNode();
  while (n && textes.length < 400) {
    const texte = (n.textContent ?? "").replace(/\s+/g, " ").trim();
    const parent = n.parentElement;
    if (
      texte.length >= 2 &&
      parent &&
      // Un contrôle inactif est exempté de contraste (WCAG 1.4.3).
      !parent.closest("[disabled], [aria-disabled=true], .disabled") &&
      !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(parent.tagName) &&
      visible(parent)
    ) {
      const st = w.getComputedStyle(parent);
      textes.push({
        texte,
        fg: st.color,
        bg: fond(parent),
        taille: Number.parseFloat(st.fontSize) || 16,
        gras: Number(st.fontWeight) >= 700 || st.fontWeight === "bold",
      });
    }
    n = marche.nextNode();
  }
  return {
    url: w.location.pathname + w.location.search,
    lang: d.documentElement.getAttribute("lang"),
    titre: d.title,
    nbMain: d.querySelectorAll("main, [role=main]").length,
    skipLink: Boolean(
      d.querySelector("a.skip-link, a[href='#main-content'], a[href='#main'], a[href='#contenu']"),
    ),
    titres,
    images,
    champs,
    liens,
    boutons,
    idsDoublons: Array.from(idsDoublons),
    iframes,
    tabindexPositifs,
    textes,
  };
}
