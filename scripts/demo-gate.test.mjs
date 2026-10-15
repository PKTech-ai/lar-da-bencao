import { describe, expect, it } from "vitest";
import { applyDemoGate } from "./demo-gate.mjs";

describe("porta de demonstração do HTML", () => {
  it("abre na tela de login, com a logo nova, e só revela o app depois", () => {
    const html = applyDemoGate('<html><head></head><body>\n<div class="app"></div></body></html>');
    expect(html).toContain("usuario@email.com.br");
    expect(html).toContain('type="password"');
    expect(html).toContain('value="*********"');
    expect(html).toContain("/marca-lar-da-bencao.png");
    expect(html).toContain("Acesso institucional");
    expect(html).not.toContain("Esqueci minha senha");
    expect(html.indexOf('id="demo-gate"')).toBeLessThan(html.indexOf('class="app"'));
    expect(html.indexOf('id="demo-gate-ready"')).toBeGreaterThan(html.indexOf('class="app"'));
  });
});
