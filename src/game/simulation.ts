import {
  ARENA_BOUNDS,
  EMPTY_INPUT,
  type BallState,
  type InputFrame,
  type MatchSnapshot,
  type PlayerRole,
  type PlayerState,
  type SimEvent,
  type TeamId,
  type ThrowKind,
  type ThrowTelegraph,
  type Vec2,
} from "./types.ts";

const FIXED_DELTA = 1 / 60;
const PLAYER_RADIUS = 0.7;
const BALL_RADIUS = 0.34;
const BALL_COLLISION_DISTANCE = 1.05;
const BALL_CATCH_DISTANCE = 1.62;
const CONTROLLED_PLAYER_ID = "blue-0";
const ENEMY_HOLD_BEFORE_AIM = 0.5;
const HUMAN_AIM_CHARGE_SECONDS = 0.82;

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
    facing: { x: 0, z: team === "blue" ? 1 : -1 },
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
    ownerId: CONTROLLED_PLAYER_ID,
    throwerId: null,
    position: { x: -5, z: -4 },
    velocity: { x: 0, z: 0 },
    kind: "STRAIGHT",
    age: 0,
    heldSeconds: 0,
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
    controlledPlayerId: CONTROLLED_PLAYER_ID,
    aimTargetId: null,
    aimCharge: 0,
    telegraph: null,
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
  return { ...player, position: cloneVec(player.position), facing: cloneVec(player.facing) };
}

function cloneBall(ball: BallState): BallState {
  return { ...ball, position: cloneVec(ball.position), velocity: cloneVec(ball.velocity) };
}

function cloneEvent(event: SimEvent): SimEvent {
  return { ...event, position: cloneVec(event.position) };
}

function cloneTelegraph(telegraph: ThrowTelegraph | null): ThrowTelegraph | null {
  return telegraph ? { ...telegraph } : null;
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
      const playerInput = player.id === state.controlledPlayerId ? input : this.aiInput(player);
      inputMap[player.id] = playerInput;
      this.updateTimers(player, delta);
      this.updateMovement(player, playerInput, delta);
    }

    this.clearAimIfUnavailable();
    for (const player of state.players) {
      if (!player.active) continue;
      this.handleActions(player, inputMap[player.id] ?? EMPTY_INPUT, delta);
    }

    this.updateTelegraph(delta);
    this.updateBall(delta, inputMap);
    this.maybeStartEnemyTelegraph();
    this.checkWinCondition();
  }

  snapshot(): MatchSnapshot {
    return {
      tick: this.snapshotState.tick,
      phase: this.snapshotState.phase,
      clockSeconds: this.snapshotState.clockSeconds,
      momentum: this.snapshotState.momentum,
      controlledPlayerId: this.snapshotState.controlledPlayerId,
      aimTargetId: this.snapshotState.aimTargetId,
      aimCharge: this.snapshotState.aimCharge,
      telegraph: cloneTelegraph(this.snapshotState.telegraph),
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
    if (this.snapshotState.telegraph?.throwerId === player.id) return;
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

    let speedScale = player.dashSeconds > 0 ? 2.2 : 1;
    if (player.id === this.snapshotState.controlledPlayerId && this.snapshotState.ball.ownerId === player.id && input.ballHeld) {
      speedScale *= 0.24;
    }
    const speed = ROLE_SPEED[player.role] * speedScale;
    player.position.x += direction.x * speed * delta;
    player.position.z += direction.z * speed * delta;
    player.position.x = clamp(player.position.x, -ARENA_BOUNDS.halfWidth + PLAYER_RADIUS, ARENA_BOUNDS.halfWidth - PLAYER_RADIUS);
    player.position.z = clamp(player.position.z, -ARENA_BOUNDS.halfDepth + PLAYER_RADIUS, ARENA_BOUNDS.halfDepth - PLAYER_RADIUS);
  }

  private clearAimIfUnavailable(): void {
    const ball = this.snapshotState.ball;
    if (ball.mode === "HELD" && ball.ownerId === this.snapshotState.controlledPlayerId) return;
    this.snapshotState.aimTargetId = null;
    this.snapshotState.aimCharge = 0;
  }

  private handleActions(player: PlayerState, input: InputFrame, delta: number): void {
    if (player.stunSeconds > 0) return;
    const ball = this.snapshotState.ball;
    if (player.id !== this.snapshotState.controlledPlayerId) return;
    if (ball.ownerId !== player.id || ball.mode !== "HELD") return;

    if (input.passPressed && !this.snapshotState.telegraph) {
      const teammate = this.selectTeammate(player, input);
      const target = this.selectAimTarget(player, input, this.snapshotState.aimTargetId);
      if (teammate && target) {
        this.startAssistAttack(player, teammate, target);
        return;
      }
    }

    if (input.ballHeld || input.ballPressed) {
      const target = this.selectAimTarget(player, input, this.snapshotState.aimTargetId);
      if (target) {
        this.snapshotState.aimTargetId = target.id;
        this.snapshotState.aimCharge = clamp(this.snapshotState.aimCharge + delta / HUMAN_AIM_CHARGE_SECONDS, 0, 1);
        player.facing = normalize({ x: target.position.x - player.position.x, z: target.position.z - player.position.z }, player.facing);
        player.lastAction = this.snapshotState.aimCharge >= 0.8 ? "LOCKED" : "AIMING";
      }
    }

    if (input.ballReleased && player.throwCooldown <= 0) {
      const target = this.findPlayer(this.snapshotState.aimTargetId) ?? this.nearestOpponent(player.position, player.team);
      if (!target) return;
      const kind = this.humanThrowKind(input, this.snapshotState.aimCharge);
      const chargeBonus = 1 + this.snapshotState.aimCharge * 0.16;
      this.throwBallAt(player, target, kind, chargeBonus);
      this.snapshotState.aimTargetId = null;
      this.snapshotState.aimCharge = 0;
    }
  }

  private humanThrowKind(input: InputFrame, charge: number): ThrowKind {
    if (charge >= 0.82) return "RUSH";
    if (Math.abs(input.moveX) > 0.55) return "CURVE";
    if (input.moveZ > 0.55) return "SKY";
    return "STRAIGHT";
  }

  private selectAimTarget(player: PlayerState, input: InputFrame, currentId: string | null): PlayerState | null {
    const opponents = this.snapshotState.players.filter((candidate) => candidate.active && candidate.team !== player.team);
    if (opponents.length === 0) return null;
    if (input.moveX > 0.35) return opponents.reduce((best, candidate) => candidate.position.x > best.position.x ? candidate : best);
    if (input.moveX < -0.35) return opponents.reduce((best, candidate) => candidate.position.x < best.position.x ? candidate : best);
    if (input.moveZ > 0.35) return opponents.reduce((best, candidate) => distance(candidate.position, player.position) > distance(best.position, player.position) ? candidate : best);
    if (input.moveZ < -0.35) return opponents.reduce((best, candidate) => distance(candidate.position, player.position) < distance(best.position, player.position) ? candidate : best);
    const current = this.findPlayer(currentId);
    if (current?.active && current.team !== player.team) return current;
    return this.nearestOpponent(player.position, player.team);
  }

  private selectTeammate(player: PlayerState, input: InputFrame): PlayerState | null {
    const teammates = this.snapshotState.players.filter((candidate) => candidate.active && candidate.team === player.team && candidate.id !== player.id);
    if (teammates.length === 0) return null;
    if (input.moveX > 0.35) return teammates.reduce((best, candidate) => candidate.position.x > best.position.x ? candidate : best);
    if (input.moveX < -0.35) return teammates.reduce((best, candidate) => candidate.position.x < best.position.x ? candidate : best);
    return teammates.reduce((closest, candidate) => distance(candidate.position, player.position) < distance(closest.position, player.position) ? candidate : closest);
  }

  private startAssistAttack(player: PlayerState, teammate: PlayerState, target: PlayerState): void {
    const ball = this.snapshotState.ball;
    ball.ownerId = teammate.id;
    ball.throwerId = null;
    ball.position = cloneVec(teammate.position);
    ball.velocity = { x: 0, z: 0 };
    ball.heldSeconds = 0;
    const kind: ThrowKind = teammate.role === "POWER" ? "RUSH" : teammate.role === "TRICK" ? "CURVE" : "STRAIGHT";
    const totalSeconds = teammate.role === "SPEED" ? 0.24 : teammate.role === "POWER" ? 0.4 : 0.32;
    this.snapshotState.telegraph = {
      source: "ASSIST",
      throwerId: teammate.id,
      targetId: target.id,
      kind,
      secondsRemaining: totalSeconds,
      totalSeconds,
    };
    teammate.facing = normalize({ x: target.position.x - teammate.position.x, z: target.position.z - teammate.position.z }, teammate.facing);
    teammate.lastAction = `${teammate.role} ASSIST`;
    player.lastAction = `PASS → ${teammate.name}`;
    this.snapshotState.aimTargetId = null;
    this.snapshotState.aimCharge = 0;
    this.emit("pass", player.id, teammate.id, teammate.position, 0, `${teammate.role} ASSIST`);
  }

  private updateTelegraph(delta: number): void {
    const telegraph = this.snapshotState.telegraph;
    if (!telegraph) return;
    const thrower = this.findPlayer(telegraph.throwerId);
    const target = this.findPlayer(telegraph.targetId);
    const ball = this.snapshotState.ball;
    if (!thrower?.active || !target?.active || ball.mode !== "HELD" || ball.ownerId !== thrower.id) {
      this.snapshotState.telegraph = null;
      return;
    }
    thrower.facing = normalize({ x: target.position.x - thrower.position.x, z: target.position.z - thrower.position.z }, thrower.facing);
    telegraph.secondsRemaining = Math.max(0, telegraph.secondsRemaining - delta);
    if (telegraph.secondsRemaining > 0) return;
    const damageBonus = telegraph.source === "ASSIST" ? 1.1 : 1;
    this.snapshotState.telegraph = null;
    this.throwBallAt(thrower, target, telegraph.kind, damageBonus);
  }

  private maybeStartEnemyTelegraph(): void {
    if (this.snapshotState.telegraph) return;
    const ball = this.snapshotState.ball;
    if (ball.mode !== "HELD" || ball.heldSeconds < ENEMY_HOLD_BEFORE_AIM) return;
    const owner = this.findPlayer(ball.ownerId);
    if (!owner?.active || owner.team !== "red" || owner.throwCooldown > 0) return;
    const target = this.findPlayer(this.snapshotState.controlledPlayerId);
    if (!target?.active) return;
    const kind: ThrowKind = owner.role === "POWER" ? "RUSH" : owner.role === "TRICK" ? "CURVE" : "STRAIGHT";
    const totalSeconds = owner.role === "SPEED" ? 0.62 : owner.role === "POWER" ? 0.86 : 0.76;
    this.snapshotState.telegraph = {
      source: "ENEMY",
      throwerId: owner.id,
      targetId: target.id,
      kind,
      secondsRemaining: totalSeconds,
      totalSeconds,
    };
    owner.facing = normalize({ x: target.position.x - owner.position.x, z: target.position.z - owner.position.z }, owner.facing);
    owner.lastAction = `AIMING ${target.name}`;
  }

  private throwBallAt(player: PlayerState, target: PlayerState, kind: ThrowKind, damageBonus = 1): void {
    const ball = this.snapshotState.ball;
    if (ball.mode !== "HELD" || ball.ownerId !== player.id) return;
    const targetDirection = normalize({ x: target.position.x - player.position.x, z: target.position.z - player.position.z }, player.facing);
    let direction = targetDirection;
    if (kind === "CURVE") {
      const side = target.position.x >= player.position.x ? 1 : -1;
      direction = normalize({ x: targetDirection.x * 0.92 + side * 0.28, z: targetDirection.z * 0.92 }, targetDirection);
    }
    const speed = kind === "RUSH" ? 15.8 : kind === "STRAIGHT" ? 12.7 : kind === "CURVE" ? 11.3 : 10;
    const baseDamage = kind === "SKY" ? 35 : kind === "RUSH" ? 32 : kind === "CURVE" ? 25 : 28;
    const damage = Math.round(baseDamage * ROLE_DAMAGE[player.role] * damageBonus);
    ball.mode = "FLYING";
    ball.ownerId = null;
    ball.throwerId = player.id;
    ball.position = { x: player.position.x + direction.x * 0.85, z: player.position.z + direction.z * 0.85 };
    ball.velocity = { x: direction.x * speed, z: direction.z * speed };
    ball.kind = kind;
    ball.age = 0;
    ball.heldSeconds = 0;
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
        ball.heldSeconds = 0;
        ball.position = owner ? cloneVec(owner.position) : cloneVec(ball.position);
        this.snapshotState.telegraph = null;
      } else {
        ball.heldSeconds += delta;
        ball.position = { x: owner.position.x + owner.facing.x * 0.86, z: owner.position.z + owner.facing.z * 0.86 };
      }
      return;
    }

    ball.age += delta;
    ball.position.x += ball.velocity.x * delta;
    ball.position.z += ball.velocity.z * delta;

    if (ball.mode === "FLYING") {
      const thrower = this.findPlayer(ball.throwerId);
      const throwerTeam = thrower?.team ?? null;
      const catchers = this.snapshotState.players.filter((player) => player.active && player.id !== ball.throwerId && player.team !== throwerTeam);
      for (const player of catchers) {
        if (player.team === "blue" && player.id !== this.snapshotState.controlledPlayerId) continue;
        const input = inputs[player.id] ?? EMPTY_INPUT;
        if (!input.ballPressed || player.catchCooldown > 0 || player.dashSeconds > 0) continue;
        if (distance(player.position, ball.position) > BALL_CATCH_DISTANCE) continue;
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
        return;
      }

      for (const player of catchers) {
        if (distance(player.position, ball.position) > BALL_COLLISION_DISTANCE) continue;
        if (player.dashSeconds > 0) {
          ball.mode = "FREE";
          ball.ownerId = null;
          ball.throwerId = null;
          ball.velocity = { x: -ball.velocity.x * 0.28, z: -ball.velocity.z * 0.28 };
          ball.heldSeconds = 0;
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
        ball.heldSeconds = 0;
      }
      return;
    }

    ball.velocity.x *= Math.pow(0.12, delta);
    ball.velocity.z *= Math.pow(0.12, delta);
    this.handleWall(ball);
    if (ball.mode !== "FREE") return;
    const claimants = this.snapshotState.players.filter((player) => player.active && (player.team === "red" || player.id === this.snapshotState.controlledPlayerId));
    const nearest = claimants.reduce<PlayerState | null>((closest, player) => {
      if (!closest) return player;
      return distance(player.position, ball.position) < distance(closest.position, ball.position) ? player : closest;
    }, null);
    if (nearest && distance(nearest.position, ball.position) < 1.05) {
      ball.mode = "HELD";
      ball.ownerId = nearest.id;
      ball.throwerId = null;
      ball.velocity = { x: 0, z: 0 };
      ball.heldSeconds = 0;
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
        ball.heldSeconds = 0;
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
        ball.heldSeconds = 0;
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
    ball.heldSeconds = 0;
    if (player.hp <= 0) {
      player.active = false;
      player.lastAction = "DOWN";
      this.emit("ko", player.id, null, player.position, 0, "DOWN");
    }
  }

  private aiInput(player: PlayerState): InputFrame {
    const ball = this.snapshotState.ball;
    const input: InputFrame = { ...EMPTY_INPUT };
    const controlled = this.findPlayer(this.snapshotState.controlledPlayerId);
    const nearestOpponent = this.nearestOpponent(player.position, player.team);
    if (!nearestOpponent) return input;

    if (player.team === "blue") {
      const anchor = controlled?.active ? controlled.position : { x: 0, z: -4 };
      const laneX = player.slot === 1 ? anchor.x + 3.2 : anchor.x - 3.2;
      const laneZ = clamp(anchor.z + 0.35, -5.6, -2.1);
      const direction = normalize({ x: laneX - player.position.x, z: laneZ - player.position.z }, player.facing);
      if (distance(player.position, { x: laneX, z: laneZ }) > 0.7) {
        input.moveX = direction.x * 0.55;
        input.moveZ = direction.z * 0.55;
      }
      if (ball.mode === "FLYING" && ball.throwerId && this.findPlayer(ball.throwerId)?.team === "red" && distance(player.position, ball.position) < 1.65 && player.dashCooldown <= 0) {
        input.dashPressed = (this.snapshotState.tick + player.slot * 5) % 13 === 0;
      }
      return input;
    }

    if (ball.mode === "FREE") {
      const direction = normalize({ x: ball.position.x - player.position.x, z: ball.position.z - player.position.z }, player.facing);
      input.moveX = direction.x;
      input.moveZ = direction.z;
      return input;
    }

    if (ball.ownerId === player.id) {
      if (controlled?.active) {
        const direction = normalize({ x: controlled.position.x - player.position.x, z: controlled.position.z - player.position.z }, player.facing);
        input.moveX = direction.x * 0.12;
        input.moveZ = direction.z * 0.12;
      }
      return input;
    }

    if (ball.mode === "FLYING" && ball.throwerId && this.findPlayer(ball.throwerId)?.team === "blue") {
      const towardBall = normalize({ x: ball.position.x - player.position.x, z: ball.position.z - player.position.z }, player.facing);
      input.moveX = towardBall.x * 0.12;
      input.moveZ = towardBall.z * 0.12;
      if (distance(player.position, ball.position) < 1.52 && (this.snapshotState.tick + player.slot * 7) % 8 === 0) input.ballPressed = true;
      if (distance(player.position, ball.position) < 1.34 && player.dashCooldown <= 0 && (this.snapshotState.tick + player.slot * 11) % 17 === 0) input.dashPressed = true;
      return input;
    }

    const spread = player.slot === 0 ? -1 : player.slot === 1 ? 0 : 1;
    const threat = ball.ownerId ? this.findPlayer(ball.ownerId)?.position ?? { x: 0, z: 0 } : { x: 0, z: 0 };
    const away = normalize({ x: player.position.x - threat.x + spread * 1.8, z: player.position.z - threat.z }, player.facing);
    input.moveX = away.x * 0.42;
    input.moveZ = away.z * 0.42;
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

  private findPlayer(id: string | null): PlayerState | null {
    return this.snapshotState.players.find((player) => player.id === id) ?? null;
  }

  private checkWinCondition(): void {
    const blueAlive = this.snapshotState.players.some((player) => player.active && player.team === "blue");
    const redAlive = this.snapshotState.players.some((player) => player.active && player.team === "red");
    if (blueAlive && redAlive) return;
    if (!blueAlive && !redAlive) this.snapshotState.phase = "BLUE_WIN";
    else this.snapshotState.phase = blueAlive ? "BLUE_WIN" : "RED_WIN";
    this.snapshotState.telegraph = null;
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
    const event: SimEvent = {
      id: this.nextEventId++,
      tick: this.snapshotState.tick,
      kind,
      actorId,
      targetId,
      position: cloneVec(position),
      value,
      label,
    };
    if (special) event.special = special;
    this.snapshotState.events.push(event);
  }
}
