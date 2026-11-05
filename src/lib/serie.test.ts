import { describe, expect, it } from "vitest";
import type { Intervalle } from "@/lib/creneaux";
import { parisDateTimeToInstant, toParisWall } from "@/lib/paris-time";
import {
  type CreneauSerie,
  chevauchementInterne,
  creneauxVises,
  decalage,
  decrireDeplacements,
  deplacer,
  lirePortee,
  memeIntervalle,
  phraseDeplacement,
  recurrenceDeplacee,
} from "@/lib/serie";

function cr(ymd: string, de: string, a: string): Intervalle {
  const startAt = parisDateTimeToInstant(ymd, de);
  const endAt = parisDateTimeToInstant(ymd, a);
  if (!startAt || !endAt) throw new Error("créneau de test invalide");
  return { startAt, endAt };
}
function paris(d: Date): string {
  const w = toParisWall(d);
  return `${w.y}-${String(w.mo).padStart(2, "0")}-${String(w.da).padStart(2, "0")} ${String(Math.floor(w.min / 60)).padStart(2, "0")}:${String(w.min % 60).padStart(2, "0")}`;
}

/** Les mardis 18h-20h de novembre 2026, le 2e annulé. */
const serie: CreneauSerie[] = [
  { id: 1, status: "prevu", ...cr("2026-11-03", "18:00", "20:00") },
  { id: 2, status: "annule", ...cr("2026-11-10", "18:00", "20:00") },
  { id: 3, status: "prevu", ...cr("2026-11-17", "18:00", "20:00") },
  { id: 4, status: "prevu", ...cr("2026-11-24", "18:00", "20:00") },
];

describe("créneaux visés par la portée", () => {
  it("« cette » : la cible seule", () => {
    expect(creneauxVises(serie, serie[2], "cette").map((c) => c.id)).toEqual([3]);
  });
  it("« suivantes » : la cible et les créneaux prévus qui la suivent", () => {
    expect(creneauxVises(serie, serie[2], "suivantes").map((c) => c.id)).toEqual([3, 4]);
  });
  it("« série » : tous les créneaux prévus, jamais les annulés, dans l'ordre", () => {
    const desordre = [serie[3], serie[1], serie[2], serie[0]];
    expect(creneauxVises(desordre, serie[2], "serie").map((c) => c.id)).toEqual([1, 3, 4]);
  });
  it("une portée inconnue vaut « cette »", () => {
    expect(lirePortee("serie")).toBe("serie");
    expect(lirePortee("n'importe quoi")).toBe("cette");
    expect(lirePortee(null)).toBe("cette");
  });
});

describe("décalage et déplacement", () => {
  it("mesure les jours, la nouvelle heure de début et la nouvelle durée", () => {
    const d = decalage(serie[0], cr("2026-11-05", "19:30", "21:00"));
    expect(d).toEqual({ jours: 2, debutMin: 19 * 60 + 30, dureeMs: 90 * 60_000 });
  });
  it("déplace la cible exactement sur le nouvel horaire et les autres d'autant", () => {
    const nouveau = cr("2026-11-04", "19:00", "21:00");
    const deps = deplacer(creneauxVises(serie, serie[0], "serie"), decalage(serie[0], nouveau));
    expect(memeIntervalle(deps[0].apres, nouveau)).toBe(true);
    expect(deps.map((x) => paris(x.apres.startAt))).toEqual([
      "2026-11-04 19:00",
      "2026-11-18 19:00",
      "2026-11-25 19:00",
    ]);
    expect(deps.map((x) => paris(x.apres.endAt))).toEqual([
      "2026-11-04 21:00",
      "2026-11-18 21:00",
      "2026-11-25 21:00",
    ]);
  });
  it("garde l'heure murale de Paris à travers le changement d'heure", () => {
    const hiver: CreneauSerie = { id: 9, status: "prevu", ...cr("2027-03-23", "18:00", "20:00") };
    const ete: CreneauSerie = { id: 10, status: "prevu", ...cr("2027-03-30", "18:00", "20:00") };
    const deps = deplacer([hiver, ete], decalage(hiver, cr("2027-03-24", "18:30", "20:00")));
    expect(paris(deps[1].apres.startAt)).toBe("2027-03-31 18:30");
    expect(paris(deps[1].apres.endAt)).toBe("2027-03-31 20:00");
  });
  it("un recul de date donne un décalage négatif", () => {
    expect(decalage(serie[2], cr("2026-11-16", "18:00", "20:00")).jours).toBe(-1);
  });
});

describe("chevauchement interne", () => {
  it("repère un créneau déplacé sur un créneau laissé en place", () => {
    const apres = [cr("2026-11-17", "18:00", "20:00")];
    const fixes = [cr("2026-11-17", "19:00", "21:00")];
    expect(chevauchementInterne(apres, fixes)).not.toBeNull();
  });
  it("repère deux créneaux déplacés l'un sur l'autre", () => {
    const apres = [cr("2026-11-17", "18:00", "20:00"), cr("2026-11-17", "19:00", "21:00")];
    expect(chevauchementInterne(apres, [])).not.toBeNull();
  });
  it("laisse passer des créneaux qui se touchent sans se chevaucher", () => {
    const apres = [cr("2026-11-17", "18:00", "20:00")];
    expect(chevauchementInterne(apres, [cr("2026-11-17", "20:00", "22:00")])).toBeNull();
  });
});

describe("récurrence déplacée", () => {
  it("décale les jours de la semaine, la fin et les exclusions", () => {
    const r = recurrenceDeplacee(
      { freq: "weekly", byWeekday: [1, 7], until: "2026-12-31", except: ["2026-11-10"] },
      1,
    );
    expect(r).toEqual({
      freq: "weekly",
      byWeekday: [1, 2],
      until: "2027-01-01",
      except: ["2026-11-11"],
    });
  });
  it("reste identique sans décalage de jour ou sans récurrence", () => {
    const rec = { freq: "weekly" as const, byWeekday: [2] };
    expect(recurrenceDeplacee(rec, 0)).toBe(rec);
    expect(recurrenceDeplacee(null, 3)).toBeNull();
  });
  it("recule aussi (lundi − 1 = dimanche)", () => {
    expect(recurrenceDeplacee({ freq: "weekly", byWeekday: [1] }, -1)?.byWeekday).toEqual([7]);
  });
});

describe("libellés", () => {
  it("décrit les déplacements avec une flèche, bornés", () => {
    const deps = deplacer(creneauxVises(serie, serie[0], "serie"), {
      jours: 1,
      debutMin: 18 * 60,
      dureeMs: 7_200_000,
    });
    const texte = decrireDeplacements(deps, 2);
    expect(texte).toContain("→");
    expect(texte).toContain("… et 1 autre(s)");
    expect(texte.split(" ; ")).toHaveLength(3);
  });
  it("résume le geste à l'agent", () => {
    expect(phraseDeplacement(1, "cette", true)).toBe(
      "Créneau déplacé, usager prévenu. Montants recalculés.",
    );
    expect(phraseDeplacement(3, "serie", false)).toBe(
      "3 créneaux déplacés (toute la série). Montants recalculés.",
    );
    expect(phraseDeplacement(2, "suivantes", false)).toContain("celui-ci et les suivants");
  });
});
