const assert = require("node:assert/strict");
const test = require("node:test");

const {
  configDigest,
  finalCollateralFactoryName,
  finalHooksFactoryName,
  listNetworks,
  loadAbiFamilies,
  loadAllChainConfigs,
  loadChainConfig,
  validateChainConfig,
} = require("./chain-config");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("loads and validates every supported chain descriptor", () => {
  assert.deepEqual(listNetworks(), [
    "mainnet",
    "plasma-mainnet",
    "plasma-testnet",
    "sepolia",
  ]);
  const { configs } = loadAllChainConfigs();
  assert.equal(configs.length, 4);
  assert.deepEqual(
    configs.map(({ chainId }) => chainId).sort((a, b) => a - b),
    [1, 9745, 9746, 11155111]
  );
});

test("keeps deployment targets empty until V2.5 addresses are ready", () => {
  const { configs } = loadAllChainConfigs();
  for (const config of configs) {
    assert.equal(config.deploymentTargetsReady, false);
    assert.deepEqual(
      config.factories.filter((factory) => factory.deploymentTarget),
      []
    );
  }
});

test("derives current manifest aliases independently of deployment eligibility", () => {
  const sepolia = loadChainConfig("sepolia");
  const standard = sepolia.factories.find((factory) => factory.label === "standard-v2.1");
  const revolving = sepolia.factories.find(
    (factory) => factory.label === "revolving-preview-2026-04-24"
  );
  assert.equal(finalHooksFactoryName(sepolia, standard), "HooksFactory");
  assert.equal(finalHooksFactoryName(sepolia, revolving), "HooksFactoryRevolving");
  assert.equal(
    finalCollateralFactoryName(sepolia, sepolia.collateralFactories[0]),
    "WildcatMarketCollateralFactory"
  );
  assert.equal(standard.deploymentTarget, false);
  assert.equal(revolving.deploymentTarget, false);
});

test("computes a stable content digest", () => {
  const config = loadChainConfig("mainnet");
  const reordered = Object.fromEntries(Object.entries(config).reverse());
  assert.equal(configDigest(config), configDigest(reordered));
  const changed = clone(config);
  changed.features.analytics = false;
  assert.notEqual(configDigest(config), configDigest(changed));
});

test("rejects duplicate addresses across configured source types", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("mainnet", { abiFamilies }));
  config.wrapperFactories[0].address = config.factories[0].address;
  assert.throws(
    () => validateChainConfig(config, abiFamilies, { expectedNetwork: "mainnet" }),
    /duplicates address/
  );
});

test("rejects a deployment target before the chain target set is ready", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("mainnet", { abiFamilies }));
  config.factories[0].deploymentTarget = true;
  assert.throws(
    () => validateChainConfig(config, abiFamilies, { expectedNetwork: "mainnet" }),
    /cannot declare deployment targets/
  );
});

test("rejects a wrapper deployment target before the chain target set is ready", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("mainnet", { abiFamilies }));
  config.wrapperFactories[0].deploymentTarget = true;
  assert.throws(
    () => validateChainConfig(config, abiFamilies, { expectedNetwork: "mainnet" }),
    /cannot declare deployment targets/
  );
});

test("requires one standard and one revolving target when marked ready", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("mainnet", { abiFamilies }));
  config.deploymentTargetsReady = true;
  config.factories[0].deploymentTarget = true;
  assert.throws(
    () => validateChainConfig(config, abiFamilies, { expectedNetwork: "mainnet" }),
    /exactly one REVOLVING deployment target/
  );
});

test("requires a wrapper target on wrapper-enabled chains when marked ready", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("sepolia", { abiFamilies }));
  config.deploymentTargetsReady = true;
  config.factories.find(
    (factory) => factory.indexed && factory.marketKind === "STANDARD"
  ).deploymentTarget = true;
  config.factories.find(
    (factory) => factory.indexed && factory.marketKind === "REVOLVING"
  ).deploymentTarget = true;
  assert.throws(
    () => validateChainConfig(config, abiFamilies, { expectedNetwork: "sepolia" }),
    /exactly one wrapper deployment target/
  );
});

test("rejects compatibility aliases that select unindexed factories", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("sepolia", { abiFamilies }));
  config.compatibility.canonicalFactoryByMarketKind.REVOLVING =
    "revolving-preview-2026-04-19";
  assert.throws(
    () => validateChainConfig(config, abiFamilies, { expectedNetwork: "sepolia" }),
    /must select an indexed factory/
  );
});
