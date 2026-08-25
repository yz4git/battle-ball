import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const mainTs = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("iPhone viewport and native zoom gestures are locked for gameplay", () => {
  assert.match(indexHtml, /maximum-scale=1/);
  assert.match(indexHtml, /user-scalable=no/);
  assert.match(mainTs, /gesturestart/);
  assert.match(mainTs, /touches\.length > 1/);
  assert.match(mainTs, /lastTouchEndAt/);
  assert.match(styles, /touch-action:\s*none/);
});
