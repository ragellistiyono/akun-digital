// Required gate: typecheck → lint → knip → depcruise → test. Stops at the first step that fails.
import { spawnSync } from "node:child_process";

const steps = [
  ["typecheck", "Checking TypeScript types"],
  ["lint", "Running the linter"],
  ["knip", "Looking for unused files, exports and dependencies"],
  ["depcruise", "Checking import boundaries between modules"],
  ["test", "Running tests"],
];

for (const [script, label] of steps) {
  console.log(`\n▶ ${label} (pnpm ${script})`);
  const result = spawnSync("pnpm", ["run", "--silent", script], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(
      `\n✗ Verification failed at "${script}". Fix the errors above, then run \`pnpm verify\` again.`,
    );
    process.exit(result.status ?? 1);
  }
}

console.log("\n✓ All checks passed.");
