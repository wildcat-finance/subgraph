#!/usr/bin/env node
const { execSync } = require("child_process");
require("dotenv").config();

const provider = process.argv[2];
const network = process.argv[3];
let subgraphName = process.argv[4];

if (!network) {
  console.error("Usage: yarn deploy <provider> <network> <subgraph-name>");
  process.exit(1);
}

if (!provider) {
  console.error("Usage: yarn deploy <provider> <network> <subgraph-name>");
  process.exit(1);
}

function run(cmd) {
  console.log("> " + cmd);
  execSync(cmd, { stdio: "inherit" });
}

const version = execSync("node scripts/next-version")
  .toString()
  .trim();

console.log(
  `Deploying ${subgraphName}@${version} to ${network} with ${provider}`
);

// always do netconfig + build to set the correct addresses and ensure the ABIs are correct
run(`yarn netconfig ${network}`);
run(`yarn build`);

switch (provider) {
  case "thegraph":
    run(
      `graph deploy --node https://api.studio.thegraph.com/deploy/ ${subgraphName} --version-label ${version}`
    );
    break;

  case "alchemy":
    subgraphName = subgraphName || network;
    run(
      `graph deploy ${network} --version-label ${version} --node https://subgraphs.alchemy.com/api/subgraphs/deploy --ipfs https://ipfs.satsuma.xyz --deploy-key ${process.env.ALCHEMY_DEPLOY_KEY}`
    );
    break;

  case "goldsky":
    run(`goldsky subgraph deploy ${subgraphName}/${version} --path .`);
    break;

  default:
    console.error("Unknown provider. Use: thegraph | alchemy | goldsky");
    process.exit(1);
}
