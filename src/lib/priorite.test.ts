import { describe, expect, it } from "vitest";
import { parisDateTimeToInstant } from "@/lib/paris-time";
import {
  decoderAlternative,
  dernierPrevu,
  encoderAlternative,
  lienSaisieVille,
  lireChoixRequisition,
  motifRequisition,
  obstacleRequisition,
  phraseBilan,
  phraseSuite,
} from "@/lib/priorite";

const now = parisDateTimeToInstant("2026-11-05", "10:00") as Date;
const cr = (ymd: string, de: string, a: string) => ({
  startAt: parisDateTimeToInstant(ymd, de) as Date,
  endAt: parisDateTimeToInstant(ymd, a) as Date,
});
const c = cr("2026-12-05", "10:00", "12:00");

describe("obstacleRequisition", () => {
  it("n'admet qu'un créneau prévu, à venir, d'un dossier acquis", () => {
    expect(obstacleRequisition({ status: "confirmee" }, { status: "prevu", ...c }, now)).toBeNull();
    expect(obstacleRequisition({ status: "a_traiter" }, { status: "prevu", ...c }, now)).toContain(
      "accepté, signé ou confirmé",
    );
    expect(obstacleRequisition({ status: "signee" }, { status: "annule", ...c }, now)).toContain(
      "déjà annulé",
    );
    expect(
      obstacleRequisition(
        { status: "signee" },
        { status: "prevu", ...cr("2026-11-01", "10:00", "12:00") },
        now,
      ),
    ).toContain("passé");
  });

  it("repère le dernier créneau prévu", () => {
    const l = [
      { id: 1, status: "prevu" },
      { id: 2, status: "annule" },
    ];
    expect(dernierPrevu(l, 1)).toBe(true);
    expect(dernierPrevu([...l, { id: 3, status: "prevu" }], 1)).toBe(false);
  });
});

describe("choix", () => {
  it("encode et décode une alternative, fin après minuit comprise", () => {
    expect(encoderAlternative(c)).toBe("2026-12-05|10:00|12:00");
    expect(decoderAlternative("2026-12-05|10:00|12:00")).toEqual(c);
    const nuit = decoderAlternative("2026-12-05|22:00|01:00");
    expect(nuit?.endAt).toEqual(parisDateTimeToInstant("2026-12-06", "01:00"));
    expect(decoderAlternative("n'importe quoi")).toBeNull();
  });

  it("lit le mode, l'alternative cochée, sinon l'horaire saisi", () => {
    expect(lireChoixRequisition({ mode: "annuler", alternative: "", saisie: null })).toEqual({
      mode: "annuler",
    });
    expect(
      lireChoixRequisition({
        mode: "deplacer",
        alternative: "2026-12-05|10:00|12:00",
        saisie: null,
      }),
    ).toEqual({
      mode: "deplacer",
      nouveau: c,
    });
    expect(lireChoixRequisition({ mode: "deplacer", alternative: "", saisie: c })).toEqual({
      mode: "deplacer",
      nouveau: c,
    });
    expect(typeof lireChoixRequisition({ mode: "deplacer", alternative: "", saisie: null })).toBe(
      "string",
    );
    expect(typeof lireChoixRequisition({ mode: "", alternative: "", saisie: c })).toBe("string");
  });
});

describe("textes", () => {
  const nouveau = cr("2026-12-06", "10:00", "12:00");

  it("motif, suite et bilan selon le sort du créneau", () => {
    expect(motifRequisition("Téléthon", null)).toBe("Priorité municipale : Téléthon");
    expect(motifRequisition("Téléthon", "plateau TV")).toBe(
      "Priorité municipale : Téléthon (plateau TV)",
    );
    const dep = phraseSuite(
      c,
      { mode: "deplacer", nouveau },
      { dossierAnnule: false, avenant: true, montantChange: false },
    );
    expect(dep).toContain("déplacé au Dim. 06 déc. 2026");
    expect(dep).toContain("avenant");
    expect(
      phraseSuite(
        c,
        { mode: "annuler" },
        { dossierAnnule: true, avenant: false, montantChange: false },
      ),
    ).toContain("annulée sans aucun frais");
    expect(
      phraseSuite(
        c,
        { mode: "annuler" },
        { dossierAnnule: false, avenant: false, montantChange: true },
      ),
    ).toContain("autres créneaux du dossier sont maintenus");
    expect(phraseBilan(c, { mode: "annuler" }, { dossierAnnule: true, prevenu: true })).toBe(
      "Réservation annulée sans frais pour la Ville. L'usager est prévenu par courriel.",
    );
    expect(
      phraseBilan(c, { mode: "deplacer", nouveau }, { dossierAnnule: false, prevenu: false }),
    ).toContain("déplacé au");
  });

  it("le lien de saisie pour la Ville reprend l'espace, le créneau libéré et l'événement", () => {
    expect(lienSaisieVille(7, c, "Téléthon 2026")).toBe(
      "/reservations/nouvelle?espace=7&date=2026-12-05&heure_debut=10%3A00&heure_fin=12%3A00&title=T%C3%A9l%C3%A9thon+2026",
    );
  });
});
