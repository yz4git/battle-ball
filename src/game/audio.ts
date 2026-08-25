import type { SimEvent } from "./types.ts";

export class BattleBallAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  async unlock(): Promise<void> {
    if (typeof window === "undefined" || !("AudioContext" in window)) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.12;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  playEvent(event: SimEvent): void {
    if (this.muted || !this.context || !this.master) return;
    const sounds: Record<SimEvent["kind"], [number, number, OscillatorType]> = {
      throw: [event.special === "RUSH" ? 170 : 240, 0.09, "sawtooth"],
      catch: [720, 0.16, "sine"],
      pass: [460, 0.09, "triangle"],
      hit: [90, 0.18, "square"],
      dodge: [560, 0.08, "triangle"],
      dash: [330, 0.06, "sawtooth"],
      ko: [62, 0.4, "sawtooth"],
      win: [520, 0.3, "sine"],
    };
    const [frequency, duration, type] = sounds[event.kind];
    this.tone(frequency, duration, type);
    if (event.kind === "catch" || event.kind === "win") {
      this.tone(frequency * 1.5, duration * 0.75, "sine", 0.06, 0.06);
    }
  }

  dispose(): void {
    this.master?.disconnect();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gainValue = 0.12,
    delay = 0,
  ): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * 0.72), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}
