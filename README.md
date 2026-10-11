# PICKLE — 3D Pickleball

A complete replacement of the former Battle Ball dodgeball implementation. Mobile-first singles against three CPU levels, procedural Three.js park and athletes, ballistic ball simulation at 120 Hz, sound effects, and touch/keyboard input. No external asset services required at runtime.

## Play
Left pad moves; DRIVE/J returns or serves, DROP/L plays short, LOB/K sends a high deep shot. Tap a shot button to swing immediately, or hold to return each incoming ball automatically when in range and legal. A missed tap buffers for 850 ms. Separate AUTO/LEFT/CENTER/RIGHT buttons keep aim independent of movement; AUTO targets the open side. Keyboard Q/E aims left/right, R auto, C center. The floating pad centers on touchdown with a dead zone. Stationary close contact produces clean fast shots; moving and stretched contact produces slower, shorter returns and floating drops. CPU selects drop/lob based on opponent position. Input buffer lasts 850 ms. Assisted mode increases paddle reach, without moving the player automatically. Pause on backgrounding. Portrait supported; landscape recommended.

Singles side-out scoring, 11 win by 2, diagonal service from alternating courts, first two returns require a bounce, kitchen volley and immediate momentum faults, out/net/double-bounce calls. This is a casual adaptation, not a certified tournament simulator; body collisions and exhaustive foot-fault adjudication are omitted.

## Development
`npm ci`, `npm test`, `npm run build`, `npm run dev`.
