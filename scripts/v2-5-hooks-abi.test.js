const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const loadSepoliaAbi = (contractName) =>
  JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "..",
        "network-specific-abis",
        "sepolia",
        `${contractName}.json`
      ),
      "utf8"
    )
  );

const loadAbi = (contractName) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "abis", `${contractName}.json`),
      "utf8"
    )
  );

const loadV25Abi = (contractName) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "abis", "v2.5", `${contractName}.json`),
      "utf8"
    )
  );

const eventSignature = (entry) =>
  `${entry.name}(${entry.inputs
    .map(({ indexed, type }) => `${indexed ? "indexed " : ""}${type}`)
    .join(",")})`;

const eventSignatures = (contractName) =>
  loadV25Abi(contractName)
    .filter(({ type }) => type === "event")
    .map(eventSignature)
    .sort();

const loadHookedMarketAbi = (variant, contractName) =>
  JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "..",
        "abis",
        "hooked-market",
        ...variant,
        `${contractName}.json`
      ),
      "utf8"
    )
  );

const outputComponentNames = (abi, functionName) => {
  const fn = abi.find(
    (entry) => entry.type === "function" && entry.name === functionName
  );
  assert.ok(fn, `${functionName} is missing`);
  assert.equal(fn.outputs.length, 1);
  return fn.outputs[0].components.map(({ name }) => name);
};

const getFunction = (abi, functionName) => {
  const fn = abi.find(
    (entry) => entry.type === "function" && entry.name === functionName
  );
  assert.ok(fn, `${functionName} is missing`);
  return fn;
};

const expectedComponents = {
  OpenTermHooks: [
    "isHooked",
    "transferRequiresAccess",
    "depositRequiresAccess",
    "minimumDeposit",
    "transfersDisabled",
  ],
  FixedTermHooks: [
    "isHooked",
    "transferRequiresAccess",
    "depositRequiresAccess",
    "withdrawalRequiresAccess",
    "minimumDeposit",
    "fixedTermEndTime",
    "transfersDisabled",
    "allowClosureBeforeTerm",
    "allowTermReduction",
  ],
};

for (const [contractName, components] of Object.entries(expectedComponents)) {
  test(`${contractName} uses the v2.5 hooked-market tuple`, () => {
    const abi = loadSepoliaAbi(contractName);
    assert.deepEqual(outputComponentNames(abi, "getHookedMarket"), components);
    assert.deepEqual(outputComponentNames(abi, "getHookedMarkets"), components);
  });

  test(`${contractName} base adapter matches the frozen v2.5 tuple`, () => {
    const abi = loadHookedMarketAbi(["base"], contractName);
    assert.deepEqual(outputComponentNames(abi, "getHookedMarket"), components);
  });

  test(`${contractName} force-buyback adapter retains its extra field`, () => {
    const abi = loadHookedMarketAbi(["force-buyback"], contractName);
    assert.deepEqual(outputComponentNames(abi, "getHookedMarket"), [
      ...components,
      "allowForceBuyBacks",
    ]);
  });
}

test("HooksFactory market parameters match the frozen v2.5 tuple", () => {
  assert.deepEqual(outputComponentNames(loadAbi("HooksFactory"), "getMarketParameters"), [
    "asset",
    "decimals",
    "packedNameWord0",
    "packedNameWord1",
    "packedSymbolWord0",
    "packedSymbolWord1",
    "borrower",
    "feeRecipient",
    "sentinel",
    "wrapperFactory",
    "maxTotalSupply",
    "protocolFeeBips",
    "annualInterestBips",
    "delinquencyFeeBips",
    "withdrawalBatchDuration",
    "reserveRatioBips",
    "delinquencyGracePeriod",
    "archController",
    "sphereXEngine",
    "hooks",
  ]);
});

test("WildcatMarket withdrawal and version declarations match v2.5", () => {
  const abi = loadAbi("WildcatMarket");
  const queueWithdrawal = getFunction(abi, "queueWithdrawal");
  const version = getFunction(abi, "version");

  assert.deepEqual(queueWithdrawal.outputs, [
    { internalType: "uint32", name: "expiry", type: "uint32" },
  ]);
  assert.equal(version.stateMutability, "pure");
});

test("v2.5 factory events retain the indexed data-model boundary", () => {
  assert.deepEqual(eventSignatures("HooksFactory"), [
    "ChangedSpherexEngineAddress(address,address)",
    "ChangedSpherexOperator(address,address)",
    "HooksInstanceAdministratorTransferred(indexed address,indexed address,indexed address)",
    "HooksInstanceDeployed(indexed address,indexed address,indexed address,address,string,string)",
    "HooksInstanceRoleProviders(indexed address,bool,uint256[],uint256[])",
    "HooksTemplateAdded(indexed address,indexed address,string,address,address,uint80,uint16)",
    "HooksTemplateDisabled(indexed address,indexed address)",
    "HooksTemplateFeesUpdated(indexed address,indexed address,address,address,address,address,uint80,uint80,uint16,uint16)",
    "MarketDeployed(indexed address,indexed address,indexed address,address,address,address,string,string,address,uint256,uint256)",
    "MarketDeploymentConfig(indexed address,uint256,uint256,uint256,uint256,uint256,uint256,address,uint256,address,uint256)",
    "MarketHooksData(indexed address,bytes)",
    "RevolvingMarketDeployed(indexed address,uint256)",
  ].sort());
});

test("v2.5 market events retain borrower and drawn-principal history", () => {
  const signatures = eventSignatures("WildcatMarket");
  for (const signature of [
    "Borrow(indexed address,uint256)",
    "BorrowerTransferCancelled(indexed address,indexed address,address,address)",
    "BorrowerTransferRequested(indexed address,indexed address,indexed address,address,address,address)",
    "BorrowerTransferred(indexed address,indexed address,address,indexed address)",
    "DrawnAmountUpdated(uint256,uint256)",
    "WrapperRegistered(indexed address)",
  ]) {
    assert.ok(signatures.includes(signature), `${signature} is missing`);
  }
});

test("v2.5 identity and provider ABIs retain their transfer histories", () => {
  assert.deepEqual(eventSignatures("WildcatBorrowerIdentityRegistry"), [
    "AccountFactoryAdded(indexed address,indexed address)",
    "AccountFactoryRemoved(indexed address,indexed address)",
    "BorrowerAccountPrincipalTransferCancelled(indexed address,indexed address,indexed address)",
    "BorrowerAccountPrincipalTransferRequested(indexed address,indexed address,address,indexed address)",
    "BorrowerAccountPrincipalTransferred(indexed address,indexed address,indexed address)",
    "BorrowerAccountRegistered(indexed address,indexed address,indexed address)",
  ].sort());
  assert.deepEqual(eventSignatures("AccessListRoleProvider"), [
    "AdministratorTransferCancelled(indexed address,indexed address)",
    "AdministratorTransferRequested(indexed address,indexed address,indexed address)",
    "AdministratorTransferred(indexed address,indexed address)",
    "MemberAdded(indexed address,indexed address)",
    "MemberRemoved(indexed address,indexed address)",
  ].sort());
});
