import { describe, expect, it } from "vitest";
import {
  arbitrer,
  conflitsParVoeu,
  decrireCreneauHebdo,
  libellePriorite,
  lireStatutCampagne,
  phraseBilanArbitrage,
  premiereOccurrence,
  prioriteDe,
  TRANSITIONS_CAMPAGNE,
  type VoeuArbitrable,
  verifierCreneauHebdo,
  voeuVersDemande,
  voeuxEnConflit,
} from "@/lib/campagnes";
import { toParisWall } from "@/lib/paris-time";

const voeu = (
  id: number,
  priorite: number,
  weekday: number,
  de: number,
  a: number,
  extra: Partial<VoeuArbitrable> = {},
): VoeuArbitrable => ({
  id,
  espaceId: 7,
  weekday,
  startMin: de * 60,
  endMin: a * 60,
  status: "en_attente",
  priorite,
  createdAt: new Date(Date.UTC(2026, 5, 1 + id)),
  ...extra,
});

describe("priorité des demandeurs", () => {
  it("classe Ville, collectivité, conventionnée, association, autres", () => {
    expect(prioriteDe({ type: "service_interne", conventionnee: false })).toBe(1);
    expect(prioriteDe({ type: "collectivite", conventionnee: false })).toBe(2);
    expect(prioriteDe({ type: "association", conventionnee: true })).toBe(3);
    expect(prioriteDe({ type: "association", conventionnee: false })).toBe(4);
    expect(prioriteDe({ type: "entreprise", conventionnee: true })).toBe(5);
    expect(prioriteDe({ type: "particulier", conventionnee: false })).toBe(5);
    expect(libellePriorite(3)).toBe("Association conventionnée");
  });
});

describe("créneau hebdomadaire", () => {
  it("vérifie jour, ordre des heures et pas", () => {
    expect(verifierCreneauHebdo({ weekday: 2, startMin: 18 * 60, endMin: 20 * 60 })).toEqual([]);
    expect(verifierCreneauHebdo({ weekday: 8, startMin: 0, endMin: 60 })).toContain(
      "Choisissez le jour de la semaine.",
    );
    expect(verifierCreneauHebdo({ weekday: 1, startMin: 600, endMin: 600 })).toContain(
      "L'heure de fin doit être après l'heure de début.",
    );
    expect(verifierCreneauHebdo({ weekday: 1, startMin: 605, endMin: 700 })).toContain(
      "Les horaires se saisissent par pas de 30 min.",
    );
  });
  it("se décrit en français", () => {
    expect(decrireCreneauHebdo({ weekday: 2, startMin: 18 * 60, endMin: 20 * 60 + 30 })).toBe(
      "Mardi 18h00 - 20h30",
    );
  });
});

describe("conflits entre vœux", () => {
  it("même espace, même jour, heures qui se recouvrent", () => {
    expect(voeuxEnConflit(voeu(1, 4, 2, 18, 20), voeu(2, 4, 2, 19, 21))).toBe(true);
    expect(voeuxEnConflit(voeu(1, 4, 2, 18, 20), voeu(2, 4, 2, 20, 22))).toBe(false);
    expect(voeuxEnConflit(voeu(1, 4, 2, 18, 20), voeu(2, 4, 3, 18, 20))).toBe(false);
    expect(voeuxEnConflit(voeu(1, 4, 2, 18, 20), voeu(2, 4, 2, 18, 20, { espaceId: 8 }))).toBe(
      false,
    );
  });
  it("ignore les vœux refusés", () => {
    const c = conflitsParVoeu([
      voeu(1, 4, 2, 18, 20),
      voeu(2, 4, 2, 19, 21, { status: "refuse" }),
      voeu(3, 4, 2, 19, 21),
    ]);
    expect(c.get(1)).toEqual([3]);
    expect(c.get(2)).toEqual([]);
    expect(c.get(3)).toEqual([1]);
  });
});

describe("arbitrage automatique", () => {
  it("retient le plus prioritaire, puis le plus ancien ; les attribués sont acquis", () => {
    const r = arbitrer([
      voeu(1, 4, 2, 18, 20),
      voeu(2, 3, 2, 19, 21),
      voeu(3, 4, 2, 20, 22),
      voeu(4, 1, 2, 21, 22, { status: "attribue" }),
      voeu(5, 4, 3, 18, 20),
    ]);
    expect(r.retenus).toEqual([2, 5]);
    expect(r.ecartes).toEqual([
      { id: 1, gagnantId: 2 },
      { id: 3, gagnantId: 4 },
    ]);
  });
  it("à priorité égale, le premier déposé l'emporte", () => {
    const r = arbitrer([voeu(9, 4, 5, 10, 12), voeu(8, 4, 5, 11, 13)]);
    expect(r.retenus).toEqual([8]);
    expect(r.ecartes).toEqual([{ id: 9, gagnantId: 8 }]);
  });
  it("sans conflit, tout le monde est retenu", () => {
    expect(arbitrer([voeu(1, 5, 1, 8, 10), voeu(2, 5, 1, 10, 12)]).retenus).toEqual([1, 2]);
  });
});

describe("du vœu à la demande", () => {
  it("trouve le premier jour de la saison tombant ce jour de la semaine", () => {
    // Le 1er septembre 2026 est un mardi.
    expect(premiereOccurrence("2026-09-01", 2)).toBe("2026-09-01");
    expect(premiereOccurrence("2026-09-01", 3)).toBe("2026-09-02");
    expect(premiereOccurrence("2026-09-01", 1)).toBe("2026-09-07");
  });
  it("produit un premier créneau en heure de Paris et une récurrence hebdomadaire jusqu'à la fin", () => {
    const d = voeuVersDemande(
      { weekday: 4, startMin: 18 * 60, endMin: 20 * 60, horsVacances: true },
      { debut: "2026-09-01", fin: "2027-06-30" },
    );
    const w = toParisWall(d.premier.startAt);
    expect([w.y, w.mo, w.da, w.min]).toEqual([2026, 9, 3, 18 * 60]);
    expect(toParisWall(d.premier.endAt).min).toBe(20 * 60);
    expect(d.recurrence).toEqual({
      freq: "weekly",
      interval: 1,
      byWeekday: [4],
      until: "2027-06-30",
      horsVacances: true,
      horsFeries: true,
    });
  });
});

describe("statuts et bilan", () => {
  it("lit un statut connu et refuse le reste", () => {
    expect(lireStatutCampagne("ouverte")).toBe("ouverte");
    expect(lireStatutCampagne("x")).toBeNull();
    expect(TRANSITIONS_CAMPAGNE.brouillon).toEqual(["ouverte"]);
  });
  it("phrase le bilan", () => {
    expect(phraseBilanArbitrage({ attribues: 2, refuses: 1, erreurs: 0 })).toBe(
      "Arbitrage terminé : 2 vœux attribués, 1 refusé.",
    );
    expect(phraseBilanArbitrage({ attribues: 1, refuses: 0, erreurs: 1 })).toContain(
      "1 laissé en attente",
    );
  });
});
