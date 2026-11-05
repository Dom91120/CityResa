import { describe, expect, it } from "vitest";
import {
  controleEnRetard,
  decrireControle,
  disponible,
  echeanceControle,
  etatLigne,
  picMobilisation,
  stockUtilisable,
  verifierPanne,
  verifierRemise,
  verifierRetour,
} from "@/lib/materiel-stock";

const d = (s: string) => new Date(`${s}T10:00:00Z`);

describe("stock", () => {
  it("retire les unités hors service puis les unités mobilisées", () => {
    expect(stockUtilisable({ stockTotal: 10, horsService: 3 })).toBe(7);
    expect(stockUtilisable({ stockTotal: 2, horsService: 5 })).toBe(0);
    expect(disponible({ stockTotal: 10, horsService: 3 }, 5)).toBe(2);
    expect(disponible({ stockTotal: 10, horsService: 3 }, 9)).toBe(0);
  });

  it("contrôle pannes et remises en service", () => {
    const m = { stockTotal: 10, horsService: 3 };
    expect(verifierPanne(m, 7)).toBeNull();
    expect(verifierPanne(m, 8)).toContain("Au plus 7");
    expect(verifierPanne(m, 0)).toContain("Indiquez");
    expect(verifierRemise(m, 3)).toBeNull();
    expect(verifierRemise(m, 4)).toContain("Au plus 3");
  });
});

describe("sortie et retour", () => {
  const base = { quantite: 4, sortieAt: null, retourAt: null, manquants: 0 };

  it("suit l'état d'une ligne", () => {
    expect(etatLigne(base)).toBe("a_sortir");
    expect(etatLigne({ ...base, sortieAt: d("2026-11-01") })).toBe("sortie");
    expect(etatLigne({ ...base, sortieAt: d("2026-11-01"), retourAt: d("2026-11-02") })).toBe(
      "rendue",
    );
    expect(
      etatLigne({ ...base, sortieAt: d("2026-11-01"), retourAt: d("2026-11-02"), manquants: 1 }),
    ).toBe("manquants");
  });

  it("compte les manquants au retour et refuse les retours impossibles", () => {
    const sortie = { ...base, sortieAt: d("2026-11-01") };
    expect(verifierRetour(sortie, 4)).toEqual({ ok: true, manquants: 0 });
    expect(verifierRetour(sortie, 1)).toEqual({ ok: true, manquants: 3 });
    expect(verifierRetour(sortie, 5)).toMatchObject({ ok: false });
    expect(verifierRetour(sortie, -1)).toMatchObject({ ok: false });
    expect(verifierRetour(base, 4)).toMatchObject({
      ok: false,
      erreur: expect.stringContaining("pas été sorti"),
    });
    expect(verifierRetour({ ...sortie, retourAt: d("2026-11-02") }, 4)).toMatchObject({
      ok: false,
    });
  });
});

describe("contrôles périodiques", () => {
  const now = d("2026-11-05");

  it("calcule l'échéance depuis le dernier contrôle, sinon depuis la création", () => {
    expect(
      echeanceControle({ controleMois: null, dernierControleAt: null, createdAt: d("2026-01-01") }),
    ).toBeNull();
    expect(
      echeanceControle({ controleMois: 6, dernierControleAt: null, createdAt: d("2026-01-01") }),
    ).toEqual(d("2026-07-01"));
    expect(
      echeanceControle({
        controleMois: 6,
        dernierControleAt: d("2026-09-01"),
        createdAt: d("2026-01-01"),
      }),
    ).toEqual(d("2027-03-01"));
  });

  it("signale le retard et le décrit", () => {
    const fmt = (x: Date) => x.toISOString().slice(0, 10);
    const retard = { controleMois: 6, dernierControleAt: null, createdAt: d("2026-01-01") };
    expect(controleEnRetard(retard, now)).toBe(true);
    expect(decrireControle(retard, fmt, now)).toBe(
      "Tous les 6 mois · jamais contrôlé · prochain le 2026-07-01 (en retard)",
    );
    const ok = { controleMois: 12, dernierControleAt: d("2026-09-01"), createdAt: d("2026-01-01") };
    expect(controleEnRetard(ok, now)).toBe(false);
    expect(decrireControle(ok, fmt, now)).toBe(
      "Tous les 12 mois · dernier le 2026-09-01 · prochain le 2027-09-01",
    );
    expect(decrireControle({ ...ok, controleMois: null }, fmt, now)).toBe(
      "Pas de contrôle périodique.",
    );
  });
});

describe("pic de mobilisation", () => {
  const h = (heure: number, jour = "2027-01-09") =>
    new Date(`${jour}T${String(heure).padStart(2, "0")}:00:00Z`);
  it("additionne seulement les dossiers qui se recouvrent", () => {
    expect(
      picMobilisation([
        { debut: h(8), fin: h(12), quantite: 100 },
        { debut: h(10), fin: h(14), quantite: 50 },
        { debut: h(8, "2027-02-01"), fin: h(12, "2027-02-01"), quantite: 200 },
      ]),
    ).toBe(200);
  });
  it("ne cumule pas deux dossiers bout à bout", () => {
    expect(
      picMobilisation([
        { debut: h(8), fin: h(12), quantite: 30 },
        { debut: h(12), fin: h(16), quantite: 40 },
      ]),
    ).toBe(40);
  });
  it("cumule trois dossiers simultanés", () => {
    expect(
      picMobilisation([
        { debut: h(8), fin: h(18), quantite: 10 },
        { debut: h(9), fin: h(11), quantite: 20 },
        { debut: h(10), fin: h(12), quantite: 5 },
      ]),
    ).toBe(35);
  });
  it("vaut 0 sans dossier", () => {
    expect(picMobilisation([])).toBe(0);
  });
});
