import * as THREE from "three";
import type { SimEvent, Vec2 } from "./types.ts";

interface Particle {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  life: number;
  maxLife: number;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
}

interface RingEffect {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
}

const PARTICLE_LIMIT = 96;
const RING_LIMIT = 18;
const WHITE = new THREE.Color(0xffffff);

function colorForEvent(event: SimEvent): number {
  switch (event.kind) {
    case "catch": return 0x78f7ff;
    case "dodge": return 0xffec73;
    case "pass": return 0xc695ff;
    case "dash": return 0x76d9ff;
    case "ko": return 0xff5f87;
    case "win": return 0xffffff;
    case "throw":
      if (event.special === "RUSH") return 0xff925f;
      if (event.special === "CURVE") return 0xd38cff;
      if (event.special === "SKY") return 0x9affd0;
      return 0xfff6bd;
    case "hit": return event.special === "RUSH" ? 0xff794d : 0xffd477;
  }
}

export class BattleBallEffects {
  readonly root = new THREE.Group();
  private readonly particleGeometry = new THREE.BoxGeometry(0.13, 0.13, 0.13);
  private readonly ringGeometry = new THREE.RingGeometry(0.72, 0.82, 24);
  private readonly particles: Particle[] = [];
  private readonly rings: RingEffect[] = [];
  private readonly particleMaterials = new Map<number, THREE.MeshBasicMaterial>();
  private readonly ringMaterials = new Map<number, THREE.MeshBasicMaterial>();

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    for (let index = 0; index < PARTICLE_LIMIT; index += 1) {
      const material = this.materialFor(this.particleMaterials, 0xffffff);
      const mesh = new THREE.Mesh(this.particleGeometry, material);
      mesh.visible = false;
      this.root.add(mesh);
      this.particles.push({
        mesh,
        life: 0,
        maxLife: 1,
        velocity: new THREE.Vector3(),
        spin: new THREE.Vector3(),
      });
    }
    for (let index = 0; index < RING_LIMIT; index += 1) {
      const material = this.materialFor(this.ringMaterials, 0xffffff);
      const mesh = new THREE.Mesh(this.ringGeometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.root.add(mesh);
      this.rings.push({ mesh, life: 0, maxLife: 1, startScale: 1, endScale: 2 });
    }
  }

  handleEvents(events: SimEvent[]): number {
    let shake = 0;
    for (const event of events) {
      const intensity = event.kind === "hit" ? 1 : event.kind === "ko" ? 1.5 : event.kind === "throw" ? 0.35 : 0.2;
      this.burst(event.position, colorForEvent(event), intensity);
      shake = Math.max(shake, intensity * (event.kind === "hit" || event.kind === "ko" ? 0.12 : 0.04));
    }
    return shake;
  }

  burst(position: Vec2, color: number, intensity = 1): void {
    const amount = Math.min(18, Math.max(6, Math.round(10 * intensity)));
    for (let index = 0; index < amount; index += 1) {
      const particle = this.particles.find((candidate) => !candidate.mesh.visible);
      if (!particle) break;
      const angle = (index / amount) * Math.PI * 2 + Math.random() * 0.3;
      const speed = (2.4 + Math.random() * 3.8) * Math.max(0.7, intensity);
      particle.mesh.visible = true;
      particle.mesh.material = this.materialFor(this.particleMaterials, color);
      particle.mesh.position.set(position.x, 0.48 + Math.random() * 0.65, position.z);
      particle.mesh.scale.setScalar(0.55 + Math.random() * 0.9);
      particle.life = 0.34 + Math.random() * 0.32;
      particle.maxLife = particle.life;
      particle.velocity.set(Math.cos(angle) * speed, 1.4 + Math.random() * 2.4, Math.sin(angle) * speed);
      particle.spin.set(Math.random() * 7, Math.random() * 7, Math.random() * 7);
    }

    const ring = this.rings.find((candidate) => !candidate.mesh.visible);
    if (ring) {
      ring.mesh.visible = true;
      ring.mesh.material = this.materialFor(this.ringMaterials, color);
      ring.mesh.position.set(position.x, 0.055, position.z);
      ring.mesh.scale.setScalar(0.35 + intensity * 0.18);
      ring.startScale = 0.35 + intensity * 0.18;
      ring.endScale = 1.1 + intensity * 0.55;
      ring.life = 0.34 + intensity * 0.12;
      ring.maxLife = ring.life;
    }
  }

  update(deltaSeconds: number): void {
    for (const particle of this.particles) {
      if (!particle.mesh.visible) continue;
      particle.life -= deltaSeconds;
      if (particle.life <= 0) {
        particle.mesh.visible = false;
        continue;
      }
      particle.velocity.y -= 7.5 * deltaSeconds;
      particle.mesh.position.addScaledVector(particle.velocity, deltaSeconds);
      particle.mesh.rotation.x += particle.spin.x * deltaSeconds;
      particle.mesh.rotation.y += particle.spin.y * deltaSeconds;
      particle.mesh.rotation.z += particle.spin.z * deltaSeconds;
      particle.mesh.material.opacity = Math.max(0, particle.life / particle.maxLife);
    }

    for (const ring of this.rings) {
      if (!ring.mesh.visible) continue;
      ring.life -= deltaSeconds;
      if (ring.life <= 0) {
        ring.mesh.visible = false;
        continue;
      }
      const progress = 1 - ring.life / ring.maxLife;
      ring.mesh.scale.setScalar(THREE.MathUtils.lerp(ring.startScale, ring.endScale, progress));
      ring.mesh.material.opacity = Math.max(0, 0.78 * (1 - progress));
    }
  }

  dispose(): void {
    this.particleGeometry.dispose();
    this.ringGeometry.dispose();
    for (const material of this.particleMaterials.values()) material.dispose();
    for (const material of this.ringMaterials.values()) material.dispose();
    this.root.clear();
  }

  private materialFor(
    materials: Map<number, THREE.MeshBasicMaterial>,
    color: number,
  ): THREE.MeshBasicMaterial {
    const existing = materials.get(color);
    if (existing) return existing;
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    materials.set(color, material);
    return material;
  }
}

export function eventColor(event: SimEvent): THREE.Color {
  return new THREE.Color(colorForEvent(event));
}

export const EFFECT_WHITE = WHITE;
