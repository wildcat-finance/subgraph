const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const YAML = require("yaml");

const {
  MANIFEST_BASE_PATH,
  UNCRASHABLE_BASE_PATH,
  buildLegacyNetworks,
  buildManifest,
  buildV25CompileFixture,
  buildUncrashableConfig,
  hooksTemplateContextKey,
  renderOutputs
} = require("./generate-manifest");
const {
  loadAbiFamilies,
  loadAllChainConfigs,
  loadChainConfig
} = require("./chain-config");

function readYaml(filePath) {
  return YAML.parse(fs.readFileSync(filePath, "utf8"));
}

function sourceByName(manifest, name) {
  return manifest.dataSources.find(source => source.name === name);
}

function sourceByAddress(manifest, address) {
  return manifest.dataSources.find(
    source => source.source.address.toLowerCase() === address.toLowerCase()
  );
}

function abiPath(mapping, name) {
  return mapping.abis.find(abi => abi.name === name)?.file;
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
        source => source.network === config.graphNetwork
      )
    );
    assert.ok(
      first.manifest.templates.every(
        template => template.network === config.graphNetwork
      )
    );
  }
});

test("renders Sepolia historical factories, canonical aliases, mappings, and ABI family", () => {
  const { manifest } = renderOutputs("sepolia");
  assert.deepEqual(
    manifest.dataSources.map(source => source.name),
    [
      "WildcatMarketCollateralFactory",
      "Wildcat4626WrapperFactoryV1",
      "Wildcat4626WrapperFactoryV2_5Preview20260727",
      "Wildcat4626WrapperFactoryV2_5",
      "Wildcat4626WrapperFactory",
      "HooksFactoryStandardV2_5_3",
      "HooksFactory",
      "HooksFactoryStandardV2_1",
      "HooksFactoryRevolvingPreview20260424",
      "HooksFactoryStandardV2_5Preview20260727",
      "HooksFactoryRevolvingV2_5Preview20260727",
      "HooksFactoryStandardV2_5",
      "HooksFactoryRevolvingV2_5",
      "HooksFactoryRevolving",
      "WildcatBorrowerIdentityRegistryV2_5",
      "AccessListRoleProviderFactoryV2_5",
      "WildcatArchController",
      "WildcatSanctionsSentinel"
    ]
  );
  const legacyTypeAnchor = sourceByName(manifest, "HooksFactory");
  const standardFactory = sourceByName(
    manifest,
    "HooksFactoryStandardV2_5_3"
  );
  const revolvingFactory = sourceByName(manifest, "HooksFactoryRevolving");
  assert.equal(
    legacyTypeAnchor.mapping.file,
    "./src/hooks-factory.ts"
  );
  assert.equal(
    sourceByName(manifest, "HooksFactoryRevolvingPreview20260424").mapping
      .file,
    "./src/hooks-factory-revolving.ts"
  );
  assert.equal(standardFactory.mapping.file, "./src/hooks-factory-v2-5.ts");
  assert.equal(revolvingFactory.mapping.file, "./src/hooks-factory-v2-5.ts");
  assert.equal(
    abiPath(legacyTypeAnchor.mapping, "PeriodicTermHooks"),
    "./abis/hooked-market/PeriodicTermHooks.json"
  );
  assert.equal(
    abiPath(legacyTypeAnchor.mapping, "FixedTermHooksBase"),
    "./abis/hooked-market/base/FixedTermHooks.json"
  );
  assert.equal(
    abiPath(legacyTypeAnchor.mapping, "FixedTermHooksForceBuyBack"),
    "./abis/hooked-market/force-buyback/FixedTermHooks.json"
  );
  assert.equal(
    abiPath(standardFactory.mapping, "HooksFactory"),
    "./abis/v2.5/HooksFactory.json"
  );
  assert.equal(
    contextData(standardFactory, standardFactory.source.address),
    "STANDARD|v2.5.3|hooks-v2-5|V2_5|BASE|11581361|true|true|ACTIVE|standard-v2.5.3|0xC003f20F2642c76B81e5e1620c6D8cdEE826408f"
  );
  assert.deepEqual(
    Object.keys(standardFactory.context).filter(key =>
      key.startsWith("hooksFactory_")
    ),
    [hooksFactoryContextKey(standardFactory.source.address)]
  );
  assert.equal(
    standardFactory.context[
      hooksTemplateContextKey("0xae00f2c2fd926007beF2EeC2B2204A4c3528b401")
    ].data,
    "OpenTermHooks|OpenTerm"
  );
  assert.equal(
    Object.keys(standardFactory.context).filter(key =>
      key.startsWith("hooksTemplate_")
    ).length,
    16
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
    Object.keys(
      sourceByName(manifest, "WildcatArchController").context
    ).filter(key => key.startsWith("hooksFactory_")).length,
    13
  );
  assert.equal(
    sourceByName(manifest, "HooksFactoryRevolving_20260419_233246"),
    undefined
  );
  const wrapperFactory = sourceByName(manifest, "Wildcat4626WrapperFactory");
  assert.equal(
    wrapperFactory.source.address,
    "0x31D8D5564Ce11f764E74beca5B4e8d363046949f"
  );
  assert.equal(wrapperFactory.source.startBlock, 11581359);
  assert.equal(
    wrapperFactory.context.moduleFactoryLabel.data,
    "wrapper-v2.5.3"
  );
  assert.equal(
    wrapperFactory.context.moduleFactoryGeneration.data,
    "v2.5.3"
  );
  assert.equal(wrapperFactory.context.moduleFactoryIndexed.data, "true");
  assert.equal(
    wrapperFactory.context.moduleFactoryDeploymentTarget.data,
    "true"
  );
  assert.equal(wrapperFactory.context.moduleFactoryLifecycle.data, "ACTIVE");
  const legacyWrapperFactory = sourceByName(
    manifest,
    "Wildcat4626WrapperFactoryV1"
  );
  assert.equal(
    legacyWrapperFactory.source.address,
    "0x0566Fe57682164af689f1440cb3BCEedEe3bf843"
  );
  assert.equal(
    legacyWrapperFactory.context.moduleFactoryDeploymentTarget.data,
    "false"
  );
  const previewWrapperFactory = sourceByName(
    manifest,
    "Wildcat4626WrapperFactoryV2_5Preview20260727"
  );
  assert.equal(
    previewWrapperFactory.source.address,
    "0x8a77449eaBB1522983cd700f002b5b191463378e"
  );
  assert.equal(
    previewWrapperFactory.context.moduleFactoryDeploymentTarget.data,
    "false"
  );
  const previousWrapperFactory = sourceByName(
    manifest,
    "Wildcat4626WrapperFactoryV2_5"
  );
  assert.equal(
    previousWrapperFactory.source.address,
    "0x6B1DD93453584346C530A1646e98aB306fD6D37C"
  );
  assert.equal(
    previousWrapperFactory.context.moduleFactoryDeploymentTarget.data,
    "false"
  );
  const borrowerIdentityRegistry = sourceByName(
    manifest,
    "WildcatBorrowerIdentityRegistryV2_5"
  );
  assert.equal(
    borrowerIdentityRegistry.source.address,
    "0xc2cF90781595203D1e75c28246b306C95d4b8b21"
  );
  assert.equal(borrowerIdentityRegistry.source.startBlock, 11559126);
  const accessListFactory = sourceByName(
    manifest,
    "AccessListRoleProviderFactoryV2_5"
  );
  assert.equal(
    accessListFactory.source.address,
    "0x92995EA2ba572E4Cb8bB41E30f813BeB77FD4974"
  );
  assert.equal(accessListFactory.source.startBlock, 11559128);
  const wrapperTemplate = manifest.templates.find(
    template => template.name === "Wildcat4626Wrapper"
  );
  assert.equal(wrapperTemplate.mapping.file, "./src/wildcat-4626-wrapper.ts");
  assert.deepEqual(
    wrapperTemplate.mapping.eventHandlers.map(handler => handler.handler),
    ["handleDeposit", "handleTokensSwept", "handleTransfer", "handleWithdraw"]
  );
  assertDeclaresEntities(wrapperTemplate.mapping, [
    "Wildcat4626WrapperAccount",
    "Wildcat4626WrapperTransactionCursor",
    "Transfer"
  ]);

  const collateralFactory = sourceByName(
    manifest,
    "WildcatMarketCollateralFactory"
  );
  assert.equal(
    collateralFactory.context.moduleFactoryLabel.data,
    "collateral-v1"
  );
  assert.equal(collateralFactory.context.moduleFactoryGeneration.data, "v1");

  assertDeclaresEntities(standardFactory.mapping, [
    "Borrower",
    "MarketEvent",
    "MarketEventCursor",
    "MarketSnapshot"
  ]);
  assertDeclaresEntities(
    sourceByName(manifest, "WildcatArchController").mapping,
    ["Borrower", "IndexerDeployment", "MarketEvent", "MarketEventCursor"]
  );
  assertDeclaresEntities(
    manifest.templates.find(template => template.name === "WildcatMarket")
      .mapping,
    [
      "LenderAccountSnapshot",
      "MarketEvent",
      "MarketEventCursor",
      "MarketSnapshot",
      "TokenDailyPrice"
    ]
  );
  assertDeclaresEntities(
    manifest.templates.find(template => template.name === "CombinedHooks")
      .mapping,
    ["HooksNameUpdated", "MarketEvent", "MarketEventCursor", "MarketSnapshot"]
  );
});

test("feature flags remove unsupported Plasma sources without changing the core schema surface", () => {
  const mainnet = renderOutputs("mainnet").manifest;
  const plasma = renderOutputs("plasma-mainnet").manifest;

  assert.deepEqual(
    plasma.dataSources.map(source => source.name),
    ["HooksFactory", "WildcatArchController", "WildcatSanctionsSentinel"]
  );
  assert.deepEqual(
    plasma.templates.map(template => template.name),
    mainnet.templates
      .map(template => template.name)
      .filter(
        name =>
          name !== "SimpleMarketCollateralMultiParty" &&
          name !== "Wildcat4626Wrapper"
      )
  );
  assert.deepEqual(plasma.schema, mainnet.schema);
});

test("legacy networks projection retains all inventory entries but aliases only canonical factories", () => {
  const { configs } = loadAllChainConfigs();
  const networks = buildLegacyNetworks(configs);
  const sepolia = networks.sepolia;

  assert.equal(sepolia.hooksFactories.length, 13);
  assert.equal(
    sepolia.hooksFactories.filter(factory => factory.indexed).length,
    9
  );
  assert.equal(
    sepolia.contracts.HooksFactory.address,
    "0x89797b782cA5b4BBFC975146B98ba3941Fe26C56"
  );
  assert.equal(
    sepolia.contracts.HooksFactoryRevolving.address,
    "0xb3FBD4FBeb1EE4BEE7afdbC4A75C7c4E97CF105C"
  );
  assert.equal(
    sepolia.contracts.Wildcat4626WrapperFactory.address,
    "0x31D8D5564Ce11f764E74beca5B4e8d363046949f"
  );
  assert.equal(
    sepolia.hooksFactories.find(
      factory => factory.address === sepolia.contracts.HooksFactory.address
    ).name,
    "HooksFactory"
  );
  assert.equal(
    sepolia.hooksFactories.find(
      factory =>
        factory.address === sepolia.contracts.HooksFactoryRevolving.address
    ).name,
    "HooksFactoryRevolving"
  );
});

test("deployment-target changes do not alter current compatibility aliases", () => {
  const abiFamilies = loadAbiFamilies();
  const base = readYaml(MANIFEST_BASE_PATH);
  const config = loadChainConfig("sepolia", { abiFamilies });
  const modified = JSON.parse(JSON.stringify(config));
  modified.factories.find(
    factory => factory.label === "standard-v2.5.3"
  ).deploymentTarget = false;
  modified.factories.find(
    factory => factory.label === "standard-v2"
  ).deploymentTarget = true;

  const manifest = buildManifest(modified, abiFamilies, base);
  assert.equal(
    sourceByName(manifest, "HooksFactoryStandardV2_5_3").source.address,
    config.factories.find(factory => factory.label === "standard-v2.5.3")
      .address
  );
  const standardTarget = modified.factories.find(
    factory => factory.label === "standard-v2"
  );
  assert.match(
    contextData(
      sourceByAddress(manifest, standardTarget.address),
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
  const source = sourceByAddress(manifest, modified.factories[0].address);
  assert.match(
    contextData(source, modified.factories[0].address),
    /\|hooks-sepolia-current\|LEGACY\|BASE\|/
  );
});

test("selects the hard-cut mappings from the deployment ABI family", () => {
  const abiFamilies = loadAbiFamilies();
  const base = readYaml(MANIFEST_BASE_PATH);
  const config = loadChainConfig("sepolia", { abiFamilies });
  const modified = JSON.parse(JSON.stringify(config));
  const standard = modified.factories.find(
    factory => factory.label === "standard-v2.5.3"
  );
  const revolving = modified.factories.find(
    factory => factory.label === "revolving-v2.5.3"
  );
  standard.abiFamily = "hooks-v2-5";
  revolving.abiFamily = "hooks-v2-5";

  const manifest = buildManifest(modified, abiFamilies, base);
  const legacyTypeAnchor = sourceByName(manifest, "HooksFactory");
  const standardSource = sourceByName(manifest, "HooksFactoryStandardV2_5_3");
  const revolvingSource = sourceByName(manifest, "HooksFactoryRevolving");
  assert.equal(legacyTypeAnchor.mapping.file, "./src/hooks-factory.ts");
  assert.equal(
    abiPath(legacyTypeAnchor.mapping, "HooksFactory"),
    "./abis/HooksFactory.json"
  );
  assert.equal(standardSource.mapping.file, "./src/hooks-factory-v2-5.ts");
  assert.equal(revolvingSource.mapping.file, "./src/hooks-factory-v2-5.ts");
  assert.equal(
    abiPath(standardSource.mapping, "HooksFactory"),
    "./abis/v2.5/HooksFactory.json"
  );
  assert.match(
    contextData(standardSource, standard.address),
    /\|hooks-v2-5\|V2_5\|BASE\|/
  );
  assert.ok(
    !standardSource.mapping.eventHandlers.some(({ event }) =>
      event.startsWith("RevolvingMarketDeployed")
    )
  );
  assert.ok(
    revolvingSource.mapping.eventHandlers.some(
      ({ event }) =>
        event === "RevolvingMarketDeployed(indexed address,uint256)"
    )
  );
  assertDeclaresEntities(standardSource.mapping, [
    "BorrowerIdentityRegistry",
    "BorrowerAccount",
    "HooksInstanceRoleProviderSnapshot",
    "MarketDeploymentConfig",
    "MarketHooksData",
    "PendingMarketDeployment",
    "RevolvingMarketDeployment"
  ]);
  assertDeclaresEntities(
    manifest.templates.find(template => template.name === "WildcatMarketV2_5")
      .mapping,
    ["MarketBorrowerChange", "MarketWrapperRegistration", "DrawnAmountUpdate"]
  );
  assertDeclaresEntities(
    manifest.templates.find(template => template.name === "CombinedHooksV2_5")
      .mapping,
    ["HookAdministratorChange", "RoleProviderInstance"]
  );
  assertDeclaresEntities(
    manifest.templates.find(
      template => template.name === "AccessListRoleProvider"
    ).mapping,
    ["RoleProviderAdministratorChange"]
  );
});

test("compiles every known v2.5 role-provider factory and mutable provider", () => {
  const manifest = buildV25CompileFixture();
  const expectedFactories = [
    [
      "AccessListRoleProviderFactoryV2_5Fixture",
      "./src/access-list-role-provider-factory.ts"
    ],
    [
      "MerkleRoleProviderFactoryV2_5Fixture",
      "./src/role-provider-factories.ts"
    ],
    ["ERC20RoleProviderFactoryV2_5Fixture", "./src/role-provider-factories.ts"],
    [
      "ERC4626AssetsRoleProviderFactoryV2_5Fixture",
      "./src/role-provider-factories.ts"
    ],
    [
      "ERC721RoleProviderFactoryV2_5Fixture",
      "./src/role-provider-factories.ts"
    ],
    [
      "ERC1155RoleProviderFactoryV2_5Fixture",
      "./src/role-provider-factories.ts"
    ]
  ];
  for (const [name, mappingFile] of expectedFactories) {
    const source = sourceByName(manifest, name);
    assert.ok(source, `${name} is missing`);
    assert.equal(source.mapping.file, mappingFile);
    assertDeclaresEntities(source.mapping, [
      "RoleProviderFactory",
      "RoleProviderInstance"
    ]);
  }

  const merkleTemplate = manifest.templates.find(
    template => template.name === "MerkleRoleProvider"
  );
  assert.ok(merkleTemplate);
  assertDeclaresEntities(merkleTemplate.mapping, [
    "RoleProviderAdministratorChange",
    "RoleProviderRootChange"
  ]);
});

test("keeps a HooksFactory type anchor on a v2.5-only chain", () => {
  const abiFamilies = loadAbiFamilies();
  const base = readYaml(MANIFEST_BASE_PATH);
  const config = loadChainConfig("sepolia", { abiFamilies });
  const modified = JSON.parse(JSON.stringify(config));
  for (const factory of modified.factories) {
    factory.indexed =
      factory.label === "standard-v2.5.3" ||
      factory.label === "revolving-v2.5.3";
  }
  const standard = modified.factories.find(
    factory => factory.label === "standard-v2.5.3"
  );
  const revolving = modified.factories.find(
    factory => factory.label === "revolving-v2.5.3"
  );
  standard.abiFamily = "hooks-v2-5";
  revolving.abiFamily = "hooks-v2-5";

  const manifest = buildManifest(modified, abiFamilies, base);
  const standardSource = sourceByName(manifest, "HooksFactory");
  assert.equal(standardSource.mapping.file, "./src/hooks-factory-v2-5.ts");
  assert.equal(
    abiPath(standardSource.mapping, "HooksFactory"),
    "./abis/v2.5/HooksFactory.json"
  );
  assert.equal(
    abiPath(
      manifest.templates.find(template => template.name === "WildcatMarket")
        .mapping,
      "WildcatMarket"
    ),
    "./abis/WildcatMarket.json"
  );
});

test("renders the uncrashable network selection structurally", () => {
  const config = loadChainConfig("plasma-testnet");
  const generated = buildUncrashableConfig(
    config,
    readYaml(UNCRASHABLE_BASE_PATH)
  );
  assert.deepEqual(generated.networkConfig.entityIdPrefixes[0].networks, [
    "plasma-testnet"
  ]);
});
