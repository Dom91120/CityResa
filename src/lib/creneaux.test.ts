import { describe, expect, it } from "vitest";
import {
  avecMarges,
  bornes,
  chevauche,
  conflits,
  dansHoraires,
  decrireRecurrence,
  developperRecurrence,
  dureeMinutes,
  HORAIRES_DEFAUT,
  type Intervalle,
  lireHoraires,
  lireRecurrence,
  MAX_OCCURRENCES,
  verifierRegles,
} from "@/lib/creneaux";
import { parisDateTimeToInstant, toParisWall } from "@/lib/paris-time";

/** Un créneau en heure de Paris : cr("2026-11-04", "18:00", "20:00"). */
function cr(ymd: string, de: string, a: string): Intervalle {
  const startAt = parisDateTimeToInstant(ymd, de);
  const endAt = parisDateTimeToInstant(
    a.includes("T") ? a.split("T")[0] : ymd,
    a.split("T").pop() ?? a,
  );
  if (!startAt || !endAt) throw new Error("créneau de test invalide");
  return { startAt, endAt };
}
function paris(d: Date): string {
  const w = toParisWall(d);
  return `${w.y}-${String(w.mo).padStart(2, "0")}-${String(w.da).padStart(2, "0")} ${String(Math.floor(w.min / 60)).padStart(2, "0")}:${String(w.min % 60).padStart(2, "0")}`;
}

describe("chevauche", () => {
  it("détecte un recouvrement partiel ou total", () => {
    expect(chevauche(cr("2026-11-04", "10:00", "12:00"), cr("2026-11-04", "11:00", "13:00"))).toBe(
      true,
    );
    expect(chevauche(cr("2026-11-04", "10:00", "12:00"), cr("2026-11-04", "10:30", "11:30"))).toBe(
      true,
    );
    expect(chevauche(cr("2026-11-04", "10:30", "11:30"), cr("2026-11-04", "10:00", "12:00"))).toBe(
      true,
    );
  });

  it("exclut les bornes : 10h-12h et 12h-14h ne se touchent pas", () => {
    expect(chevauche(cr("2026-11-04", "10:00", "12:00"), cr("2026-11-04", "12:00", "14:00"))).toBe(
      false,
    );
    expect(chevauche(cr("2026-11-04", "12:00", "14:00"), cr("2026-11-04", "10:00", "12:00"))).toBe(
      false,
    );
  });

  it("ne voit pas de conflit entre deux jours différents", () => {
    expect(chevauche(cr("2026-11-04", "10:00", "12:00"), cr("2026-11-05", "10:00", "12:00"))).toBe(
      false,
    );
  });
});

describe("avecMarges / dureeMinutes", () => {
  it("élargit l'intervalle des temps de montage et de démontage", () => {
    const i = cr("2026-11-04", "10:00", "12:00");
    const m = avecMarges(i, 30, 60);
    expect(paris(m.startAt)).toBe("2026-11-04 09:30");
    expect(paris(m.endAt)).toBe("2026-11-04 13:00");
    expect(dureeMinutes(m)).toBe(210);
  });

  it("sans marge, rend un intervalle identique", () => {
    const i = cr("2026-11-04", "10:00", "12:00");
    expect(avecMarges(i, 0, 0)).toEqual(i);
    expect(dureeMinutes(i)).toBe(120);
  });
});

describe("lireRecurrence", () => {
  it("accepte une récurrence propre et normalise ses champs", () => {
    expect(
      lireRecurrence({
        freq: "weekly",
        interval: 2.7,
        byWeekday: ["1", 3, 9, "x"],
        until: "2026-12-31",
        count: 4.9,
        except: ["2026-12-25", "noël", 12],
      }),
    ).toEqual({
      freq: "weekly",
      interval: 2,
      byWeekday: [1, 3],
      until: "2026-12-31",
      count: 4,
      except: ["2026-12-25"],
    });
  });

  it("rejette ce qui n'est pas une récurrence", () => {
    expect(lireRecurrence(null)).toBeNull();
    expect(lireRecurrence("weekly")).toBeNull();
    expect(lireRecurrence({ freq: "yearly" })).toBeNull();
    expect(lireRecurrence({})).toBeNull();
  });

  it("ignore un intervalle, un compte ou une date limite invalides", () => {
    expect(lireRecurrence({ freq: "daily", interval: 0, count: 0, until: "31/12/2026" })).toEqual({
      freq: "daily",
    });
  });
});

describe("developperRecurrence", () => {
  it("sans récurrence, rend le premier créneau seul", () => {
    const i = cr("2026-11-04", "18:00", "20:00");
    expect(developperRecurrence(i, null)).toEqual([i]);
  });

  it("daily : chaque jour jusqu'à la date limite incluse", () => {
    const out = developperRecurrence(cr("2026-11-04", "09:00", "12:00"), {
      freq: "daily",
      until: "2026-11-07",
    });
    expect(out.map((c) => paris(c.startAt))).toEqual([
      "2026-11-04 09:00",
      "2026-11-05 09:00",
      "2026-11-06 09:00",
      "2026-11-07 09:00",
    ]);
    expect(out.every((c) => dureeMinutes(c) === 180)).toBe(true);
  });

  it("daily avec count et interval 2", () => {
    const out = developperRecurrence(cr("2026-11-04", "09:00", "12:00"), {
      freq: "daily",
      interval: 2,
      count: 3,
    });
    expect(out.map((c) => paris(c.startAt))).toEqual([
      "2026-11-04 09:00",
      "2026-11-06 09:00",
      "2026-11-08 09:00",
    ]);
  });

  it("weekly : garde le jour du premier créneau quand byWeekday est vide", () => {
    const out = developperRecurrence(cr("2026-11-04", "18:00", "20:00"), {
      freq: "weekly",
      until: "2026-11-25",
    });
    expect(out.map((c) => paris(c.startAt))).toEqual([
      "2026-11-04 18:00",
      "2026-11-11 18:00",
      "2026-11-18 18:00",
      "2026-11-25 18:00",
    ]);
  });

  it("weekly : plusieurs jours par semaine, sans occurrence avant le premier créneau", () => {
    // Mercredi 4 novembre 2026 ; lundi et mercredi demandés : le lundi 2 n'est pas inclus.
    const out = developperRecurrence(cr("2026-11-04", "18:00", "20:00"), {
      freq: "weekly",
      byWeekday: [1, 3],
      until: "2026-11-16",
    });
    expect(out.map((c) => paris(c.startAt))).toEqual([
      "2026-11-04 18:00",
      "2026-11-09 18:00",
      "2026-11-11 18:00",
      "2026-11-16 18:00",
    ]);
  });

  it("weekly : une semaine sur deux, avec exclusions", () => {
    const out = developperRecurrence(cr("2026-11-04", "18:00", "20:00"), {
      freq: "weekly",
      interval: 2,
      byWeekday: [3],
      until: "2026-12-31",
      except: ["2026-12-02"],
    });
    expect(out.map((c) => paris(c.startAt))).toEqual([
      "2026-11-04 18:00",
      "2026-11-18 18:00",
      "2026-12-16 18:00",
      "2026-12-30 18:00",
    ]);
  });

  it("weekly : count borne le nombre d'occurrences", () => {
    const out = developperRecurrence(cr("2026-11-04", "18:00", "20:00"), {
      freq: "weekly",
      count: 3,
    });
    expect(out).toHaveLength(3);
  });

  it("weekly : un créneau 18h-20h hebdomadaire reste à 18 h de Paris après le passage à l'heure d'été", () => {
    const out = developperRecurrence(cr("2026-03-25", "18:00", "20:00"), {
      freq: "weekly",
      until: "2026-04-08",
    });
    expect(out.map((c) => paris(c.startAt))).toEqual([
      "2026-03-25 18:00",
      "2026-04-01 18:00",
      "2026-04-08 18:00",
    ]);
    // En UTC, l'heure change : 17 h avant, 16 h après.
    expect(out[0].startAt.toISOString()).toBe("2026-03-25T17:00:00.000Z");
    expect(out[1].startAt.toISOString()).toBe("2026-04-01T16:00:00.000Z");
    expect(out.every((c) => dureeMinutes(c) === 120)).toBe(true);
  });

  it("monthly : le 31 tombe sur le dernier jour des mois plus courts", () => {
    const out = developperRecurrence(cr("2026-01-31", "10:00", "12:00"), {
      freq: "monthly",
      count: 4,
    });
    expect(out.map((c) => paris(c.startAt))).toEqual([
      "2026-01-31 10:00",
      "2026-02-28 10:00",
      "2026-03-31 10:00",
      "2026-04-30 10:00",
    ]);
  });

  it("monthly : interval 3 et passage d'année", () => {
    const out = developperRecurrence(cr("2026-11-15", "10:00", "12:00"), {
      freq: "monthly",
      interval: 3,
      until: "2027-06-30",
    });
    expect(out.map((c) => paris(c.startAt))).toEqual([
      "2026-11-15 10:00",
      "2027-02-15 10:00",
      "2027-05-15 10:00",
    ]);
  });

  it("sans until ni count, s'arrête au bout d'un an", () => {
    const out = developperRecurrence(cr("2026-11-04", "18:00", "20:00"), { freq: "weekly" });
    expect(out.length).toBeGreaterThanOrEqual(52);
    expect(out.length).toBeLessThanOrEqual(53);
    expect(out[out.length - 1].startAt.getTime()).toBeLessThanOrEqual(
      cr("2027-11-04", "18:00", "20:00").startAt.getTime(),
    );
  });

  it("ne dépasse jamais MAX_OCCURRENCES", () => {
    const out = developperRecurrence(cr("2026-01-01", "09:00", "10:00"), {
      freq: "daily",
      until: "2030-01-01",
    });
    expect(out).toHaveLength(MAX_OCCURRENCES);
  });
});

describe("decrireRecurrence", () => {
  it("décrit une récurrence en français", () => {
    expect(decrireRecurrence(null)).toBe("");
    expect(decrireRecurrence({ freq: "daily" })).toBe("Chaque jour");
    expect(decrireRecurrence({ freq: "daily", interval: 3, count: 5 })).toBe(
      "Tous les 3 jours, 5 fois",
    );
    expect(decrireRecurrence({ freq: "weekly", byWeekday: [3], until: "2026-06-30" })).toBe(
      "Chaque semaine le mercredi, jusqu'au 30/06/2026",
    );
    expect(decrireRecurrence({ freq: "weekly", interval: 2, byWeekday: [1, 5] })).toBe(
      "Une semaine sur deux le lundi, vendredi",
    );
    expect(decrireRecurrence({ freq: "weekly", interval: 3 })).toBe("Toutes les 3 semaines");
    expect(decrireRecurrence({ freq: "monthly" })).toBe("Chaque mois");
    expect(decrireRecurrence({ freq: "monthly", interval: 2 })).toBe("Tous les 2 mois");
  });
});

describe("lireHoraires", () => {
  it("ne garde que les jours 1-7 et les plages bien formées", () => {
    expect(
      lireHoraires({
        "1": [["08:00", "22:00"]],
        "8": [["08:00", "22:00"]],
        "2": "fermé",
        "3": [["08:00"], ["09:00", "12:00"], [1, 2]],
        lundi: [["08:00", "22:00"]],
      }),
    ).toEqual({ "1": [["08:00", "22:00"]], "3": [["09:00", "12:00"]] });
  });

  it("rend null pour autre chose qu'un objet", () => {
    expect(lireHoraires(null)).toBeNull();
    expect(lireHoraires("x")).toBeNull();
    expect(lireHoraires(undefined)).toBeNull();
  });
});

describe("dansHoraires", () => {
  // Mercredi 4 novembre 2026.
  const horaires = {
    "3": [
      ["08:00", "12:00"],
      ["14:00", "22:00"],
    ] as [string, string][],
    "5": [["18:00", "00:00"]] as [string, string][],
    "6": [["08:00", "23:00"]] as [string, string][],
    "7": [["00:00", "02:00"]] as [string, string][],
  };

  it("sans horaires déclarés, tout est ouvert", () => {
    expect(dansHoraires(null, cr("2026-11-04", "03:00", "05:00"))).toBe(true);
  });

  it("accepte un créneau contenu dans une plage, bornes comprises", () => {
    expect(dansHoraires(horaires, cr("2026-11-04", "08:00", "12:00"))).toBe(true);
    expect(dansHoraires(horaires, cr("2026-11-04", "15:00", "17:00"))).toBe(true);
  });

  it("refuse un créneau à cheval sur deux plages ou hors plage", () => {
    expect(dansHoraires(horaires, cr("2026-11-04", "11:00", "15:00"))).toBe(false);
    expect(dansHoraires(horaires, cr("2026-11-04", "07:30", "09:00"))).toBe(false);
    expect(dansHoraires(horaires, cr("2026-11-04", "21:00", "22:30"))).toBe(false);
  });

  it("refuse un jour sans plage (fermé)", () => {
    expect(dansHoraires(horaires, cr("2026-11-05", "10:00", "11:00"))).toBe(false);
  });

  it("une fermeture à 00:00 signifie minuit", () => {
    // Vendredi 6 novembre : 18 h → minuit.
    expect(dansHoraires(horaires, cr("2026-11-06", "20:00", "2026-11-07T00:00"))).toBe(true);
    expect(dansHoraires(horaires, cr("2026-11-06", "17:00", "19:00"))).toBe(false);
  });

  it("vérifie un créneau sur plusieurs jours, jour par jour", () => {
    // Samedi 7 nov. 20 h → dimanche 8 nov. 2 h : samedi ouvert jusqu'à 23 h → refusé.
    expect(dansHoraires(horaires, cr("2026-11-07", "20:00", "2026-11-08T02:00"))).toBe(false);
    // Vendredi 6 nov. 20 h → samedi 7 nov. 10 h : vendredi jusqu'à minuit, samedi dès 8 h → refusé (0 h-8 h fermé).
    expect(dansHoraires(horaires, cr("2026-11-06", "20:00", "2026-11-07T10:00"))).toBe(false);
    // Vendredi 6 nov. 20 h → samedi 7 nov. 0 h 00 précises : la fin est à minuit → accepté.
    expect(dansHoraires(horaires, cr("2026-11-06", "20:00", "2026-11-07T00:00"))).toBe(true);
  });

  it("les horaires par défaut couvrent 8 h - 22 h tous les jours", () => {
    expect(Object.keys(HORAIRES_DEFAUT)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(dansHoraires(HORAIRES_DEFAUT, cr("2026-11-08", "08:00", "22:00"))).toBe(true);
    expect(dansHoraires(HORAIRES_DEFAUT, cr("2026-11-08", "07:00", "09:00"))).toBe(false);
  });
});

describe("verifierRegles", () => {
  const regles = {
    slotStepMin: 30,
    minDurationMin: 120,
    maxDurationMin: 480,
    delayMinDays: 7,
    horizonMaxDays: 365,
    openHours: HORAIRES_DEFAUT,
  };
  const now = new Date("2026-11-01T10:00:00Z");

  it("accepte un créneau conforme", () => {
    expect(verifierRegles(regles, cr("2026-11-20", "10:00", "12:00"), now)).toEqual([]);
  });

  it("refuse une fin avant le début, sans autre reproche", () => {
    const e = verifierRegles(regles, cr("2026-11-20", "12:00", "10:00"), now);
    expect(e).toEqual(["L'heure de fin doit être après l'heure de début."]);
  });

  it("vérifie la durée minimale et maximale", () => {
    expect(verifierRegles(regles, cr("2026-11-20", "10:00", "11:00"), now)).toContain(
      "Durée minimale : 2 h.",
    );
    expect(verifierRegles(regles, cr("2026-11-20", "08:00", "17:00"), now)).toContain(
      "Durée maximale : 8 h.",
    );
  });

  it("vérifie le pas de saisie", () => {
    expect(verifierRegles(regles, cr("2026-11-20", "10:15", "12:15"), now)).toContain(
      "Les horaires se saisissent par pas de 30 min.",
    );
    expect(
      verifierRegles({ ...regles, slotStepMin: 0 }, cr("2026-11-20", "10:15", "12:15"), now),
    ).toEqual([]);
  });

  it("vérifie le délai minimal et l'horizon, sauf si on les ignore", () => {
    const tropTot = cr("2026-11-04", "10:00", "12:00");
    expect(verifierRegles(regles, tropTot, now)).toContain(
      "La demande doit être déposée au moins 7 jour(s) à l'avance.",
    );
    expect(verifierRegles(regles, tropTot, now, { ignorerDelai: true })).toEqual([]);
    const tropLoin = cr("2028-01-10", "10:00", "12:00");
    expect(verifierRegles(regles, tropLoin, now)).toContain(
      "Impossible de réserver plus de 365 jours à l'avance.",
    );
    expect(verifierRegles(regles, tropLoin, now, { ignorerDelai: true })).toEqual([]);
  });

  it("vérifie les horaires d'ouverture et cumule les manquements", () => {
    const e = verifierRegles(regles, cr("2026-11-20", "06:00", "07:00"), now);
    expect(e).toContain("Le créneau sort des horaires d'ouverture de l'espace.");
    expect(e).toContain("Durée minimale : 2 h.");
    expect(e).toHaveLength(2);
  });

  it("sans horaires (null), tout horaire convient", () => {
    expect(
      verifierRegles({ ...regles, openHours: null }, cr("2026-11-20", "06:00", "08:00"), now),
    ).toEqual([]);
  });
});

describe("conflits", () => {
  const existants = [
    { ...cr("2026-11-04", "10:00", "12:00"), id: 1, libelle: "A" },
    { ...cr("2026-11-04", "14:00", "16:00"), id: 2, libelle: "B" },
  ];

  it("retourne chaque couple (demande, existant) qui se chevauche", () => {
    const out = conflits([cr("2026-11-04", "11:00", "15:00")], existants);
    expect(out.map((c) => c.existant.id)).toEqual([1, 2]);
  });

  it("ne voit rien quand les créneaux se touchent sans marge", () => {
    expect(conflits([cr("2026-11-04", "12:00", "14:00")], existants)).toEqual([]);
  });

  it("les marges de montage / démontage créent le conflit", () => {
    const out = conflits([cr("2026-11-04", "12:00", "14:00")], existants, {
      avantMin: 30,
      apresMin: 0,
    });
    expect(out.map((c) => c.existant.id)).toEqual([1]);
    const out2 = conflits([cr("2026-11-04", "12:00", "14:00")], existants, {
      avantMin: 0,
      apresMin: 15,
    });
    expect(out2.map((c) => c.existant.id)).toEqual([2]);
  });

  it("teste chaque créneau demandé", () => {
    const out = conflits(
      [cr("2026-11-04", "09:00", "10:30"), cr("2026-11-05", "09:00", "10:30")],
      existants,
    );
    expect(out).toHaveLength(1);
    expect(paris(out[0].demande.startAt)).toBe("2026-11-04 09:00");
  });
});

describe("bornes", () => {
  it("donne le premier début et la dernière fin", () => {
    const b = bornes([
      cr("2026-11-10", "10:00", "12:00"),
      cr("2026-11-04", "18:00", "20:00"),
      cr("2026-11-07", "09:00", "11:00"),
    ]);
    expect(paris(b.startAt)).toBe("2026-11-04 18:00");
    expect(paris(b.endAt)).toBe("2026-11-10 12:00");
  });
});
