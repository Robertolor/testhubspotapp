import { spawnSync } from "node:child_process";

const npmScriptChecks = [
  "validate:mapping",
  "validate:transform",
  "validate:runtime",
  "validate:cutoff",
  "validate:queue",
  "validate:dispatch",
] as const;

function runNpmScript(script: string): void {
  const result = spawnSync("npm", ["run", script], {
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Running validate:all …\n");

for (const script of npmScriptChecks) {
  console.log(`--- ${script} ---`);
  runNpmScript(script);
}

console.log("--- typecheck ---");
runNpmScript("typecheck");

console.log("\nvalidate:all passed");
