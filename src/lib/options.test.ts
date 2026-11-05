import { describe, expect, it } from "vitest";
import { decrireOption, entreesConcernees, estOption, trierOptions } from "@/lib/options";

const now = new Date("2026-11-05T10:00:00Z");
const j = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe("options", () => {
  it("n'a de sens que sur un dossier non acquis avec une échéance", () => {
    expect(estOption({ status: "a_traiter", optionExpiresAt: j(2) })).toBe(true);
    expect(estOption({ status: "acceptee", optionExpiresAt: j(2) })).toBe(true);
    expect(estOption({ status: "confirmee", optionExpiresAt: j(2) })).toBe(false);
    expect(estOption({ status: "a_traiter", optionExpiresAt: null })).toBe(false);
  });

  it("relance dans la fenêtre une seule fois, libère au-delà de l'échéance", () => {
    const r = trierOptions(
      [
        { id: 1, status: "a_traiter", optionExpiresAt: j(2), optionRelanceAt: null },
        { id: 2, status: "a_traiter", optionExpiresAt: j(2), optionRelanceAt: j(-1) },
        { id: 3, status: "acceptee", optionExpiresAt: j(10), optionRelanceAt: null },
        { id: 4, status: "a_traiter", optionExpiresAt: j(-0.5), optionRelanceAt: j(-3) },
        { id: 5, status: "confirmee", optionExpiresAt: j(-1), optionRelanceAt: null },
      ],
      now,
      3,
    );
    expect(r.aRelancer).toEqual([1]);
    expect(r.expirees).toEqual([4]);
  });

  it("décrit l'échéance", () => {
    expect(decrireOption({ optionExpiresAt: j(3) }, now)).toContain("dans 3 jours");
    expect(decrireOption({ optionExpiresAt: j(-1) }, now)).toContain("échéance dépassée");
    expect(decrireOption({ optionExpiresAt: null }, now)).toBe("");
  });
});

describe("liste d'attente", () => {
  const e = (
    id: number,
    espaceId: number,
    de: number,
    a: number,
    notifiedAt: Date | null = null,
  ) => ({
    id,
    espaceId,
    startAt: new Date(2026, 10, 10, de),
    endAt: new Date(2026, 10, 10, a),
    notifiedAt,
  });
  it("retient les inscriptions du même espace qui recouvrent un créneau libéré", () => {
    const libere = [{ startAt: new Date(2026, 10, 10, 18), endAt: new Date(2026, 10, 10, 20) }];
    expect(
      entreesConcernees(
        [e(1, 7, 19, 21), e(2, 7, 20, 22), e(3, 8, 18, 20), e(4, 7, 18, 20, now)],
        7,
        libere,
      ),
    ).toEqual([1]);
  });
});
