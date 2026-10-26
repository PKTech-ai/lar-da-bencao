import { describe, expect, it } from "vitest";
import { formatPersonName } from "@/lib/person-name";

describe("padrão de escrita de nomes", () => {
  it("inicial maiúscula em cada palavra e preposições em minúsculas", () => {
    expect(formatPersonName("MARIA DA SILVA")).toBe("Maria da Silva");
    expect(formatPersonName("marinaldo escorcio do nascimento")).toBe("Marinaldo Escorcio do Nascimento");
    expect(formatPersonName("ANTONIO Bartolomeu Rodrigues da Silva")).toBe("Antonio Bartolomeu Rodrigues da Silva");
    expect(formatPersonName("Cecília socorro de oliveira costa")).toBe("Cecília Socorro de Oliveira Costa");
    expect(formatPersonName("LUCIVÂNIA de Sena Ferreira dos Santos")).toBe("Lucivânia de Sena Ferreira dos Santos");
    expect(formatPersonName("Azamor dos Santos Filho")).toBe("Azamor dos Santos Filho");
  });

  it("mantém iniciais, romanos, hífen e apóstrofo", () => {
    expect(formatPersonName("ANA CLAUDIA M SILVA")).toBe("Ana Claudia M Silva");
    expect(formatPersonName("EDIMARA O. GOMES")).toBe("Edimara O. Gomes");
    expect(formatPersonName("pedro ii de alcântara")).toBe("Pedro II de Alcântara");
    expect(formatPersonName("ana-luíza d'ávila")).toBe("Ana-Luíza D'Ávila");
  });

  it("limpa espaços e não muda o que já está no padrão", () => {
    expect(formatPersonName("  Maria   do  Socorro ")).toBe("Maria do Socorro");
    expect(formatPersonName("Washington Barbosa")).toBe("Washington Barbosa");
    expect(formatPersonName("E Silva")).toBe("E Silva");
  });
});
