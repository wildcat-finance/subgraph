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
  test(`${contractName} uses the V2.5 hooked-market tuple`, () => {
    const abi = loadSepoliaAbi(contractName);
    assert.deepEqual(outputComponentNames(abi, "getHookedMarket"), components);
    assert.deepEqual(outputComponentNames(abi, "getHookedMarkets"), components);
  });

  test(`${contractName} base adapter matches the frozen V2.5 tuple`, () => {
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

test("HooksFactory market parameters match the frozen V2.5 tuple", () => {
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

test("WildcatMarket withdrawal and version declarations match V2.5", () => {
  const abi = loadAbi("WildcatMarket");
  const queueWithdrawal = getFunction(abi, "queueWithdrawal");
  const version = getFunction(abi, "version");

  assert.deepEqual(queueWithdrawal.outputs, [
    { internalType: "uint32", name: "expiry", type: "uint32" },
  ]);
  assert.equal(version.stateMutability, "pure");
});
