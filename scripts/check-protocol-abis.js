#!/usr/bin/env node
// Compare indexer wire formats against a freshly built protocol artifact set.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const artifactRoot = process.argv[2];
if (!artifactRoot) {
  console.error("Usage: node scripts/check-protocol-abis.js <fresh-protocol-artifacts-directory>");
  process.exit(1);
}
const repoRoot = path.resolve(__dirname, "..");
const groups = {
  HooksFactory: ["HooksFactory", "HooksFactoryRevolving"],
  WildcatMarket: ["WildcatMarket", "WildcatMarketRevolving"],
  CombinedHooks: ["OpenTermHooks", "FixedTermHooks", "PeriodicTermHooks"],
};
function typeOf(input) {
  return input.type.startsWith("tuple")
    ? `(${input.components.map(typeOf).join(",")})${input.type.slice(5)}`
    : input.type;
}
function wireFormat(entry) {
  return `${entry.type} ${entry.name}(${entry.inputs.map(input =>
    `${input.indexed ? "indexed " : ""}${typeOf(input)}`).join(",")})` +
    (entry.type === "function" ? `:(${entry.outputs.map(typeOf).join(",")})` : "");
}
function relevant(abi) {
  return abi.filter(entry => ["event", "function"].includes(entry.type));
}

let checked = 0;
for (const file of [
  ...fs.readdirSync(path.join(repoRoot, "abis/v2.5"))
    .filter(file => file.endsWith(".json") && file !== "WildcatMarketLegacyState.json")
    .map(file => `abis/v2.5/${file}`),
  "abis/Wildcat4626Wrapper.json", "abis/Wildcat4626WrapperFactory.json",
]) {
  const name = path.basename(file, ".json");
  const indexer = relevant(JSON.parse(fs.readFileSync(path.join(repoRoot, file), "utf8")));
  const protocol = relevant((groups[name] || [name]).flatMap(contract =>
    JSON.parse(fs.readFileSync(path.join(artifactRoot, `${contract}.sol`, `${contract}.json`), "utf8")).abi));
  const protocolFormats = new Set(protocol.map(wireFormat));
  for (const entry of indexer) {
    assert.ok(protocolFormats.has(wireFormat(entry)), `${file}: incompatible ${wireFormat(entry)}`);
    checked++;
  }
  if (groups[name]) {
    assert.deepEqual(
      [...new Set(indexer.filter(entry => entry.type === "event").map(wireFormat))].sort(),
      [...new Set(protocol.filter(entry => entry.type === "event").map(wireFormat))].sort(),
      `${file}: incomplete event coverage`
    );
  }
}
console.log(`Verified ${checked} event/function wire formats against ${path.resolve(artifactRoot)}`);
