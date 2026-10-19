import { describe, expect, it } from "vitest";
import { loginIdentifier } from "./login-identifier";

describe("loginIdentifier", () => {
  it("separa e-mail, CPF e valor inválido", () => {
    expect(loginIdentifier("usuario@lar.org")).toEqual({ kind: "email", email: "usuario@lar.org" });
    expect(loginIdentifier("529.982.247-25")).toEqual({ kind: "cpf", cpf: "52998224725" });
    expect(loginIdentifier("123")).toEqual({ kind: "invalid" });
  });
});
