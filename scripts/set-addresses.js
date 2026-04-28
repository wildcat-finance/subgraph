const fs = require("fs");
const networks = require("../networks.json");
const path = require("path");
const networkId = process.argv[2];
if (!networks[networkId]) {
  throw Error(`No deployments for network: ${networkId}`);
}
let subgraphTemplateYamlName = "subgraph.template.yaml";
if (networkId.toLowerCase().includes("plasma")) {
  subgraphTemplateYamlName = "plasma-subgraph.template.yaml";
}

function legacyHooksFactoriesFromContracts(contracts) {
  const hooksFactories = [];
  if (contracts.HooksFactory) {
    hooksFactories.push({
      name: "HooksFactory",
      marketType: "legacy",
      address: contracts.HooksFactory.address,
      startBlock: contracts.HooksFactory.startBlock,
      indexed: true,
    });
  }
  if (contracts.HooksFactoryRevolving) {
    hooksFactories.push({
      name: "HooksFactoryRevolving",
      marketType: "revolving",
      address: contracts.HooksFactoryRevolving.address,
      startBlock: contracts.HooksFactoryRevolving.startBlock,
      indexed: true,
    });
  }
  return hooksFactories;
}

function validateHooksFactory(hooksFactory, index) {
  const label = `hooksFactories[${index}]`;
  if (!hooksFactory.name) {
    throw new Error(`${label}.name is required`);
  }
  if (!hooksFactory.marketType) {
    throw new Error(`${label}.marketType is required`);
  }
  if (!hooksFactory.address) {
    throw new Error(`${label}.address is required`);
  }
  if (!Number.isInteger(Number(hooksFactory.startBlock))) {
    throw new Error(`${label}.startBlock must be an integer`);
  }
}

function getIndexedHooksFactories(networkConfig) {
  const hooksFactories = Array.isArray(networkConfig.hooksFactories)
    ? networkConfig.hooksFactories
    : legacyHooksFactoriesFromContracts(networkConfig.contracts);
  const indexedHooksFactories = hooksFactories.filter(
    (hooksFactory) => hooksFactory.indexed !== false
  );
  const names = new Set();
  const addresses = new Set();

  indexedHooksFactories.forEach((hooksFactory, index) => {
    validateHooksFactory(hooksFactory, index);
    if (names.has(hooksFactory.name)) {
      throw new Error(`Duplicate indexed hooks factory name: ${hooksFactory.name}`);
    }
    names.add(hooksFactory.name);

    const address = hooksFactory.address.toLowerCase();
    if (addresses.has(address)) {
      throw new Error(`Duplicate indexed hooks factory address: ${hooksFactory.address}`);
    }
    addresses.add(address);
  });

  return indexedHooksFactories;
}

function normalizeNetworkConfig(networkConfig) {
  const hooksFactories = getIndexedHooksFactories(networkConfig);
  const contracts = { ...networkConfig.contracts };

  for (const hooksFactory of hooksFactories) {
    if (hooksFactory.name === "HooksFactory" || hooksFactory.name === "HooksFactoryRevolving") {
      contracts[hooksFactory.name] = {
        address: hooksFactory.address,
        startBlock: hooksFactory.startBlock,
      };
    }
  }

  return { ...networkConfig, contracts, hooksFactories };
}

function hooksFactoryMappingFile(hooksFactory) {
  if (hooksFactory.marketType === "legacy") {
    return "./src/hooks-factory.ts";
  }
  if (hooksFactory.marketType === "revolving") {
    return "./src/hooks-factory-revolving.ts";
  }
  throw new Error(`Unsupported hooks factory market type: ${hooksFactory.marketType}`);
}

function hooksAbiDir() {
  const networkAbisDir = path.join(
    __dirname,
    "../network-specific-abis",
    networkId
  );
  return fs.existsSync(networkAbisDir) ? `./network-specific-abis/${networkId}` : "./abis";
}

function buildHooksFactoryDataSource(network, hooksFactory) {
  return `  - kind: ethereum
    name: ${hooksFactory.name}
    network: ${network}
    source:
      address: "${hooksFactory.address}"
      abi: HooksFactory
      startBlock: ${hooksFactory.startBlock}
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
          file: ${hooksAbiDir()}/OpenTermHooks.json
        - name: FixedTermHooks
          file: ${hooksAbiDir()}/FixedTermHooks.json
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
      file: ${hooksFactoryMappingFile(hooksFactory)}
`;
}

function buildAdditionalHooksFactoryDataSources(network, hooksFactories) {
  return hooksFactories
    .filter((hooksFactory) => hooksFactory.name !== "HooksFactory")
    .map((hooksFactory) => buildHooksFactoryDataSource(network, hooksFactory))
    .join("");
}

function setNetworkAddresses() {
  const { name: network, contracts, hooksFactories } = normalizeNetworkConfig(networks[networkId]);
  let subgraph = fs
    .readFileSync(path.join(__dirname, `../${subgraphTemplateYamlName}`), "utf8")
    .replace(new RegExp(`{{NetworkName}}`, "g"), network)
    .replace(new RegExp(`{{HooksAbiDir}}`, "g"), hooksAbiDir());
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
    buildAdditionalHooksFactoryDataSources(network, hooksFactories)
  );

  fs.writeFileSync(path.join(__dirname, "../subgraph.yaml"), subgraph);
  fs.writeFileSync(
    path.join(__dirname, "../uncrashable-config.yaml"),
    uncrashable
  );
}

setNetworkAddresses();
