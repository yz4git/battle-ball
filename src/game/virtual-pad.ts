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

export function quantizeDirection(x: number, y: number, radius: number, previous: DigitalDirection = "NEUTRAL"): DigitalDirection {
  const magnitude = Math.hypot(x, y);
  if (!Number.isFinite(magnitude) || radius <= 0 || magnitude <= radius * 0.2) return "NEUTRAL";
  const angle = (Math.atan2(x, y) * 180) / Math.PI;
  const sector = Math.round(angle / 45);
  const candidate = ORDER[((sector % 8) + 8) % 8] ?? "UP";
  if (previous === "NEUTRAL") return candidate;
  const previousAngle = ORDER.indexOf(previous) * 45;
  let delta = Math.abs(angle - previousAngle) % 360;
  if (delta > 180) delta = 360 - delta;
  return delta <= 29 ? previous : candidate;
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
