import { describe, expect, it } from "vitest";
import { oneDriveFileUrl, oneDriveLinks } from "@/lib/onedrive";

const share = "https://1drv.ms/f/c/exemplo/PastaDeTeste?e=abc";

describe("links do OneDrive para os estudos ESE", () => {
  it("abre o arquivo pela pasta compartilhada, com o nome exato (inclusive espaços duplos)", () => {
    const url = new URL(oneDriveFileUrl(share, "ESE - ROTEIROS/Roteiro 001 - Capítulo II -  Meu reino.pdf"));
    expect(url.origin).toBe("https://onedrive.live.com");
    expect(Buffer.from(url.searchParams.get("redeem")!, "base64url").toString()).toBe(share);
    expect(url.searchParams.get("id")).toMatch(/\/ESE\/ESE - ROTEIROS\/Roteiro 001 - Capítulo II - {2}Meu reino\.pdf$/);
    expect(url.searchParams.get("parent")).toMatch(/\/ESE\/ESE - ROTEIROS$/);
  });

  it("sem o compartilhamento configurado, ou sem arquivos, não mostra links", () => {
    expect(oneDriveLinks({ roteiro: "ESE - ROTEIROS/a.pdf" }, undefined)).toBeNull();
    expect(oneDriveLinks(null, share)).toBeNull();
    const links = oneDriveLinks({ roteiro: "ESE - ROTEIROS/a.pdf", perguntas: "../fora.docx", texto: 3 }, share);
    expect(Object.keys(links!)).toEqual(["roteiro"]);
  });
});
