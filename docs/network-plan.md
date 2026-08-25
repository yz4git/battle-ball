# Network mode plan

The first release intentionally does not fake online play. It prepares the boundary required for it.

## Authority model

- Server owns the match tick, ball trajectory, hit tests, HP, KO and round result.
- Clients send input commands with a monotonically increasing tick and sequence number.
- Server periodically sends an authoritative snapshot and event list.
- Client prediction can be added for the local player after the offline simulation is stable.

## Message shape

`src/game/netcode.ts` contains JSON-safe message types for:

- room join/leave;
- input command batches;
- authoritative snapshots;
- reliable gameplay events;
- ping/ack and protocol version negotiation.

## Why this is future-safe

The render layer consumes `MatchSnapshot`; it does not decide whether the snapshot came from the local simulation or a server. This avoids coupling Three.js, touch input, and networking together.
