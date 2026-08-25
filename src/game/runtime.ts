import type { InputAction, InputOwner } from "./input.ts";
import type { MatchSnapshot } from "./types.ts";

export interface GameRuntimeCallbacks {
  onSnapshot: (snapshot: MatchSnapshot) => void;
  onRuntimeFailure?: (error: Error) => void;
}

export interface BattleBallRuntime {
  press(action: InputAction, owner: InputOwner): void;
  release(action: InputAction, owner: InputOwner): void;
  releaseOwner(owner: InputOwner): void;
  interact(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  snapshot(): MatchSnapshot;
  destroy(): void;
}
