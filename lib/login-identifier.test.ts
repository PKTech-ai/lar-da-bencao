import { describe, expect, it } from "vitest";
import { loginIdentifier } from "./login-identifier";

describe("loginIdentifier", () => {
  it("aceita só CPF", () => {
    expect(loginIdentifier("529.982.247-25")).toEqual({ kind: "cpf", cpf: "52998224725" });
    expect(loginIdentifier("usuario@lar.org")).toEqual({ kind: "invalid" });
    expect(loginIdentifier("123")).toEqual({ kind: "invalid" });
  });
});
