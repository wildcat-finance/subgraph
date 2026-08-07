const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const deployScript = path.join(__dirname, "deploy.js");

function runDeploy(args, env = process.env) {
  return spawnSync(process.execPath, [deployScript, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env,
  });
}

const missingVersion = runDeploy(
  ["goldsky", "sepolia", "sepolia"],
  {
    ...process.env,
    // The legacy environment fallback must not authorize a deployment.
    SUBGRAPH_VERSION_LABEL: "v9.9.9",
  }
);
assert.notStrictEqual(missingVersion.status, 0);
assert.match(missingVersion.stderr, /explicit version label/);
assert.doesNotMatch(
  missingVersion.stdout + missingVersion.stderr,
  /yarn netconfig/
);

const invalidVersion = runDeploy([
  "hinterlight",
  "sepolia",
  "sepolia",
  "latest",
]);
assert.notStrictEqual(invalidVersion.status, 0);
assert.match(invalidVersion.stderr, /vMAJOR\.MINOR\.PATCH/);
assert.doesNotMatch(
  invalidVersion.stdout + invalidVersion.stderr,
  /yarn netconfig/
);

console.log("Deployments fail closed without an explicit release version.");
