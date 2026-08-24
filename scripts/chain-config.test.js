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
  validateChainConfig
} = require("./chain-config");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("loads and validates every supported chain descriptor", () => {
  assert.deepEqual(listNetworks(), [
    "mainnet",
    "plasma-mainnet",
    "plasma-testnet",
    "sepolia"
  ]);
  const { configs } = loadAllChainConfigs();
  assert.equal(configs.length, 4);
  assert.ok(configs.every(({ configVersion }) => configVersion === 2));
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
      config.factories.filter(factory => factory.deploymentTarget),
      []
    );
  }

  const sepolia = configs.find(({ network }) => network === "sepolia");
  assert.equal(sepolia.deploymentTargetsReady, true);
  assert.equal(sepolia.hooksTemplates.length, 13);
  assert.deepEqual(
    [...new Set(sepolia.hooksTemplates.map(({ kind }) => kind))].sort(),
    ["FixedTerm", "OpenTerm", "PeriodicTerm"]
  );
  assert.deepEqual(
    sepolia.factories
      .filter(factory => factory.deploymentTarget)
      .map(({ label, marketKind, abiFamily, address, startBlock }) => ({
        label,
        marketKind,
        abiFamily,
        address,
        startBlock
      })),
    [
      {
        label: "standard-v2.5",
        marketKind: "STANDARD",
        abiFamily: "hooks-v2-5",
        address: "0xbFbDaFc91977eE599a61B30D9e75788565Ad6d18",
        startBlock: 11559133
      },
      {
        label: "revolving-v2.5",
        marketKind: "REVOLVING",
        abiFamily: "hooks-v2-5",
        address: "0x190B42942fe9492df9CeA441dA5c43309840E93A",
        startBlock: 11559137
      }
    ]
  );
  assert.deepEqual(
    sepolia.wrapperFactories
      .filter(factory => factory.deploymentTarget)
      .map(({ label, address, startBlock }) => ({
        label,
        address,
        startBlock
      })),
    [
      {
        label: "wrapper-v2.5",
        address: "0x6B1DD93453584346C530A1646e98aB306fD6D37C",
        startBlock: 11559124
      }
    ]
  );
  assert.deepEqual(sepolia.borrowerIdentityRegistries, [
    {
      label: "borrower-identity-registry-v2.5",
      manifestName: "WildcatBorrowerIdentityRegistryV2_5",
      generation: "v2.5",
      address: "0xc2cF90781595203D1e75c28246b306C95d4b8b21",
      startBlock: 11559126,
      indexed: true,
      lifecycle: "active"
    }
  ]);
  assert.deepEqual(sepolia.roleProviderFactories, [
    {
      label: "access-list-role-provider-factory-v2.5",
      manifestName: "AccessListRoleProviderFactoryV2_5",
      kind: "ACCESS_LIST",
      generation: "v2.5",
      address: "0x92995EA2ba572E4Cb8bB41E30f813BeB77FD4974",
      startBlock: 11559128,
      indexed: true,
      lifecycle: "active"
    }
  ]);
  assert.deepEqual(sepolia.provenance, {
    kind: "protocol-live-evidence-packet",
    source:
      "v2-protocol/v2-5-sepolia-live-20260824T194947Z.tar.gz",
    sha256: "8d8464612987074b151b8cb66451298962431ee24b2dd5b19757057318eb34ad"
  });
});

test("keeps legacy Plasma factories on the base hooked-market ABI", () => {
  const abiFamilies = loadAbiFamilies();
  for (const network of ["plasma-mainnet", "plasma-testnet"]) {
    const config = loadChainConfig(network, { abiFamilies });
    assert.deepEqual(
      config.factories.map(({ abiFamily }) => abiFamily),
      ["hooks-mainnet-current"]
    );
    assert.equal(
      abiFamilies[config.factories[0].abiFamily].hookedMarketAbi,
      "BASE"
    );
  }
});

test("derives current manifest aliases from the live Sepolia V2.5 targets", () => {
  const sepolia = loadChainConfig("sepolia");
  const standard = sepolia.factories.find(
    factory => factory.label === "standard-v2.5"
  );
  const revolving = sepolia.factories.find(
    factory => factory.label === "revolving-v2.5"
  );
  const wrapper = sepolia.wrapperFactories.find(
    factory => factory.label === "wrapper-v2.5"
  );
  assert.equal(finalHooksFactoryName(sepolia, standard), "HooksFactory");
  assert.equal(
    finalHooksFactoryName(sepolia, revolving),
    "HooksFactoryRevolving"
  );
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
    () =>
      validateChainConfig(config, abiFamilies, { expectedNetwork: "mainnet" }),
    /duplicates address/
  );
});

test("rejects unknown role-provider factory kinds", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("mainnet", { abiFamilies }));
  config.roleProviderFactories.push({
    label: "unknown-role-provider",
    manifestName: "UnknownRoleProviderFactory",
    kind: "UNKNOWN",
    generation: "v2.5",
    address: "0x000000000000000000000000000000000000f008",
    startBlock: 0,
    indexed: true,
    lifecycle: "active"
  });
  assert.throws(
    () =>
      validateChainConfig(config, abiFamilies, {
        expectedNetwork: "mainnet"
      }),
    /must be one of ACCESS_LIST, MERKLE, ERC20, ERC4626_ASSETS, ERC721, ERC1155/
  );
});

test("rejects duplicate and inconsistent hooks-template identities", () => {
  const abiFamilies = loadAbiFamilies();
  const duplicate = clone(loadChainConfig("sepolia", { abiFamilies }));
  duplicate.hooksTemplates[1].address = duplicate.hooksTemplates[0].address;
  assert.throws(
    () =>
      validateChainConfig(duplicate, abiFamilies, {
        expectedNetwork: "sepolia"
      }),
    /duplicates address/
  );

  const inconsistent = clone(loadChainConfig("sepolia", { abiFamilies }));
  inconsistent.hooksTemplates[0].version = "FixedTermHooks";
  assert.throws(
    () =>
      validateChainConfig(inconsistent, abiFamilies, {
        expectedNetwork: "sepolia"
      }),
    /must be OpenTermHooks for OpenTerm/
  );
});

test("rejects a deployment target before the chain target set is ready", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("mainnet", { abiFamilies }));
  config.factories[0].deploymentTarget = true;
  assert.throws(
    () =>
      validateChainConfig(config, abiFamilies, { expectedNetwork: "mainnet" }),
    /cannot declare deployment targets/
  );
});

test("rejects a non-active deployment target", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("mainnet", { abiFamilies }));
  config.factories[0].deploymentTarget = true;
  config.factories[0].lifecycle = "historical";
  assert.throws(
    () =>
      validateChainConfig(config, abiFamilies, { expectedNetwork: "mainnet" }),
    /deployment target must have an active lifecycle/
  );
});

test("rejects a wrapper deployment target before the chain target set is ready", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("mainnet", { abiFamilies }));
  config.wrapperFactories[0].deploymentTarget = true;
  assert.throws(
    () =>
      validateChainConfig(config, abiFamilies, { expectedNetwork: "mainnet" }),
    /cannot declare deployment targets/
  );
});

test("requires one standard and one revolving target when marked ready", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("mainnet", { abiFamilies }));
  config.deploymentTargetsReady = true;
  config.factories[0].deploymentTarget = true;
  assert.throws(
    () =>
      validateChainConfig(config, abiFamilies, { expectedNetwork: "mainnet" }),
    /exactly one REVOLVING deployment target/
  );
});

test("requires a wrapper target on wrapper-enabled chains when marked ready", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("sepolia", { abiFamilies }));
  config.factories.forEach(factory => {
    factory.deploymentTarget = false;
  });
  config.wrapperFactories.forEach(factory => {
    factory.deploymentTarget = false;
  });
  config.factories.find(
    factory => factory.label === "standard-v2.5"
  ).deploymentTarget = true;
  config.factories.find(
    factory => factory.label === "revolving-v2.5"
  ).deploymentTarget = true;
  assert.throws(
    () =>
      validateChainConfig(config, abiFamilies, { expectedNetwork: "sepolia" }),
    /exactly one wrapper deployment target/
  );
});

test("rejects compatibility aliases that select unindexed factories", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("sepolia", { abiFamilies }));
  config.compatibility.canonicalFactoryByMarketKind.REVOLVING =
    "revolving-preview-2026-04-19";
  assert.throws(
    () =>
      validateChainConfig(config, abiFamilies, { expectedNetwork: "sepolia" }),
    /must select an indexed factory/
  );
});

test("rejects factory metadata that cannot be encoded in mapping context", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("mainnet", { abiFamilies }));
  config.factories[0].generation = "v2|unexpected";
  assert.throws(
    () =>
      validateChainConfig(config, abiFamilies, { expectedNetwork: "mainnet" }),
    /must not contain the factory-context separator/
  );
});

test("keeps every analytics price source explicit in chain configuration", () => {
  const mainnet = loadChainConfig("mainnet");
  assert.equal(mainnet.pricing.mode, "CHAINLINK");
  assert.equal(mainnet.pricing.directFeeds.length, 2);

  const sepolia = loadChainConfig("sepolia");
  assert.equal(sepolia.pricing.mode, "SYNTHETIC_TESTNET");
  assert.deepEqual(
    sepolia.pricing.syntheticPrices.map(({ symbol }) => symbol),
    ["USDC", "USDT", "DAI", "WETH", "WBTC", "ZRX"]
  );

  const plasmaMainnet = loadChainConfig("plasma-mainnet");
  assert.equal(plasmaMainnet.pricing.mode, "USD_PEG");
  assert.deepEqual(plasmaMainnet.pricing.stablecoins, [
    "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb"
  ]);

  const plasmaTestnet = loadChainConfig("plasma-testnet");
  assert.equal(plasmaTestnet.pricing.mode, "USD_PEG");
  assert.equal(plasmaTestnet.pricing.stablecoins.length, 9);
  assert.equal(plasmaTestnet.pricing.directFeeds.length, 0);
  assert.equal(plasmaTestnet.pricing.syntheticPrices.length, 0);
});

test("rejects mixed or incomplete pricing modes", () => {
  const abiFamilies = loadAbiFamilies();
  const config = clone(loadChainConfig("sepolia", { abiFamilies }));
  config.pricing.feedRegistry = "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf";
  assert.throws(
    () =>
      validateChainConfig(config, abiFamilies, { expectedNetwork: "sepolia" }),
    /must not declare Chainlink configuration/
  );
});

test("rejects zero-address pricing configuration", () => {
  const abiFamilies = loadAbiFamilies();
  const stablecoin = clone(loadChainConfig("plasma-mainnet", { abiFamilies }));
  stablecoin.pricing.stablecoins[0] =
    "0x0000000000000000000000000000000000000000";
  assert.throws(
    () =>
      validateChainConfig(stablecoin, abiFamilies, {
        expectedNetwork: "plasma-mainnet"
      }),
    /must not be the zero address/
  );

  const directFeed = clone(loadChainConfig("mainnet", { abiFamilies }));
  directFeed.pricing.directFeeds[0].feed =
    "0x0000000000000000000000000000000000000000";
  assert.throws(
    () =>
      validateChainConfig(directFeed, abiFamilies, {
        expectedNetwork: "mainnet"
      }),
    /must not be the zero address/
  );
});
