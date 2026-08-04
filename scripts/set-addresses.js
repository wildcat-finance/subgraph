const fs = require("fs");
const networks = require("../networks.json");
const path = require("path");
const networkId = process.argv[2];
if (!networks[networkId]) {
  throw Error(`No deployments for network: ${networkId}`);
}
// Plasma deployments use the same pre-force-buyback hooks ABI as mainnet.
const abiNetworkId = {
  "plasma-testnet": "mainnet",
  "plasma-mainnet": "mainnet",
}[networkId] ?? networkId;
let subgraphTemplateYamlName = 'subgraph.template.yaml';
if (networkId.toLowerCase().includes("plasma")) {
  subgraphTemplateYamlName = "plasma-subgraph.template.yaml";
}
function setNetworkAddresses() {
  const { name: network, contracts } = networks[networkId];
  let subgraph = fs
    .readFileSync(path.join(__dirname, `../${subgraphTemplateYamlName}`), "utf8")
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
}

function replaceNetworkAbis() {
  const networkAbisDir = path.join(
    __dirname,
    "../network-specific-abis",
    abiNetworkId
  );
  const abisDir = path.join(__dirname, "../abis");
  if (!fs.existsSync(networkAbisDir)) {
    throw new Error(`Network ${networkId} not found in network-specific-abis`);
  }
  const abiFiles = fs.readdirSync(networkAbisDir);

  for (const abiFile of abiFiles) {
    const abi = fs.readFileSync(path.join(networkAbisDir, abiFile), "utf8");
    const abiPath = path.join(abisDir, abiFile);
    fs.writeFileSync(abiPath, abi);
  }
}

function replaceRefsToForceBuyBacks() {
  const hooksFactoryPath = path.join(__dirname, "../src/hooks-factory.ts");
  let hooksFactory = fs.readFileSync(hooksFactoryPath, "utf8");
  if (networkId !== "sepolia") {
    hooksFactory = hooksFactory.replaceAll(
      "allowForceBuyBacks = hookedMarket.allowForceBuyBacks;",
      "allowForceBuyBacks = false;"
    );
  } else {
    hooksFactory = hooksFactory.replaceAll(
      "allowForceBuyBacks = false;",
      "allowForceBuyBacks = hookedMarket.allowForceBuyBacks;"
    );
  }
  fs.writeFileSync(hooksFactoryPath, hooksFactory);
}

setNetworkAddresses();
replaceNetworkAbis();
replaceRefsToForceBuyBacks();
