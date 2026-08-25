export type TeamId = "blue" | "red";
export type PlayerRole = "POWER" | "SPEED" | "TRICK";
export type ThrowKind = "STRAIGHT" | "CURVE" | "SKY" | "RUSH";
export type BallMode = "HELD" | "FLYING" | "FREE";
export type MatchPhase = "PLAYING" | "BLUE_WIN" | "RED_WIN";

export interface Vec2 {
  x: number;
  z: number;
}

export interface InputFrame {
  moveX: number;
  moveZ: number;
  throwPressed: boolean;
  catchPressed: boolean;
  dashPressed: boolean;
  passPressed: boolean;
}

export const EMPTY_INPUT: InputFrame = {
  moveX: 0,
  moveZ: 0,
  throwPressed: false,
  catchPressed: false,
  dashPressed: false,
  passPressed: false,
};

export function cloneInput(input: InputFrame): InputFrame {
  return { ...input };
}

export interface PlayerState {
  id: string;
  team: TeamId;
  slot: number;
  name: string;
  role: PlayerRole;
  position: Vec2;
  facing: Vec2;
  hp: number;
  maxHp: number;
  active: boolean;
  stunSeconds: number;
  dashSeconds: number;
  dashCooldown: number;
  catchCooldown: number;
  throwCooldown: number;
  combo: number;
  lastAction: string;
}

export interface BallState {
  mode: BallMode;
  ownerId: string | null;
  throwerId: string | null;
  position: Vec2;
  velocity: Vec2;
  kind: ThrowKind;
  age: number;
  damage: number;
  bounces: number;
}

export type SimEventKind = "throw" | "catch" | "pass" | "hit" | "dodge" | "dash" | "ko" | "win";

export interface SimEvent {
  id: number;
  tick: number;
  kind: SimEventKind;
  actorId: string | null;
  targetId: string | null;
  position: Vec2;
  value: number;
  label: string;
  special?: ThrowKind;
}

export interface MatchSnapshot {
  tick: number;
  phase: MatchPhase;
  clockSeconds: number;
  momentum: number;
  players: PlayerState[];
  ball: BallState;
  events: SimEvent[];
}

export const ARENA_BOUNDS = {
  halfWidth: 11,
  halfDepth: 7.3,
};

export const ROLE_COLORS: Record<PlayerRole, number> = {
  POWER: 0xff8b57,
  SPEED: 0x5ce4ff,
  TRICK: 0xd88cff,
};

export const TEAM_COLORS: Record<TeamId, number> = {
  blue: 0x43cfff,
  red: 0xff547d,
};
