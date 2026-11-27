import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const run = promisify(execFile);

test("compiled Vercel entry starts under native Node ESM before database initialization", async () => {
  // Keep output under the project so native Node can resolve its dependencies.
  const root = resolve(import.meta.dirname, "..");
  await mkdir(join(root, "build"), { recursive: true });
  const output = await mkdtemp(join(root, "build", "vercel-runtime-"));
  try {
    await run(process.execPath, [
      join(root, "node_modules/typescript/bin/tsc"),
      "-p", join(root, "tsconfig.server.json"),
      "--noEmit", "false", "--outDir", output,
    ]);
    const env: NodeJS.ProcessEnv = { ...process.env, VERCEL: "1" };
    for (const key of [
      "DATABASE_URL", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN",
      "DASHBOARD_PASSWORD", "DATA_PROXY_URL", "NODE_OPTIONS",
    ]) delete env[key];
    const entry = pathToFileURL(join(output, "api/index.js")).href;
    const { stdout } = await run(process.execPath, ["--input-type=module", "-e", `
      import { createServer } from "node:http";
      import { once } from "node:events";
      import handler from ${JSON.stringify(entry)};
      const server = createServer(handler);
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      try {
        const base = "http://127.0.0.1:" + server.address().port;
        const health = await fetch(base + "/api/health");
        const dashboard = await fetch(base + "/api/dashboard");
        console.log(JSON.stringify({
          health: health.status, healthBody: await health.json(),
          dashboard: dashboard.status, dashboardBody: await dashboard.json(),
        }));
      } finally {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      }
    `], { env, timeout: 15000 });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.health, 200);
    assert.deepEqual(result.healthBody, { ok: true });
    assert.equal(result.dashboard, 503);
    assert.match(result.dashboardBody.error, /TURSO_DATABASE_URL/);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
