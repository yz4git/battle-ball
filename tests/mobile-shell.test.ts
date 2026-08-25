import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const mainTs = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

test("iPhone controls use the same pointer-owned model as the stable games", () => {
  assert.match(indexHtml, /maximum-scale=1/);
  assert.match(indexHtml, /user-scalable=no/);
  assert.match(mainTs, /button:\$\{action\}:\$\{event\.pointerId\}/);
  assert.match(mainTs, /pad:\$\{event\.pointerId\}/);
  assert.match(mainTs, /lostpointercapture/);
  assert.doesNotMatch(mainTs, /gesturestart/);
  assert.doesNotMatch(mainTs, /lastTouchEndAt/);
  assert.match(mainTs, /updateViaCache: "none"/);
  assert.match(styles, /touch-action:\s*none/);
});

test("startup can recover instead of leaving a blank page", () => {
  assert.match(indexHtml, /id="boot-fallback"/);
  assert.match(indexHtml, /LOADING ARENA/);
  assert.match(indexHtml, /CLEAR CACHE &amp; RETRY/);
  assert.match(indexHtml, /navigator\.serviceWorker\.getRegistrations/);
  assert.match(indexHtml, /battle-ball-boot-recovered-v7/);
  assert.match(indexHtml, /window\.setTimeout\(showFailure, 5000\)/);
});

test("service worker cannot serve stale runtime assets", () => {
  assert.match(serviceWorker, /v7-startup-safe/);
  assert.doesNotMatch(serviceWorker, /addEventListener\("fetch"/);
  assert.match(serviceWorker, /caches\.delete/);
});
