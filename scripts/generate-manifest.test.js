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
    "./network-specific-abis/sepolia/PeriodicTermHooks.json"
  );
  assert.equal(
    abiPath(
      manifest.templates.find((template) => template.name === "CombinedHooks")
        .mapping,
      "FixedTermHooks"
    ),
    "./network-specific-abis/sepolia/FixedTermHooks.json"
  );
  assert.equal(
    sourceByName(manifest, "HooksFactoryRevolving_20260419_233246"),
    undefined
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
});

test("rejects mixed indexed ABI families until dynamic templates are generation-aware", () => {
  const abiFamilies = loadAbiFamilies();
  const base = readYaml(MANIFEST_BASE_PATH);
  const config = loadChainConfig("sepolia", { abiFamilies });
  const modified = JSON.parse(JSON.stringify(config));
  modified.factories[0].abiFamily = "hooks-shared-current";

  assert.throws(
    () => buildManifest(modified, abiFamilies, base),
    /must currently share one ABI family/
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
