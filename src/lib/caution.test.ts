import { describe, expect, it } from "vitest";
import {
  cautionEnRetard,
  decrireCaution,
  lireStatutCaution,
  obstacleCloture,
  retenueAValider,
  verifierRetenue,
} from "@/lib/caution";

describe("cycle de la caution", () => {
  it("lit un statut connu, « aucune » sinon", () => {
    expect(lireStatutCaution("encaissee")).toBe("encaissee");
    expect(lireStatutCaution("x")).toBe("aucune");
  });

  it("ne clôture qu'une caution encaissée après l'état des lieux de sortie", () => {
    expect(obstacleCloture({ cautionStatus: "aucune", caution: 0 }, true)).toContain(
      "pas de caution",
    );
    expect(obstacleCloture({ cautionStatus: "attendue", caution: 300 }, true)).toContain(
      "encaissée",
    );
    expect(obstacleCloture({ cautionStatus: "encaissee", caution: 300 }, false)).toContain(
      "état des lieux de sortie",
    );
    expect(obstacleCloture({ cautionStatus: "encaissee", caution: 300 }, true)).toBeNull();
    expect(obstacleCloture({ cautionStatus: "restituee", caution: 300 }, true)).toContain("déjà");
  });

  it("demande une seconde validation au-delà du seuil seulement", () => {
    expect(retenueAValider(600, 500)).toBe(true);
    expect(retenueAValider(500, 500)).toBe(false);
    expect(retenueAValider(900, 0)).toBe(false);
  });

  it("refuse une retenue sans montant, sans motif, au-delà de la caution ou sans constat", () => {
    const edl = { degats: true, observations: null, photos: 0 };
    expect(verifierRetenue(120, 300, "Sol rayé", edl)).toEqual([]);
    expect(verifierRetenue(0, 300, "Sol rayé", edl)).toContain("Indiquez le montant retenu.");
    expect(verifierRetenue(400, 300, "Sol rayé", edl)[0]).toContain("dépasser la caution");
    expect(verifierRetenue(120, 300, " ", edl)[0]).toContain("motif");
    expect(verifierRetenue(120, 300, "Sol rayé", null)[0]).toContain("état des lieux de sortie");
    expect(
      verifierRetenue(120, 300, "Sol rayé", { degats: false, observations: "", photos: 0 })[0],
    ).toContain("ne constate rien");
    expect(
      verifierRetenue(120, 300, "Sol rayé", { degats: false, observations: "", photos: 2 }),
    ).toEqual([]);
  });

  it("met en alerte une caution encaissée oubliée après le délai", () => {
    const fin = new Date("2026-10-01T22:00:00Z");
    expect(
      cautionEnRetard({ cautionStatus: "encaissee", endAt: fin }, new Date("2026-11-05"), 30),
    ).toBe(true);
    expect(
      cautionEnRetard({ cautionStatus: "encaissee", endAt: fin }, new Date("2026-10-20"), 30),
    ).toBe(false);
    expect(
      cautionEnRetard({ cautionStatus: "restituee", endAt: fin }, new Date("2026-12-05"), 30),
    ).toBe(false);
  });

  it("décrit la caution", () => {
    expect(decrireCaution({ caution: 0, cautionStatus: "aucune", cautionRetenue: 0 })).toBe(
      "Aucune caution",
    );
    expect(decrireCaution({ caution: 300, cautionStatus: "encaissee", cautionRetenue: 0 })).toBe(
      "Caution de 300 € encaissée",
    );
    expect(decrireCaution({ caution: 300, cautionStatus: "retenue", cautionRetenue: 120 })).toBe(
      "Caution de 300 € retenue à hauteur de 120 €",
    );
    expect(
      decrireCaution({ caution: 300, cautionStatus: "retenue_a_valider", cautionRetenue: 300 }),
    ).toBe("Caution de 300 € retenue en totalité (validation en attente)");
  });
});
