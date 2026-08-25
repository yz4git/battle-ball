import assert from "node:assert/strict";
import test from "node:test";
import { BattleBallSimulation } from "../src/game/simulation.ts";
import { EMPTY_INPUT, type InputFrame } from "../src/game/types.ts";

const aimInput: InputFrame = { ...EMPTY_INPUT, ballHeld: true, ballPressed: true };
const holdInput: InputFrame = { ...EMPTY_INPUT, ballHeld: true };
const releaseInput: InputFrame = { ...EMPTY_INPUT, ballReleased: true };

test("starts as a stable 3v3 match with the player holding the ball", () => {
  const simulation = new BattleBallSimulation();
  const snapshot = simulation.snapshot();
  assert.equal(snapshot.phase, "PLAYING");
  assert.equal(snapshot.players.length, 6);
  assert.equal(snapshot.ball.mode, "HELD");
  assert.equal(snapshot.ball.ownerId, "blue-0");
  assert.equal(snapshot.controlledPlayerId, "blue-0");
});

test("CPU teams cannot start an automatic rally while the player does nothing", () => {
  const simulation = new BattleBallSimulation();
  const observed = new Set<string>();
  for (let tick = 0; tick < 600; tick += 1) {
    simulation.step(EMPTY_INPUT);
    for (const event of simulation.snapshot().events) observed.add(event.kind);
  }
  assert.equal(observed.has("throw"), false);
  assert.equal(simulation.snapshot().ball.ownerId, "blue-0");
});

test("BALL hold manually selects a target and release throws at it", () => {
  const simulation = new BattleBallSimulation();
  simulation.step({ ...aimInput, moveX: 1 });
  for (let tick = 0; tick < 20; tick += 1) simulation.step({ ...holdInput, moveX: 1 });
  assert.equal(simulation.snapshot().aimTargetId, "red-0");
  simulation.step({ ...releaseInput, moveX: 1 });
  const snapshot = simulation.snapshot();
  assert.equal(snapshot.ball.mode, "FLYING");
  assert.equal(snapshot.ball.throwerId, "blue-0");
  assert.equal(snapshot.events.some((event) => event.kind === "throw" && event.targetId === "red-0"), true);
});

test("PASS delegates exactly one attack to a teammate", () => {
  const simulation = new BattleBallSimulation();
  simulation.step({ ...EMPTY_INPUT, passPressed: true, moveX: 1 });
  let snapshot = simulation.snapshot();
  assert.equal(snapshot.telegraph?.source, "ASSIST");
  assert.equal(snapshot.telegraph?.throwerId, "blue-2");
  assert.equal(snapshot.ball.ownerId, "blue-2");
  let assistThrows = 0;
  for (let tick = 0; tick < 80; tick += 1) {
    simulation.step(EMPTY_INPUT);
    snapshot = simulation.snapshot();
    assistThrows += snapshot.events.filter((event) => event.kind === "throw" && event.actorId === "blue-2").length;
  }
  assert.equal(assistThrows, 1);
});

test("an enemy possession announces a telegraph before the throw", () => {
  const simulation = new BattleBallSimulation();
  simulation.step(aimInput);
  simulation.step(releaseInput);
  let sawEnemyTelegraph = false;
  let enemyThrowBeforeTelegraph = false;
  for (let tick = 0; tick < 900; tick += 1) {
    simulation.step(EMPTY_INPUT);
    const snapshot = simulation.snapshot();
    if (snapshot.telegraph?.source === "ENEMY") sawEnemyTelegraph = true;
    if (snapshot.events.some((event) => event.kind === "throw" && event.actorId?.startsWith("red-")) && !sawEnemyTelegraph) {
      enemyThrowBeforeTelegraph = true;
      break;
    }
    if (sawEnemyTelegraph && snapshot.events.some((event) => event.kind === "throw" && event.actorId?.startsWith("red-"))) break;
  }
  assert.equal(sawEnemyTelegraph, true);
  assert.equal(enemyThrowBeforeTelegraph, false);
});

test("the same fixed input sequence produces the same snapshot", () => {
  const first = new BattleBallSimulation();
  const second = new BattleBallSimulation();
  const sequence = [aimInput, holdInput, holdInput, releaseInput];
  for (let tick = 0; tick < 240; tick += 1) {
    const input = sequence[tick] ?? EMPTY_INPUT;
    first.step(input);
    second.step(input);
  }
  assert.deepEqual(first.snapshot(), second.snapshot());
});

test("reset returns the simulation to tick zero", () => {
  const simulation = new BattleBallSimulation();
  simulation.step(aimInput);
  simulation.reset();
  const snapshot = simulation.snapshot();
  assert.equal(snapshot.tick, 0);
  assert.equal(snapshot.clockSeconds, 0);
  assert.equal(snapshot.ball.ownerId, "blue-0");
  assert.equal(snapshot.telegraph, null);
});
