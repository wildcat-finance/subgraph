const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");

const root = path.join(__dirname, "..");

test("network switching selects the correct wrapper source and hooks ABI", () => {
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
    for (const network of ["sepolia", "ink-sepolia", "mainnet", "plasma-mainnet", "plasma-testnet", "ink-sepolia", "sepolia"]) {
      execFileSync(process.execPath, [path.join(fixture, "scripts/set-addresses.js"), network]);
      const manifest = fs.readFileSync(path.join(fixture, "subgraph.yaml"), "utf8");
      assert.doesNotMatch(manifest, /\{\{/);
      const sources = manifest.split(/\n(?=  - kind: ethereum\r?\n)/);
      const wrapperSource = sources.find((source) => source.includes("name: Wildcat4626WrapperFactory\n"));
      if (network === "sepolia" || network === "ink-sepolia") {
        assert.ok(wrapperSource);
        const factory = require("../networks.json")[network].contracts.Wildcat4626WrapperFactory;
        assert.ok(wrapperSource.includes(`address: "${factory.address}"`));
        assert.ok(wrapperSource.includes(`startBlock: ${factory.startBlock}`));
        assert.match(wrapperSource, /WrapperDeployed\(indexed address,indexed address\)/);
        assert.match(wrapperSource, /name: IERC20/);
        assert.match(wrapperSource, /file: .\/src\/wildcat-4626-wrapper-factory.ts/);
      } else {
        assert.equal(wrapperSource, undefined);
      }
      if (network === "ink-sepolia") {
        assert.doesNotMatch(manifest, /name: WildcatMarketCollateralFactory/);
        assert.doesNotMatch(manifest, /network: (?:sepolia|mainnet|plasma)/);
        assert.equal((manifest.match(/\n    source:\n      address:/g) || []).length, 4);
        for (const [name, contract] of Object.entries(require("../networks.json")[network].contracts)) {
          const source = sources.find((entry) => entry.includes(`name: ${name}\n`));
          assert.ok(source.includes(`address: "${contract.address}"`));
          assert.ok(source.includes(`startBlock: ${contract.startBlock}`));
        }
        assert.doesNotMatch(
          fs.readFileSync(path.join(fixture, "src/hooks-factory.ts"), "utf8"),
          /allowForceBuyBacks = hookedMarket\.allowForceBuyBacks;/
        );
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
