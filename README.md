# PICKLE — 3D Pickleball

A complete replacement of the former Battle Ball dodgeball implementation. Mobile-first singles against three CPU levels, procedural Three.js park and athletes, ballistic ball simulation at 120 Hz, sound effects, and touch/keyboard input. No external asset services required at runtime.

## Play
Left pad moves; DRIVE/J returns or serves, DROP/L plays short, LOB/K sends a high deep shot. Hold any shot button, slide horizontally and release to hit; aim persists independently of movement. Keyboard Q/E adjusts aim, R centers it. Stationary close contact produces clean fast shots; moving and stretched contact produces slower, shorter returns and floating drops. CPU selects drop/lob based on opponent position. Input buffer lasts 420 ms. Assisted mode increases paddle reach, without moving the player automatically. Pause on backgrounding. Portrait supported; landscape recommended.

Singles side-out scoring, 11 win by 2, diagonal service from alternating courts, first two returns require a bounce, kitchen volley and immediate momentum faults, out/net/double-bounce calls. This is a casual adaptation, not a certified tournament simulator; body collisions and exhaustive foot-fault adjudication are omitted.

## Development
`npm ci`, `npm test`, `npm run build`, `npm run dev`.
