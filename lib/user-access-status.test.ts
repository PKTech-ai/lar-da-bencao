import { describe, expect, it } from "vitest";
import { accessState, lastAccessText, latestAccess, needsAttention } from "@/lib/user-access-status";

const base = { status: "active", access_allowed: true, must_reset_password: false, last_access: null as string | null };

describe("Situação do acesso na lista de Usuários", () => {
  it("diz se a pessoa nunca entrou ou quando foi o último acesso, no horário de Brasília", () => {
    expect(lastAccessText(null)).toBe("Nunca entrou");
    expect(lastAccessText("data ruim")).toBe("Nunca entrou");
    expect(lastAccessText("2026-11-07T15:00:00Z")).toBe("Último acesso em 07/11/2026");
    // 01h30 em UTC ainda é o dia anterior em Brasília.
    expect(lastAccessText("2026-11-08T01:30:00Z")).toBe("Último acesso em 07/11/2026");
  });

  it("mostra se o acesso está liberado", () => {
    expect(accessState(base)).toEqual({ label: "Acesso liberado", tone: "ready" });
    // Primeiro acesso: a senha inicial é o CPF e a troca já é obrigatória, mas a pessoa pode entrar.
    expect(accessState({ ...base, must_reset_password: true })).toEqual({ label: "Acesso liberado", tone: "ready" });
    expect(accessState({ ...base, must_reset_password: true, last_access: "2026-11-01T12:00:00Z" }).label).toBe("Aguardando nova senha");
    expect(accessState({ ...base, status: "suspended" }).label).toBe("Suspenso");
    expect(accessState({ ...base, status: "pending" }).label).toBe("Pendente");
    expect(accessState({ ...base, access_allowed: false }).label).toBe("Fora do biênio");
  });

  it("põe no alto só quem não consegue entrar", () => {
    expect(needsAttention(base)).toBe(false);
    expect(needsAttention({ ...base, must_reset_password: true })).toBe(false);
    expect(needsAttention({ ...base, status: "suspended" })).toBe(true);
    expect(needsAttention({ ...base, status: "pending" })).toBe(true);
    expect(needsAttention({ ...base, access_allowed: false })).toBe(true);
  });

  it("usa o acesso mais recente entre o provedor e o Dedo-duro", () => {
    expect(latestAccess(null, undefined)).toBeNull();
    expect(latestAccess("2026-11-01T10:00:00Z", new Date("2026-11-03T10:00:00Z"))).toBe("2026-11-03T10:00:00.000Z");
    expect(latestAccess("2026-11-05T10:00:00Z", null)).toBe("2026-11-05T10:00:00.000Z");
  });
});
