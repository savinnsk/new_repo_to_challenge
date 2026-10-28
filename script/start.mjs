import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { root } from "./common.mjs";

for (const artifact of [
  "apps/api/dist/apps/api/src/server.js",
  "apps/web/.next/BUILD_ID",
  "node_modules/next/dist/bin/next",
]) {
  if (!existsSync(resolve(root, artifact))) {
    throw new Error(
      `Arquivo necessário ausente: ${artifact}. Execute node script/build.mjs primeiro.`,
    );
  }
}

const children = [];
let stopping = false;
let exitCode = 0;
let forceTimer;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGTERM");
  }
  forceTimer = setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    }
  }, 10000);
  forceTimer.unref();
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

const services = [
  { name: "API", cwd: "apps/api", args: ["dist/apps/api/src/server.js"] },
  {
    name: "Web",
    cwd: "apps/web",
    args: [
      resolve(root, "node_modules/next/dist/bin/next"),
      "start",
      "--port",
      process.env.PORT ?? "3000",
      "--hostname",
      process.env.WEB_HOST ?? "0.0.0.0",
    ],
  },
];

await Promise.all(
  services.map(
    (service) =>
      new Promise((resolveDone) => {
        const child = spawn(process.execPath, service.args, {
          cwd: resolve(root, service.cwd),
          stdio: "inherit",
          env: process.env,
        });
        children.push(child);
        child.once("error", (error) => {
          console.error(`${service.name}: ${error.message}`);
          stop(1);
          resolveDone();
        });
        child.once("exit", (code, signal) => {
          if (!stopping) {
            console.error(
              `${service.name} encerrou (${signal ?? code}); encerrando o outro serviço.`,
            );
            stop(code || 1);
          }
          resolveDone();
        });
      }),
  ),
);
clearTimeout(forceTimer);
process.exitCode = exitCode;
