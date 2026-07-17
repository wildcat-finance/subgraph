const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const YAML = require("yaml");

const {
  MANIFEST_BASE_PATH,
  UNCRASHABLE_BASE_PATH,
  buildLegacyNetworks,
  buildManifest,
  buildUncrashableConfig,
  renderOutputs,
} = require("./generate-manifest");
const {
  loadAbiFamilies,
  loadAllChainConfigs,
  loadChainConfig,
} = require("./chain-config");

function readYaml(filePath) {
  return YAML.parse(fs.readFileSync(filePath, "utf8"));
}

function sourceByName(manifest, name) {
  return manifest.dataSources.find((source) => source.name === name);
}

function abiPath(mapping, name) {
  return mapping.abis.find((abi) => abi.name === name)?.file;
}

function hooksFactoryContextKey(address) {
  return `hooksFactory_${address.toLowerCase().slice(2)}`;
}

function contextData(source, address) {
  return source.context?.[hooksFactoryContextKey(address)]?.data;
}

function assertDeclaresEntities(mapping, expectedEntities) {
  for (const entity of expectedEntities) {
    assert.ok(
      mapping.entities.includes(entity),
      `${mapping.file} must declare writes to ${entity}`
    );
  }
}

test("renders every configured network deterministically without placeholders", () => {
  const { configs } = loadAllChainConfigs();
  for (const config of configs) {
    const first = renderOutputs(config.network);
    const second = renderOutputs(config.network);
    assert.deepEqual([...first.files], [...second.files]);

    for (const content of first.files.values()) {
      assert.doesNotMatch(content, /\{\{/);
    }
    assert.ok(
      first.manifest.dataSources.every(
        (source) => source.network === config.graphNetwork
      )
    );
    assert.ok(
      first.manifest.templates.every(
        (template) => template.network === config.graphNetwork
      )
    );
  }
});

test("renders Sepolia historical factories, canonical aliases, mappings, and ABI family", () => {
  const { manifest } = renderOutputs("sepolia");
  assert.deepEqual(
    manifest.dataSources.map((source) => source.name),
    [
      "WildcatMarketCollateralFactory",
      "Wildcat4626WrapperFactory",
      "HooksFactory",
      "HooksFactoryLegacyV2",
      "HooksFactoryRevolving",
      "WildcatArchController",
      "WildcatSanctionsSentinel",
    ]
  );
  assert.equal(
    sourceByName(manifest, "HooksFactoryLegacyV2").mapping.file,
    "./src/hooks-factory.ts"
  );
  assert.equal(
    sourceByName(manifest, "HooksFactoryRevolving").mapping.file,
    "./src/hooks-factory-revolving.ts"
  );
  assert.equal(
    abiPath(
      sourceByName(manifest, "HooksFactory").mapping,
      "PeriodicTermHooks"
    ),
    "./abis/hooked-market/PeriodicTermHooks.json"
  );
  assert.equal(
    abiPath(
      sourceByName(manifest, "HooksFactory").mapping,
      "FixedTermHooksBase"
    ),
    "./abis/hooked-market/base/FixedTermHooks.json"
  );
  assert.equal(
    abiPath(
      sourceByName(manifest, "HooksFactory").mapping,
      "FixedTermHooksForceBuyBack"
    ),
    "./abis/hooked-market/force-buyback/FixedTermHooks.json"
  );
  const standardFactory = sourceByName(manifest, "HooksFactory");
  assert.equal(
    contextData(standardFactory, standardFactory.source.address),
    "STANDARD|v2.1|hooks-shared-current|FORCE_BUYBACK|7124440|true|false|ACTIVE|standard-v2.1|0xC003f20F2642c76B81e5e1620c6D8cdEE826408f"
  );
  assert.deepEqual(
    Object.keys(standardFactory.context).filter((key) =>
      key.startsWith("hooksFactory_")
    ),
    [hooksFactoryContextKey(standardFactory.source.address)]
  );
  assert.equal(standardFactory.context.pricingMode.data, "SYNTHETIC_TESTNET");
  assert.match(
    standardFactory.context.pricingSyntheticPrices.data,
    /ZRX=0\.10=false/
  );
  assert.equal(
    standardFactory.context.deploymentArchController.data,
    "0xC003f20F2642c76B81e5e1620c6D8cdEE826408f"
  );
  assert.equal(
    Object.keys(sourceByName(manifest, "WildcatArchController").context).filter(
      (key) => key.startsWith("hooksFactory_")
    ).length,
    7
  );
  assert.equal(
    sourceByName(manifest, "HooksFactoryRevolving_20260419_233246"),
    undefined
  );
  const wrapperFactory = sourceByName(
    manifest,
    "Wildcat4626WrapperFactory"
  );
  assert.equal(
    wrapperFactory.source.address,
    "0x0566Fe57682164af689f1440cb3BCEedEe3bf843"
  );
  assert.equal(wrapperFactory.source.startBlock, 10534112);
  assert.equal(wrapperFactory.context.moduleFactoryLabel.data, "wrapper-v1");
  assert.equal(wrapperFactory.context.moduleFactoryGeneration.data, "v1");
  assert.equal(wrapperFactory.context.moduleFactoryIndexed.data, "true");
  assert.equal(
    wrapperFactory.context.moduleFactoryDeploymentTarget.data,
    "false"
  );
  assert.equal(wrapperFactory.context.moduleFactoryLifecycle.data, "ACTIVE");

  const collateralFactory = sourceByName(
    manifest,
    "WildcatMarketCollateralFactory"
  );
  assert.equal(
    collateralFactory.context.moduleFactoryLabel.data,
    "collateral-v1"
  );
  assert.equal(
    collateralFactory.context.moduleFactoryGeneration.data,
    "v1"
  );

  assertDeclaresEntities(standardFactory.mapping, [
    "Borrower",
    "MarketEvent",
    "MarketEventCursor",
    "MarketSnapshot",
  ]);
  assertDeclaresEntities(
    sourceByName(manifest, "WildcatArchController").mapping,
    ["Borrower", "IndexerDeployment", "MarketEvent", "MarketEventCursor"]
  );
  assertDeclaresEntities(
    manifest.templates.find((template) => template.name === "WildcatMarket")
      .mapping,
    [
      "LenderAccountSnapshot",
      "MarketEvent",
      "MarketEventCursor",
      "MarketSnapshot",
      "TokenDailyPrice",
    ]
  );
  assertDeclaresEntities(
    manifest.templates.find((template) => template.name === "CombinedHooks")
      .mapping,
    ["HooksNameUpdated", "MarketEvent", "MarketEventCursor", "MarketSnapshot"]
  );
});

test("feature flags remove unsupported Plasma sources without changing the core schema surface", () => {
  const mainnet = renderOutputs("mainnet").manifest;
  const plasma = renderOutputs("plasma-mainnet").manifest;

  assert.deepEqual(
    plasma.dataSources.map((source) => source.name),
    ["HooksFactory", "WildcatArchController", "WildcatSanctionsSentinel"]
  );
  assert.deepEqual(
    plasma.templates.map((template) => template.name),
    mainnet.templates
      .map((template) => template.name)
      .filter((name) => name !== "SimpleMarketCollateralMultiParty")
  );
  assert.deepEqual(plasma.schema, mainnet.schema);
});

test("legacy networks projection retains all inventory entries but aliases only canonical factories", () => {
  const { configs } = loadAllChainConfigs();
  const networks = buildLegacyNetworks(configs);
  const sepolia = networks.sepolia;

  assert.equal(sepolia.hooksFactories.length, 7);
  assert.equal(
    sepolia.hooksFactories.filter((factory) => factory.indexed).length,
    3
  );
  assert.equal(
    sepolia.contracts.HooksFactory.address,
    "0x10A64ABa0159720F8a23E1A552800CA4eb21576C"
  );
  assert.equal(
    sepolia.contracts.HooksFactoryRevolving.address,
    "0xb899ba2a5F5b609898A2bABe445Aa31dDf0277e5"
  );
  assert.equal(
    sepolia.hooksFactories.find(
      (factory) => factory.address === sepolia.contracts.HooksFactory.address
    ).name,
    "HooksFactory"
  );
  assert.equal(
    sepolia.hooksFactories.find(
      (factory) => factory.address === sepolia.contracts.HooksFactoryRevolving.address
    ).name,
    "HooksFactoryRevolving"
  );
});

test("deployment-target state does not alter current compatibility aliases", () => {
  const abiFamilies = loadAbiFamilies();
  const base = readYaml(MANIFEST_BASE_PATH);
  const config = loadChainConfig("sepolia", { abiFamilies });
  const modified = JSON.parse(JSON.stringify(config));
  modified.deploymentTargetsReady = true;
  modified.factories.find((factory) => factory.label === "standard-v2").deploymentTarget = true;
  modified.factories.find(
    (factory) => factory.label === "revolving-preview-2026-04-24"
  ).deploymentTarget = true;

  const manifest = buildManifest(modified, abiFamilies, base);
  assert.equal(
    sourceByName(manifest, "HooksFactory").source.address,
    config.factories.find((factory) => factory.label === "standard-v2.1").address
  );
  const standardTarget = modified.factories.find(
    (factory) => factory.label === "standard-v2"
  );
  assert.match(
    contextData(
      sourceByName(manifest, standardTarget.manifestName),
      standardTarget.address
    ),
    /\|true\|true\|ACTIVE\|standard-v2\|/
  );
});

test("supports mixed hooked-market ABI adapters when core dynamic ABIs match", () => {
  const abiFamilies = loadAbiFamilies();
  const base = readYaml(MANIFEST_BASE_PATH);
  const config = loadChainConfig("sepolia", { abiFamilies });
  const modified = JSON.parse(JSON.stringify(config));
  modified.factories[0].abiFamily = "hooks-sepolia-current";

  const manifest = buildManifest(modified, abiFamilies, base);
  const source = sourceByName(
    manifest,
    modified.factories[0].manifestName
  );
  assert.match(
    contextData(source, modified.factories[0].address),
    /\|hooks-sepolia-current\|BASE\|/
  );
});

test("renders the uncrashable network selection structurally", () => {
  const config = loadChainConfig("plasma-testnet");
  const generated = buildUncrashableConfig(
    config,
    readYaml(UNCRASHABLE_BASE_PATH)
  );
  assert.deepEqual(generated.networkConfig.entityIdPrefixes[0].networks, [
    "plasma-testnet",
  ]);
});
