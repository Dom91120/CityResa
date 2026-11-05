import { describe, expect, it } from "vitest";
import {
  apercuInchange,
  dossiersTouches,
  type OccurrenceTouchee,
  phraseBilan,
  planFermeture,
} from "@/lib/fermetures";

const occ = (creneauId: number, reservationId: number, jour: number): OccurrenceTouchee => ({
  creneauId,
  reservationId,
  startAt: new Date(Date.UTC(2026, 10, jour, 17)),
  endAt: new Date(Date.UTC(2026, 10, jour, 19)),
});

describe("dossiers touchés par une fermeture", () => {
  it("regroupe par dossier, dans l'ordre chronologique", () => {
    const r = dossiersTouches(
      [occ(3, 20, 12), occ(1, 10, 5), occ(2, 10, 3)],
      new Map([
        [10, 30],
        [20, 30],
      ]),
    );
    expect(r.map((d) => d.reservationId)).toEqual([10, 20]);
    expect(r[0].occurrences.map((o) => o.creneauId)).toEqual([2, 1]);
  });

  it("repère le dossier dont tous les créneaux prévus sont couverts", () => {
    const r = dossiersTouches(
      [occ(1, 10, 5), occ(2, 20, 5), occ(3, 20, 6)],
      new Map([
        [10, 1],
        [20, 5],
      ]),
    );
    expect(r.find((d) => d.reservationId === 10)?.entier).toBe(true);
    expect(r.find((d) => d.reservationId === 20)?.entier).toBe(false);
  });

  it("compte une seule fois un créneau vu deux fois (espace et sous-espace)", () => {
    const r = dossiersTouches([occ(1, 10, 5), occ(1, 10, 5)], new Map([[10, 2]]));
    expect(r[0].occurrences).toHaveLength(1);
    expect(r[0].entier).toBe(false);
  });

  it("sans décompte connu, le dossier est considéré entier", () => {
    expect(dossiersTouches([occ(1, 10, 5)], new Map())[0].entier).toBe(true);
  });
});

describe("aperçu toujours exact", () => {
  const touches = dossiersTouches(
    [occ(1, 10, 5), occ(2, 20, 6)],
    new Map([
      [10, 3],
      [20, 3],
    ]),
  );

  it("vrai pour les mêmes créneaux, dans n'importe quel ordre", () => {
    expect(apercuInchange([2, 1], touches)).toBe(true);
  });

  it("faux si un créneau est apparu ou a disparu depuis l'aperçu", () => {
    expect(apercuInchange([1], touches)).toBe(false);
    expect(apercuInchange([1, 2, 3], touches)).toBe(false);
    expect(apercuInchange([], [])).toBe(true);
  });
});

describe("plan d'une fermeture", () => {
  const touches = dossiersTouches(
    [occ(1, 10, 5), occ(2, 10, 6), occ(3, 20, 5)],
    new Map([
      [10, 8],
      [20, 1],
    ]),
  );

  it("annule les créneaux des dossiers non couverts entièrement", () => {
    const p = planFermeture(touches, { annuler: true, prevenir: true });
    expect(p.creneauxAAnnuler).toEqual([1, 2]);
    expect([...p.dossiersAnnules]).toEqual([10]);
    expect(p.bilan).toEqual({ dossiers: 2, annulees: 2, prevenus: 2, entiers: 1 });
  });

  it("n'annule rien et ne prévient personne si l'agent ne le demande pas", () => {
    const p = planFermeture(touches, { annuler: false, prevenir: false });
    expect(p.creneauxAAnnuler).toEqual([]);
    expect(p.bilan).toEqual({ dossiers: 2, annulees: 0, prevenus: 0, entiers: 1 });
  });
});

describe("message de bilan", () => {
  it("accorde au singulier et au pluriel, signale les dossiers entiers", () => {
    expect(phraseBilan({ dossiers: 1, annulees: 1, prevenus: 0, entiers: 0 }, "Salle A", "P")).toBe(
      "Fermeture posée sur Salle A (P) : 1 dossier concerné, 1 créneau annulé.",
    );
    expect(phraseBilan({ dossiers: 3, annulees: 4, prevenus: 3, entiers: 2 }, "Salle A", "P")).toBe(
      "Fermeture posée sur Salle A (P) : 3 dossiers concernés, 4 créneaux annulés, 3 usagers prévenus. 2 dossiers entièrement couverts : à annuler ou reporter depuis sa fiche.",
    );
  });
});
