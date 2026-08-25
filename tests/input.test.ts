import assert from "node:assert/strict";
import test from "node:test";
import { InputSystem } from "../src/game/input.ts";
import { directionVector, quantizeDirection, VirtualPadTracker } from "../src/game/virtual-pad.ts";

test("virtual pad quantizes eight directions with a dead zone", () => {
  assert.equal(quantizeDirection(0, 0, 40), "NEUTRAL");
  assert.equal(quantizeDirection(0, 40, 40), "UP");
  assert.equal(quantizeDirection(0, -40, 40), "DOWN");
  assert.equal(quantizeDirection(40, 0, 40), "RIGHT");
  assert.equal(quantizeDirection(-30, -30, 40), "DOWN_LEFT");
  assert.deepEqual(directionVector("UP_RIGHT"), { x: 0.707, z: 0.707 });
});

test("virtual pad keeps vertical direction stable while crossing the diagonal boundaries", () => {
  assert.equal(quantizeDirection(0.92, -0.39, 1, "RIGHT"), "RIGHT");
  assert.equal(quantizeDirection(0.7, -0.72, 1, "RIGHT"), "DOWN_RIGHT");
  assert.equal(quantizeDirection(0, -1, 1, "DOWN"), "DOWN");
  assert.equal(quantizeDirection(0, 1, 1, "UP"), "UP");
});

test("virtual pad tracks one pointer, supports continuous direction changes, and releases to neutral", () => {
  const pad = new VirtualPadTracker();
  assert.equal(pad.begin(7, 0, 40, 40), "UP");
  assert.equal(pad.begin(8, 0, -40, 40), "UP");
  assert.equal(pad.move(8, 0, -40, 40), "UP");
  assert.equal(pad.move(7, 0, -40, 40), "DOWN");
  pad.release(7);
  assert.equal(pad.pointerId, null);
  assert.equal(pad.direction, "NEUTRAL");
});

test("BALL exposes held, press, and release while movement remains held", () => {
  const input = new InputSystem();
  input.press("right", "pad");
  input.press("ball", "button:ball");
  const first = input.frame();
  const second = input.frame();
  assert.equal(first.moveX, 1);
  assert.equal(first.ballHeld, true);
  assert.equal(first.ballPressed, true);
  assert.equal(first.ballReleased, false);
  assert.equal(second.ballHeld, true);
  assert.equal(second.ballPressed, false);
  input.release("ball", "button:ball");
  const released = input.frame();
  assert.equal(released.ballHeld, false);
  assert.equal(released.ballReleased, true);
  input.release("right", "pad");
  assert.deepEqual(input.frame(), {
    moveX: 0,
    moveZ: 0,
    ballHeld: false,
    ballPressed: false,
    ballReleased: false,
    dashPressed: false,
    passPressed: false,
  });
});
