const assert = require("node:assert/strict");
const test = require("node:test");
const packageJson = require("../package.json");

const networks = [
  "mainnet",
  "sepolia",
  "plasma-mainnet",
  "plasma-testnet",
];

test("binds explicit provider and network deployment shortcuts", () => {
  for (const network of networks) {
    assert.equal(
      packageJson.scripts[`deploy:goldsky:${network}`],
      `yarn deploy goldsky ${network} ${network}`
    );
    assert.equal(
      packageJson.scripts[`deploy:hinterlight:${network}`],
      `yarn deploy hinterlight ${network} ${network}`
    );
  }
});

test("does not retain ambiguous provider-less deployment shortcuts", () => {
  for (const network of networks) {
    assert.equal(packageJson.scripts[`deploy:${network}`], undefined);
    assert.equal(packageJson.scripts[`deploy:sentio:${network}`], undefined);
  }
});
