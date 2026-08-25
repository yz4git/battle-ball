# BATTLE BALL

`BATTLE BALL` is a mobile-first 3D dodgeball action game built around player-controlled rallies rather than CPU-vs-CPU exchanges.

Core rules in the current 3v3 slice:

- one player-controlled Blue fighter drives the rally;
- CPU teammates do not start autonomous throw/catch loops;
- one `BALL` input handles both catching and throwing;
- hold `BALL` to aim, use the left pad to choose a target, then release to throw;
- enemy possession always enters a visible telegraph before the enemy throws at the player;
- `PASS` delegates exactly one role-specific assist attack to a teammate;
- damage replaces instant elimination and matches remain short;
- fixed-step simulation remains independent from Three.js and the DOM for future network play.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
```

## Controls

- Left virtual pad: move; while holding `BALL`, choose the target
- `BALL`: tap an incoming ball to catch / hold while possessing the ball to aim / release to throw
- `DASH`: short invulnerable burst
- `PASS`: send the ball to a teammate for one role-specific assist attack

Keyboard fallback: WASD / arrow keys, `J` or `K` for BALL, `L` for dash, `I` for pass.

## Network-ready boundary

`src/game/simulation.ts` owns deterministic match rules. `src/game/netcode.ts` defines ticked input and snapshot messages. The current game uses a local transport, but a future online mode can send `InputCommand` packets to an authoritative match room and broadcast snapshots or compact event deltas.
