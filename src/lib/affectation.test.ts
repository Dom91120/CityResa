import { describe, expect, it } from "vitest";
import {
  type AbsenceRef,
  absencesDuJour,
  type CreneauAffectable,
  candidats,
  controleManuel,
  decisionAffectation,
  disponible,
  enContrat,
  fenetreSemaines,
  heuresAttendues,
  heuresDuCycle,
  horsAbsences,
  libellePlages,
  type OccupationRef,
  type PersonneAffectable,
  periodesTravaillees,
  soustraire,
  travaille,
} from "@/lib/affectation";
import { parisDateTimeToInstant } from "@/lib/paris-time";

const t = (ymd: string, hm: string) => parisDateTimeToInstant(ymd, hm) as Date;

const SOIRS = {
  "1": [["16:30", "23:30"]],
  "2": [["16:30", "23:30"]],
  "3": [["16:30", "23:30"]],
  "4": [["16:30", "23:30"]],
  "5": [["16:30", "23:30"]],
} as Record<string, [string, string][]>;

const JOURNEE_COUPEE = {
  "1": [
    ["08:00", "12:00"],
    ["13:30", "17:00"],
  ],
  "2": [
    ["08:00", "12:00"],
    ["13:30", "17:00"],
  ],
} as Record<string, [string, string][]>;

const personne = (
  id: number,
  nom: string,
  extra: Partial<PersonneAffectable> = {},
): PersonneAffectable => ({
  id,
  firstName: nom,
  lastName: "X",
  isActive: true,
  quotite: 100,
  heuresHebdo: null,
  contratDebut: null,
  contratFin: null,
  horaires: SOIRS,
  sites: [{ siteId: 1, principal: true }],
  ...extra,
});

const cren = (id: number, ymd: string, de: string, a: string, siteId = 1): CreneauAffectable => ({
  id,
  reservationId: 100 + id,
  siteId,
  startAt: t(ymd, de),
  endAt: t(ymd, a),
});

const vide = { absences: [], occupations: [] };

describe("temps de travail", () => {
  it("compte les heures du cycle et les heures attendues", () => {
    expect(heuresDuCycle(SOIRS)).toBe(35);
    expect(heuresDuCycle(JOURNEE_COUPEE)).toBe(15);
    expect(heuresDuCycle(null)).toBe(0);
    expect(heuresAttendues({ quotite: 80, heuresHebdo: null })).toBe(28);
    expect(heuresAttendues({ quotite: 80, heuresHebdo: 30 })).toBe(30);
  });

  it("sait si la personne est en poste sur l'intervalle", () => {
    expect(travaille(SOIRS, cren(1, "2026-11-09", "18:00", "22:00"))).toBe(true); // lundi
    expect(travaille(SOIRS, cren(1, "2026-11-09", "14:00", "18:00"))).toBe(false);
    expect(travaille(SOIRS, cren(1, "2026-11-14", "18:00", "22:00"))).toBe(false); // samedi
    expect(travaille(null, cren(1, "2026-11-14", "18:00", "22:00"))).toBe(true);
    expect(travaille(JOURNEE_COUPEE, cren(1, "2026-11-09", "11:00", "14:00"))).toBe(false);
  });

  it("respecte les dates de contrat", () => {
    const p = personne(1, "A", { contratDebut: "2026-11-10", contratFin: "2026-11-30" });
    expect(enContrat(p, cren(1, "2026-11-09", "18:00", "22:00"))).toBe(false);
    expect(enContrat(p, cren(1, "2026-11-10", "18:00", "22:00"))).toBe(true);
    expect(enContrat(p, cren(1, "2026-11-30", "18:00", "22:00"))).toBe(true);
    expect(enContrat(p, cren(1, "2026-12-01", "18:00", "22:00"))).toBe(false);
  });
});

describe("disponibilité", () => {
  const c = cren(1, "2026-11-09", "18:00", "22:00");

  it("accepte une personne rattachée, en contrat, en poste, présente et libre", () => {
    expect(disponible(personne(1, "A"), c, vide)).toEqual({ ok: true });
  });

  it("donne le motif de chaque refus, dans l'ordre", () => {
    expect(disponible(personne(1, "A", { isActive: false }), c, vide)).toEqual({
      ok: false,
      motif: "inactive",
    });
    expect(
      disponible(personne(1, "A", { sites: [{ siteId: 2, principal: true }] }), c, vide),
    ).toEqual({ ok: false, motif: "hors_site" });
    expect(disponible(personne(1, "A", { contratFin: "2026-11-01" }), c, vide)).toEqual({
      ok: false,
      motif: "hors_contrat",
    });
    expect(disponible(personne(1, "A", { horaires: JOURNEE_COUPEE }), c, vide)).toEqual({
      ok: false,
      motif: "hors_horaires",
    });
    const absences: AbsenceRef[] = [
      {
        id: 1,
        personnelId: 1,
        startAt: t("2026-11-09", "00:00"),
        endAt: t("2026-11-10", "00:00"),
        motif: "Congés",
      },
    ];
    expect(disponible(personne(1, "A"), c, { absences, occupations: [] })).toEqual({
      ok: false,
      motif: "absente",
    });
    const occupations: OccupationRef[] = [
      {
        personnelId: 1,
        siteId: 2,
        startAt: t("2026-11-09", "20:00"),
        endAt: t("2026-11-09", "23:00"),
      },
    ];
    expect(disponible(personne(1, "A"), c, { absences: [], occupations })).toEqual({
      ok: false,
      motif: "occupee",
    });
  });

  it("reste compatible avec une occupation sur le même site", () => {
    const occupations: OccupationRef[] = [
      {
        personnelId: 1,
        siteId: 1,
        startAt: t("2026-11-09", "20:00"),
        endAt: t("2026-11-09", "23:00"),
        creneauId: 9,
      },
    ];
    expect(disponible(personne(1, "A"), c, { absences: [], occupations })).toEqual({ ok: true });
  });
});

describe("candidats et décision", () => {
  const c = cren(1, "2026-11-09", "18:00", "22:00");
  const personnes = [
    personne(1, "Zoé", { sites: [{ siteId: 1, principal: false }] }),
    personne(2, "Ali", { sites: [{ siteId: 1, principal: true }] }),
    personne(3, "Bob", { sites: [{ siteId: 1, principal: true }] }),
    personne(4, "Nina", { sites: [{ siteId: 2, principal: true }] }),
  ];

  it("classe site principal, puis charge de la semaine, puis nom", () => {
    const occupations: OccupationRef[] = [
      // Ali a déjà 6 h cette semaine, Bob 0 : Bob passe devant.
      {
        personnelId: 2,
        siteId: 1,
        startAt: t("2026-11-10", "17:00"),
        endAt: t("2026-11-10", "23:00"),
        creneauId: 50,
      },
      // La semaine précédente ne compte pas.
      {
        personnelId: 3,
        siteId: 1,
        startAt: t("2026-11-03", "17:00"),
        endAt: t("2026-11-03", "23:00"),
        creneauId: 51,
      },
    ];
    const { retenus, ecartes } = candidats(c, personnes, { absences: [], occupations });
    expect(retenus.map((r) => [r.personne.firstName, r.principal, r.heuresSemaine])).toEqual([
      ["Bob", true, 0],
      ["Ali", true, 6],
      ["Zoé", false, 0],
    ]);
    expect(ecartes.map((e) => [e.personne.firstName, e.motif])).toEqual([["Nina", "hors_site"]]);
  });

  it("affecte sur un site automatique, propose sinon, rien sans candidat", () => {
    const { retenus } = candidats(c, personnes, vide);
    expect(decisionAffectation({ affectationAuto: true }, retenus)).toEqual({
      action: "affecter",
      personnelId: 2,
    });
    expect(decisionAffectation({ affectationAuto: false }, retenus)).toEqual({
      action: "proposer",
      personnelId: 2,
    });
    expect(decisionAffectation({ affectationAuto: true }, retenus, true).action).toBe("proposer");
    expect(decisionAffectation({ affectationAuto: true }, [])).toEqual({ action: "aucun" });
  });
});

describe("périodes travaillées d'un jour", () => {
  const absences: AbsenceRef[] = [
    {
      id: 1,
      personnelId: 1,
      startAt: t("2026-11-09", "10:00"),
      endAt: t("2026-11-09", "14:00"),
      motif: "RTT",
    },
    {
      id: 2,
      personnelId: 1,
      startAt: t("2026-11-10", "00:00"),
      endAt: t("2026-11-12", "00:00"),
      motif: "Congés",
    },
  ];
  const p = { id: 1, horaires: JOURNEE_COUPEE, contratDebut: null, contratFin: "2026-11-20" };

  it("soustrait les absences aux plages du cycle", () => {
    expect(periodesTravaillees(p, "2026-11-09", absences)).toEqual({
      etat: "travail",
      plages: [
        { debutMin: 8 * 60, finMin: 10 * 60 },
        { debutMin: 14 * 60, finMin: 17 * 60 },
      ],
    });
    expect(absencesDuJour(absences, 1, "2026-11-10")).toEqual([
      { debutMin: 0, finMin: 1440, motif: "Congés" },
    ]);
    expect(periodesTravaillees(p, "2026-11-10", absences)).toEqual({ etat: "travail", plages: [] });
    expect(periodesTravaillees(p, "2026-11-11", absences).etat).toBe("repos");
    expect(periodesTravaillees(p, "2026-11-21", absences).etat).toBe("hors_contrat");
    expect(periodesTravaillees({ ...p, horaires: null }, "2026-11-13", absences)).toEqual({
      etat: "libre",
      plages: [{ debutMin: 0, finMin: 1440 }],
    });
  });

  it("soustrait et libelle", () => {
    expect(soustraire([{ debutMin: 480, finMin: 1020 }], [{ debutMin: 720, finMin: 810 }])).toEqual(
      [
        { debutMin: 480, finMin: 720 },
        { debutMin: 810, finMin: 1020 },
      ],
    );
    expect(
      libellePlages([
        { debutMin: 480, finMin: 720 },
        { debutMin: 810, finMin: 1020 },
      ]),
    ).toBe("8h00 – 12h00 · 13h30 – 17h00");
  });
});

describe("fenêtre de la charge hebdomadaire", () => {
  it("s'élargit à la semaine entière du créneau, du lundi au lundi", () => {
    // Jeudi 12 novembre 2026, 18 h – 22 h.
    const f = fenetreSemaines(t("2026-11-12", "18:00"), t("2026-11-12", "22:00"));
    expect(f.startAt).toEqual(t("2026-11-09", "00:00"));
    expect(f.endAt).toEqual(t("2026-11-16", "00:00"));
  });

  it("couvre toutes les semaines d'un lot, sans déborder quand il finit un lundi à 0 h", () => {
    const f = fenetreSemaines(t("2026-11-11", "08:00"), t("2026-11-23", "00:00"));
    expect(f.startAt).toEqual(t("2026-11-09", "00:00"));
    expect(f.endAt).toEqual(t("2026-11-23", "00:00"));
  });
});

describe("affectation décidée à la main", () => {
  const c = cren(1, "2026-11-09", "18:00", "22:00");
  const absences: AbsenceRef[] = [
    {
      id: 1,
      personnelId: 1,
      startAt: t("2026-11-09", "00:00"),
      endAt: t("2026-11-10", "00:00"),
      motif: "Congés",
    },
  ];

  it("laisse passer une personne disponible", () => {
    expect(controleManuel(personne(1, "A"), c, vide)).toEqual({
      bloquant: null,
      avertissements: [],
    });
  });

  it("avertit sans bloquer hors du site ou des horaires de travail", () => {
    const p = personne(1, "A", {
      sites: [{ siteId: 2, principal: true }],
      horaires: JOURNEE_COUPEE,
    });
    expect(controleManuel(p, c, vide)).toEqual({
      bloquant: null,
      avertissements: ["hors_site", "hors_horaires"],
    });
  });

  it("bloque une personne absente, hors contrat, hors service ou déjà ailleurs", () => {
    expect(controleManuel(personne(1, "A"), c, { absences, occupations: [] }).bloquant).toBe(
      "absente",
    );
    expect(controleManuel(personne(1, "A", { contratFin: "2026-11-01" }), c, vide).bloquant).toBe(
      "hors_contrat",
    );
    expect(controleManuel(personne(1, "A", { isActive: false }), c, vide).bloquant).toBe(
      "inactive",
    );
    const occupations: OccupationRef[] = [
      {
        personnelId: 1,
        siteId: 2,
        startAt: t("2026-11-09", "20:00"),
        endAt: t("2026-11-09", "23:00"),
      },
    ];
    expect(controleManuel(personne(1, "A"), c, { absences: [], occupations }).bloquant).toBe(
      "occupee",
    );
  });

  it("garde l'avertissement à côté du motif bloquant", () => {
    const p = personne(1, "A", { sites: [{ siteId: 2, principal: true }] });
    expect(controleManuel(p, c, { absences, occupations: [] })).toEqual({
      bloquant: "absente",
      avertissements: ["hors_site"],
    });
  });
});

describe("vacations hors absences", () => {
  const vac = (personnelId: number, de: string, a: string) => ({
    id: personnelId,
    personnelId,
    startAt: t("2026-11-09", de),
    endAt: t("2026-11-09", a),
  });
  const abs = (personnelId: number, de: string, a: string): AbsenceRef => ({
    id: 1,
    personnelId,
    startAt: t("2026-11-09", de),
    endAt: t("2026-11-09", a),
    motif: null,
  });
  const plages = (xs: { startAt: Date; endAt: Date }[]) =>
    xs.map((x) => [x.startAt.getTime(), x.endAt.getTime()]);

  it("laisse intactes les vacations des autres et celles hors de l'absence", () => {
    const v = [vac(1, "08:00", "12:00"), vac(2, "14:00", "18:00")];
    expect(horsAbsences(v, [abs(1, "14:00", "18:00")])).toEqual(v);
  });

  it("supprime une vacation entièrement dans l'absence", () => {
    expect(horsAbsences([vac(1, "08:00", "12:00")], [abs(1, "07:00", "13:00")])).toEqual([]);
  });

  it("rogne une vacation à cheval et coupe en deux autour d'une absence au milieu", () => {
    expect(plages(horsAbsences([vac(1, "08:00", "12:00")], [abs(1, "10:00", "13:00")]))).toEqual([
      [t("2026-11-09", "08:00").getTime(), t("2026-11-09", "10:00").getTime()],
    ]);
    expect(plages(horsAbsences([vac(1, "08:00", "18:00")], [abs(1, "12:00", "14:00")]))).toEqual([
      [t("2026-11-09", "08:00").getTime(), t("2026-11-09", "12:00").getTime()],
      [t("2026-11-09", "14:00").getTime(), t("2026-11-09", "18:00").getTime()],
    ]);
  });
});
