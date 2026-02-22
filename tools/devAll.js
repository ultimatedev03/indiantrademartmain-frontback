import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

const spawnTask = (scriptName) => {
  const child = spawn("npm", ["run", scriptName], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  child.on("error", (error) => {
    console.error(`[devAll] Failed to start ${scriptName}:`, error?.message || error);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (signal) {
      console.log(`[devAll] ${scriptName} exited with signal ${signal}`);
    } else if (code !== 0) {
      console.log(`[devAll] ${scriptName} exited with code ${code}`);
    }
    shutdown(code ?? 0);
  });

  children.push(child);
};

const shutdown = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child || child.killed) continue;
    try {
      child.kill("SIGTERM");
    } catch {
      // Ignore process kill errors during shutdown.
    }
  }

  setTimeout(() => process.exit(exitCode), 150);
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

spawnTask("dev:client");
spawnTask("dev:server");
