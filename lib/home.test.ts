import { describe, expect, it } from "vitest";
import { institutionalMemory } from "@/lib/home";

describe("memória institucional", () => {
  it("conta a idade da Casa e o próximo aniversário", () => {
    expect(institutionalMemory("1966-01-10", "2026-09-17")).toEqual({
      foundedOn: "1966-01-10", age: 60, nextAnniversary: "2027-01-10", daysToAnniversary: 115
    });
  });

  it("no dia do aniversário, o próximo é no ano seguinte e a idade é a que a Casa completa hoje", () => {
    const memory = institutionalMemory("1966-01-10", "2026-01-10");
    expect(memory.nextAnniversary).toBe("2027-01-10");
    expect(memory.age).toBe(60);
    expect(memory.daysToAnniversary).toBe(365);
  });

  it("antes do aniversário, o próximo é no mesmo ano", () => {
    const memory = institutionalMemory("1966-01-10", "2026-01-05");
    expect(memory).toMatchObject({ nextAnniversary: "2026-01-10", age: 59, daysToAnniversary: 5 });
  });
});
