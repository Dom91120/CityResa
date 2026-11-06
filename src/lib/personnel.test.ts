import { describe, expect, it } from "vitest";
import { parisDateTimeToInstant } from "@/lib/paris-time";
import {
  type CreneauACouvrir,
  chevauchementsPersonne,
  couverture,
  creneauxNonCouverts,
  developperVacations,
  etatsCouverture,
  evtsVacations,
  nomFichierPlanningPersonnel,
  nomPersonne,
  resumeCouverture,
  resumeSemainePersonne,
  type VacationRef,
} from "@/lib/personnel";

const t = (ymd: string, hm: string) => parisDateTimeToInstant(ymd, hm) as Date;

const vac = (
  id: number,
  personnelId: number,
  siteId: number,
  ymd: string,
  de: string,
  a: string,
): VacationRef => ({ id, personnelId, siteId, startAt: t(ymd, de), endAt: t(ymd, a) });

const cren = (
  id: number,
  siteId: number,
  ymd: string,
  de: string,
  a: string,
  personnelId: number | null = null,
): CreneauACouvrir => ({
  id,
  reservationId: 100 + id,
  numero: `R-${id}`,
  titre: `Créneau ${id}`,
  espaceId: 10,
  espaceNom: "Salle A",
  siteId,
  siteNom: siteId === 1 ? "Gymnase" : "Centre",
  startAt: t(ymd, de),
  endAt: t(ymd, a),
  personnelId,
});

describe("couverture d'un créneau", () => {
  const vacations = [
    vac(1, 7, 1, "2026-11-09", "17:00", "23:00"),
    vac(2, 8, 1, "2026-11-10", "08:00", "12:00"),
    vac(3, 8, 1, "2026-11-10", "12:00", "14:00"),
    vac(4, 9, 2, "2026-11-09", "17:00", "23:00"),
  ];

  it("est couvert quand une vacation du site englobe le créneau", () => {
    const c = couverture(cren(1, 1, "2026-11-09", "18:00", "20:00"), vacations);
    expect(c).toEqual({ etat: "couvert", personnelIds: [7], epingle: false });
  });

  it("est couvert par deux vacations mises bout à bout", () => {
    const c = couverture(cren(2, 1, "2026-11-10", "10:00", "13:30"), vacations);
    expect(c.etat).toBe("couvert");
    expect(c.personnelIds).toEqual([8]);
  });

  it("est partiel quand une vacation le touche sans tout couvrir", () => {
    const c = couverture(cren(3, 1, "2026-11-10", "13:00", "16:00"), vacations);
    expect(c.etat).toBe("partiel");
    expect(c.personnelIds).toEqual([8]);
  });

  it("ignore les vacations d'un autre site", () => {
    const c = couverture(cren(4, 2, "2026-11-09", "18:00", "20:00"), vacations);
    expect(c).toEqual({ etat: "couvert", personnelIds: [9], epingle: false });
    expect(couverture(cren(5, 2, "2026-11-10", "09:00", "10:00"), vacations).etat).toBe(
      "non_couvert",
    );
  });

  it("une personne épinglée couvre toujours, et passe en tête", () => {
    const c = couverture(cren(6, 1, "2026-11-10", "13:00", "16:00", 5), vacations);
    expect(c).toEqual({ etat: "couvert", personnelIds: [5, 8], epingle: true });
  });

  it("compte les états et isole ce qui reste à couvrir", () => {
    const etats = etatsCouverture(
      [
        cren(1, 1, "2026-11-09", "18:00", "20:00"),
        cren(3, 1, "2026-11-10", "13:00", "16:00"),
        cren(5, 2, "2026-11-10", "09:00", "10:00"),
      ],
      vacations,
    );
    expect(resumeCouverture(etats)).toEqual({ total: 3, couvert: 1, partiel: 1, non_couvert: 1 });
    expect(creneauxNonCouverts(etats).map((e) => e.creneau.id)).toEqual([3, 5]);
  });
});

describe("chevauchements d'une même personne", () => {
  it("refuse 12h-14h contre 10h-13h, accepte 12h-14h contre 10h-12h", () => {
    const existantes = [vac(1, 7, 1, "2026-11-09", "10:00", "13:00")];
    expect(
      chevauchementsPersonne(
        [{ startAt: t("2026-11-09", "12:00"), endAt: t("2026-11-09", "14:00") }],
        existantes,
      ),
    ).toHaveLength(1);
    expect(
      chevauchementsPersonne(
        [{ startAt: t("2026-11-09", "13:00"), endAt: t("2026-11-09", "14:00") }],
        existantes,
      ),
    ).toHaveLength(0);
  });
});

describe("répétition hebdomadaire", () => {
  it("développe chaque semaine jusqu'à la date incluse, en sautant les jours exclus", () => {
    const out = developperVacations(
      { startAt: t("2026-11-09", "17:00"), endAt: t("2026-11-09", "23:00") },
      { until: "2026-11-30" },
      ["2026-11-23"],
    );
    expect(out.map((i) => i.startAt.toISOString())).toEqual([
      t("2026-11-09", "17:00").toISOString(),
      t("2026-11-16", "17:00").toISOString(),
      t("2026-11-30", "17:00").toISOString(),
    ]);
  });

  it("sans répétition, ne renvoie que la vacation", () => {
    expect(
      developperVacations(
        { startAt: t("2026-11-09", "17:00"), endAt: t("2026-11-09", "23:00") },
        null,
      ),
    ).toHaveLength(1);
  });
});

describe("éditions", () => {
  const jours = [
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
    "2026-11-15",
  ];
  const personne = { id: 7, firstName: "Ali", lastName: "Keita", fonction: "Gardien" };

  it("projette les vacations et hachure ce qui reste à couvrir", () => {
    const evts = evtsVacations(
      [{ ...vac(1, 7, 1, "2026-11-09", "17:00", "23:00"), personne }],
      etatsCouverture([cren(5, 1, "2026-11-10", "09:00", "10:00")], []),
      jours,
    );
    expect(evts.map((e) => [e.jour, e.titre, e.sousTitre, e.genre, e.espaceId])).toEqual([
      [1, "Ali Keita", "Gardien", "reservation", 1],
      [2, "À couvrir · Créneau 5", "Salle A", "blocage", 1],
    ]);
  });

  it("résume la semaine d'une personne", () => {
    expect(
      resumeSemainePersonne(
        [
          { ...vac(1, 7, 1, "2026-11-09", "17:00", "23:00"), siteNom: "Gymnase", note: "clés" },
          { ...vac(2, 7, 2, "2026-11-11", "08:00", "12:00"), siteNom: "Centre" },
        ],
        jours,
        ["Lun. 9", "Mar. 10", "Mer. 11", "Jeu. 12", "Ven. 13", "Sam. 14", "Dim. 15"],
      ),
    ).toBe("– Lun. 9 17:00–23:00 · Gymnase (clés)\n– Mer. 11 08:00–12:00 · Centre");
    expect(resumeSemainePersonne([], jours)).toBe("Aucune vacation cette semaine.");
    expect(nomPersonne(personne)).toBe("Ali Keita");
    expect(nomFichierPlanningPersonnel("2026-11-09")).toBe("planning-service-2026-11-09.pdf");
  });
});
