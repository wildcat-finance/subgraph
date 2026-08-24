#!/usr/bin/env node
const { execSync, spawnSync } = require("child_process");
const { getHinterlightPaths } = require("./hinterlight-paths");
require("dotenv").config();

const provider = process.argv[2];
const network = process.argv[3];
const subgraphName = process.argv[4];
const version = process.argv[5];
let targetSubgraphName = subgraphName;
let publicSubgraphName = subgraphName;
let publicQueryUrl = null;

if (!provider || !network || !subgraphName) {
  console.error(
    "Usage: yarn deploy <provider> <network> <subgraph-name> <version-label>"
  );
  process.exit(1);
}

if (!version) {
  console.error(
    "Deployments require an explicit version label.\n" +
      "Examples:\n" +
      "  yarn deploy:goldsky:sepolia v2.5.9\n" +
      "  yarn deploy:hinterlight:sepolia v2.5.9"
  );
  process.exit(1);
}

if (!/^v[0-9]+(?:\.[0-9]+){2,3}$/.test(version)) {
  console.error(
    "Version labels must use the release format vMAJOR.MINOR.PATCH[.REVISION]"
  );
  process.exit(1);
}

const supportedProviders = new Set([
  "dev",
  "thegraph",
  "goldsky",
  "hinterlight",
]);
if (!supportedProviders.has(provider)) {
  console.error(
    "Unknown provider. Use: dev | thegraph | goldsky | hinterlight"
  );
  process.exit(1);
}

const supportedNetworks = new Set([
  "mainnet",
  "sepolia",
  "plasma-mainnet",
  "plasma-testnet",
]);
if (!supportedNetworks.has(network)) {
  console.error(`Unknown network: ${network}`);
  process.exit(1);
}

if (!/^[A-Za-z0-9][A-Za-z0-9_/-]*$/.test(subgraphName)) {
  console.error(`Invalid subgraph name: ${subgraphName}`);
  process.exit(1);
}

function run(cmd) {
  console.log("> " + cmd);
  execSync(cmd, { stdio: "inherit" });
}

const graphCliPath = require.resolve("@graphprotocol/graph-cli/bin/run");
const sensitiveGraphFlags = new Set([
  "--access-token",
  "--deploy-key",
  "--headers",
]);

function formatGraphCommand(args) {
  const formatted = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    formatted.push(arg);
    if (sensitiveGraphFlags.has(arg) && i + 1 < args.length) {
      formatted.push("<redacted>");
      i += 1;
    }
  }
  return `graph ${formatted.join(" ")}`;
}

function runGraph(args, { allowExistingSubgraph = false } = {}) {
  console.log("> " + formatGraphCommand(args));
  const result = spawnSync(process.execPath, [graphCliPath, ...args], {
    encoding: allowExistingSubgraph ? "utf8" : undefined,
    stdio: allowExistingSubgraph ? "pipe" : "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (allowExistingSubgraph) {
    const stdout = result.stdout || "";
    const stderr = result.stderr || "";
    const output = stdout + stderr;
    if (result.status !== 0 && /subgraph already exists/i.test(output)) {
      console.log("Subgraph already exists; continuing with deployment.");
      return;
    }
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  }

  if (result.status !== 0) {
    throw new Error(
      `Graph CLI exited with status ${result.status ?? "unknown"}`
    );
  }
}

function requireEnvironment(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
    process.exit(1);
  }
}

if (provider === "hinterlight") {
  if (!/^[A-Za-z0-9_-]+$/.test(subgraphName)) {
    console.error(`Invalid Hinterlight subgraph name: ${subgraphName}`);
    process.exit(1);
  }
  const hinterlightPaths = getHinterlightPaths(subgraphName, version);
  targetSubgraphName = hinterlightPaths.internalSubgraphName;
  publicSubgraphName = hinterlightPaths.publicSubgraphName;
  publicQueryUrl = hinterlightPaths.publicQueryUrl;
  requireEnvironment([
    "GRAPH_ACCESS_TOKEN",
    "GRAPH_DEPLOY_KEY",
    "IPFS_BEARER_TOKEN",
  ]);
}

if (provider === "dev") {
  requireEnvironment(["DEV_DEPLOY_KEY", "DEV_NODE_URL", "DEV_IPFS_URL"]);
}

console.log(
  `Deploying ${targetSubgraphName}@${version} to ${network} with ${provider}`
);

// Always generate and build for the selected network before deployment.
run(`yarn netconfig ${network}`);
run("yarn build");

switch (provider) {
  case "hinterlight": {
    runGraph(
      [
        "create",
        "--node",
        "https://graph.hinterlight.net/deploy/",
        "--access-token",
        process.env.GRAPH_ACCESS_TOKEN,
        targetSubgraphName,
      ],
      { allowExistingSubgraph: true }
    );
    runGraph([
      "deploy",
      "--node",
      "https://graph.hinterlight.net/deploy/",
      "--ipfs",
      "https://ipfs.hinterlight.net",
      "--deploy-key",
      process.env.GRAPH_DEPLOY_KEY,
      "--headers",
      JSON.stringify({
        Authorization: `Bearer ${process.env.IPFS_BEARER_TOKEN}`,
      }),
      "--version-label",
      version,
      targetSubgraphName,
    ]);
    console.log(`Deployed ${publicSubgraphName} to Hinterlight.`);
    console.log(`Queries (HTTP):     ${publicQueryUrl}`);
    break;
  }

  case "dev": {
    const deployId = `${subgraphName}_${version.replace(/[.-]/g, "_")}`;
    runGraph(
      [
        "create",
        "--node",
        process.env.DEV_NODE_URL,
        "--access-token",
        process.env.DEV_DEPLOY_KEY,
        deployId,
      ],
      { allowExistingSubgraph: true }
    );
    runGraph([
      "deploy",
      "--node",
      process.env.DEV_NODE_URL,
      "--ipfs",
      process.env.DEV_IPFS_URL,
      "--deploy-key",
      process.env.DEV_DEPLOY_KEY,
      "--headers",
      JSON.stringify({
        Authorization: `Bearer ${process.env.DEV_DEPLOY_KEY}`,
      }),
      "--version-label",
      version,
      deployId,
    ]);
    console.log(
      `Deployed ${subgraphName}@${version} to dev with name ${deployId}`
    );
    break;
  }

  case "thegraph":
    run(
      `graph deploy --node https://api.studio.thegraph.com/deploy/ ${subgraphName} --version-label ${version}`
    );
    break;

  case "goldsky":
    run(`goldsky subgraph deploy ${subgraphName}/${version} --path .`);
    break;
}
