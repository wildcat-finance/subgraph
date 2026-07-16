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

const outputComponentNames = (abi, functionName) => {
  const fn = abi.find(
    (entry) => entry.type === "function" && entry.name === functionName
  );
  assert.ok(fn, `${functionName} is missing`);
  assert.equal(fn.outputs.length, 1);
  return fn.outputs[0].components.map(({ name }) => name);
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
}
