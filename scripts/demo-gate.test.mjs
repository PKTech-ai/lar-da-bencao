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
    expect(html).toContain("position:fixed!important");
    expect(html).toContain("gate.remove()");
    expect(html).toContain("Já escalado em:");
    expect(html).toContain("demo-conflict-pointer");
    expect(html).toContain("lar-data-refreshed");
    expect(html).toContain("current.a[sel.dataset.k]=sel.value");
    expect(html).not.toContain("Esqueci minha senha");
    expect(html.indexOf('id="demo-gate"')).toBeLessThan(html.indexOf('class="app"'));
    expect(html.indexOf('id="demo-gate-ready"')).toBeGreaterThan(html.indexOf('class="app"'));
  });
});
