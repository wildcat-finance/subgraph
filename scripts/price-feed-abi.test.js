const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const abiPath = path.join(__dirname, "..", "abis", "ChainlinkAggregator.json");

test("Chainlink aggregator ABI exposes validated round metadata", () => {
  const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  const functions = new Map(
    abi
      .filter((entry) => entry.type === "function")
      .map((entry) => [entry.name, entry])
  );

  assert.deepEqual([...functions.keys()].sort(), ["decimals", "latestRoundData"]);
  assert.deepEqual(
    functions.get("decimals").outputs.map(({ type }) => type),
    ["uint8"]
  );
  assert.deepEqual(
    functions.get("latestRoundData").outputs.map(({ type }) => type),
    ["uint80", "int256", "uint256", "uint256", "uint80"]
  );
  assert.equal(functions.has("latestAnswer"), false);
});
