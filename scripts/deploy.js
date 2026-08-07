#!/usr/bin/env node
const { execSync, spawnSync } = require("child_process");
const { getHinterlightPaths } = require("./hinterlight-paths");
require("dotenv").config();

const provider = process.argv[2];
const network = process.argv[3];
const subgraphName = process.argv[4] || network;
const version = process.argv[5];
let targetSubgraphName = subgraphName;
let publicSubgraphName = subgraphName;
let publicQueryUrl = null;

if (!network) {
  console.error(
    "Usage: yarn deploy <provider> <network> <subgraph-name> <version-label>"
  );
  process.exit(1);
}

if (!provider) {
  console.error(
    "Usage: yarn deploy <provider> <network> <subgraph-name> <version-label>"
  );
  process.exit(1);
}

if (!version) {
  console.error(
    "Deployments require an explicit version label.\n" +
      "Examples:\n" +
      "  yarn deploy:goldsky:sepolia v2.1.6\n" +
      "  yarn deploy:hinterlight:sepolia v2.1.6"
  );
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

if (!/^v[0-9]+(?:\.[0-9]+){2,3}$/.test(version)) {
  console.error(
    "Version labels must use the release format vMAJOR.MINOR.PATCH[.REVISION]"
  );
  process.exit(1);
}

if (provider === "hinterlight") {
  if (!/^[A-Za-z0-9_-]+$/.test(subgraphName)) {
    throw Error(`Invalid Hinterlight subgraph name: ${subgraphName}`);
  }
  const hinterlightPaths = getHinterlightPaths(subgraphName, version);
  targetSubgraphName = hinterlightPaths.internalSubgraphName;
  publicSubgraphName = hinterlightPaths.publicSubgraphName;
  publicQueryUrl = hinterlightPaths.publicQueryUrl;
  const missingSecrets = [
    "GRAPH_ACCESS_TOKEN",
    "GRAPH_DEPLOY_KEY",
    "IPFS_BEARER_TOKEN",
  ].filter((name) => !process.env[name]);
  if (missingSecrets.length > 0) {
    console.error(
      `Missing required environment variables: ${missingSecrets.join(", ")}`
    );
    process.exit(1);
  }
}

console.log(
  `Deploying ${targetSubgraphName}@${version} to ${network} with ${provider}`
);

// always do netconfig + build to set the correct addresses and ensure the ABIs are correct
run(`yarn netconfig ${network}`);
run(`yarn build`);

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

  case "thegraph":
    run(
      `graph deploy --node https://api.studio.thegraph.com/deploy/ ${subgraphName} --version-label ${version}`
    );
    break;

  case "alchemy":
    throw Error(`Alchemy subgraph support is deprecated. Use Goldsky instead.`)
    // run(
    //   `graph deploy ${network} --version-label ${version} --node https://subgraphs.alchemy.com/api/subgraphs/deploy --ipfs https://ipfs.satsuma.xyz --deploy-key ${process.env.ALCHEMY_DEPLOY_KEY}`
    // );

  case "goldsky":
    run(`goldsky subgraph deploy ${subgraphName}/${version} --path .`);
    break;

  default:
    console.error(
      "Unknown provider. Use: thegraph | alchemy | goldsky | hinterlight"
    );
    process.exit(1);
}
