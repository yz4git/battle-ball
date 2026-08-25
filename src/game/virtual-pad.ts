export type DigitalDirection =
  | "NEUTRAL"
  | "LEFT"
  | "UP_LEFT"
  | "UP"
  | "UP_RIGHT"
  | "RIGHT"
  | "DOWN_RIGHT"
  | "DOWN"
  | "DOWN_LEFT";

const ORDER: Exclude<DigitalDirection, "NEUTRAL">[] = [
  "UP", "UP_RIGHT", "RIGHT", "DOWN_RIGHT", "DOWN", "DOWN_LEFT", "LEFT", "UP_LEFT",
];

export const VIRTUAL_PAD_DEADZONE = 0.2;
export const VIRTUAL_PAD_HYSTERESIS_DEGREES = 6;

function wrapDegrees(value: number): number {
  let result = value % 360;
  if (result > 180) result -= 360;
  if (result < -180) result += 360;
  return result;
}

function directionAngle(direction: Exclude<DigitalDirection, "NEUTRAL">): number {
  return ORDER.indexOf(direction) * 45;
}

/** Converts a pad vector (where positive y means the top of the pad) to 8-way input. */
export function quantizeDirection(
  x: number,
  y: number,
  outerRadius: number,
  previous: DigitalDirection = "NEUTRAL",
  deadzone = VIRTUAL_PAD_DEADZONE,
  hysteresisDegrees = VIRTUAL_PAD_HYSTERESIS_DEGREES,
): DigitalDirection {
  const radius = Math.max(0, outerRadius);
  const magnitude = Math.hypot(x, y);
  if (!Number.isFinite(magnitude) || radius <= 0 || magnitude <= radius * deadzone) return "NEUTRAL";
  const angle = (Math.atan2(x, y) * 180) / Math.PI;
  const sector = Math.round(angle / 45);
  const candidate = ORDER[((sector % 8) + 8) % 8] ?? "UP";
  if (previous === "NEUTRAL") return candidate;
  const previousAngle = directionAngle(previous);
  const distanceFromPrevious = Math.abs(wrapDegrees(angle - previousAngle));
  return distanceFromPrevious <= 22.5 + Math.max(0, hysteresisDegrees) ? previous : candidate;
}

export function directionVector(direction: DigitalDirection): { x: number; z: number } {
  switch (direction) {
    case "LEFT": return { x: -1, z: 0 };
    case "UP_LEFT": return { x: -0.707, z: 0.707 };
    case "UP": return { x: 0, z: 1 };
    case "UP_RIGHT": return { x: 0.707, z: 0.707 };
    case "RIGHT": return { x: 1, z: 0 };
    case "DOWN_RIGHT": return { x: 0.707, z: -0.707 };
    case "DOWN": return { x: 0, z: -1 };
    case "DOWN_LEFT": return { x: -0.707, z: -0.707 };
    case "NEUTRAL": return { x: 0, z: 0 };
  }
}

export class VirtualPadTracker {
  pointerId: number | null = null;
  direction: DigitalDirection = "NEUTRAL";

  begin(pointerId: number, x: number, y: number, radius: number): DigitalDirection {
    if (this.pointerId !== null) return this.direction;
    this.pointerId = pointerId;
    return this.update(pointerId, x, y, radius);
  }

  move(pointerId: number, x: number, y: number, radius: number): DigitalDirection {
    return this.update(pointerId, x, y, radius);
  }

  release(pointerId: number): void {
    if (this.pointerId !== pointerId) return;
    this.pointerId = null;
    this.direction = "NEUTRAL";
  }

  reset(): void {
    this.pointerId = null;
    this.direction = "NEUTRAL";
  }

  private update(pointerId: number, x: number, y: number, radius: number): DigitalDirection {
    if (this.pointerId !== pointerId) return this.direction;
    this.direction = quantizeDirection(x, y, radius, this.direction);
    return this.direction;
  }
}
