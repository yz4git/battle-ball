import assert from "node:assert/strict";
import test from "node:test";
import { LocalLoopbackTransport, makeInputCommand } from "../src/game/netcode.ts";
import { EMPTY_INPUT } from "../src/game/types.ts";

test("input command includes the future network boundary", () => {
  const command = makeInputCommand("room-a", "client-a", "blue-0", 42, 7, EMPTY_INPUT);
  assert.equal(command.type, "input");
  assert.equal(command.protocol, 1);
  assert.equal(command.tick, 42);
  assert.equal(command.sequence, 7);
});

test("loopback transport delivers messages asynchronously", async () => {
  const transport = new LocalLoopbackTransport();
  const received: string[] = [];
  const unsubscribe = transport.onMessage((message) => received.push(message.type));
  transport.send({ type: "ping", protocol: 1, roomId: "room-a", clientId: "client-a", sentAt: 1 });
  assert.deepEqual(received, []);
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  assert.deepEqual(received, ["ping"]);
  unsubscribe();
  transport.close();
});
