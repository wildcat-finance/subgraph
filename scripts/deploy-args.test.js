const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const deployScript = path.join(__dirname, "deploy.js");

function runDeploy(args, env = process.env) {
  return spawnSync(process.execPath, [deployScript, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env,
  });
}

test("fails closed before building when the version is omitted", () => {
  const result = runDeploy(["goldsky", "sepolia", "sepolia"], {
    ...process.env,
    // A legacy environment fallback must not authorize a deployment.
    SUBGRAPH_VERSION_LABEL: "v9.9.9",
  });

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /explicit version label/);
  assert.doesNotMatch(result.stdout + result.stderr, /yarn netconfig/);
});

test("fails closed before building when the version is malformed", () => {
  const result = runDeploy([
    "hinterlight",
    "sepolia",
    "sepolia",
    "latest",
  ]);

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /vMAJOR\.MINOR\.PATCH/);
  assert.doesNotMatch(result.stdout + result.stderr, /yarn netconfig/);
});

test("fails closed before building when the provider is unknown", () => {
  const result = runDeploy(["unknown", "sepolia", "sepolia", "v2.5.8"]);

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /Unknown provider/);
  assert.doesNotMatch(result.stdout + result.stderr, /yarn netconfig/);
});

test("fails closed before building when the network is unknown", () => {
  const result = runDeploy(["goldsky", "devnet", "devnet", "v2.5.8"]);

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /Unknown network/);
  assert.doesNotMatch(result.stdout + result.stderr, /yarn netconfig/);
});

test("rejects unsafe subgraph names before invoking a shell", () => {
  const result = runDeploy([
    "goldsky",
    "sepolia",
    "sepolia;false",
    "v2.5.8",
  ]);

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /Invalid subgraph name/);
  assert.doesNotMatch(result.stdout + result.stderr, /yarn netconfig/);
});
