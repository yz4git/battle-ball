from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing replacement target in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new))


replace(
    "index.html",
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no" />',
)

replace(
    "src/styles.css",
    """html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}""",
    """html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  touch-action: none;
}

html {
  overscroll-behavior: none;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}""",
)

replace(
    "src/styles.css",
    """body {
  background: #030611;
  color: var(--ink);
  overscroll-behavior: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}""",
    """body {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #030611;
  color: var(--ink);
  overscroll-behavior: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: none;
}""",
)

replace(
    "src/styles.css",
    "button { color: inherit; font: inherit; }",
    "button { color: inherit; font: inherit; touch-action: none; -webkit-tap-highlight-color: transparent; }",
)

replace(
    "src/main.ts",
    '<span class="team-note">BALL = CATCH / AIM / THROW</span>',
    '<span class="team-note">CATCH / DASH → COUNTER</span>',
)
replace(
    "src/main.ts",
    "        <p>BALL長押しで敵を狙い、離して投球。飛んできた球にはBALLタップでキャッチ。PASSすると味方が役割別の一撃だけを放つ。</p>",
    "        <p>敵の予告を読み、BALLでキャッチかDASHで奪取。成功するほどRALLYが伸び、直後のカウンターが高速・高威力になる。PASSはRALLYを味方の必殺攻撃へ変換。</p>",
)
replace(
    "src/main.ts",
    """  const blue = teamStats("blue");
  const red = teamStats("red");
  if (blueAlive) blueAlive.textContent = `${blue.alive} / 3`;""",
    """  const blue = teamStats("blue");
  const red = teamStats("red");
  const controlled = snapshot.players.find((player) => player.id === snapshot.controlledPlayerId);
  if (matchLabel && !matchLabel.classList.contains("is-fallback")) {
    matchLabel.textContent = controlled && controlled.combo > 0
      ? `RALLY x${controlled.combo} // ${snapshot.momentum >= 80 ? "SURGE" : "COUNTER UP"}`
      : "PLAYER LED // 3v3";
  }
  if (blueAlive) blueAlive.textContent = `${blue.alive} / 3`;""",
)
replace(
    "src/main.ts",
    """window.addEventListener("contextmenu", (event) => event.preventDefault());

if ("serviceWorker" in navigator) {""",
    """window.addEventListener("contextmenu", (event) => event.preventDefault());

// Safari can still interpret rapid action taps as browser zoom. Block native zoom globally.
const blockNativeZoom = (event: Event): void => event.preventDefault();
document.addEventListener("gesturestart", blockNativeZoom, { passive: false });
document.addEventListener("gesturechange", blockNativeZoom, { passive: false });
document.addEventListener("gestureend", blockNativeZoom, { passive: false });
document.addEventListener("touchmove", (event) => {
  if (event.touches.length > 1) event.preventDefault();
}, { passive: false });
let lastTouchEndAt = 0;
document.addEventListener("touchend", (event) => {
  const now = performance.now();
  if (now - lastTouchEndAt < 320) event.preventDefault();
  lastTouchEndAt = now;
}, { passive: false, capture: true });
document.addEventListener("dblclick", blockNativeZoom, { passive: false });

if ("serviceWorker" in navigator) {""",
)

replace("src/game/simulation.ts", "const BALL_CATCH_DISTANCE = 1.62;", "const BALL_CATCH_DISTANCE = 1.85;\nconst PERFECT_CATCH_DISTANCE = 0.92;")
replace("src/game/simulation.ts", "const ENEMY_HOLD_BEFORE_AIM = 0.5;", "const ENEMY_HOLD_BEFORE_AIM = 0.2;")
replace("src/game/simulation.ts", "const HUMAN_AIM_CHARGE_SECONDS = 0.82;", "const HUMAN_AIM_CHARGE_SECONDS = 0.52;")
replace("src/game/simulation.ts", "      speedScale *= 0.24;", "      speedScale *= 0.62;")
replace(
    "src/game/simulation.ts",
    """      const kind = this.humanThrowKind(input, this.snapshotState.aimCharge);
      const chargeBonus = 1 + this.snapshotState.aimCharge * 0.16;
      this.throwBallAt(player, target, kind, chargeBonus);""",
    """      const kind = this.humanThrowKind(input, this.snapshotState.aimCharge);
      const rallyBonus = 1 + Math.min(player.combo, 6) * 0.08;
      const surgeBonus = this.snapshotState.momentum >= 80 ? 1.18 : 1;
      const chargeBonus = (1 + this.snapshotState.aimCharge * 0.18) * rallyBonus * surgeBonus;
      this.throwBallAt(player, target, kind, chargeBonus);""",
)
replace(
    "src/game/simulation.ts",
    '    const totalSeconds = teammate.role === "SPEED" ? 0.24 : teammate.role === "POWER" ? 0.4 : 0.32;',
    '    const totalSeconds = teammate.role === "SPEED" ? 0.18 : teammate.role === "POWER" ? 0.3 : 0.24;',
)
replace(
    "src/game/simulation.ts",
    """    const damageBonus = telegraph.source === "ASSIST" ? 1.1 : 1;
    this.snapshotState.telegraph = null;""",
    """    const leader = this.findPlayer(this.snapshotState.controlledPlayerId);
    const assistRallyBonus = 1 + Math.min(leader?.combo ?? 0, 6) * 0.06;
    const damageBonus = telegraph.source === "ASSIST" ? 1.12 * assistRallyBonus : 1;
    this.snapshotState.telegraph = null;""",
)
replace(
    "src/game/simulation.ts",
    '    const totalSeconds = owner.role === "SPEED" ? 0.62 : owner.role === "POWER" ? 0.86 : 0.76;',
    '    const totalSeconds = owner.role === "SPEED" ? 0.48 : owner.role === "POWER" ? 0.68 : 0.58;',
)
replace(
    "src/game/simulation.ts",
    """    const speed = kind === "RUSH" ? 15.8 : kind === "STRAIGHT" ? 12.7 : kind === "CURVE" ? 11.3 : 10;
    const baseDamage = kind === "SKY" ? 35 : kind === "RUSH" ? 32 : kind === "CURVE" ? 25 : 28;""",
    """    const baseSpeed = kind === "RUSH" ? 15.8 : kind === "STRAIGHT" ? 12.7 : kind === "CURVE" ? 11.3 : 10;
    const rallyLeader = player.team === "blue" ? this.findPlayer(this.snapshotState.controlledPlayerId) : null;
    const rallyStack = Math.min(rallyLeader?.combo ?? 0, 6);
    const speedMultiplier = 1 + rallyStack * 0.045 + (this.snapshotState.momentum >= 80 && player.team === "blue" ? 0.08 : 0);
    const speed = baseSpeed * speedMultiplier;
    const baseDamage = kind === "SKY" ? 35 : kind === "RUSH" ? 32 : kind === "CURVE" ? 25 : 28;""",
)
replace(
    "src/game/simulation.ts",
    """    player.throwCooldown = player.role === "POWER" ? 0.38 : 0.3;
    player.lastAction = `${kind}_THROW`;
    this.emit("throw", player.id, target.id, ball.position, damage, `${kind} THROW`, kind);""",
    """    player.throwCooldown = player.role === "POWER" ? 0.34 : 0.26;
    const rallyLabel = player.team === "blue" && rallyStack > 0 ? ` COUNTER x${rallyStack}` : "";
    player.lastAction = `${kind}${rallyLabel}`;
    this.emit("throw", player.id, target.id, ball.position, damage, `${kind}${rallyLabel}`, kind);""",
)
replace(
    "src/game/simulation.ts",
    """        if (distance(player.position, ball.position) > BALL_CATCH_DISTANCE) continue;
        ball.mode = "HELD";
        ball.ownerId = player.id;
        ball.throwerId = null;
        ball.velocity = { x: 0, z: 0 };
        ball.age = 0;
        ball.heldSeconds = 0;
        player.catchCooldown = 0.34;
        player.combo += 1;
        player.lastAction = player.id === this.snapshotState.controlledPlayerId ? "PERFECT CATCH" : "CATCH";
        if (player.id === this.snapshotState.controlledPlayerId) {
          this.snapshotState.momentum = clamp(this.snapshotState.momentum + 14, 0, 100);
        }
        this.emit("catch", player.id, null, player.position, player.combo, player.lastAction);
        return;""",
    """        const catchDistance = distance(player.position, ball.position);
        if (catchDistance > BALL_CATCH_DISTANCE) continue;
        ball.mode = "HELD";
        ball.ownerId = player.id;
        ball.throwerId = null;
        ball.velocity = { x: 0, z: 0 };
        ball.age = 0;
        ball.heldSeconds = 0;
        player.catchCooldown = 0.24;
        player.combo = Math.min(player.combo + 1, 9);
        const controlledCatch = player.id === this.snapshotState.controlledPlayerId;
        const perfect = controlledCatch && catchDistance <= PERFECT_CATCH_DISTANCE;
        player.lastAction = controlledCatch
          ? `${perfect ? "PERFECT" : "CATCH"}! RALLY x${player.combo}`
          : "CATCH";
        if (controlledCatch) {
          this.snapshotState.momentum = clamp(this.snapshotState.momentum + (perfect ? 26 : 15), 0, 100);
        }
        this.emit("catch", player.id, null, player.position, player.combo, player.lastAction);
        return;""",
)
replace(
    "src/game/simulation.ts",
    """        if (player.dashSeconds > 0) {
          ball.mode = "FREE";
          ball.ownerId = null;
          ball.throwerId = null;
          ball.velocity = { x: -ball.velocity.x * 0.28, z: -ball.velocity.z * 0.28 };
          ball.heldSeconds = 0;
          player.lastAction = "DODGE";
          this.emit("dodge", player.id, null, player.position, 0, "DODGE");
          return;
        }""",
    """        if (player.dashSeconds > 0) {
          if (player.id === this.snapshotState.controlledPlayerId) {
            ball.mode = "HELD";
            ball.ownerId = player.id;
            ball.throwerId = null;
            ball.position = cloneVec(player.position);
            ball.velocity = { x: 0, z: 0 };
            ball.age = 0;
            ball.heldSeconds = 0;
            player.combo = Math.min(player.combo + 1, 9);
            player.lastAction = `DASH STEAL! RALLY x${player.combo}`;
            this.snapshotState.momentum = clamp(this.snapshotState.momentum + 12, 0, 100);
            this.emit("dodge", player.id, null, player.position, player.combo, player.lastAction);
          } else {
            ball.mode = "FREE";
            ball.ownerId = null;
            ball.throwerId = null;
            ball.velocity = { x: -ball.velocity.x * 0.28, z: -ball.velocity.z * 0.28 };
            ball.heldSeconds = 0;
            player.lastAction = "DODGE";
            this.emit("dodge", player.id, null, player.position, 0, "DODGE");
          }
          return;
        }""",
)
replace(
    "src/game/simulation.ts",
    '    this.snapshotState.momentum = clamp(this.snapshotState.momentum + (player.team === "red" ? 10 : -8), 0, 100);',
    '    this.snapshotState.momentum = clamp(this.snapshotState.momentum + (player.team === "red" ? 14 : -20), 0, 100);',
)
replace("public/sw.js", 'const CACHE_VERSION = "v4-player-led-rally";', 'const CACHE_VERSION = "v5-rally-counter";')

test_path = Path("tests/simulation.test.ts")
test_text = test_path.read_text()
test_text += r'''

test("catching an enemy return builds rally and momentum", () => {
  const simulation = new BattleBallSimulation();
  simulation.step(aimInput);
  simulation.step(releaseInput);
  let caught = false;
  for (let tick = 0; tick < 1200; tick += 1) {
    const before = simulation.snapshot();
    const controlled = before.players.find((player) => player.id === before.controlledPlayerId);
    const incoming = before.ball.mode === "FLYING" && before.ball.throwerId?.startsWith("red-");
    const gap = controlled ? Math.hypot(controlled.position.x - before.ball.position.x, controlled.position.z - before.ball.position.z) : Infinity;
    simulation.step(incoming && gap < 1.82 ? { ...EMPTY_INPUT, ballPressed: true, ballHeld: true } : EMPTY_INPUT);
    const after = simulation.snapshot();
    const player = after.players.find((candidate) => candidate.id === after.controlledPlayerId);
    if (after.ball.ownerId === after.controlledPlayerId && (player?.combo ?? 0) > 0) {
      assert.ok(after.momentum >= 15);
      assert.match(player?.lastAction ?? "", /RALLY x/);
      caught = true;
      break;
    }
  }
  assert.equal(caught, true);
});
'''
test_path.write_text(test_text)

Path("tests/mobile-shell.test.ts").write_text(r'''import assert from "node:assert/strict";
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
''')
