import "./styles.css";
import { BattleBallCanvasDemo } from "./game/canvas-demo.ts";
import type { InputAction } from "./game/input.ts";
import { BattleBallWebGLDemo } from "./game/webgl-demo.ts";
import { directionVector, VirtualPadTracker, type DigitalDirection } from "./game/virtual-pad.ts";
import { registerBattleBallServiceWorker } from "./service-worker-registration.ts";
import type { BattleBallRuntime, GameRuntimeCallbacks } from "./game/runtime.ts";
import type { MatchSnapshot, PlayerState, TeamId } from "./game/types.ts";

const appElement = document.querySelector<HTMLElement>("#app");
if (!appElement) throw new Error("BATTLE BALL mount is missing");
const app: HTMLElement = appElement;

app.innerHTML = `
  <div class="game-shell">
    <canvas id="game-canvas" aria-label="BATTLE BALL arena"></canvas>
    <div class="world-vignette" aria-hidden="true"></div>
    <div class="world-noise" aria-hidden="true"></div>

    <header class="hud">
      <div class="brand-lockup">
        <span class="brand-kicker">ARCADE PROTOCOL 01</span>
        <strong class="brand-title">BATTLE <i>BALL</i></strong>
      </div>
      <div class="match-core">
        <span id="match-label" class="match-label">LOCAL // 3v3</span>
        <strong id="match-clock" class="match-clock">00:00</strong>
        <div class="momentum-track" aria-label="Momentum">
          <span class="momentum-blue"></span>
          <i id="momentum-fill"></i>
          <span class="momentum-red"></span>
        </div>
        <span id="ball-state" class="ball-state">BALL // BOLT</span>
      </div>
      <button id="pause-button" class="icon-button" type="button" aria-label="Pause match">Ⅱ</button>
    </header>

    <section class="team-hud team-hud--blue" aria-label="Blue team status">
      <div class="team-heading"><span class="team-dot"></span><span>BLUE UNIT</span><strong id="blue-alive">3 / 3</strong></div>
      <div class="team-hp"><i id="blue-hp"></i></div>
      <span class="team-note">CATCH &amp; COUNTER</span>
    </section>
    <section class="team-hud team-hud--red" aria-label="Red team status">
      <div class="team-heading"><span class="team-dot"></span><span>RED UNIT</span><strong id="red-alive">3 / 3</strong></div>
      <div class="team-hp"><i id="red-hp"></i></div>
      <span class="team-note">PRESSURE MODE</span>
    </section>

    <div id="event-feed" class="event-feed" aria-live="polite"></div>
    <div id="callout" class="callout" aria-live="polite"></div>

    <div class="touch-controls" aria-label="Touch controls">
      <div id="virtual-pad" class="virtual-pad" aria-label="Move">
        <div class="pad-ring"><div class="pad-knob"></div></div>
        <span class="pad-caption">MOVE</span>
      </div>
      <div class="action-cluster">
        <button class="action-button action-button--pass" data-action="pass" type="button"><span>PASS</span><b>I</b></button>
        <button class="action-button action-button--dash" data-action="dash" type="button"><span>DASH</span><b>Ⅲ</b></button>
        <button class="action-button action-button--catch" data-action="catch" type="button"><span>CATCH</span><b>K</b></button>
        <button class="action-button action-button--throw" data-action="throw" type="button"><span>THROW</span><b>J</b></button>
      </div>
    </div>

    <section id="start-screen" class="screen screen--start">
      <div class="screen-card">
        <span class="screen-eyebrow">DODGEBALL / REWIRED</span>
        <h1>READ THE<br><em>RHYTHM.</em></h1>
        <p>キャッチで流れを奪い、投げ返して一気に決めろ。<br>3人の役割を使い分け、相手の最後の一人を倒せ。</p>
        <button id="start-button" class="primary-button" type="button"><span>ENTER ARENA</span><b>→</b></button>
        <div class="screen-foot"><span>LANDSCAPE / IPHONE READY</span><span>LOCAL 3v3</span></div>
      </div>
    </section>

    <section id="pause-screen" class="screen screen--pause" hidden>
      <div class="screen-card screen-card--compact">
        <span class="screen-eyebrow">MATCH PAUSED</span>
        <h2>TAKE A<br><em>BREATH.</em></h2>
        <button id="resume-button" class="primary-button" type="button"><span>RESUME</span><b>→</b></button>
      </div>
    </section>

    <section id="result-screen" class="screen screen--result" hidden>
      <div class="screen-card screen-card--compact">
        <span id="result-eyebrow" class="screen-eyebrow">MATCH COMPLETE</span>
        <h2 id="result-title">BLUE<br><em>WINS.</em></h2>
        <p id="result-copy">Momentum belongs to the team that caught the moment.</p>
        <button id="rematch-button" class="primary-button" type="button"><span>REMATCH</span><b>↻</b></button>
      </div>
    </section>

    <div class="portrait-lock"><strong>ROTATE YOUR IPHONE</strong><span>BATTLE BALL is tuned for landscape play</span></div>
  </div>
`;

const canvasElement = app.querySelector<HTMLCanvasElement>("#game-canvas");
if (!canvasElement) throw new Error("BATTLE BALL canvas is missing");
const canvas: HTMLCanvasElement = canvasElement;

const startScreen = app.querySelector<HTMLElement>("#start-screen");
const pauseScreen = app.querySelector<HTMLElement>("#pause-screen");
const resultScreen = app.querySelector<HTMLElement>("#result-screen");
const startButton = app.querySelector<HTMLButtonElement>("#start-button");
const resumeButton = app.querySelector<HTMLButtonElement>("#resume-button");
const rematchButton = app.querySelector<HTMLButtonElement>("#rematch-button");
const pauseButton = app.querySelector<HTMLButtonElement>("#pause-button");
const pad = app.querySelector<HTMLElement>("#virtual-pad");
const padKnob = app.querySelector<HTMLElement>(".pad-knob");
const callout = app.querySelector<HTMLElement>("#callout");
const eventFeed = app.querySelector<HTMLElement>("#event-feed");
const clockLabel = app.querySelector<HTMLElement>("#match-clock");
const matchLabel = app.querySelector<HTMLElement>("#match-label");
const ballStateLabel = app.querySelector<HTMLElement>("#ball-state");
const momentumFill = app.querySelector<HTMLElement>("#momentum-fill");
const blueAlive = app.querySelector<HTMLElement>("#blue-alive");
const redAlive = app.querySelector<HTMLElement>("#red-alive");
const blueHp = app.querySelector<HTMLElement>("#blue-hp");
const redHp = app.querySelector<HTMLElement>("#red-hp");

let runtime: BattleBallRuntime | null = null;
let matchStarted = false;
let isPaused = true;
let usedCanvasFallback = false;
let feedEvents: { id: number; label: string; kind: string }[] = [];

const callbacks: GameRuntimeCallbacks = {
  onSnapshot: updateHud,
  onRuntimeFailure: () => switchToCanvasFallback(),
};

function createRuntime(forceCanvas = false): BattleBallRuntime {
  if (forceCanvas) return new BattleBallCanvasDemo(canvas, callbacks, { paused: true });
  return new BattleBallWebGLDemo(canvas, callbacks, { paused: true });
}

try {
  runtime = createRuntime();
} catch {
  switchToCanvasFallback();
}

function switchToCanvasFallback(): void {
  if (usedCanvasFallback) return;
  usedCanvasFallback = true;
  runtime?.destroy();
  try {
    runtime = createRuntime(true);
    matchLabel?.classList.add("is-fallback");
    if (matchLabel) matchLabel.textContent = "CANVAS SAFE MODE // 3v3";
  } catch {
    if (matchLabel) matchLabel.textContent = "RUNTIME ERROR // RELOAD";
  }
}

function updateHud(snapshot: MatchSnapshot): void {
  const teamStats = (team: TeamId) => {
    const players = snapshot.players.filter((player) => player.team === team);
    return {
      alive: players.filter((player) => player.active).length,
      hp: players.reduce((total, player) => total + player.hp, 0),
      maxHp: players.reduce((total, player) => total + player.maxHp, 0),
    };
  };
  const blue = teamStats("blue");
  const red = teamStats("red");
  if (blueAlive) blueAlive.textContent = `${blue.alive} / 3`;
  if (redAlive) redAlive.textContent = `${red.alive} / 3`;
  if (blueHp) blueHp.style.width = `${(blue.hp / blue.maxHp) * 100}%`;
  if (redHp) redHp.style.width = `${(red.hp / red.maxHp) * 100}%`;
  if (momentumFill) {
    momentumFill.style.width = `${Math.max(2, Math.min(98, snapshot.momentum))}%`;
  }
  if (clockLabel) clockLabel.textContent = formatClock(snapshot.clockSeconds);
  const owner = snapshot.players.find((player) => player.id === snapshot.ball.ownerId);
  if (ballStateLabel) ballStateLabel.textContent = `BALL // ${snapshot.ball.mode === "HELD" ? owner?.name ?? "READY" : snapshot.ball.kind}`;
  if (snapshot.phase !== "PLAYING" && matchStarted && resultScreen?.hidden) showResult(snapshot);

  const newEvents = snapshot.events.filter((event) => !feedEvents.some((known) => known.id === event.id));
  if (newEvents.length > 0) {
    feedEvents = [...feedEvents, ...newEvents.map((event) => ({ id: event.id, label: event.label, kind: event.kind }))].slice(-4);
    renderFeed();
    const headline = newEvents[newEvents.length - 1]?.label;
    if (headline && callout) {
      callout.textContent = headline;
      callout.dataset.kind = newEvents[newEvents.length - 1]?.kind ?? "";
      callout.classList.remove("is-live");
      void callout.offsetWidth;
      callout.classList.add("is-live");
    }
  }
}

function renderFeed(): void {
  if (!eventFeed) return;
  eventFeed.innerHTML = feedEvents.map((event) => `<span class="feed-item feed-item--${event.kind}">${escapeHtml(event.label)}</span>`).join("");
}

function showResult(snapshot: MatchSnapshot): void {
  isPaused = true;
  runtime?.pause();
  const blueWon = snapshot.phase === "BLUE_WIN";
  const resultTitle = app.querySelector<HTMLElement>("#result-title");
  const resultCopy = app.querySelector<HTMLElement>("#result-copy");
  if (resultTitle) resultTitle.innerHTML = `${blueWon ? "BLUE" : "RED"}<br><em>WINS.</em>`;
  if (resultCopy) resultCopy.textContent = blueWon ? "キャッチから始まった逆転。BLUE UNITが流れを制した。" : "最後まで押し切った。RED UNITがアリーナを支配した。";
  if (resultScreen) resultScreen.hidden = false;
}

function formatClock(seconds: number): string {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function startMatch(): void {
  matchStarted = true;
  isPaused = false;
  resetPad();
  startScreen?.setAttribute("hidden", "true");
  pauseScreen?.setAttribute("hidden", "true");
  resultScreen?.setAttribute("hidden", "true");
  runtime?.interact();
  runtime?.resume();
}

function togglePause(): void {
  if (!matchStarted || !runtime) return;
  isPaused = !isPaused;
  if (isPaused) {
    resetPad();
    runtime.pause();
    if (pauseScreen) pauseScreen.hidden = false;
    if (pauseButton) pauseButton.textContent = "▶";
  } else {
    runtime.resume();
    if (pauseScreen) pauseScreen.hidden = true;
    if (pauseButton) pauseButton.textContent = "Ⅱ";
  }
}

function rematch(): void {
  feedEvents = [];
  renderFeed();
  resetPad();
  runtime?.reset();
  if (resultScreen) resultScreen.hidden = true;
  matchStarted = true;
  isPaused = false;
  runtime?.interact();
  runtime?.resume();
}

startButton?.addEventListener("click", startMatch);
resumeButton?.addEventListener("click", togglePause);
rematchButton?.addEventListener("click", rematch);
pauseButton?.addEventListener("click", togglePause);

const virtualPad = new VirtualPadTracker();

function applyPadDirection(direction: DigitalDirection): void {
  runtime?.releaseOwner("pad");
  const vector = directionVector(direction);
  if (vector.x < -0.1) runtime?.press("left", "pad");
  if (vector.x > 0.1) runtime?.press("right", "pad");
  if (vector.z < -0.1) runtime?.press("down", "pad");
  if (vector.z > 0.1) runtime?.press("up", "pad");
  if (padKnob) {
    padKnob.style.setProperty("--pad-x", `${vector.x * 28}px`);
    padKnob.style.setProperty("--pad-y", `${-vector.z * 28}px`);
  }
}

function padCoordinates(event: PointerEvent): { x: number; y: number; radius: number } {
  const rect = pad?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0, radius: 1 };
  return {
    x: event.clientX - (rect.left + rect.width / 2),
    y: rect.top + rect.height / 2 - event.clientY,
    radius: Math.min(rect.width, rect.height) * 0.5,
  };
}

pad?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  pad.setPointerCapture?.(event.pointerId);
  const point = padCoordinates(event);
  applyPadDirection(virtualPad.begin(event.pointerId, point.x, point.y, point.radius));
});
pad?.addEventListener("pointermove", (event) => {
  if (virtualPad.pointerId !== event.pointerId) return;
  event.preventDefault();
  const point = padCoordinates(event);
  applyPadDirection(virtualPad.move(event.pointerId, point.x, point.y, point.radius));
});
const releasePad = (event: PointerEvent): void => {
  if (virtualPad.pointerId !== event.pointerId) return;
  virtualPad.release(event.pointerId);
  runtime?.releaseOwner("pad");
  applyPadDirection("NEUTRAL");
};
const resetPad = (): void => {
  virtualPad.reset();
  runtime?.releaseOwner("pad");
  applyPadDirection("NEUTRAL");
};
pad?.addEventListener("pointerup", releasePad);
pad?.addEventListener("pointercancel", releasePad);
pad?.addEventListener("lostpointercapture", releasePad);
window.addEventListener("pointerup", releasePad);
window.addEventListener("pointercancel", releasePad);

for (const button of app.querySelectorAll<HTMLButtonElement>(".action-button")) {
  const action = button.dataset.action as InputAction;
  const owner = `button:${action}`;
  const release = (): void => runtime?.release(action, owner);
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    runtime?.press(action, owner);
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
}

window.addEventListener("blur", () => {
  resetPad();
  runtime?.releaseOwner("keyboard");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) resetPad();
});
window.addEventListener("pagehide", resetPad);
window.addEventListener("contextmenu", (event) => event.preventDefault());
registerBattleBallServiceWorker();

// Keeps the first HUD frame useful even before the first animation callback.
if (runtime) updateHud(runtime.snapshot());
