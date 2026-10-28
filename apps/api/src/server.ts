import { createApp } from "./app.js";
const app = await createApp({ logger: true });
await app.listen({
  port: Number(process.env.API_PORT ?? 3001),
  host: process.env.API_HOST ?? "127.0.0.1",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
