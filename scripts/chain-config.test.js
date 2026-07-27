const assert = require("node:assert/strict");
const test = require("node:test");

const {
  configDigest,
  finalCollateralFactoryName,
  finalHooksFactoryName,
  finalWrapperFactoryName,
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

test("keeps non-Sepolia targets blocked and pins the live Sepolia V2.5 targets", () => {
  const { configs } = loadAllChainConfigs();
  for (const config of configs.filter(({ network }) => network !== "sepolia")) {
    assert.equal(config.deploymentTargetsReady, false);
    assert.deepEqual(
      config.factories.filter((factory) => factory.deploymentTarget),
      []
    );
  }

  const sepolia = configs.find(({ network }) => network === "sepolia");
  assert.equal(sepolia.deploymentTargetsReady, true);
  assert.deepEqual(
    sepolia.factories
      .filter((factory) => factory.deploymentTarget)
      .map(({ label, marketKind, abiFamily, address, startBlock }) => ({
        label,
        marketKind,
        abiFamily,
        address,
        startBlock,
      })),
    [
      {
        label: "standard-v2.5",
        marketKind: "STANDARD",
        abiFamily: "hooks-sepolia-current",
        address: "0xAa9BbaE0D519e85B6aBEA81aD3C2cBeBfA57696C",
        startBlock: 11363908,
      },
      {
        label: "revolving-v2.5",
        marketKind: "REVOLVING",
        abiFamily: "hooks-sepolia-current",
        address: "0x76Fe050d91940a72133e1819BF34c1042d8DBe73",
        startBlock: 11363912,
      },
    ]
  );
  assert.deepEqual(
    sepolia.wrapperFactories
      .filter((factory) => factory.deploymentTarget)
      .map(({ label, address, startBlock }) => ({ label, address, startBlock })),
    [
      {
        label: "wrapper-v2.5",
        address: "0x8a77449eaBB1522983cd700f002b5b191463378e",
        startBlock: 11363904,
      },
    ]
  );
  assert.deepEqual(sepolia.provenance, {
    kind: "protocol-live-checkpoint",
    source:
      "v2-protocol/deployments/sepolia/run-state-checkpoints/run-state-v2-5-card-23-live.json",
    sha256: "c5acd8fefcc5d4b7de52e25e39770a7fd59b7e926ca892fe5cfcf739f1092ebe",
  });
});

test("derives current manifest aliases from the live Sepolia V2.5 targets", () => {
  const sepolia = loadChainConfig("sepolia");
  const standard = sepolia.factories.find((factory) => factory.label === "standard-v2.5");
  const revolving = sepolia.factories.find(
    (factory) => factory.label === "revolving-v2.5"
  );
  const wrapper = sepolia.wrapperFactories.find(
    (factory) => factory.label === "wrapper-v2.5"
  );
  assert.equal(finalHooksFactoryName(sepolia, standard), "HooksFactory");
  assert.equal(finalHooksFactoryName(sepolia, revolving), "HooksFactoryRevolving");
  assert.equal(
    finalWrapperFactoryName(sepolia, wrapper),
    "Wildcat4626WrapperFactory"
  );
  assert.equal(
    finalCollateralFactoryName(sepolia, sepolia.collateralFactories[0]),
    "WildcatMarketCollateralFactory"
  );
  assert.equal(standard.deploymentTarget, true);
  assert.equal(revolving.deploymentTarget, true);
  assert.equal(wrapper.deploymentTarget, true);
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

test("rejects a non-active deployment target", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("mainnet", { abiFamilies }));
  config.factories[0].deploymentTarget = true;
  config.factories[0].lifecycle = "historical";
  assert.throws(
    () => validateChainConfig(config, abiFamilies, { expectedNetwork: "mainnet" }),
    /deployment target must have an active lifecycle/
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
  config.factories.forEach((factory) => {
    factory.deploymentTarget = false;
  });
  config.wrapperFactories.forEach((factory) => {
    factory.deploymentTarget = false;
  });
  config.factories.find(
    (factory) => factory.label === "standard-v2.5"
  ).deploymentTarget = true;
  config.factories.find(
    (factory) => factory.label === "revolving-v2.5"
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

test("rejects factory metadata that cannot be encoded in mapping context", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("mainnet", { abiFamilies }));
  config.factories[0].generation = "v2|unexpected";
  assert.throws(
    () => validateChainConfig(config, abiFamilies, { expectedNetwork: "mainnet" }),
    /must not contain the factory-context separator/
  );
});

test("keeps every analytics price source explicit in chain configuration", () => {
  const mainnet = loadChainConfig("mainnet");
  assert.equal(mainnet.pricing.mode, "CHAINLINK");
  assert.equal(mainnet.pricing.feedDecimals, 8);
  assert.equal(mainnet.pricing.directFeeds.length, 2);

  const sepolia = loadChainConfig("sepolia");
  assert.equal(sepolia.pricing.mode, "SYNTHETIC_TESTNET");
  assert.deepEqual(
    sepolia.pricing.syntheticPrices.map(({ symbol }) => symbol),
    ["USDC", "USDT", "DAI", "WETH", "WBTC", "ZRX"]
  );
});

test("rejects mixed or incomplete pricing modes", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("sepolia", { abiFamilies }));
  config.pricing.feedRegistry =
    "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf";
  assert.throws(
    () => validateChainConfig(config, abiFamilies, { expectedNetwork: "sepolia" }),
    /must not declare Chainlink configuration/
  );
});
