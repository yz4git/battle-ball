import type { InputFrame, MatchSnapshot, SimEvent } from "./types.ts";

export const BATTLE_BALL_PROTOCOL_VERSION = 1;

export interface InputCommand {
  type: "input";
  protocol: number;
  roomId: string;
  clientId: string;
  playerId: string;
  tick: number;
  sequence: number;
  input: InputFrame;
}

export interface SnapshotMessage {
  type: "snapshot";
  protocol: number;
  roomId: string;
  tick: number;
  snapshot: MatchSnapshot;
  events: SimEvent[];
}

export interface RoomMessage {
  type: "hello" | "join" | "leave" | "ping" | "ack";
  protocol: number;
  roomId: string;
  clientId: string;
  sentAt: number;
}

export type BattleBallMessage = InputCommand | SnapshotMessage | RoomMessage;

export interface BattleBallTransport {
  send(message: BattleBallMessage): void;
  onMessage(listener: (message: BattleBallMessage) => void): () => void;
  close(): void;
}

/** Local transport used by the offline game and by deterministic tests. */
export class LocalLoopbackTransport implements BattleBallTransport {
  private readonly listeners = new Set<(message: BattleBallMessage) => void>();

  send(message: BattleBallMessage): void {
    queueMicrotask(() => {
      for (const listener of this.listeners) listener(message);
    });
  }

  onMessage(listener: (message: BattleBallMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.listeners.clear();
  }
}

export function makeInputCommand(
  roomId: string,
  clientId: string,
  playerId: string,
  tick: number,
  sequence: number,
  input: InputFrame,
): InputCommand {
  return { type: "input", protocol: BATTLE_BALL_PROTOCOL_VERSION, roomId, clientId, playerId, tick, sequence, input: { ...input } };
}
