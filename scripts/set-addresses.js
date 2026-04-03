const fs = require("fs");
const networks = require("../networks.json");
const path = require("path");
const networkId = process.argv[2];
if (!networks[networkId]) {
  throw Error(`No deployments for network: ${networkId}`);
}
let subgraphTemplateYamlName = 'subgraph.template.yaml';
if (networkId.toLowerCase().includes("plasma")) {
  subgraphTemplateYamlName = "plasma-subgraph.template.yaml";
}

function buildHooksFactoryRevolvingDataSource(network, contracts) {
  const revolvingFactory = contracts.HooksFactoryRevolving;
  if (!revolvingFactory) {
    return "";
  }

  return `  - kind: ethereum
    name: HooksFactoryRevolving
    network: ${network}
    source:
      address: "${revolvingFactory.address}"
      abi: HooksFactory
      startBlock: ${revolvingFactory.startBlock}
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - LenderHooksAccess
        - HooksInstance
        - RoleProvider
        - HooksConfig
        - RoleProviderUpdated
        - RoleProviderAdded
        - RoleProviderRemoved
        - AccountBlockedFromDeposits
        - AccountUnblockedFromDeposits
        - AccountMadeFirstDeposit
        - AccountAccessGranted
        - AccountAccessRevoked
        - HooksFactory
        - HooksTemplate
        - HooksInstanceDeployed
        - HooksTemplateAdded
        - HooksTemplateDisabled
        - HooksTemplateFeesUpdated
        - LenderAccount
      abis:
        - name: HooksFactory
          file: ./abis/HooksFactory.json
        - name: WildcatMarket
          file: ./abis/WildcatMarket.json
        - name: IWildcatMarketRevolving
          file: ./abis/IWildcatMarketRevolving.json
        - name: OpenTermHooks
          file: ./abis/OpenTermHooks.json
        - name: FixedTermHooks
          file: ./abis/FixedTermHooks.json
        - name: CombinedHooks
          file: ./abis/CombinedHooks.json
        - name: IERC20
          file: ./abis/IERC20.json
      eventHandlers:
        - event: ChangedSpherexEngineAddress(address,address)
          handler: handleChangedSpherexEngineAddress
        - event: ChangedSpherexOperator(address,address)
          handler: handleChangedSpherexOperator
        - event: HooksInstanceDeployed(address,address)
          handler: handleHooksInstanceDeployed
        - event: HooksTemplateAdded(address,string,address,address,uint80,uint16)
          handler: handleHooksTemplateAdded
        - event: HooksTemplateDisabled(address)
          handler: handleHooksTemplateDisabled
        - event: HooksTemplateFeesUpdated(address,address,address,uint80,uint16)
          handler: handleHooksTemplateFeesUpdated
        - event: MarketDeployed(indexed address,indexed address,string,string,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256)
          handler: handleMarketDeployed
      file: ./src/hooks-factory-revolving.ts
`;
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

  subgraph = subgraph.replace(
    new RegExp(`{{HooksFactoryRevolvingDataSource}}`, "g"),
    buildHooksFactoryRevolvingDataSource(network, contracts)
  );

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
    networkId
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
