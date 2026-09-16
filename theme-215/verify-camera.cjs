const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/marcel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`file:///${path.resolve(__dirname, "../dist/index.html").replaceAll("\\", "/")}`);
    await page.evaluate(() => {
      setAccessCurrentUser(1);
      go("infancia");
      document.querySelector('.evangelizando-new[data-evdept="Infância"]').click();
    });
    await page.locator("#evangelizandoModal.open").waitFor();

    const camera = page.locator("#evPhotoInput");
    assert.equal(await camera.getAttribute("accept"), "image/*");
    assert.equal(await camera.getAttribute("capture"), "environment");
    assert.equal(await page.locator('label[for="evPhotoInput"] svg').count(), 2);
    assert.match(await page.locator(".ev-camera-button").innerText(), /Tirar foto/);

    const output = path.resolve(__dirname, "../../tmp/visual-215");
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "mobile-camera-evangelizando.png") });

    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    await camera.setInputFiles({ name: "foto-camera.png", mimeType: "image/png", buffer: png });
    await page.locator("#evPhotoPreview img").waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.screenshot({ path: path.join(output, "mobile-camera-photo-selected.png") });
    console.log("Câmera do cadastro do evangelizando validada em 390x844.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
