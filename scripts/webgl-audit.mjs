import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BATTLE_BALL_AUDIT_URL || "https://battle-ball.yzgame.chatgpt.site/";
const outputDir = process.env.BATTLE_BALL_AUDIT_DIR || "artifacts/webgl-audit";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--disable-dev-shm-usage",
  ],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(String(error)));

await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
await page.screenshot({ path: `${outputDir}/00-startup.png`, fullPage: true });

const start = page.getByRole("button", { name: /ENTER ARENA/i });
await start.waitFor({ state: "visible", timeout: 15_000 });
await start.click();

const canvas = page.locator("#game-canvas");
await canvas.waitFor({ state: "visible", timeout: 15_000 });
await page.waitForTimeout(900);

const webgl = await canvas.evaluate((element) => {
  const target = element;
  const gl = target.getContext("webgl2") || target.getContext("webgl") || target.getContext("experimental-webgl");
  if (!gl) return { ok: false, width: target.width, height: target.height };
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    ok: true,
    width: target.width,
    height: target.height,
    clientWidth: target.clientWidth,
    clientHeight: target.clientHeight,
    vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
  };
});
if (!webgl.ok) throw new Error(`WebGL context was not created: ${JSON.stringify(webgl)}`);

await page.screenshot({ path: `${outputDir}/01-webgl-gameplay.png`, fullPage: true });
await canvas.screenshot({ path: `${outputDir}/01-webgl-canvas.png` });

const throwButton = page.getByRole("button", { name: /THROW J/i });
await throwButton.click();
await page.waitForTimeout(260);
await page.screenshot({ path: `${outputDir}/02-webgl-throw.png`, fullPage: true });

const pauseButton = page.getByRole("button", { name: "Pause match" });
await pauseButton.click();
await page.getByRole("button", { name: /RESUME/i }).waitFor({ state: "visible", timeout: 5_000 });
await page.screenshot({ path: `${outputDir}/03-webgl-pause.png`, fullPage: true });

const diagnostics = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  canvas: (() => {
    const element = document.querySelector("#game-canvas");
    return element ? { width: element.width, height: element.height, clientWidth: element.clientWidth, clientHeight: element.clientHeight } : null;
  })(),
  clock: document.querySelector("#match-clock")?.textContent ?? null,
  matchLabel: document.querySelector("#match-label")?.textContent ?? null,
  startHidden: document.querySelector("#start-screen")?.hasAttribute("hidden") ?? false,
  pauseVisible: !document.querySelector("#pause-screen")?.hasAttribute("hidden"),
  blueAlive: document.querySelector("#blue-alive")?.textContent ?? null,
  redAlive: document.querySelector("#red-alive")?.textContent ?? null,
  consoleErrors,
  pageErrors,
}));
await writeFile(`${outputDir}/diagnostics.json`, JSON.stringify({ capturedAt: new Date().toISOString(), webgl, diagnostics }, null, 2));
if (pageErrors.length) throw new Error(`Page errors during WebGL audit: ${pageErrors.join(" | ")}`);
await browser.close();
