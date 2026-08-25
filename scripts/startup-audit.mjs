import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const url = process.env.BATTLE_BALL_AUDIT_URL || "https://battle-ball.yzgame.chatgpt.site/";
const out = "artifacts/startup-audit";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-webgl", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const badResponses = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? "unknown" }));
page.on("response", (response) => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });

let gotoError = null;
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2500);
} catch (error) {
  gotoError = String(error);
}
await page.screenshot({ path: `${out}/startup.png`, fullPage: true });

const diagnostics = await page.evaluate(() => {
  const app = document.querySelector("#app");
  const start = document.querySelector("#start-button");
  const canvas = document.querySelector("#game-canvas");
  const scripts = [...document.scripts].map((script) => script.src).filter(Boolean);
  const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href);
  const bodyStyle = getComputedStyle(document.body);
  const appStyle = app ? getComputedStyle(app) : null;
  return {
    title: document.title,
    readyState: document.readyState,
    bodyText: document.body.innerText.slice(0, 1000),
    bodyHtmlLength: document.body.innerHTML.length,
    appHtmlLength: app?.innerHTML.length ?? 0,
    startExists: Boolean(start),
    startVisible: start ? Boolean(start.getBoundingClientRect().width && start.getBoundingClientRect().height) : false,
    canvasExists: Boolean(canvas),
    bodyBackground: bodyStyle.backgroundColor,
    bodyDisplay: bodyStyle.display,
    appDisplay: appStyle?.display ?? null,
    appVisibility: appStyle?.visibility ?? null,
    scripts,
    styles,
    serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
  };
});

const result = { url: page.url(), gotoError, consoleErrors, pageErrors, failedRequests, badResponses, diagnostics };
await writeFile(`${out}/diagnostics.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();

if (gotoError || pageErrors.length || failedRequests.length || badResponses.length || !diagnostics.startExists || !diagnostics.startVisible) {
  process.exitCode = 1;
}
