#!/usr/bin/env node
const { execSync } = require("child_process");
require("dotenv").config();

const provider = process.argv[2];
const network = process.argv[3];
const subgraphName = process.argv[4] || network;
const devDeployKey = process.env.DEV_DEPLOY_KEY;
const devIpfsUrl = process.env.DEV_IPFS_URL;
const devNodeUrl = process.env.DEV_NODE_URL;

if (!network) {
  console.error(
    "Usage: SUBGRAPH_VERSION_LABEL=<label> yarn deploy <provider> <network> [subgraph-name]"
  );
  process.exit(1);
}

if (!provider) {
  console.error(
    "Usage: SUBGRAPH_VERSION_LABEL=<label> yarn deploy <provider> <network> [subgraph-name]"
  );
  process.exit(1);
}

function run(cmd) {
  console.log("> " + cmd);
  execSync(cmd, { stdio: "inherit" });
}

const version =
  process.env.SUBGRAPH_VERSION_LABEL ||
  execSync("node scripts/next-version").toString().trim();

if (!/^[A-Za-z0-9._-]+$/.test(version)) {
  throw Error(`Invalid subgraph version label: ${version}`);
}

console.log(
  `Deploying ${subgraphName}@${version} to ${network} with ${provider}`
);

// always do netconfig + build to set the correct addresses and ensure the ABIs are correct
run(`yarn netconfig ${network}`);
run(`yarn build`);

switch (provider) {
  case "dev":
    if (!devDeployKey || !devNodeUrl || !devIpfsUrl) {
      console.error("DEV_DEPLOY_KEY, DEV_NODE_URL, and DEV_IPFS_URL must be set");
      process.exit(1);
    }
    // Graph name can't contain periods or hyphens
    const deployId = `${subgraphName}_${version.replaceAll(/[.\-]/g, '_')}`;
    // Try to create subgraph if it doesn't exist
    try {
      run(`graph create --node ${devNodeUrl} --access-token ${devDeployKey} ${deployId}`);
    } catch (err) {}
    run(`graph deploy --node ${devNodeUrl} --ipfs ${devIpfsUrl} --deploy-key ${devDeployKey} --headers '{"Authorization": "Bearer ${devDeployKey}"}' --version-label ${version} ${deployId}`);
    console.log(`Deployed ${subgraphName}@${version} to dev with name ${deployId}`);
    break;
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
    console.error("Unknown provider. Use: thegraph | alchemy | goldsky | dev");
    process.exit(1);
}
