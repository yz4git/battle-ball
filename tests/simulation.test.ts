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


test("catching an enemy return builds rally and momentum", () => {
  const simulation = new BattleBallSimulation();
  const state = simulation as unknown as { snapshotState: ReturnType<BattleBallSimulation["snapshot"]> };
  const controlled = state.snapshotState.players.find((player) => player.id === state.snapshotState.controlledPlayerId);
  assert.ok(controlled);
  state.snapshotState.ball.mode = "FLYING";
  state.snapshotState.ball.ownerId = null;
  state.snapshotState.ball.throwerId = "red-0";
  state.snapshotState.ball.position = { x: controlled.position.x, z: controlled.position.z + 1.2 };
  state.snapshotState.ball.velocity = { x: 0, z: -12 };
  state.snapshotState.ball.kind = "STRAIGHT";
  state.snapshotState.ball.damage = 20;
  simulation.step({ ...EMPTY_INPUT, ballPressed: true, ballHeld: true });
  const after = simulation.snapshot();
  const player = after.players.find((candidate) => candidate.id === after.controlledPlayerId);
  assert.equal(after.ball.ownerId, after.controlledPlayerId);
  assert.equal(player?.combo, 1);
  assert.ok(after.momentum >= 15);
  assert.match(player?.lastAction ?? "", /CHAIN x1/);
});


test("DASH can aggressively break-steal from an enemy holder", () => {
  const simulation = new BattleBallSimulation();
  const state = simulation as unknown as { snapshotState: ReturnType<BattleBallSimulation["snapshot"]> };
  const controlled = state.snapshotState.players.find((player) => player.id === state.snapshotState.controlledPlayerId);
  const enemy = state.snapshotState.players.find((player) => player.id === "red-1");
  assert.ok(controlled);
  assert.ok(enemy);
  enemy.position = { x: controlled.position.x, z: controlled.position.z + 3.25 };
  state.snapshotState.ball.mode = "HELD";
  state.snapshotState.ball.ownerId = enemy.id;
  state.snapshotState.ball.throwerId = null;
  state.snapshotState.ball.position = { ...enemy.position };
  simulation.step({ ...EMPTY_INPUT, dashPressed: true, moveZ: 1 });
  const after = simulation.snapshot();
  const afterEnemy = after.players.find((player) => player.id === enemy.id);
  const afterControlled = after.players.find((player) => player.id === after.controlledPlayerId);
  assert.equal(after.ball.ownerId, after.controlledPlayerId);
  assert.ok((afterEnemy?.stunSeconds ?? 0) > 0);
  assert.ok((afterControlled?.combo ?? 0) >= 2);
  assert.match(afterControlled?.lastAction ?? "", /BREAK STEAL/);
});

test("successful offense builds chain and rebounds the ball away from the victim", () => {
  const simulation = new BattleBallSimulation();
  const state = simulation as unknown as { snapshotState: ReturnType<BattleBallSimulation["snapshot"]> };
  const controlled = state.snapshotState.players.find((player) => player.id === state.snapshotState.controlledPlayerId);
  const enemy = state.snapshotState.players.find((player) => player.id === "red-1");
  assert.ok(controlled);
  assert.ok(enemy);
  enemy.position = { x: controlled.position.x, z: controlled.position.z + 2.1 };
  simulation.step({ ...EMPTY_INPUT, ballPressed: true, ballHeld: true });
  simulation.step({ ...EMPTY_INPUT, ballReleased: true });
  let hit = false;
  for (let tick = 0; tick < 40; tick += 1) {
    simulation.step(EMPTY_INPUT);
    const snapshot = simulation.snapshot();
    if (snapshot.events.some((event) => event.kind === "hit" && event.targetId === enemy.id)) {
      hit = true;
      const leader = snapshot.players.find((player) => player.id === snapshot.controlledPlayerId);
      assert.ok((leader?.combo ?? 0) >= 1);
      assert.equal(snapshot.ball.mode, "FREE");
      assert.ok(Math.hypot(snapshot.ball.velocity.x, snapshot.ball.velocity.z) > 5);
      break;
    }
  }
  assert.equal(hit, true);
});
