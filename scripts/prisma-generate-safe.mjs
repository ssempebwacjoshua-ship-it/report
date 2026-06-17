import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const workspace = process.cwd();
const isWindows = process.platform === "win32";
const maxAttempts = 3;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workspace,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  return result.status ?? 1;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function normalize(value) {
  return value.replaceAll("\\", "/").toLowerCase();
}

function workspaceNodeProcesses() {
  if (!isWindows) return [];

  const ps = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' } | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
  ];

  try {
    const raw = execFileSync("powershell.exe", ps, { cwd: workspace, encoding: "utf8" }).trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function stopWorkspaceDevProcesses() {
  if (!isWindows) return;

  const workspaceNeedle = normalize(workspace);
  const devNeedles = [
    "tsx watch",
    "vite",
    "vitest",
    "prisma studio",
    "dist/server/index.js",
    "src/server/index.ts",
  ];

  const candidates = workspaceNodeProcesses().filter((proc) => {
    const pid = Number(proc.ProcessId);
    const commandLine = normalize(String(proc.CommandLine ?? ""));
    if (!pid || pid === process.pid || pid === process.ppid) return false;
    if (!commandLine.includes(workspaceNeedle)) return false;
    return devNeedles.some((needle) => commandLine.includes(needle));
  });

  for (const proc of candidates) {
    const pid = String(proc.ProcessId);
    console.log(`[prisma:generate] stopping workspace dev process ${pid}`);
    spawnSync("taskkill.exe", ["/PID", pid, "/T", "/F"], { stdio: "ignore" });
  }

  if (candidates.length > 0) sleep(1200);
}

function removeStalePrismaTempFiles() {
  if (!isWindows) return;

  const dirs = [
    path.join(workspace, "node_modules", ".prisma", "client"),
    path.join(workspace, "node_modules", "@prisma", "client"),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      if (!/^query_engine-windows.*\.tmp$/i.test(entry)) continue;
      const target = path.join(dir, entry);
      try {
        rmSync(target, { force: true });
        console.log(`[prisma:generate] removed stale temp file ${target}`);
      } catch {
        // A locked temp file will be retried after process cleanup.
      }
    }
  }
}

function prismaGenerate() {
  if (isWindows) {
    return run("cmd.exe", ["/d", "/s", "/c", "npx prisma generate"]);
  }
  return run("npx", ["prisma", "generate"]);
}

if (isWindows) {
  stopWorkspaceDevProcesses();
  removeStalePrismaTempFiles();
}

let exitCode = 1;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  console.log(`[prisma:generate] attempt ${attempt}/${maxAttempts}`);
  exitCode = prismaGenerate();
  if (exitCode === 0) break;
  if (!isWindows || attempt === maxAttempts) break;
  stopWorkspaceDevProcesses();
  removeStalePrismaTempFiles();
  sleep(1500 * attempt);
}

if (exitCode !== 0) {
  console.error("[prisma:generate] failed. On Windows, close dev servers, test watchers, Prisma Studio, and editors using the generated Prisma client, then retry.");
}

process.exit(exitCode);
