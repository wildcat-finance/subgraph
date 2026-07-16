const fs = require("fs");
const networks = require("../networks.json");
const path = require("path");
const networkId = process.argv[2];

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

function legacyWrapperFactoriesFromContracts(contracts) {
  const wrapperFactory = contracts.Wildcat4626WrapperFactory;
  if (!wrapperFactory) {
    return [];
  }
  return [
    {
      name: "Wildcat4626WrapperFactory",
      address: wrapperFactory.address,
      startBlock: wrapperFactory.startBlock,
      indexed: true,
    },
  ];
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

function getIndexedWrapperFactories(networkConfig) {
  const wrapperFactories = Array.isArray(networkConfig.wrapperFactories)
    ? networkConfig.wrapperFactories
    : legacyWrapperFactoriesFromContracts(networkConfig.contracts);
  const indexedWrapperFactories = wrapperFactories.filter(
    (wrapperFactory) => wrapperFactory.indexed !== false
  );
  const names = new Set();
  const addresses = new Set();

  indexedWrapperFactories.forEach((wrapperFactory, index) => {
    const label = `wrapperFactories[${index}]`;
    if (!wrapperFactory.name) {
      throw new Error(`${label}.name is required`);
    }
    if (!wrapperFactory.address) {
      throw new Error(`${label}.address is required`);
    }
    if (!Number.isInteger(Number(wrapperFactory.startBlock))) {
      throw new Error(`${label}.startBlock must be an integer`);
    }
    if (names.has(wrapperFactory.name)) {
      throw new Error(`Duplicate indexed wrapper factory name: ${wrapperFactory.name}`);
    }
    names.add(wrapperFactory.name);

    const address = wrapperFactory.address.toLowerCase();
    if (addresses.has(address)) {
      throw new Error(`Duplicate indexed wrapper factory address: ${wrapperFactory.address}`);
    }
    addresses.add(address);
  });

  return indexedWrapperFactories;
}

function normalizeNetworkConfig(networkConfig) {
  const hooksFactories = getIndexedHooksFactories(networkConfig);
  const wrapperFactories = getIndexedWrapperFactories(networkConfig);
  const contracts = { ...networkConfig.contracts };

  for (const hooksFactory of hooksFactories) {
    if (hooksFactory.name === "HooksFactory" || hooksFactory.name === "HooksFactoryRevolving") {
      contracts[hooksFactory.name] = {
        address: hooksFactory.address,
        startBlock: hooksFactory.startBlock,
      };
    }
  }

  return { ...networkConfig, contracts, hooksFactories, wrapperFactories };
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
        - name: PeriodicTermHooks
          file: ${hooksAbiDir()}/PeriodicTermHooks.json
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

function buildWildcat4626WrapperFactoryDataSource(network, wrapperFactory) {
  return `  - kind: ethereum
    name: ${wrapperFactory.name}
    network: ${network}
    source:
      address: "${wrapperFactory.address}"
      abi: Wildcat4626WrapperFactory
      startBlock: ${wrapperFactory.startBlock}
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - ArchController
        - Market
        - Token
        - Wildcat4626WrapperFactory
        - Wildcat4626Wrapper
        - Wildcat4626WrapperDeployed
      abis:
        - name: Wildcat4626WrapperFactory
          file: ./abis/Wildcat4626WrapperFactory.json
        - name: IERC20
          file: ./abis/IERC20.json
      eventHandlers:
        - event: WrapperDeployed(indexed address,indexed address)
          handler: handleWrapperDeployed
      file: ./src/wildcat-4626-wrapper-factory.ts
`;
}

function buildWildcat4626WrapperFactoryDataSources(network, wrapperFactories) {
  return wrapperFactories
    .map((wrapperFactory) =>
      buildWildcat4626WrapperFactoryDataSource(network, wrapperFactory)
    )
    .join("");
}

function setNetworkAddresses(networkId) {
  if (!networks[networkId]) {
    throw Error(`No deployments for network: ${networkId}`);
  }
  const subgraphTemplateYamlName = networkId.toLowerCase().includes("plasma")
    ? "plasma-subgraph.template.yaml"
    : "subgraph.template.yaml";
  const { name: network, contracts, hooksFactories, wrapperFactories } =
    normalizeNetworkConfig(networks[networkId]);
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
  subgraph = subgraph.replace(
    new RegExp(`{{Wildcat4626WrapperFactoryDataSource}}`, "g"),
    buildWildcat4626WrapperFactoryDataSources(network, wrapperFactories)
  );

  fs.writeFileSync(path.join(__dirname, "../subgraph.yaml"), subgraph);
  fs.writeFileSync(
    path.join(__dirname, "../uncrashable-config.yaml"),
    uncrashable
  );
}

if (require.main === module) {
  setNetworkAddresses(networkId);
}

module.exports = {
  buildWildcat4626WrapperFactoryDataSources,
  getIndexedWrapperFactories,
};
