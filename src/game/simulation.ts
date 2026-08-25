import {
  ARENA_BOUNDS,
  EMPTY_INPUT,
  type BallState,
  type InputFrame,
  type MatchPhase,
  type MatchSnapshot,
  type PlayerRole,
  type PlayerState,
  type SimEvent,
  type TeamId,
  type ThrowKind,
  type Vec2,
} from "./types.ts";

const FIXED_DELTA = 1 / 60;
const PLAYER_RADIUS = 0.7;
const BALL_RADIUS = 0.34;
const BALL_COLLISION_DISTANCE = 1.05;
const BALL_CATCH_DISTANCE = 1.95;

const ROLE_SPEED: Record<PlayerRole, number> = {
  POWER: 4.6,
  SPEED: 6.2,
  TRICK: 5.4,
};

const ROLE_HP: Record<PlayerRole, number> = {
  POWER: 132,
  SPEED: 92,
  TRICK: 108,
};

const ROLE_DAMAGE: Record<PlayerRole, number> = {
  POWER: 1.16,
  SPEED: 0.9,
  TRICK: 1,
};

interface InputMap {
  [playerId: string]: InputFrame;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function length(vector: Vec2): number {
  return Math.hypot(vector.x, vector.z);
}

function normalize(vector: Vec2, fallback: Vec2 = { x: 0, z: 1 }): Vec2 {
  const magnitude = length(vector);
  if (magnitude < 0.0001) return { ...fallback };
  return { x: vector.x / magnitude, z: vector.z / magnitude };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function cloneVec(vector: Vec2): Vec2 {
  return { x: vector.x, z: vector.z };
}

function roleFor(team: TeamId, slot: number): PlayerRole {
  const roles: PlayerRole[] = team === "blue" ? ["POWER", "SPEED", "TRICK"] : ["SPEED", "POWER", "TRICK"];
  return roles[slot] ?? "TRICK";
}

function createPlayer(team: TeamId, slot: number, position: Vec2): PlayerState {
  const role = roleFor(team, slot);
  const maxHp = ROLE_HP[role];
  const names = team === "blue" ? ["BOLT", "MICA", "NOVA"] : ["RUSH", "VEX", "ORBIT"];
  return {
    id: `${team}-${slot}`,
    team,
    slot,
    name: names[slot] ?? `${team.toUpperCase()}-${slot + 1}`,
    role,
    position: cloneVec(position),
    facing: { x: team === "blue" ? 0 : 0, z: team === "blue" ? 1 : -1 },
    hp: maxHp,
    maxHp,
    active: true,
    stunSeconds: 0,
    dashSeconds: 0,
    dashCooldown: 0,
    catchCooldown: 0,
    throwCooldown: 0,
    combo: 0,
    lastAction: "READY",
  };
}

function createInitialBall(): BallState {
  return {
    mode: "HELD",
    ownerId: "blue-0",
    throwerId: null,
    position: { x: -5, z: -4 },
    velocity: { x: 0, z: 0 },
    kind: "STRAIGHT",
    age: 0,
    damage: 28,
    bounces: 0,
  };
}

function createInitialSnapshot(): MatchSnapshot {
  return {
    tick: 0,
    phase: "PLAYING",
    clockSeconds: 0,
    momentum: 0,
    players: [
      createPlayer("blue", 0, { x: -5, z: -4 }),
      createPlayer("blue", 1, { x: 0, z: -4.6 }),
      createPlayer("blue", 2, { x: 5, z: -4 }),
      createPlayer("red", 0, { x: 5, z: 4 }),
      createPlayer("red", 1, { x: 0, z: 4.6 }),
      createPlayer("red", 2, { x: -5, z: 4 }),
    ],
    ball: createInitialBall(),
    events: [],
  };
}

function clonePlayer(player: PlayerState): PlayerState {
  return {
    ...player,
    position: cloneVec(player.position),
    facing: cloneVec(player.facing),
  };
}

function cloneBall(ball: BallState): BallState {
  return {
    ...ball,
    position: cloneVec(ball.position),
    velocity: cloneVec(ball.velocity),
  };
}

function cloneEvent(event: SimEvent): SimEvent {
  return { ...event, position: cloneVec(event.position) };
}

export class BattleBallSimulation {
  readonly fixedDelta = FIXED_DELTA;
  private snapshotState = createInitialSnapshot();
  private nextEventId = 1;

  reset(): void {
    this.snapshotState = createInitialSnapshot();
    this.nextEventId = 1;
  }

  step(input: InputFrame = EMPTY_INPUT, deltaSeconds = FIXED_DELTA): void {
    if (this.snapshotState.phase !== "PLAYING") return;
    const delta = clamp(deltaSeconds, 0.001, 0.05);
    const state = this.snapshotState;
    state.tick += 1;
    state.clockSeconds += delta;
    state.events = [];

    const inputMap: InputMap = {};
    for (const player of state.players) {
      if (!player.active) continue;
      const playerInput = player.id === "blue-0" ? input : this.aiInput(player);
      inputMap[player.id] = playerInput;
      this.updateTimers(player, delta);
      this.updateMovement(player, playerInput, delta);
    }

    for (const player of state.players) {
      if (!player.active) continue;
      const playerInput = inputMap[player.id] ?? EMPTY_INPUT;
      this.handleActions(player, playerInput);
    }

    this.updateBall(delta, inputMap);
    this.checkWinCondition();
  }

  snapshot(): MatchSnapshot {
    return {
      tick: this.snapshotState.tick,
      phase: this.snapshotState.phase,
      clockSeconds: this.snapshotState.clockSeconds,
      momentum: this.snapshotState.momentum,
      players: this.snapshotState.players.map(clonePlayer),
      ball: cloneBall(this.snapshotState.ball),
      events: this.snapshotState.events.map(cloneEvent),
    };
  }

  activePlayers(team?: TeamId): PlayerState[] {
    return this.snapshotState.players.filter((player) => player.active && (!team || player.team === team)).map(clonePlayer);
  }

  private updateTimers(player: PlayerState, delta: number): void {
    player.stunSeconds = Math.max(0, player.stunSeconds - delta);
    player.dashSeconds = Math.max(0, player.dashSeconds - delta);
    player.dashCooldown = Math.max(0, player.dashCooldown - delta);
    player.catchCooldown = Math.max(0, player.catchCooldown - delta);
    player.throwCooldown = Math.max(0, player.throwCooldown - delta);
  }

  private updateMovement(player: PlayerState, input: InputFrame, delta: number): void {
    if (player.stunSeconds > 0) return;
    const direction = normalize({ x: input.moveX, z: input.moveZ }, player.facing);
    const hasDirection = length({ x: input.moveX, z: input.moveZ }) > 0.01;
    if (hasDirection) player.facing = direction;

    if (input.dashPressed && player.dashCooldown <= 0) {
      player.dashSeconds = 0.22;
      player.dashCooldown = player.role === "SPEED" ? 0.62 : 0.88;
      player.position.x += direction.x * (player.role === "SPEED" ? 2.8 : 2.35);
      player.position.z += direction.z * (player.role === "SPEED" ? 2.8 : 2.35);
      player.lastAction = "DASH";
      this.emit("dash", player.id, null, player.position, player.role === "SPEED" ? 2.8 : 2.35, "DASH");
    }

    const speed = ROLE_SPEED[player.role] * (player.dashSeconds > 0 ? 2.2 : 1);
    player.position.x += direction.x * speed * delta;
    player.position.z += direction.z * speed * delta;
    player.position.x = clamp(player.position.x, -ARENA_BOUNDS.halfWidth + PLAYER_RADIUS, ARENA_BOUNDS.halfWidth - PLAYER_RADIUS);
    player.position.z = clamp(player.position.z, -ARENA_BOUNDS.halfDepth + PLAYER_RADIUS, ARENA_BOUNDS.halfDepth - PLAYER_RADIUS);
  }

  private handleActions(player: PlayerState, input: InputFrame): void {
    if (player.stunSeconds > 0) return;
    const ball = this.snapshotState.ball;
    if (ball.ownerId !== player.id || ball.mode !== "HELD") return;

    if (input.passPressed) {
      const teammate = this.nearestPlayer(player.position, player.team, player.id);
      if (teammate) {
        ball.ownerId = teammate.id;
        ball.position = cloneVec(teammate.position);
        player.lastAction = "PASS";
        this.emit("pass", player.id, teammate.id, teammate.position, 0, "PASS");
        return;
      }
    }

    if (input.throwPressed && player.throwCooldown <= 0) {
      this.throwBall(player, input);
    }
  }

  private throwBall(player: PlayerState, input: InputFrame): void {
    const ball = this.snapshotState.ball;
    const target = this.nearestOpponent(player.position, player.team);
    if (!target) return;
    let kind: ThrowKind = "STRAIGHT";
    if (input.dashPressed) kind = "RUSH";
    else if (input.moveZ > 0.55) kind = "SKY";
    else if (Math.abs(input.moveX) > 0.55) kind = "CURVE";

    const targetDirection = normalize({ x: target.position.x - player.position.x, z: target.position.z - player.position.z }, player.facing);
    let direction = targetDirection;
    if (kind === "CURVE") {
      const side = Math.sign(input.moveX || player.facing.x || 1);
      direction = normalize({ x: targetDirection.x * 0.92 + side * 0.32, z: targetDirection.z * 0.92 }, targetDirection);
    }
    if (kind === "SKY") {
      direction = normalize({ x: targetDirection.x * 0.86, z: targetDirection.z * 0.86 + (target.team === "red" ? 0.22 : -0.22) }, targetDirection);
    }

    const speed = kind === "RUSH" ? 15.2 : kind === "STRAIGHT" ? 12.4 : kind === "CURVE" ? 10.9 : 9.2;
    const damage = Math.round((kind === "SKY" ? 35 : kind === "RUSH" ? 32 : kind === "CURVE" ? 25 : 28) * ROLE_DAMAGE[player.role]);
    ball.mode = "FLYING";
    ball.ownerId = null;
    ball.throwerId = player.id;
    ball.position = {
      x: player.position.x + direction.x * 0.85,
      z: player.position.z + direction.z * 0.85,
    };
    ball.velocity = { x: direction.x * speed, z: direction.z * speed };
    ball.kind = kind;
    ball.age = 0;
    ball.damage = damage;
    ball.bounces = 0;
    player.throwCooldown = player.role === "POWER" ? 0.38 : 0.3;
    player.lastAction = `${kind}_THROW`;
    this.emit("throw", player.id, target.id, ball.position, damage, `${kind} THROW`, kind);
  }

  private updateBall(delta: number, inputs: InputMap): void {
    const ball = this.snapshotState.ball;
    if (ball.mode === "HELD") {
      const owner = this.findPlayer(ball.ownerId);
      if (!owner || !owner.active) {
        ball.mode = "FREE";
        ball.ownerId = null;
        ball.position = owner ? cloneVec(owner.position) : cloneVec(ball.position);
      } else {
        ball.position = {
          x: owner.position.x + owner.facing.x * 0.86,
          z: owner.position.z + owner.facing.z * 0.86,
        };
      }
      return;
    }

    ball.age += delta;
    ball.position.x += ball.velocity.x * delta;
    ball.position.z += ball.velocity.z * delta;

    if (ball.mode === "FLYING") {
      const catchers = this.snapshotState.players.filter((player) => player.active && player.id !== ball.throwerId);
      for (const player of catchers) {
        const input = inputs[player.id] ?? EMPTY_INPUT;
        if (!input.catchPressed || player.catchCooldown > 0 || player.dashSeconds > 0) continue;
        if (distance(player.position, ball.position) > BALL_CATCH_DISTANCE) continue;
        ball.mode = "HELD";
        ball.ownerId = player.id;
        ball.throwerId = null;
        ball.velocity = { x: 0, z: 0 };
        ball.age = 0;
        player.catchCooldown = 0.34;
        player.combo += 1;
        player.lastAction = "PERFECT CATCH";
        this.snapshotState.momentum = clamp(this.snapshotState.momentum + (player.team === "blue" ? 14 : -8), 0, 100);
        this.emit("catch", player.id, null, player.position, player.combo, "PERFECT CATCH");
        return;
      }

      for (const player of catchers) {
        if (player.id === ball.throwerId) continue;
        if (distance(player.position, ball.position) > BALL_COLLISION_DISTANCE) continue;
        if (player.dashSeconds > 0) {
          ball.mode = "FREE";
          ball.ownerId = null;
          ball.throwerId = null;
          ball.velocity = { x: -ball.velocity.x * 0.28, z: -ball.velocity.z * 0.28 };
          player.lastAction = "DODGE";
          this.emit("dodge", player.id, null, player.position, 0, "DODGE");
          return;
        }
        this.hitPlayer(player, ball);
        return;
      }

      const bounced = this.handleWall(ball);
      if (bounced) return;
      if (ball.age > 2.8) {
        ball.mode = "FREE";
        ball.ownerId = null;
        ball.throwerId = null;
        ball.velocity.x *= 0.3;
        ball.velocity.z *= 0.3;
      }
      return;
    }

    ball.velocity.x *= Math.pow(0.12, delta);
    ball.velocity.z *= Math.pow(0.12, delta);
    this.handleWall(ball);
    if (ball.mode !== "FREE") return;
    const nearest = this.snapshotState.players
      .filter((player) => player.active)
      .reduce<PlayerState | null>((closest, player) => {
        if (!closest) return player;
        return distance(player.position, ball.position) < distance(closest.position, ball.position) ? player : closest;
      }, null);
    if (nearest && distance(nearest.position, ball.position) < 1.05) {
      ball.mode = "HELD";
      ball.ownerId = nearest.id;
      ball.throwerId = null;
      ball.velocity = { x: 0, z: 0 };
      nearest.lastAction = "BALL CLAIMED";
    }
  }

  private handleWall(ball: BallState): boolean {
    let bounced = false;
    const limitX = ARENA_BOUNDS.halfWidth - BALL_RADIUS;
    const limitZ = ARENA_BOUNDS.halfDepth - BALL_RADIUS;
    if (ball.position.x < -limitX || ball.position.x > limitX) {
      if (ball.kind === "CURVE" && ball.bounces < 2) {
        ball.position.x = clamp(ball.position.x, -limitX, limitX);
        ball.velocity.x *= -1;
        ball.bounces += 1;
        bounced = true;
      } else {
        ball.position.x = clamp(ball.position.x, -limitX, limitX);
        ball.mode = "FREE";
        ball.ownerId = null;
        ball.throwerId = null;
        ball.velocity.x *= -0.3;
      }
    }
    if (ball.position.z < -limitZ || ball.position.z > limitZ) {
      if (ball.kind === "CURVE" && ball.bounces < 2) {
        ball.position.z = clamp(ball.position.z, -limitZ, limitZ);
        ball.velocity.z *= -1;
        ball.bounces += 1;
        bounced = true;
      } else {
        ball.position.z = clamp(ball.position.z, -limitZ, limitZ);
        ball.mode = "FREE";
        ball.ownerId = null;
        ball.throwerId = null;
        ball.velocity.z *= -0.3;
      }
    }
    return bounced;
  }

  private hitPlayer(player: PlayerState, ball: BallState): void {
    const damage = ball.damage;
    player.hp = Math.max(0, player.hp - damage);
    player.stunSeconds = ball.kind === "RUSH" ? 0.6 : 0.38;
    player.combo = 0;
    player.lastAction = `HIT -${damage}`;
    this.snapshotState.momentum = clamp(this.snapshotState.momentum + (player.team === "red" ? 10 : -8), 0, 100);
    this.emit("hit", ball.throwerId, player.id, player.position, damage, `HIT -${damage}`, ball.kind);
    ball.mode = "FREE";
    ball.ownerId = null;
    ball.throwerId = null;
    ball.velocity = { x: -ball.velocity.x * 0.24, z: -ball.velocity.z * 0.24 };
    if (player.hp <= 0) {
      player.active = false;
      player.lastAction = "DOWN";
      this.emit("ko", player.id, null, player.position, 0, "DOWN");
    }
  }

  private aiInput(player: PlayerState): InputFrame {
    const ball = this.snapshotState.ball;
    const input: InputFrame = { ...EMPTY_INPUT };
    const nearestOpponent = this.nearestOpponent(player.position, player.team);
    if (!nearestOpponent) return input;

    if (ball.mode === "FREE") {
      const direction = normalize({ x: ball.position.x - player.position.x, z: ball.position.z - player.position.z });
      input.moveX = direction.x;
      input.moveZ = direction.z;
      if (distance(player.position, ball.position) < 1.55 && this.snapshotState.tick % 5 === player.slot) input.catchPressed = true;
      return input;
    }

    if (ball.ownerId === player.id) {
      const direction = normalize({ x: nearestOpponent.position.x - player.position.x, z: nearestOpponent.position.z - player.position.z }, player.facing);
      input.moveX = direction.x * 0.35;
      input.moveZ = direction.z * 0.35;
      if (player.throwCooldown <= 0 && (this.snapshotState.tick + player.slot * 17) % 42 === 0) {
        input.throwPressed = true;
        if (player.role === "TRICK") input.moveX = player.slot % 2 === 0 ? 1 : -1;
        if (player.role === "POWER") input.moveZ = 1;
      }
      return input;
    }

    if (ball.mode === "FLYING" && ball.throwerId && this.findPlayer(ball.throwerId)?.team !== player.team) {
      const towardBall = normalize({ x: ball.position.x - player.position.x, z: ball.position.z - player.position.z }, player.facing);
      input.moveX = towardBall.x * 0.2;
      input.moveZ = towardBall.z * 0.2;
      if (distance(player.position, ball.position) < 1.85 && this.snapshotState.tick % 6 === player.slot) input.catchPressed = true;
      if (distance(player.position, ball.position) < 1.5 && player.dashCooldown <= 0 && this.snapshotState.tick % 11 === player.slot) input.dashPressed = true;
      return input;
    }

    const spread = player.slot === 0 ? -1 : player.slot === 1 ? 0 : 1;
    const away = normalize({
      x: player.position.x - (ball.ownerId ? this.findPlayer(ball.ownerId)?.position.x ?? 0 : 0) + spread * 2,
      z: player.position.z - (ball.ownerId ? this.findPlayer(ball.ownerId)?.position.z ?? 0 : 0),
    }, player.facing);
    input.moveX = away.x * 0.5;
    input.moveZ = away.z * 0.5;
    return input;
  }

  private nearestOpponent(position: Vec2, team: TeamId): PlayerState | null {
    return this.snapshotState.players
      .filter((player) => player.active && player.team !== team)
      .reduce<PlayerState | null>((closest, player) => {
        if (!closest) return player;
        return distance(player.position, position) < distance(closest.position, position) ? player : closest;
      }, null);
  }

  private nearestPlayer(position: Vec2, team: TeamId, excludeId: string): PlayerState | null {
    return this.snapshotState.players
      .filter((player) => player.active && player.team === team && player.id !== excludeId)
      .reduce<PlayerState | null>((closest, player) => {
        if (!closest) return player;
        return distance(player.position, position) < distance(closest.position, position) ? player : closest;
      }, null);
  }

  private findPlayer(id: string | null): PlayerState | null {
    return this.snapshotState.players.find((player) => player.id === id) ?? null;
  }

  private checkWinCondition(): void {
    const blueAlive = this.snapshotState.players.some((player) => player.active && player.team === "blue");
    const redAlive = this.snapshotState.players.some((player) => player.active && player.team === "red");
    if (blueAlive && redAlive) return;
    if (!blueAlive && !redAlive) this.snapshotState.phase = "BLUE_WIN";
    else this.snapshotState.phase = blueAlive ? "BLUE_WIN" : "RED_WIN";
    this.emit("win", null, null, { x: 0, z: 0 }, 0, this.snapshotState.phase === "BLUE_WIN" ? "BLUE TEAM WINS" : "RED TEAM WINS");
  }

  private emit(
    kind: SimEvent["kind"],
    actorId: string | null,
    targetId: string | null,
    position: Vec2,
    value: number,
    label: string,
    special?: ThrowKind,
  ): void {
    this.snapshotState.events.push({
      id: this.nextEventId++,
      tick: this.snapshotState.tick,
      kind,
      actorId,
      targetId,
      position: cloneVec(position),
      value,
      label,
      special,
    });
  }
}

export function createBattleBallSimulation(): BattleBallSimulation {
  return new BattleBallSimulation();
}
