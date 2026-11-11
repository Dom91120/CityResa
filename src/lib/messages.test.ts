import { describe, expect, it } from "vitest";
import { attendReponse, compteDansLeFil, libelleARepondre } from "@/lib/messages";

const m = (authorKind: string, minute: number, isInternal = false) => ({
  authorKind,
  isInternal,
  createdAt: new Date(Date.UTC(2026, 10, 8, 10, minute)),
});

describe("conversation en attente de réponse", () => {
  it("attend une réponse quand l'usager a écrit en dernier, même si le message a été lu", () => {
    expect(attendReponse([m("agent", 1), m("usager", 2)])).toBe(true);
    expect(attendReponse([m("usager", 1)])).toBe(true);
  });

  it("n'attend plus quand un agent a répondu à l'usager", () => {
    expect(attendReponse([m("usager", 1), m("agent", 2)])).toBe(false);
    expect(attendReponse([m("agent", 1)])).toBe(false);
    expect(attendReponse([])).toBe(false);
  });

  it("ignore les notes internes et les messages automatiques, quel que soit l'ordre", () => {
    expect(attendReponse([m("agent", 3, true), m("usager", 2), m("systeme", 4)])).toBe(true);
    expect(attendReponse([m("agent", 5), m("usager", 2)])).toBe(false);
    expect(compteDansLeFil({ authorKind: "systeme", isInternal: false })).toBe(false);
    expect(compteDansLeFil({ authorKind: "agent", isInternal: true })).toBe(false);
  });

  it("libelle le nombre de conversations à répondre", () => {
    expect(libelleARepondre(0)).toBe("");
    expect(libelleARepondre(1)).toBe("1 conversation à répondre");
    expect(libelleARepondre(3)).toBe("3 conversations à répondre");
  });
});
