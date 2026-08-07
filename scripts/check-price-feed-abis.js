#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const manifestNames = [
  "subgraph.template.yaml",
  "plasma-subgraph.template.yaml",
];
const priceFeedMappings = [
  "simple-collateral-factory.ts",
  "hooks-factory.ts",
  "wildcat-market-controller-factory.ts",
  "wildcat-market-controller.ts",
  "wildcat-market.ts",
];
const requiredAbis = ["ChainlinkAggregator", "ChainlinkFeedRegistry"];
const errors = [];
let checkedMappings = 0;

for (const manifestName of manifestNames) {
  const manifest = fs.readFileSync(path.join(root, manifestName), "utf8");
  const mappingBlocks = manifest.split(/\n(?=  - kind: ethereum\r?\n)/);

  for (const mappingName of priceFeedMappings) {
    const mappingFile = `file: ./src/${mappingName}`;
    const mappingBlock = mappingBlocks.find((block) =>
      block.includes(mappingFile)
    );
    if (!mappingBlock) continue;

    checkedMappings += 1;
    for (const abi of requiredAbis) {
      if (!mappingBlock.includes(`- name: ${abi}`)) {
        errors.push(`${manifestName}: ${mappingName} is missing ${abi}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Price-feed ABI manifest check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Validated Chainlink ABIs for ${checkedMappings} price-feed mapping contexts.`
);
