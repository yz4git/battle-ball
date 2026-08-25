import { EMPTY_INPUT, type InputFrame } from "./types.ts";

export type InputAction = "ball" | "dash" | "pass" | "left" | "right" | "up" | "down";
export type InputOwner = number | string;

const ACTIONS: InputAction[] = ["ball", "dash", "pass", "left", "right", "up", "down"];

export class InputSystem {
  private readonly owners = new Map<InputAction, Set<InputOwner>>();
  private readonly pressedEdges = new Set<InputAction>();
  private readonly releasedEdges = new Set<InputAction>();
  private keyboardCleanup: (() => void) | null = null;

  constructor() {
    for (const action of ACTIONS) this.owners.set(action, new Set());
  }

  press(action: InputAction, owner: InputOwner): void {
    const entries = this.owners.get(action);
    if (!entries || entries.has(owner)) return;
    const wasInactive = entries.size === 0;
    entries.add(owner);
    if (wasInactive) this.pressedEdges.add(action);
  }

  release(action: InputAction, owner: InputOwner): void {
    const entries = this.owners.get(action);
    if (!entries || !entries.delete(owner)) return;
    if (entries.size === 0) this.releasedEdges.add(action);
  }

  releaseOwner(owner: InputOwner): void {
    for (const [action, entries] of this.owners) {
      if (!entries.delete(owner)) continue;
      if (entries.size === 0) this.releasedEdges.add(action);
    }
  }

  frame(): InputFrame {
    const held = (action: InputAction) => (this.owners.get(action)?.size ?? 0) > 0;
    const x = (held("right") ? 1 : 0) - (held("left") ? 1 : 0);
    const z = (held("up") ? 1 : 0) - (held("down") ? 1 : 0);
    const length = Math.hypot(x, z);
    const frame = {
      moveX: length > 1 ? x / length : x,
      moveZ: length > 1 ? z / length : z,
      ballHeld: held("ball"),
      ballPressed: this.pressedEdges.has("ball"),
      ballReleased: this.releasedEdges.has("ball"),
      dashPressed: this.pressedEdges.has("dash"),
      passPressed: this.pressedEdges.has("pass"),
    };
    this.pressedEdges.clear();
    this.releasedEdges.clear();
    return frame;
  }

  clear(): void {
    for (const entries of this.owners.values()) entries.clear();
    this.pressedEdges.clear();
    this.releasedEdges.clear();
  }

  attachKeyboard(target: Document = document): () => void {
    const keyMap: Record<string, InputAction> = {
      arrowleft: "left", a: "left", arrowright: "right", d: "right",
      arrowup: "up", w: "up", arrowdown: "down", s: "down",
      j: "ball", z: "ball", k: "ball", x: "ball", l: "dash", c: "dash", i: "pass", v: "pass",
    };
    const onKey = (event: KeyboardEvent, isPressed: boolean) => {
      const action = keyMap[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      if (isPressed) this.press(action, "keyboard");
      else this.release(action, "keyboard");
    };
    const down = (event: KeyboardEvent) => onKey(event, true);
    const up = (event: KeyboardEvent) => onKey(event, false);
    target.addEventListener("keydown", down, { passive: false });
    target.addEventListener("keyup", up, { passive: false });
    this.keyboardCleanup = () => {
      target.removeEventListener("keydown", down);
      target.removeEventListener("keyup", up);
    };
    return this.keyboardCleanup;
  }

  destroy(): void {
    this.keyboardCleanup?.();
    this.keyboardCleanup = null;
    this.clear();
  }
}

export function emptyFrame(): InputFrame {
  return { ...EMPTY_INPUT };
}
