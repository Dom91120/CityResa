import { describe, expect, it } from "vitest";
import { emplacementAscii } from "@/lib/url";

describe("emplacementAscii", () => {
  it("encode les accents et les espaces en UTF-8 sans toucher au reste", () => {
    expect(emplacementAscii("/portail/reserver/x?date=2026-12-12&title=Entraînement d'été")).toBe(
      "/portail/reserver/x?date=2026-12-12&title=Entra%C3%AEnement%20d'%C3%A9t%C3%A9",
    );
  });

  it("laisse intact un chemin déjà encodé", () => {
    const deja = "/connexion?next=%2Fportail%2Freserver%3Ftitle%3DEntra%C3%AEnement";
    expect(emplacementAscii(deja)).toBe(deja);
    expect(emplacementAscii("/reservations/12#documents")).toBe("/reservations/12#documents");
  });
});
