const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const CHAINS_DIR = path.join(REPO_ROOT, "config", "chains");
const ABI_FAMILIES_PATH = path.join(REPO_ROOT, "config", "abi-families.json");

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const LABEL_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const MANIFEST_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const PRICE_SYMBOL_PATTERN = /^[A-Za-z0-9._-]+$/;
const POSITIVE_DECIMAL_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const MARKET_KINDS = ["STANDARD", "REVOLVING"];
const LIFECYCLES = ["active", "historical", "retired"];
const HOOKED_MARKET_ABIS = ["BASE", "FORCE_BUYBACK"];
const PRICING_MODES = ["CHAINLINK", "SYNTHETIC_TESTNET", "NONE"];
const REQUIRED_HOOKS_ABIS = [
  "HooksFactory",
  "WildcatMarket",
  "IWildcatMarketRevolving",
  "CombinedHooks",
  "IERC20",
  "ChainlinkFeedRegistry",
  "ChainlinkAggregator",
];

const TOP_LEVEL_KEYS = [
  "configVersion",
  "schemaRelease",
  "network",
  "chainId",
  "graphNetwork",
  "deploymentTargetsReady",
  "anchors",
  "factories",
  "wrapperFactories",
  "collateralFactories",
  "features",
  "pricing",
  "compatibility",
  "provenance",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(context, message) {
  throw new Error(`${context}: ${message}`);
}

function assertObject(value, context) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(context, "must be an object");
  }
}

function assertExactKeys(value, allowedKeys, context) {
  assertObject(value, context);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unknown.length > 0) {
    fail(context, `contains unknown field(s): ${unknown.join(", ")}`);
  }
  const missing = allowedKeys.filter((key) => !(key in value));
  if (missing.length > 0) {
    fail(context, `is missing field(s): ${missing.join(", ")}`);
  }
}

function assertNonEmptyString(value, context) {
  if (typeof value !== "string" || value.length === 0) {
    fail(context, "must be a non-empty string");
  }
}

function assertContextSafeString(value, context) {
  assertNonEmptyString(value, context);
  if (value.includes("|")) {
    fail(context, "must not contain the factory-context separator |");
  }
}

function assertBoolean(value, context) {
  if (typeof value !== "boolean") {
    fail(context, "must be a boolean");
  }
}

function assertAddress(value, context) {
  if (typeof value !== "string" || !ADDRESS_PATTERN.test(value)) {
    fail(context, "must be a 20-byte hex address");
  }
}

function assertStartBlock(value, context) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(context, "must be a non-negative safe integer");
  }
}

function validateAnchor(anchor, context) {
  assertExactKeys(anchor, ["address", "startBlock"], context);
  assertAddress(anchor.address, `${context}.address`);
  assertStartBlock(anchor.startBlock, `${context}.startBlock`);
}

function validatePricing(pricing, context) {
  assertExactKeys(
    pricing,
    [
      "mode",
      "feedDecimals",
      "feedRegistry",
      "denominations",
      "bridgeFeeds",
      "stablecoins",
      "directFeeds",
      "syntheticPrices",
    ],
    context
  );
  if (!PRICING_MODES.includes(pricing.mode)) {
    fail(`${context}.mode`, `must be one of ${PRICING_MODES.join(", ")}`);
  }
  if (!Array.isArray(pricing.stablecoins)) {
    fail(`${context}.stablecoins`, "must be an array");
  }
  if (!Array.isArray(pricing.directFeeds)) {
    fail(`${context}.directFeeds`, "must be an array");
  }
  if (!Array.isArray(pricing.syntheticPrices)) {
    fail(`${context}.syntheticPrices`, "must be an array");
  }

  const stablecoins = new Set();
  pricing.stablecoins.forEach((address, index) => {
    assertAddress(address, `${context}.stablecoins[${index}]`);
    const normalized = address.toLowerCase();
    if (stablecoins.has(normalized)) {
      fail(`${context}.stablecoins[${index}]`, `duplicates address ${address}`);
    }
    stablecoins.add(normalized);
  });

  const directFeedTokens = new Set();
  pricing.directFeeds.forEach((entry, index) => {
    const entryContext = `${context}.directFeeds[${index}]`;
    assertExactKeys(entry, ["token", "feed"], entryContext);
    assertAddress(entry.token, `${entryContext}.token`);
    assertAddress(entry.feed, `${entryContext}.feed`);
    const normalized = entry.token.toLowerCase();
    if (directFeedTokens.has(normalized)) {
      fail(`${entryContext}.token`, `duplicates token ${entry.token}`);
    }
    if (stablecoins.has(normalized)) {
      fail(`${entryContext}.token`, "cannot also be configured as a stablecoin");
    }
    directFeedTokens.add(normalized);
  });

  const syntheticSymbols = new Set();
  pricing.syntheticPrices.forEach((entry, index) => {
    const entryContext = `${context}.syntheticPrices[${index}]`;
    assertExactKeys(entry, ["symbol", "priceUSD", "usdPeg"], entryContext);
    if (
      typeof entry.symbol !== "string" ||
      !PRICE_SYMBOL_PATTERN.test(entry.symbol)
    ) {
      fail(`${entryContext}.symbol`, "must be a context-safe token symbol");
    }
    if (syntheticSymbols.has(entry.symbol)) {
      fail(`${entryContext}.symbol`, `duplicates symbol ${entry.symbol}`);
    }
    syntheticSymbols.add(entry.symbol);
    if (
      typeof entry.priceUSD !== "string" ||
      !POSITIVE_DECIMAL_PATTERN.test(entry.priceUSD) ||
      Number(entry.priceUSD) <= 0
    ) {
      fail(`${entryContext}.priceUSD`, "must be a positive decimal string");
    }
    assertBoolean(entry.usdPeg, `${entryContext}.usdPeg`);
  });

  if (pricing.mode === "CHAINLINK") {
    if (!Number.isInteger(pricing.feedDecimals) || pricing.feedDecimals <= 0) {
      fail(`${context}.feedDecimals`, "must be a positive integer for CHAINLINK");
    }
    assertAddress(pricing.feedRegistry, `${context}.feedRegistry`);
    assertExactKeys(
      pricing.denominations,
      ["usd", "eth", "btc"],
      `${context}.denominations`
    );
    assertAddress(pricing.denominations.usd, `${context}.denominations.usd`);
    assertAddress(pricing.denominations.eth, `${context}.denominations.eth`);
    assertAddress(pricing.denominations.btc, `${context}.denominations.btc`);
    assertExactKeys(
      pricing.bridgeFeeds,
      ["ethUsd", "btcUsd"],
      `${context}.bridgeFeeds`
    );
    assertAddress(pricing.bridgeFeeds.ethUsd, `${context}.bridgeFeeds.ethUsd`);
    assertAddress(pricing.bridgeFeeds.btcUsd, `${context}.bridgeFeeds.btcUsd`);
    if (pricing.syntheticPrices.length !== 0) {
      fail(`${context}.syntheticPrices`, "must be empty for CHAINLINK");
    }
    return;
  }

  if (
    pricing.feedDecimals !== null ||
    pricing.feedRegistry !== null ||
    pricing.denominations !== null ||
    pricing.bridgeFeeds !== null
  ) {
    fail(context, `${pricing.mode} must not declare Chainlink configuration`);
  }
  if (pricing.stablecoins.length !== 0 || pricing.directFeeds.length !== 0) {
    fail(context, `${pricing.mode} must not declare address-based Chainlink assets`);
  }
  if (
    pricing.mode === "SYNTHETIC_TESTNET" &&
    pricing.syntheticPrices.length === 0
  ) {
    fail(`${context}.syntheticPrices`, "must not be empty for SYNTHETIC_TESTNET");
  }
  if (pricing.mode === "NONE" && pricing.syntheticPrices.length !== 0) {
    fail(`${context}.syntheticPrices`, "must be empty for NONE");
  }
}

function validateCommonFactory(factory, context, { deploymentTarget }) {
  const keys = [
    "label",
    "manifestName",
    "generation",
    "address",
    "startBlock",
    "indexed",
    "lifecycle",
  ];
  if (deploymentTarget) keys.splice(6, 0, "deploymentTarget");
  assertExactKeys(factory, keys, context);

  if (typeof factory.label !== "string" || !LABEL_PATTERN.test(factory.label)) {
    fail(`${context}.label`, "must use lowercase letters, digits, dots, underscores, or hyphens");
  }
  if (
    typeof factory.manifestName !== "string" ||
    !MANIFEST_NAME_PATTERN.test(factory.manifestName)
  ) {
    fail(`${context}.manifestName`, "must be a valid Graph data-source name");
  }
  assertContextSafeString(factory.generation, `${context}.generation`);
  assertAddress(factory.address, `${context}.address`);
  assertStartBlock(factory.startBlock, `${context}.startBlock`);
  assertBoolean(factory.indexed, `${context}.indexed`);
  if (!LIFECYCLES.includes(factory.lifecycle)) {
    fail(`${context}.lifecycle`, `must be one of ${LIFECYCLES.join(", ")}`);
  }
  if (deploymentTarget) {
    assertBoolean(factory.deploymentTarget, `${context}.deploymentTarget`);
    if (factory.deploymentTarget && !factory.indexed) {
      fail(context, "a deployment target must also be indexed");
    }
    if (factory.deploymentTarget && factory.lifecycle !== "active") {
      fail(context, "a deployment target must have an active lifecycle");
    }
  }
}

function validateHooksFactory(factory, context, abiFamilies) {
  const expectedKeys = [
    "label",
    "manifestName",
    "marketKind",
    "generation",
    "abiFamily",
    "address",
    "startBlock",
    "indexed",
    "deploymentTarget",
    "lifecycle",
  ];
  assertExactKeys(factory, expectedKeys, context);
  validateCommonFactory(
    {
      label: factory.label,
      manifestName: factory.manifestName,
      generation: factory.generation,
      address: factory.address,
      startBlock: factory.startBlock,
      indexed: factory.indexed,
      deploymentTarget: factory.deploymentTarget,
      lifecycle: factory.lifecycle,
    },
    context,
    { deploymentTarget: true }
  );
  if (!MARKET_KINDS.includes(factory.marketKind)) {
    fail(`${context}.marketKind`, `must be one of ${MARKET_KINDS.join(", ")}`);
  }
  assertContextSafeString(factory.abiFamily, `${context}.abiFamily`);
  const abiFamily = abiFamilies[factory.abiFamily];
  if (!abiFamily) {
    fail(`${context}.abiFamily`, `references unknown family ${factory.abiFamily}`);
  }
  if (abiFamily.kind !== "hooksFactory") {
    fail(`${context}.abiFamily`, `${factory.abiFamily} is not a hooksFactory family`);
  }
}

function validateFactoryCollection(factories, context, validator) {
  if (!Array.isArray(factories)) {
    fail(context, "must be an array");
  }
  const labels = new Set();
  const addresses = new Set();
  const manifestNames = new Set();
  factories.forEach((factory, index) => {
    const itemContext = `${context}[${index}]`;
    validator(factory, itemContext);
    if (labels.has(factory.label)) {
      fail(itemContext, `duplicates label ${factory.label}`);
    }
    labels.add(factory.label);
    const address = factory.address.toLowerCase();
    if (addresses.has(address)) {
      fail(itemContext, `duplicates address ${factory.address}`);
    }
    addresses.add(address);
    if (manifestNames.has(factory.manifestName)) {
      fail(itemContext, `duplicates manifestName ${factory.manifestName}`);
    }
    manifestNames.add(factory.manifestName);
  });
}

function validateAbiFamilies(abiFamilies, options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  assertObject(abiFamilies, "abiFamilies");
  if (Object.keys(abiFamilies).length === 0) {
    fail("abiFamilies", "must not be empty");
  }
  for (const [name, family] of Object.entries(abiFamilies)) {
    const context = `abiFamilies.${name}`;
    assertExactKeys(family, ["kind", "hookedMarketAbi", "abis"], context);
    if (family.kind !== "hooksFactory") {
      fail(`${context}.kind`, "must be hooksFactory");
    }
    if (!HOOKED_MARKET_ABIS.includes(family.hookedMarketAbi)) {
      fail(
        `${context}.hookedMarketAbi`,
        `must be one of ${HOOKED_MARKET_ABIS.join(", ")}`
      );
    }
    assertObject(family.abis, `${context}.abis`);
    const missing = REQUIRED_HOOKS_ABIS.filter((abiName) => !(abiName in family.abis));
    const unknown = Object.keys(family.abis).filter(
      (abiName) => !REQUIRED_HOOKS_ABIS.includes(abiName)
    );
    if (missing.length > 0) {
      fail(`${context}.abis`, `is missing ABI(s): ${missing.join(", ")}`);
    }
    if (unknown.length > 0) {
      fail(`${context}.abis`, `contains unknown ABI(s): ${unknown.join(", ")}`);
    }
    for (const [abiName, relativePath] of Object.entries(family.abis)) {
      if (typeof relativePath !== "string" || !relativePath.startsWith("./")) {
        fail(`${context}.abis.${abiName}`, "must be a repository-relative ./ path");
      }
      const resolved = path.resolve(repoRoot, relativePath);
      if (!resolved.startsWith(`${repoRoot}${path.sep}`)) {
        fail(`${context}.abis.${abiName}`, "must remain inside the repository");
      }
      if (!fs.existsSync(resolved)) {
        fail(`${context}.abis.${abiName}`, `does not exist: ${relativePath}`);
      }
      const abi = readJson(resolved);
      if (!Array.isArray(abi)) {
        fail(`${context}.abis.${abiName}`, "must contain a JSON ABI array");
      }
    }
  }
  return abiFamilies;
}

function finalHooksFactoryName(config, factory) {
  const aliases = config.compatibility.canonicalFactoryByMarketKind;
  if (aliases[factory.marketKind] === factory.label) {
    return factory.marketKind === "STANDARD" ? "HooksFactory" : "HooksFactoryRevolving";
  }
  return factory.manifestName;
}

function finalWrapperFactoryName(config, factory) {
  if (config.compatibility.primaryWrapperFactory === factory.label) {
    return "Wildcat4626WrapperFactory";
  }
  return factory.manifestName;
}

function finalCollateralFactoryName(config, factory) {
  if (config.compatibility.primaryCollateralFactory === factory.label) {
    return "WildcatMarketCollateralFactory";
  }
  return factory.manifestName;
}

function validateChainConfig(config, abiFamilies, options = {}) {
  const expectedNetwork = options.expectedNetwork;
  assertExactKeys(config, TOP_LEVEL_KEYS, expectedNetwork || "chainConfig");
  const context = `chainConfig.${config.network || expectedNetwork || "unknown"}`;

  if (config.configVersion !== 1) fail(`${context}.configVersion`, "must be 1");
  if (config.schemaRelease !== "2.5") fail(`${context}.schemaRelease`, "must be 2.5");
  if (typeof config.network !== "string" || !LABEL_PATTERN.test(config.network)) {
    fail(`${context}.network`, "must be a lowercase network identifier");
  }
  if (expectedNetwork && config.network !== expectedNetwork) {
    fail(`${context}.network`, `must match file name ${expectedNetwork}`);
  }
  if (!Number.isSafeInteger(config.chainId) || config.chainId <= 0) {
    fail(`${context}.chainId`, "must be a positive safe integer");
  }
  assertNonEmptyString(config.graphNetwork, `${context}.graphNetwork`);
  assertBoolean(config.deploymentTargetsReady, `${context}.deploymentTargetsReady`);

  assertExactKeys(config.anchors, ["archController", "sanctionsSentinel"], `${context}.anchors`);
  validateAnchor(config.anchors.archController, `${context}.anchors.archController`);
  validateAnchor(config.anchors.sanctionsSentinel, `${context}.anchors.sanctionsSentinel`);

  validateFactoryCollection(config.factories, `${context}.factories`, (factory, itemContext) =>
    validateHooksFactory(factory, itemContext, abiFamilies)
  );
  validateFactoryCollection(
    config.wrapperFactories,
    `${context}.wrapperFactories`,
    (factory, itemContext) => validateCommonFactory(factory, itemContext, { deploymentTarget: true })
  );
  validateFactoryCollection(
    config.collateralFactories,
    `${context}.collateralFactories`,
    (factory, itemContext) => validateCommonFactory(factory, itemContext, { deploymentTarget: false })
  );

  assertExactKeys(config.features, ["analytics", "collateral", "wrappers"], `${context}.features`);
  Object.entries(config.features).forEach(([name, enabled]) =>
    assertBoolean(enabled, `${context}.features.${name}`)
  );
  if (config.features.wrappers !== config.wrapperFactories.some((factory) => factory.indexed)) {
    fail(`${context}.features.wrappers`, "must match the presence of indexed wrapper factories");
  }
  if (config.features.collateral !== config.collateralFactories.some((factory) => factory.indexed)) {
    fail(`${context}.features.collateral`, "must match the presence of indexed collateral factories");
  }

  validatePricing(config.pricing, `${context}.pricing`);

  assertExactKeys(
    config.compatibility,
    [
      "canonicalFactoryByMarketKind",
      "primaryWrapperFactory",
      "primaryCollateralFactory",
    ],
    `${context}.compatibility`
  );
  assertObject(
    config.compatibility.canonicalFactoryByMarketKind,
    `${context}.compatibility.canonicalFactoryByMarketKind`
  );
  for (const [marketKind, label] of Object.entries(
    config.compatibility.canonicalFactoryByMarketKind
  )) {
    if (!MARKET_KINDS.includes(marketKind)) {
      fail(`${context}.compatibility.canonicalFactoryByMarketKind`, `unknown kind ${marketKind}`);
    }
    const factory = config.factories.find((candidate) => candidate.label === label);
    if (!factory) {
      fail(`${context}.compatibility.canonicalFactoryByMarketKind.${marketKind}`, `unknown label ${label}`);
    }
    if (factory.marketKind !== marketKind) {
      fail(`${context}.compatibility.canonicalFactoryByMarketKind.${marketKind}`, "market kind mismatch");
    }
    if (!factory.indexed) {
      fail(`${context}.compatibility.canonicalFactoryByMarketKind.${marketKind}`, "must select an indexed factory");
    }
  }
  for (const marketKind of MARKET_KINDS) {
    const hasIndexedFactory = config.factories.some(
      (factory) => factory.indexed && factory.marketKind === marketKind
    );
    if (
      hasIndexedFactory &&
      !(marketKind in config.compatibility.canonicalFactoryByMarketKind)
    ) {
      fail(
        `${context}.compatibility.canonicalFactoryByMarketKind`,
        `must select one indexed ${marketKind} factory`
      );
    }
  }
  if (
    !config.factories.some(
      (factory) => factory.indexed && factory.marketKind === "STANDARD"
    )
  ) {
    fail(`${context}.factories`, "must include an indexed STANDARD factory");
  }

  const primaryWrapper = config.compatibility.primaryWrapperFactory;
  if (primaryWrapper !== null) {
    assertNonEmptyString(primaryWrapper, `${context}.compatibility.primaryWrapperFactory`);
    const factory = config.wrapperFactories.find((candidate) => candidate.label === primaryWrapper);
    if (!factory || !factory.indexed) {
      fail(`${context}.compatibility.primaryWrapperFactory`, "must select an indexed wrapper factory");
    }
  } else if (config.features.wrappers) {
    fail(`${context}.compatibility.primaryWrapperFactory`, "is required when wrappers are enabled");
  }

  const primaryCollateral = config.compatibility.primaryCollateralFactory;
  if (primaryCollateral !== null) {
    assertNonEmptyString(
      primaryCollateral,
      `${context}.compatibility.primaryCollateralFactory`
    );
    const factory = config.collateralFactories.find(
      (candidate) => candidate.label === primaryCollateral
    );
    if (!factory || !factory.indexed) {
      fail(
        `${context}.compatibility.primaryCollateralFactory`,
        "must select an indexed collateral factory"
      );
    }
  } else if (config.features.collateral) {
    fail(
      `${context}.compatibility.primaryCollateralFactory`,
      "is required when collateral is enabled"
    );
  }

  const targets = config.factories.filter((factory) => factory.deploymentTarget);
  for (const marketKind of MARKET_KINDS) {
    const kindTargets = targets.filter((factory) => factory.marketKind === marketKind);
    if (kindTargets.length > 1) {
      fail(context, `contains multiple ${marketKind} deployment targets`);
    }
    if (config.deploymentTargetsReady && kindTargets.length !== 1) {
      fail(context, `must contain exactly one ${marketKind} deployment target when ready`);
    }
  }
  const wrapperTargets = config.wrapperFactories.filter(
    (factory) => factory.deploymentTarget
  );
  if (wrapperTargets.length > 1) {
    fail(context, "contains multiple wrapper deployment targets");
  }
  if (
    config.deploymentTargetsReady &&
    config.features.wrappers &&
    wrapperTargets.length !== 1
  ) {
    fail(context, "must contain exactly one wrapper deployment target when ready");
  }
  if (!config.features.wrappers && wrapperTargets.length > 0) {
    fail(context, "cannot declare a wrapper deployment target when wrappers are disabled");
  }
  if (
    !config.deploymentTargetsReady &&
    targets.length + wrapperTargets.length > 0
  ) {
    fail(context, "cannot declare deployment targets before deploymentTargetsReady is true");
  }

  const allAddresses = new Map();
  const addressEntries = [
    ["anchors.archController", config.anchors.archController.address],
    ["anchors.sanctionsSentinel", config.anchors.sanctionsSentinel.address],
    ...config.factories.map((factory) => [`factories.${factory.label}`, factory.address]),
    ...config.wrapperFactories.map((factory) => [
      `wrapperFactories.${factory.label}`,
      factory.address,
    ]),
    ...config.collateralFactories.map((factory) => [
      `collateralFactories.${factory.label}`,
      factory.address,
    ]),
  ];
  for (const [name, address] of addressEntries) {
    const key = address.toLowerCase();
    if (allAddresses.has(key)) {
      fail(context, `${name} duplicates address used by ${allAddresses.get(key)}`);
    }
    allAddresses.set(key, name);
  }

  const sourceNames = new Set(["WildcatArchController", "WildcatSanctionsSentinel"]);
  const indexedSources = [
    ...config.factories
      .filter((factory) => factory.indexed)
      .map((factory) => finalHooksFactoryName(config, factory)),
    ...config.wrapperFactories
      .filter((factory) => factory.indexed)
      .map((factory) => finalWrapperFactoryName(config, factory)),
    ...config.collateralFactories
      .filter((factory) => factory.indexed)
      .map((factory) => finalCollateralFactoryName(config, factory)),
  ];
  for (const name of indexedSources) {
    if (sourceNames.has(name)) {
      fail(context, `generated manifest data-source name is duplicated: ${name}`);
    }
    sourceNames.add(name);
  }

  assertObject(config.provenance, `${context}.provenance`);
  assertNonEmptyString(config.provenance.kind, `${context}.provenance.kind`);
  assertNonEmptyString(config.provenance.source, `${context}.provenance.source`);
  if (typeof config.provenance.sha256 !== "string" || !HASH_PATTERN.test(config.provenance.sha256)) {
    fail(`${context}.provenance.sha256`, "must be a lowercase SHA-256 digest");
  }

  return config;
}

function loadAbiFamilies() {
  return validateAbiFamilies(readJson(ABI_FAMILIES_PATH));
}

function listNetworks() {
  return fs
    .readdirSync(CHAINS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.slice(0, -5))
    .sort();
}

function loadChainConfig(network, options = {}) {
  if (typeof network !== "string" || !LABEL_PATTERN.test(network)) {
    fail("network", "must be a lowercase network identifier");
  }
  const filePath = path.join(CHAINS_DIR, `${network}.json`);
  if (!fs.existsSync(filePath)) {
    fail("network", `no chain descriptor exists for ${network}`);
  }
  const abiFamilies = options.abiFamilies || loadAbiFamilies();
  return validateChainConfig(readJson(filePath), abiFamilies, {
    expectedNetwork: network,
  });
}

function loadAllChainConfigs() {
  const abiFamilies = loadAbiFamilies();
  const configs = listNetworks().map((network) =>
    loadChainConfig(network, { abiFamilies })
  );
  const chainIds = new Set();
  const graphNetworks = new Set();
  for (const config of configs) {
    if (chainIds.has(config.chainId)) {
      fail("chainConfigs", `duplicate chainId ${config.chainId}`);
    }
    chainIds.add(config.chainId);
    if (graphNetworks.has(config.graphNetwork)) {
      fail("chainConfigs", `duplicate graphNetwork ${config.graphNetwork}`);
    }
    graphNetworks.add(config.graphNetwork);
  }
  return { abiFamilies, configs };
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function configDigest(config) {
  return crypto.createHash("sha256").update(canonicalJson(config)).digest("hex");
}

module.exports = {
  ABI_FAMILIES_PATH,
  CHAINS_DIR,
  MARKET_KINDS,
  REPO_ROOT,
  canonicalJson,
  configDigest,
  finalCollateralFactoryName,
  finalHooksFactoryName,
  finalWrapperFactoryName,
  listNetworks,
  loadAbiFamilies,
  loadAllChainConfigs,
  loadChainConfig,
  validateAbiFamilies,
  validateChainConfig,
};
