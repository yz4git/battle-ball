import { EMPTY_INPUT, type InputFrame } from "./types.ts";

export type InputAction = "throw" | "catch" | "dash" | "pass" | "left" | "right" | "up" | "down";
export type InputOwner = number | string;

export class InputSystem {
  private readonly owners = new Map<InputAction, Set<InputOwner>>();
  private readonly previous = new Set<InputAction>();
  private keyboardCleanup: (() => void) | null = null;

  constructor() {
    for (const action of ["throw", "catch", "dash", "pass", "left", "right", "up", "down"] as InputAction[]) {
      this.owners.set(action, new Set());
    }
  }

  press(action: InputAction, owner: InputOwner): void {
    this.owners.get(action)?.add(owner);
  }

  release(action: InputAction, owner: InputOwner): void {
    this.owners.get(action)?.delete(owner);
  }

  releaseOwner(owner: InputOwner): void {
    for (const entries of this.owners.values()) entries.delete(owner);
  }

  frame(): InputFrame {
    const current = (action: InputAction) => (this.owners.get(action)?.size ?? 0) > 0;
    const edge = (action: InputAction): boolean => {
      const value = current(action);
      const pressed = value && !this.previous.has(action);
      if (value) this.previous.add(action);
      else this.previous.delete(action);
      return pressed;
    };
    const x = (current("right") ? 1 : 0) - (current("left") ? 1 : 0);
    const z = (current("up") ? 1 : 0) - (current("down") ? 1 : 0);
    const length = Math.hypot(x, z);
    return {
      moveX: length > 1 ? x / length : x,
      moveZ: length > 1 ? z / length : z,
      throwPressed: edge("throw"),
      catchPressed: edge("catch"),
      dashPressed: edge("dash"),
      passPressed: edge("pass"),
    };
  }

  clear(): void {
    for (const entries of this.owners.values()) entries.clear();
    this.previous.clear();
  }

  attachKeyboard(target: Document = document): () => void {
    const keyMap: Record<string, InputAction> = {
      arrowleft: "left", a: "left", arrowright: "right", d: "right",
      arrowup: "up", w: "up", arrowdown: "down", s: "down",
      j: "throw", z: "throw", k: "catch", x: "catch", l: "dash", c: "dash", i: "pass", v: "pass",
    };
    const onKey = (event: KeyboardEvent, pressed: boolean) => {
      const action = keyMap[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      if (pressed) this.press(action, "keyboard");
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
