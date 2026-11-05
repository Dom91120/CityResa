import { describe, expect, it } from "vitest";
import { parisDateTimeToInstant } from "@/lib/paris-time";
import {
  destinataires,
  estJourEnvoi,
  lundiAEditer,
  nomFichierPlanning,
  resumeSemaine,
} from "@/lib/planning-hebdo";

const a = (ymd: string, hm = "06:30") => parisDateTimeToInstant(ymd, hm) as Date;

describe("jour d'envoi et semaine éditée", () => {
  it("reconnaît le jour configuré en heure de Paris", () => {
    expect(estJourEnvoi(1, a("2026-11-09"))).toBe(true); // lundi
    expect(estJourEnvoi(1, a("2026-11-10"))).toBe(false);
    expect(estJourEnvoi(7, a("2026-11-08"))).toBe(true); // dimanche
  });

  it("édite la semaine en cours en début de semaine, la suivante en fin de semaine", () => {
    expect(lundiAEditer(a("2026-11-09"))).toBe("2026-11-09");
    expect(lundiAEditer(a("2026-11-12"))).toBe("2026-11-09"); // jeudi
    expect(lundiAEditer(a("2026-11-13"))).toBe("2026-11-16"); // vendredi
    expect(lundiAEditer(a("2026-11-15"))).toBe("2026-11-16"); // dimanche
    expect(nomFichierPlanning("2026-11-16")).toBe("planning-semaine-2026-11-16.pdf");
  });
});

describe("destinataires", () => {
  const agents = [
    { id: "a", email: "b@x.fr", firstName: "B", isActive: true, notifEmail: true },
    { id: "b", email: "a@x.fr", firstName: "A", isActive: true, notifEmail: true },
    { id: "c", email: "c@x.fr", firstName: "C", isActive: true, notifEmail: false },
    { id: "d", email: "d@x.fr", firstName: "D", isActive: false, notifEmail: true },
  ];
  const espaces = [
    { id: 1, name: "Salle B", site: "Mairie", isActive: true },
    { id: 2, name: "Salle A", site: "Mairie", isActive: true },
    { id: 3, name: "Gymnase", site: "Sablons", isActive: false },
  ];

  it("garde les gestionnaires et notifiés actifs qui acceptent les courriels, espaces actifs triés", () => {
    const d = destinataires(
      [
        { userId: "a", espaceId: 1, role: "gestionnaire" },
        { userId: "a", espaceId: 2, role: "notifie" },
        { userId: "a", espaceId: 3, role: "gestionnaire" },
        { userId: "a", espaceId: 1, role: "notifie" },
        { userId: "b", espaceId: 2, role: "lecteur" },
        { userId: "b", espaceId: 1, role: "gestionnaire" },
        { userId: "c", espaceId: 1, role: "gestionnaire" },
        { userId: "d", espaceId: 1, role: "gestionnaire" },
        { userId: "zz", espaceId: 1, role: "gestionnaire" },
      ],
      agents,
      espaces,
    );
    expect(d.map((x) => [x.agent.email, x.espaces.map((e) => e.name)])).toEqual([
      ["a@x.fr", ["Salle B"]],
      ["b@x.fr", ["Salle A", "Salle B"]],
    ]);
  });
});

describe("résumé", () => {
  it("liste par espace les créneaux de la semaine, fermetures comprises", () => {
    const espaces = [
      { id: 1, name: "Salle A", site: "Mairie", isActive: true },
      { id: 2, name: "Salle B", site: "Mairie", isActive: true },
    ];
    const jours = ["Lun. 16 nov.", "Mar. 17 nov.", "Mer. 18 nov.", "Jeu.", "Ven.", "Sam.", "Dim."];
    const texte = resumeSemaine(
      espaces,
      [
        {
          jour: 3,
          debutMin: 600,
          finMin: 720,
          titre: "AG",
          sousTitre: "Club",
          genre: "reservation",
          espaceId: 1,
        },
        {
          jour: 1,
          debutMin: 1080,
          finMin: 1200,
          titre: "Cours",
          sousTitre: "",
          genre: "reservation",
          espaceId: 1,
        },
        {
          jour: 2,
          debutMin: 0,
          finMin: 1440,
          titre: "Travaux",
          sousTitre: "",
          genre: "blocage",
          espaceId: 1,
        },
      ],
      jours,
    );
    expect(texte).toBe(
      [
        "Salle A (Mairie) : 2 créneaux",
        "  – Lun. 16 nov. 18:00–20:00 · Cours",
        "  – Mar. 17 nov. 00:00–24:00 · fermé : Travaux",
        "  – Mer. 18 nov. 10:00–12:00 · AG (Club)",
        "",
        "Salle B (Mairie) : aucun créneau",
      ].join("\n"),
    );
  });
});
