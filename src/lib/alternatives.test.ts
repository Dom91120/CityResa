import { describe, expect, it } from "vitest";
import {
  candidats,
  choisir,
  decalerJours,
  decalerMinutes,
  decrire,
  type EspaceCandidat,
  estLibre,
  lignesCourriel,
} from "@/lib/alternatives";
import type { Intervalle } from "@/lib/creneaux";
import { parisDateTimeToInstant } from "@/lib/paris-time";

function cr(ymd: string, de: string, a: string): Intervalle {
  const startAt = parisDateTimeToInstant(ymd, de);
  const endAt = parisDateTimeToInstant(ymd, a);
  if (!startAt || !endAt) throw new Error("date invalide");
  return { startAt, endAt };
}
const now = parisDateTimeToInstant("2026-11-05", "10:00") as Date;
const espace: EspaceCandidat = {
  id: 1,
  slotStepMin: 30,
  minDurationMin: 60,
  maxDurationMin: null,
  delayMinDays: 1,
  horizonMaxDays: 365,
  openHours: { "1": [["08:00", "22:00"]], "2": [["08:00", "22:00"]], "3": [["08:00", "22:00"]] },
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  capaciteSimultanee: 1,
  periodes: [],
};
// Mardi 1er décembre 2026, 10h-12h.
const demande = cr("2026-12-01", "10:00", "12:00");

describe("décalages en heure de Paris", () => {
  it("décale les minutes sans changer la durée", () => {
    expect(decalerMinutes(demande, 90)).toEqual(cr("2026-12-01", "11:30", "13:30"));
  });

  it("reporte au même horaire mural même à travers un changement d'heure", () => {
    const avant = cr("2026-10-24", "10:00", "12:00");
    expect(decalerJours(avant, 2)).toEqual(cr("2026-10-26", "10:00", "12:00"));
    expect(decalerJours(demande, -1)).toEqual(cr("2026-11-30", "10:00", "12:00"));
  });
});

describe("candidats", () => {
  it("vont du plus proche au plus lointain, dans l'ordre horaire, jour, espace", () => {
    const c = candidats(demande, { id: 1, slotStepMin: 30 }, [{ id: 2 }], {
      maxPas: 2,
      maxJours: 1,
    });
    expect(c.map((x) => [x.genre, x.ecart])).toEqual([
      ["horaire", 30],
      ["horaire", 30],
      ["horaire", 60],
      ["horaire", 60],
      ["jour", 1],
      ["jour", 1],
      ["espace", 0],
    ]);
    expect(c[0]).toMatchObject(cr("2026-12-01", "10:30", "12:30"));
    expect(c[1]).toMatchObject(cr("2026-12-01", "09:30", "11:30"));
    expect(c[6]).toMatchObject({ ...demande, espaceId: 2 });
  });
});

describe("estLibre", () => {
  const occ = [{ ...cr("2026-12-01", "11:00", "13:00"), genre: "reservation" as const }];

  it("refuse un candidat qui chevauche, hors horaires, passé ou fermé par un blocage", () => {
    const [plusTard, plusTot] = candidats(demande, espace, [], { maxPas: 1, maxJours: 0 });
    expect(estLibre(plusTard, espace, occ, now)).toBe(false);
    expect(estLibre(plusTot, espace, occ, now)).toBe(false);
    const libre = {
      ...cr("2026-12-01", "08:00", "10:00"),
      espaceId: 1,
      genre: "horaire" as const,
      ecart: 120,
    };
    expect(estLibre(libre, espace, occ, now)).toBe(true);
    expect(estLibre({ ...libre, ...cr("2026-12-01", "06:00", "08:00") }, espace, occ, now)).toBe(
      false,
    );
    expect(
      estLibre(
        { ...libre, ...cr("2026-12-01", "08:00", "10:00") },
        espace,
        [{ ...cr("2026-12-01", "00:00", "23:00"), genre: "blocage" }],
        now,
      ),
    ).toBe(false);
    expect(estLibre({ ...libre, ...cr("2026-11-01", "08:00", "10:00") }, espace, [], now)).toBe(
      false,
    );
  });

  it("un jeudi fermé n'est pas proposé, un espace partageable accepte une deuxième occupation", () => {
    const jeudi = {
      ...cr("2026-12-03", "10:00", "12:00"),
      espaceId: 1,
      genre: "jour" as const,
      ecart: 2,
    };
    expect(estLibre(jeudi, espace, [], now)).toBe(false);
    const partage = { ...espace, capaciteSimultanee: 2 };
    expect(
      estLibre({ ...demande, espaceId: 1, genre: "horaire", ecart: 0 }, partage, occ, now),
    ).toBe(true);
  });
});

describe("choisir et décrire", () => {
  it("prend la plus proche de chaque genre, puis complète par proximité", () => {
    const h1 = {
      ...cr("2026-12-01", "13:00", "15:00"),
      espaceId: 1,
      genre: "horaire" as const,
      ecart: 180,
    };
    const h2 = {
      ...cr("2026-12-01", "14:00", "16:00"),
      espaceId: 1,
      genre: "horaire" as const,
      ecart: 240,
    };
    const j1 = {
      ...cr("2026-12-02", "10:00", "12:00"),
      espaceId: 1,
      genre: "jour" as const,
      ecart: 1,
    };
    const e1 = { ...demande, espaceId: 2, genre: "espace" as const, ecart: 0 };
    expect(choisir([h1, h2, j1, e1])).toEqual([h1, j1, e1]);
    expect(choisir([h1, h2])).toEqual([h1, h2]);
    expect(choisir([h1, h2, j1, e1], 4)).toEqual([h1, j1, e1, h2]);
    expect(decrire(h1, "Salle A")).toBe("Le même jour, 13h00 – 15h00");
    expect(decrire(j1, "Salle A")).toBe("Le 02/12/2026, 10h00 – 12h00");
    expect(decrire(e1, "Salle B")).toBe("Salle B, le 01/12/2026, 10h00 – 12h00");
    expect(lignesCourriel([])).toBe("");
    expect(lignesCourriel([{ texte: "a" }, { texte: "b" }])).toBe(
      "Créneaux de remplacement libres à ce jour : a ; b.",
    );
  });
});
