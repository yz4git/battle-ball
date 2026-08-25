import { BattleBallAudio } from "./audio.ts";
import { FixedStepClock } from "./fixed.ts";
import { InputSystem, type InputAction, type InputOwner } from "./input.ts";
import { BattleBallSimulation } from "./simulation.ts";
import type { BattleBallRuntime, GameRuntimeCallbacks } from "./runtime.ts";
import { ARENA_BOUNDS, ROLE_COLORS, TEAM_COLORS, type MatchSnapshot, type PlayerState } from "./types.ts";

function cssColor(color: number, alpha = 1): string {
  const value = color.toString(16).padStart(6, "0");
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(value.slice(2, 4), 16)}, ${Number.parseInt(value.slice(4, 6), 16)}, ${alpha})`;
}

export class BattleBallCanvasDemo implements BattleBallRuntime {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly callbacks: GameRuntimeCallbacks;
  private readonly simulation = new BattleBallSimulation();
  private readonly fixedClock = new FixedStepClock(1 / 60);
  private readonly input = new InputSystem();
  private readonly audio = new BattleBallAudio();
  private readonly animate = (time: number): void => {
    if (this.destroyed) return;
    const elapsed = this.lastTime === 0 ? 0 : Math.min(0.1, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    if (!this.paused) this.fixedClock.advance(elapsed, () => this.simulation.step(this.input.frame()), 8);
    const snapshot = this.simulation.snapshot();
    this.render(snapshot);
    const newEvents = snapshot.events.filter((event) => event.id > this.lastEventId);
    for (const event of newEvents) this.audio.playEvent(event);
    if (newEvents.length > 0) this.lastEventId = newEvents[newEvents.length - 1]?.id ?? this.lastEventId;
    this.callbacks.onSnapshot(snapshot);
    this.frameHandle = window.requestAnimationFrame(this.animate);
  };
  private frameHandle = 0;
  private lastTime = 0;
  private lastEventId = 0;
  private paused: boolean;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, callbacks: GameRuntimeCallbacks, options: { paused?: boolean } = {}) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    this.canvas = canvas;
    this.context = context;
    this.callbacks = callbacks;
    this.paused = options.paused ?? false;
    this.input.attachKeyboard();
    this.callbacks.onSnapshot(this.simulation.snapshot());
    this.frameHandle = window.requestAnimationFrame(this.animate);
  }

  press(action: InputAction, owner: InputOwner): void {
    this.input.press(action, owner);
  }

  release(action: InputAction, owner: InputOwner): void {
    this.input.release(action, owner);
  }

  releaseOwner(owner: InputOwner): void {
    this.input.releaseOwner(owner);
  }

  interact(): void {
    void this.audio.unlock();
  }

  pause(): void {
    this.paused = true;
    this.input.clear();
  }

  resume(): void {
    this.paused = false;
    this.interact();
  }

  reset(): void {
    this.simulation.reset();
    this.fixedClock.reset();
    this.input.clear();
    this.lastEventId = 0;
    this.callbacks.onSnapshot(this.simulation.snapshot());
  }

  snapshot(): MatchSnapshot {
    return this.simulation.snapshot();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.cancelAnimationFrame(this.frameHandle);
    this.input.destroy();
    this.audio.dispose();
  }

  private render(snapshot: MatchSnapshot): void {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
    }
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gradient = this.context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#07122e");
    gradient.addColorStop(1, "#02050d");
    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, width, height);

    const scale = Math.min((width - 34) / (ARENA_BOUNDS.halfWidth * 2), (height - 34) / (ARENA_BOUNDS.halfDepth * 2));
    const originX = width / 2;
    const originY = height / 2;
    const point = (x: number, z: number): [number, number] => [originX + x * scale, originY - z * scale];
    const arenaWidth = ARENA_BOUNDS.halfWidth * 2 * scale;
    const arenaHeight = ARENA_BOUNDS.halfDepth * 2 * scale;
    const arenaLeft = originX - arenaWidth / 2;
    const arenaTop = originY - arenaHeight / 2;

    this.context.fillStyle = cssColor(TEAM_COLORS.blue, 0.13);
    this.context.fillRect(arenaLeft, arenaTop, arenaWidth, arenaHeight / 2);
    this.context.fillStyle = cssColor(TEAM_COLORS.red, 0.11);
    this.context.fillRect(arenaLeft, originY, arenaWidth, arenaHeight / 2);
    this.context.strokeStyle = "rgba(118, 179, 229, .42)";
    this.context.lineWidth = 1;
    this.context.strokeRect(arenaLeft, arenaTop, arenaWidth, arenaHeight);
    this.context.strokeStyle = "rgba(195, 233, 255, .75)";
    this.context.beginPath();
    this.context.moveTo(arenaLeft, originY);
    this.context.lineTo(arenaLeft + arenaWidth, originY);
    this.context.stroke();
    this.context.strokeStyle = "rgba(160, 204, 255, .36)";
    this.context.beginPath();
    this.context.arc(originX, originY, 2.18 * scale, 0, Math.PI * 2);
    this.context.stroke();
    for (let x = -10; x <= 10; x += 2) {
      const [startX, startY] = point(x, -7.1);
      const [endX, endY] = point(x, 7.1);
      this.context.strokeStyle = "rgba(54, 112, 158, .18)";
      this.context.beginPath();
      this.context.moveTo(startX, startY);
      this.context.lineTo(endX, endY);
      this.context.stroke();
    }

    for (const player of snapshot.players) this.drawPlayer(player, point, scale);
    const [ballX, ballY] = point(snapshot.ball.position.x, snapshot.ball.position.z);
    const ballColor = snapshot.ball.mode === "FLYING" ? "#ff9a62" : "#fff1ad";
    this.context.fillStyle = `${ballColor}22`;
    this.context.beginPath();
    this.context.arc(ballX, ballY, scale * 0.8, 0, Math.PI * 2);
    this.context.fill();
    this.context.fillStyle = ballColor;
    this.context.beginPath();
    this.context.arc(ballX, ballY, Math.max(4, scale * 0.34), 0, Math.PI * 2);
    this.context.fill();
    this.context.strokeStyle = "rgba(255, 255, 255, .7)";
    this.context.stroke();
  }

  private drawPlayer(player: PlayerState, point: (x: number, z: number) => [number, number], scale: number): void {
    const [x, y] = point(player.position.x, player.position.z);
    if (!player.active) {
      this.context.strokeStyle = "rgba(150, 165, 190, .32)";
      this.context.beginPath();
      this.context.arc(x, y, scale * 0.5, 0, Math.PI * 2);
      this.context.stroke();
      return;
    }
    this.context.fillStyle = "rgba(0, 0, 0, .35)";
    this.context.beginPath();
    this.context.ellipse(x, y + scale * 0.38, scale * 0.76, scale * 0.3, 0, 0, Math.PI * 2);
    this.context.fill();
    this.context.fillStyle = cssColor(TEAM_COLORS[player.team], 0.2);
    this.context.beginPath();
    this.context.arc(x, y, scale * 0.78, 0, Math.PI * 2);
    this.context.fill();
    this.context.fillStyle = cssColor(ROLE_COLORS[player.role]);
    this.context.beginPath();
    this.context.arc(x, y, scale * 0.56, 0, Math.PI * 2);
    this.context.fill();
    this.context.strokeStyle = cssColor(TEAM_COLORS[player.team], 0.95);
    this.context.lineWidth = Math.max(2, scale * 0.08);
    this.context.stroke();
    const hpWidth = scale * 1.36;
    this.context.fillStyle = "rgba(6, 11, 24, .85)";
    this.context.fillRect(x - hpWidth / 2, y - scale * 1.12, hpWidth, Math.max(3, scale * 0.12));
    this.context.fillStyle = cssColor(TEAM_COLORS[player.team], 0.95);
    this.context.fillRect(x - hpWidth / 2, y - scale * 1.12, hpWidth * (player.hp / player.maxHp), Math.max(3, scale * 0.12));
  }
}
