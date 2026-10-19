import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { AppError, errorResponse, failureMessage, plainFailure } from "./errors";

describe("falha visível", () => {
  it("mostra a frase do AppError e descarta protocolo e suporte", () => {
    expect(plainFailure("Não foi possível concluir a operação. Informe ao suporte o protocolo F374D9E9.")).toBe("Não foi possível concluir a operação.");
    expect(failureMessage(new AppError("Preencha o CPF na ficha antes de aprovar.", 409, "CPF_REQUIRED"))).toBe("Preencha o CPF na ficha antes de aprovar.");
  });

  it("diz quando o banco recusou a conexão", () => {
    const error = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:54322"), { code: "ECONNREFUSED", address: "127.0.0.1", port: 54322 });
    expect(failureMessage(error)).toBe("O banco de dados recusou a conexão em 127.0.0.1:54322.");
  });

  it("não devolve protocolo na resposta", async () => {
    const response = errorResponse(new ZodError([{ code: "custom", message: "Informe um CPF válido.", path: ["cpf"] }]));
    const body = await response.json() as { error: string; protocol?: string };
    expect(response.status).toBe(400);
    expect(body.error).toBe("Informe um CPF válido.");
    expect(body.protocol).toBeUndefined();
  });
});
