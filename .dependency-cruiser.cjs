// Import boundaries for the pure domain module (docs/adr/0002). Run by `pnpm depcruise` inside `pnpm verify`.
// Tests inside src/domain/ may also import vitest and the golden fixtures in tests/golden/.
const TEST = "\\.test\\.tsx?$";
const DOMAIN_TEST = "^src/domain/.*\\.test\\.tsx?$";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-imports-only-domain",
      comment:
        "The pure domain module imports only src/domain/. Move code that needs anything else to src/server/.",
      severity: "error",
      from: { path: "^src/domain/", pathNot: TEST },
      to: { pathNot: "^src/domain/" },
    },
    {
      name: "domain-uses-no-packages",
      comment:
        "src/domain/ uses no npm packages and no Node built-in modules (src/domain/AGENTS.md).",
      severity: "error",
      from: { path: "^src/domain/", pathNot: TEST },
      to: {
        dependencyTypes: [
          "npm",
          "npm-dev",
          "npm-optional",
          "npm-peer",
          "npm-bundled",
          "npm-no-pkg",
          "npm-unknown",
          "core",
        ],
      },
    },
    {
      name: "domain-tests-import-domain-vitest-golden",
      comment:
        "Tests in src/domain/ import only src/domain/, vitest and tests/golden/*.json.",
      severity: "error",
      from: { path: DOMAIN_TEST },
      to: {
        pathNot: [
          "^src/domain/",
          "(^|/)node_modules/vitest/",
          "^tests/golden/[^/]+\\.json$",
        ],
      },
    },
    {
      name: "server-does-not-import-app",
      comment: "src/server/ is called by src/app/, never the other way round.",
      severity: "error",
      from: { path: "^src/server/" },
      to: { path: "^src/app/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
    },
  },
};
