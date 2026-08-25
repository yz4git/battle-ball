import * as THREE from "three";
import { BattleBallAudio } from "./audio.ts";
import { BattleBallEffects } from "./effects.ts";
import { FixedStepClock } from "./fixed.ts";
import { InputSystem, type InputAction, type InputOwner } from "./input.ts";
import { BattleBallSimulation } from "./simulation.ts";
import type { BattleBallRuntime, GameRuntimeCallbacks } from "./runtime.ts";
import {
  ARENA_BOUNDS,
  ROLE_COLORS,
  TEAM_COLORS,
  type MatchSnapshot,
  type PlayerState,
  type ThrowKind,
} from "./types.ts";

interface PlayerVisual {
  root: THREE.Group;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  body: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  head: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>;
  hpFill: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  activeScale: number;
}

const BALL_COLORS: Record<ThrowKind, number> = {
  STRAIGHT: 0xfff0b0,
  CURVE: 0xd18aff,
  SKY: 0x9affd0,
  RUSH: 0xff885b,
};

const PLAYER_HEIGHT = 0.7;

export class BattleBallWebGLDemo implements BattleBallRuntime {
  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: GameRuntimeCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly simulation = new BattleBallSimulation();
  private readonly fixedClock = new FixedStepClock(1 / 60);
  private readonly input = new InputSystem();
  private readonly effects: BattleBallEffects;
  private readonly audio = new BattleBallAudio();
  private readonly playerVisuals = new Map<string, PlayerVisual>();
  private readonly ballRoot = new THREE.Group();
  private ballMesh!: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>;
  private ballAura!: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private ballRing!: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly trailMeshes: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly trailPositions: THREE.Vector3[] = [];
  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    if (!this.destroyed) this.callbacks.onRuntimeFailure?.(new Error("WebGL context was lost"));
  };
  private readonly animate = (time: number): void => {
    if (this.destroyed) return;
    const elapsed = this.lastTime === 0 ? 0 : Math.min(0.1, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    if (!this.paused) {
      this.fixedClock.advance(elapsed, () => this.simulation.step(this.input.frame()), 8);
    }
    this.renderFrame(elapsed);
    this.frameHandle = window.requestAnimationFrame(this.animate);
  };

  private frameHandle = 0;
  private lastTime = 0;
  private paused: boolean;
  private destroyed = false;
  private lastEventId = 0;
  private cameraShake = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: GameRuntimeCallbacks, options: { paused?: boolean } = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.paused = options.paused ?? false;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.canvas.addEventListener("webglcontextlost", this.onContextLost, { passive: false });
    this.scene.background = new THREE.Color(0x050a19);
    this.scene.fog = new THREE.Fog(0x050a19, 22, 52);
    // Keep +Z aligned with the top of the arena and the virtual pad.
    // Looking from -Z makes WebGL match the Canvas projection and avoids
    // making the player's UP input move down the screen.
    this.camera.position.set(0, 16.8, -18.8);
    this.camera.lookAt(0, 0, 0);
    this.createLights();
    this.createArena();
    this.createBall();
    this.effects = new BattleBallEffects(this.scene);
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
    this.cameraShake = 0;
    this.callbacks.onSnapshot(this.simulation.snapshot());
  }

  snapshot(): MatchSnapshot {
    return this.simulation.snapshot();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.cancelAnimationFrame(this.frameHandle);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.input.destroy();
    this.effects.dispose();
    this.audio.dispose();
    this.disposeScene();
    this.renderer.dispose();
  }

  private createLights(): void {
    this.scene.add(new THREE.HemisphereLight(0x8dbbff, 0x071020, 2.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(-5, 15, 8);
    this.scene.add(key);
    const blue = new THREE.PointLight(TEAM_COLORS.blue, 8, 20, 2);
    blue.position.set(-8, 4, -2);
    this.scene.add(blue);
    const red = new THREE.PointLight(TEAM_COLORS.red, 8, 20, 2);
    red.position.set(8, 4, 2);
    this.scene.add(red);
  }

  private createArena(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(22.7, 15.1),
      new THREE.MeshStandardMaterial({ color: 0x071630, roughness: 0.82, metalness: 0.22 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const blueHalf = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 7.1),
      new THREE.MeshBasicMaterial({ color: TEAM_COLORS.blue, transparent: true, opacity: 0.055, depthWrite: false }),
    );
    blueHalf.rotation.x = -Math.PI / 2;
    blueHalf.position.set(0, 0.012, -3.55);
    this.scene.add(blueHalf);
    const redHalf = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 7.1),
      new THREE.MeshBasicMaterial({ color: TEAM_COLORS.red, transparent: true, opacity: 0.045, depthWrite: false }),
    );
    redHalf.rotation.x = -Math.PI / 2;
    redHalf.position.set(0, 0.013, 3.55);
    this.scene.add(redHalf);

    const grid = new THREE.GridHelper(22, 22, 0x24658a, 0x102946);
    grid.position.y = 0.035;
    grid.scale.z = 0.66;
    this.scene.add(grid);

    const centerLine = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.035, 0.07),
      new THREE.MeshBasicMaterial({ color: 0xe7f5ff, transparent: true, opacity: 0.72 }),
    );
    centerLine.position.y = 0.06;
    this.scene.add(centerLine);
    const centerCircle = new THREE.Mesh(
      new THREE.RingGeometry(2.15, 2.21, 48),
      new THREE.MeshBasicMaterial({ color: 0xb4d7ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    );
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.y = 0.065;
    this.scene.add(centerCircle);

    this.addRail(0, -ARENA_BOUNDS.halfDepth, 22.4, 0.11, TEAM_COLORS.blue);
    this.addRail(0, ARENA_BOUNDS.halfDepth, 22.4, 0.11, TEAM_COLORS.red);
    this.addRail(-ARENA_BOUNDS.halfWidth, 0, 0.11, 14.6, 0x6a91b8);
    this.addRail(ARENA_BOUNDS.halfWidth, 0, 0.11, 14.6, 0x6a91b8);

    for (const [x, z, color] of [
      [-ARENA_BOUNDS.halfWidth, -ARENA_BOUNDS.halfDepth, TEAM_COLORS.blue],
      [ARENA_BOUNDS.halfWidth, -ARENA_BOUNDS.halfDepth, TEAM_COLORS.blue],
      [-ARENA_BOUNDS.halfWidth, ARENA_BOUNDS.halfDepth, TEAM_COLORS.red],
      [ARENA_BOUNDS.halfWidth, ARENA_BOUNDS.halfDepth, TEAM_COLORS.red],
    ] as [number, number, number][]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.21, 1.8, 8),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.45 }),
      );
      post.position.set(x, 0.82, z);
      this.scene.add(post);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 10, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.86 }),
      );
      cap.position.set(x, 1.78, z);
      this.scene.add(cap);
    }
  }

  private addRail(x: number, z: number, width: number, depth: number, color: number): void {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.13, depth),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.84 }),
    );
    rail.position.set(x, 0.14, z);
    this.scene.add(rail);
  }

  private createBall(): void {
    this.ballMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.38, 1),
      new THREE.MeshStandardMaterial({ color: BALL_COLORS.STRAIGHT, emissive: BALL_COLORS.STRAIGHT, emissiveIntensity: 1.8, roughness: 0.28, metalness: 0.1, flatShading: true }),
    );
    this.ballMesh.castShadow = false;
    this.ballRoot.add(this.ballMesh);
    this.ballAura = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 12, 8),
      new THREE.MeshBasicMaterial({ color: BALL_COLORS.STRAIGHT, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.ballRoot.add(this.ballAura);
    this.ballRing = new THREE.Mesh(
      new THREE.RingGeometry(0.54, 0.62, 20),
      new THREE.MeshBasicMaterial({ color: BALL_COLORS.STRAIGHT, transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.ballRing.rotation.x = -Math.PI / 2;
    this.ballRing.position.y = -0.44;
    this.ballRoot.add(this.ballRing);
    for (let index = 0; index < 9; index += 1) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 6, 4),
        new THREE.MeshBasicMaterial({ color: BALL_COLORS.STRAIGHT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      mesh.visible = false;
      this.trailMeshes.push(mesh);
      this.ballRoot.add(mesh);
    }
    this.ballRoot.position.set(-5, 0.6, -4);
    this.scene.add(this.ballRoot);
  }

  private renderFrame(delta: number): void {
    const snapshot = this.simulation.snapshot();
    const newEvents = snapshot.events.filter((event) => event.id > this.lastEventId);
    if (newEvents.length > 0) {
      this.cameraShake = Math.max(this.cameraShake, this.effects.handleEvents(newEvents));
      for (const event of newEvents) this.audio.playEvent(event);
      this.lastEventId = newEvents[newEvents.length - 1]?.id ?? this.lastEventId;
    }
    this.updatePlayers(snapshot);
    this.updateBall(snapshot);
    this.effects.update(delta);
    this.updateCamera(snapshot, delta);
    this.resize();
    this.renderer.render(this.scene, this.camera);
    this.callbacks.onSnapshot(snapshot);
  }

  private updatePlayers(snapshot: MatchSnapshot): void {
    for (const player of snapshot.players) {
      let visual = this.playerVisuals.get(player.id);
      if (!visual) {
        visual = this.createPlayerVisual(player);
        this.playerVisuals.set(player.id, visual);
        this.scene.add(visual.root);
      }
      const target = new THREE.Vector3(player.position.x, 0, player.position.z);
      visual.root.position.lerp(target, 0.35);
      visual.root.rotation.y = Math.atan2(player.facing.x, player.facing.z);
      visual.root.visible = player.active || player.stunSeconds > 0;
      visual.activeScale = THREE.MathUtils.lerp(visual.activeScale, player.active ? 1 : 0.78, 0.22);
      visual.root.scale.set(visual.activeScale, visual.activeScale, visual.activeScale);
      visual.body.material.emissiveIntensity = player.stunSeconds > 0 ? 3.4 : 1.2;
      const isControlled = player.id === snapshot.controlledPlayerId;
      const isAimTarget = player.id === snapshot.aimTargetId;
      const isTelegraphThrower = player.id === snapshot.telegraph?.throwerId;
      const ringColor = isTelegraphThrower ? 0xffd166 : isAimTarget ? 0xffffff : TEAM_COLORS[player.team];
      visual.ring.material.color.setHex(ringColor);
      visual.ring.material.opacity = player.stunSeconds > 0 || isControlled || isAimTarget || isTelegraphThrower ? 0.98 : 0.58;
      const ringPulse = isTelegraphThrower ? 1.16 + Math.sin(snapshot.clockSeconds * 18) * 0.12 : isAimTarget ? 1.12 : player.stunSeconds > 0 ? 1.1 : 1;
      visual.ring.scale.setScalar(ringPulse);
      visual.hpFill.scale.x = Math.max(0.001, player.hp / player.maxHp);
      visual.hpFill.position.x = -0.64 * (1 - player.hp / player.maxHp);
    }
  }

  private createPlayerVisual(player: PlayerState): PlayerVisual {
    const teamColor = TEAM_COLORS[player.team];
    const roleColor = ROLE_COLORS[player.role];
    const root = new THREE.Group();
    root.position.set(player.position.x, 0, player.position.z);
    root.name = `player-${player.id}`;
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.86, 20),
      new THREE.MeshBasicMaterial({ color: 0x02050d, transparent: true, opacity: 0.56, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    root.add(shadow);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.72, 24),
      new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.66, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    root.add(ring);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.53, 1.05, 8),
      new THREE.MeshStandardMaterial({ color: roleColor, emissive: roleColor, emissiveIntensity: 1.2, roughness: 0.42, metalness: 0.14, flatShading: true }),
    );
    body.position.y = 0.68;
    root.add(body);
    const head = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.39, 1),
      new THREE.MeshStandardMaterial({ color: teamColor, emissive: teamColor, emissiveIntensity: 1.4, roughness: 0.34, flatShading: true }),
    );
    head.position.y = 1.42;
    root.add(head);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.13, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x071222, emissive: 0x285879, emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.3 }),
    );
    visor.position.set(0, 1.44, 0.33);
    root.add(visor);
    const armGeometry = new THREE.BoxGeometry(0.13, 0.62, 0.13);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeometry, new THREE.MeshStandardMaterial({ color: roleColor, emissive: roleColor, emissiveIntensity: 0.8, flatShading: true }));
      arm.position.set(side * 0.5, 0.66, 0);
      arm.rotation.z = side * 0.24;
      root.add(arm);
    }

    const hpBack = new THREE.Mesh(
      new THREE.BoxGeometry(1.38, 0.11, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x101728, transparent: true, opacity: 0.92 }),
    );
    hpBack.position.set(0, 2.08, 0);
    root.add(hpBack);
    const hpFill = new THREE.Mesh(
      new THREE.BoxGeometry(1.26, 0.07, 0.09),
      new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.96 }),
    );
    hpFill.position.set(0, 2.08, 0.05);
    root.add(hpFill);
    return { root, ring, body, head, hpFill, activeScale: 1 };
  }

  private updateBall(snapshot: MatchSnapshot): void {
    const color = BALL_COLORS[snapshot.ball.kind];
    this.ballMesh.material.color.setHex(color);
    this.ballMesh.material.emissive.setHex(color);
    this.ballAura.material.color.setHex(color);
    this.ballRing.material.color.setHex(color);
    for (const mesh of this.trailMeshes) mesh.material.color.setHex(color);
    const target = new THREE.Vector3(snapshot.ball.position.x, 0.66, snapshot.ball.position.z);
    const previous = this.ballRoot.position.clone();
    this.ballRoot.position.lerp(target, 0.5);
    if (previous.distanceTo(this.ballRoot.position) > 0.015 || this.trailPositions.length === 0) {
      this.trailPositions.unshift(this.ballRoot.position.clone());
      this.trailPositions.splice(this.trailMeshes.length);
    }
    const flying = snapshot.ball.mode === "FLYING";
    for (let index = 0; index < this.trailMeshes.length; index += 1) {
      const mesh = this.trailMeshes[index];
      const position = this.trailPositions[index];
      mesh.visible = flying && Boolean(position);
      if (position) {
        mesh.position.copy(position);
        mesh.position.y -= 0.02;
        mesh.scale.setScalar(0.78 - index * 0.07);
        mesh.material.opacity = Math.max(0, 0.3 - index * 0.028);
      }
    }
    const pulse = 1 + Math.sin(snapshot.clockSeconds * (flying ? 18 : 8)) * (flying ? 0.12 : 0.06);
    this.ballMesh.scale.setScalar(pulse);
    this.ballAura.material.opacity = flying ? 0.18 : 0.1;
    this.ballRoot.visible = true;
    this.ballRing.rotation.z += 0.025;
  }

  private updateCamera(snapshot: MatchSnapshot, delta: number): void {
    this.cameraShake = Math.max(0, this.cameraShake - delta * 2.8);
    const shakeX = this.cameraShake * Math.sin(snapshot.tick * 1.7) * 0.7;
    const shakeY = this.cameraShake * Math.cos(snapshot.tick * 2.1) * 0.45;
    const desiredX = snapshot.ball.position.x * 0.12 + shakeX;
    const desiredZ = -18.8 + snapshot.ball.position.z * 0.035;
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, desiredX, 0.06);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 16.8 + shakeY, 0.08);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, desiredZ, 0.06);
    this.camera.lookAt(0, 0, 0);
  }

  private resize(): void {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    if (this.canvas.width !== Math.round(width * (window.devicePixelRatio || 1))) {
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.setSize(width, height, false);
    } else if (this.camera.aspect !== width / height) {
      this.renderer.setSize(width, height, false);
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private disposeScene(): void {
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else if (material) material.dispose();
    });
    this.scene.clear();
  }
}
