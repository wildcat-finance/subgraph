const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");

const root = path.join(__dirname, "..");

test("wrapper source is configured for Sepolia and omitted on other networks", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "wrapper-config-"));
  try {
    for (const name of [
      "scripts/set-addresses.js", "networks.json", "subgraph.template.yaml",
      "plasma-subgraph.template.yaml", "uncrashable-config.template.yaml",
      "network-specific-abis", "abis", "src/hooks-factory.ts",
    ]) {
      fs.cpSync(path.join(root, name), path.join(fixture, name), { recursive: true });
    }
    // Exercise switching back to Sepolia too: generation must not retain a
    // previous network's source, address, or incompatible hooks ABI.
    for (const network of ["sepolia", "mainnet", "plasma-mainnet", "plasma-testnet", "sepolia"]) {
      execFileSync(process.execPath, [path.join(fixture, "scripts/set-addresses.js"), network]);
      const manifest = fs.readFileSync(path.join(fixture, "subgraph.yaml"), "utf8");
      assert.doesNotMatch(manifest, /\{\{/);
      const sources = manifest.split(/\n(?=  - kind: ethereum\r?\n)/);
      const wrapperSource = sources.find((source) => source.includes("name: Wildcat4626WrapperFactory\n"));
      if (network === "sepolia") {
        assert.ok(wrapperSource);
        assert.match(wrapperSource, /address: "0x0566Fe57682164af689f1440cb3BCEedEe3bf843"/);
        assert.match(wrapperSource, /startBlock: 10534112/);
        assert.match(wrapperSource, /WrapperDeployed\(indexed address,indexed address\)/);
        assert.match(wrapperSource, /name: IERC20/);
        assert.match(wrapperSource, /file: .\/src\/wildcat-4626-wrapper-factory.ts/);
      } else {
        assert.equal(wrapperSource, undefined);
      }
      for (const mapping of ["hooks-factory.ts", "wildcat-market-controller.ts"]) {
        const source = sources.find((source) => source.includes(`file: ./src/${mapping}`));
        assert.match(source, /- Wildcat4626Wrapper\n/);
        assert.match(source, /- WrapperMarketIndex\n/);
      }
      assert.match(manifest, /PeriodicTermUpdated\(address,uint32,uint32,uint32\)/);
      assert.match(manifest, /AnnualInterestBipsReductionExecuted\(indexed address,uint16\)/);
      assert.deepEqual(
        fs.readFileSync(path.join(fixture, "abis", "PeriodicTermHooks.json")),
        fs.readFileSync(path.join(root, "abis", "PeriodicTermHooks.json"))
      );
      const abiNetwork = network === "sepolia" ? "sepolia" : "mainnet";
      for (const name of ["OpenTermHooks.json", "FixedTermHooks.json"]) {
        assert.deepEqual(
          fs.readFileSync(path.join(fixture, "abis", name)),
          fs.readFileSync(path.join(root, "network-specific-abis", abiNetwork, name))
        );
      }
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
