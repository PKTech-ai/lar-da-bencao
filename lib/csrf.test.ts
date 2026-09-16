import { afterEach, describe, expect, it } from "vitest";
import { assertSameOrigin } from "@/lib/csrf";

const previousAppUrl = process.env.APP_URL;

afterEach(() => {
  if (previousAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = previousAppUrl;
});

describe("assertSameOrigin", () => {
  it("aceita a origem da própria aplicação", () => {
    const request = new Request("https://app.exemplo.org/api/users", { headers: { origin: "https://app.exemplo.org", "sec-fetch-site": "same-origin" } });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("bloqueia requisição cross-site", () => {
    const request = new Request("https://app.exemplo.org/api/users", { headers: { origin: "https://malicioso.test", "sec-fetch-site": "cross-site" } });
    expect(() => assertSameOrigin(request)).toThrow("Origem da requisição não permitida");
  });

  it("não aceita mutação sem cabeçalho Origin", () => {
    const request = new Request("https://app.exemplo.org/api/users");
    expect(() => assertSameOrigin(request)).toThrow("Origem da requisição não permitida");
  });
});
