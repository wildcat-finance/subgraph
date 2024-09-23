const fs = require("fs");
const networks = require("../networks.json");
const path = require("path");
const networkId = process.argv[2];
if (!networks[networkId]) {
  throw Error(`No deployments for network: ${networkId}`);
}
const { name: network, contracts } = networks[networkId];
let subgraph = fs
  .readFileSync(path.join(__dirname, "../subgraph.template.yaml"), "utf8")
  .replace(new RegExp(`{{NetworkName}}`, "g"), network);
let uncrashable = fs
  .readFileSync(
    path.join(__dirname, "../uncrashable-config.template.yaml"),
    "utf8"
  )
  .replace(new RegExp(`{{NetworkName}}`, "g"), network);
for (const contract in contracts) {
  const { address, startBlock } = contracts[contract];
  subgraph = subgraph
    .replace(new RegExp(`{{${contract}Address}}`, "g"), address)
    .replace(new RegExp(`{{${contract}StartBlock}}`, "g"), startBlock);
  uncrashable = uncrashable
    .replace(new RegExp(`{{${contract}Address}}`, "g"), address)
    .replace(new RegExp(`{{${contract}StartBlock}}`, "g"), startBlock);
}

fs.writeFileSync(path.join(__dirname, "../subgraph.yaml"), subgraph);
fs.writeFileSync(
  path.join(__dirname, "../uncrashable-config.yaml"),
  uncrashable
);
