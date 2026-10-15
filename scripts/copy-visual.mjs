import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { applyDemoGate } from "./demo-gate.mjs";

mkdirSync("public", { recursive: true });
const html = applyDemoGate(readFileSync("dist/index.html", "utf8"));
writeFileSync("public/visual-v215.html", html);
