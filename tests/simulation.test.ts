import assert from "node:assert/strict";
import test from "node:test";
import { BattleBallSimulation } from "../src/game/simulation.ts";
import { EMPTY_INPUT, type InputFrame } from "../src/game/types.ts";

const throwInput: InputFrame = {
  ...EMPTY_INPUT,
  throwPressed: true,
};

test("starts as a stable 3v3 match with a held ball", () => {
  const simulation = new BattleBallSimulation();
  const snapshot = simulation.snapshot();
  assert.equal(snapshot.phase, "PLAYING");
  assert.equal(snapshot.players.length, 6);
  assert.equal(snapshot.players.filter((player) => player.team === "blue").length, 3);
  assert.equal(snapshot.ball.mode, "HELD");
  assert.equal(snapshot.ball.ownerId, "blue-0");
});

test("the same fixed input sequence produces the same snapshot", () => {
  const first = new BattleBallSimulation();
  const second = new BattleBallSimulation();
  for (let tick = 0; tick < 180; tick += 1) {
    const input = tick === 0 ? throwInput : EMPTY_INPUT;
    first.step(input);
    second.step(input);
  }
  assert.deepEqual(first.snapshot(), second.snapshot());
  assert.deepEqual(first.snapshot().players.map((player) => player.id), [
    "blue-0", "blue-1", "blue-2", "red-0", "red-1", "red-2",
  ]);
});

test("throws can be caught and the opponent can counterattack", () => {
  const simulation = new BattleBallSimulation();
  const observed = new Set<string>();
  for (let tick = 0; tick < 80; tick += 1) {
    simulation.step(tick === 0 ? throwInput : EMPTY_INPUT);
    for (const event of simulation.snapshot().events) observed.add(event.kind);
  }
  assert.equal(observed.has("throw"), true);
  assert.equal(observed.has("catch"), true);
  assert.equal(observed.has("hit"), true);
});

test("reset returns the simulation to tick zero", () => {
  const simulation = new BattleBallSimulation();
  simulation.step(throwInput);
  simulation.step();
  simulation.reset();
  const snapshot = simulation.snapshot();
  assert.equal(snapshot.tick, 0);
  assert.equal(snapshot.clockSeconds, 0);
  assert.equal(snapshot.ball.ownerId, "blue-0");
  assert.equal(snapshot.events.length, 0);
});
