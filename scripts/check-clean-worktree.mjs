import { execSync } from "node:child_process";

try {
  execSync("git diff --quiet", { stdio: "inherit" });
  execSync("git diff --cached --quiet", { stdio: "inherit" });
} catch {
  console.error("Working tree is not clean.");
  process.exit(1);
}
