import assert from "node:assert/strict";
import test from "node:test";
import { InputSystem } from "../src/game/input.ts";
import { directionVector, quantizeDirection } from "../src/game/virtual-pad.ts";

test("virtual pad quantizes eight directions with a dead zone", () => {
  assert.equal(quantizeDirection(0, 0, 40), "NEUTRAL");
  assert.equal(quantizeDirection(0, 40, 40), "UP");
  assert.equal(quantizeDirection(40, 0, 40), "RIGHT");
  assert.equal(quantizeDirection(-30, -30, 40), "DOWN_LEFT");
  assert.deepEqual(directionVector("UP_RIGHT"), { x: 0.707, z: 0.707 });
});

test("input edges fire once and movement remains held", () => {
  const input = new InputSystem();
  input.press("right", "pad");
  input.press("throw", "button:throw");
  const first = input.frame();
  const second = input.frame();
  assert.equal(first.moveX, 1);
  assert.equal(first.throwPressed, true);
  assert.equal(second.moveX, 1);
  assert.equal(second.throwPressed, false);
  input.release("throw", "button:throw");
  input.release("right", "pad");
  assert.deepEqual(input.frame(), {
    moveX: 0,
    moveZ: 0,
    throwPressed: false,
    catchPressed: false,
    dashPressed: false,
    passPressed: false,
  });
});
