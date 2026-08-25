import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("dist/server", { recursive: true });
writeFileSync(
  "dist/server/index.js",
  `const worker = {
  async fetch(request, env) {
    if (env?.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }
    return new Response("BATTLE BALL assets are not bound.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};

export default worker;
`,
);
