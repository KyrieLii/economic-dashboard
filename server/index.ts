import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { app } from "./app.js";
import { startScheduler } from "./scheduler.js";

const server = new Hono();
server.route("/", app);
server.use("*", serveStatic({ root: "./dist" }));
server.get("*", serveStatic({ path: "./dist/index.html" }));
const instance = serve(
  {
    fetch: server.fetch,
    hostname: process.env.HOST || "0.0.0.0",
    port: Number(process.env.PORT || 3001),
  },
  (info) => console.log(`Economic Dashboard: http://localhost:${info.port}`),
);
const stopScheduler = startScheduler();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopScheduler();
    instance.close();
  });
