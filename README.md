# BATTLE BALL

`BATTLE BALL` is a mobile-first 3D action game built around the strongest parts of classic dodgeball action:

- damage instead of instant elimination;
- high-risk catch and immediate counterattack;
- contextual special throws;
- readable character roles and short matches;
- fixed-step simulation that can later be driven by network input.

The first playable slice is a local 3v3 CPU match. The simulation is deliberately kept independent from Three.js and the DOM so an authoritative server or relay transport can be added later without rewriting combat rules.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
```

## Controls

- Left virtual pad: move
- THROW: release the ball toward the nearest opponent
- CATCH: catch an incoming ball during the timing window
- DASH: short invulnerable burst
- PASS: pass to the nearest teammate

Keyboard fallback: WASD / arrow keys, `J` throw, `K` catch, `L` dash, `I` pass.

## Network-ready boundary

`src/game/simulation.ts` owns deterministic match rules. `src/game/netcode.ts` defines ticked input and snapshot messages. The current game uses a local transport, but the future online mode can send `InputCommand` packets to an authoritative match room and broadcast snapshots or compact event deltas.
