#!/usr/bin/env node

const { configDigest, loadAllChainConfigs, loadChainConfig } = require("./chain-config");

function describe(config) {
  const indexedFactories = config.factories.filter(
    (factory) => factory.indexed
  ).length;
  const targets = [
    ...config.factories,
    ...config.wrapperFactories,
  ].filter((factory) => factory.deploymentTarget).length;
  console.log(
    `Config valid: ${config.network} (chain ${config.chainId}, ${indexedFactories} indexed hooks factories, ${targets} deployment targets, digest ${configDigest(config)})`
  );
}

function run(argv = process.argv.slice(2)) {
  if (argv.length > 1) {
    throw new Error("Usage: node scripts/validate-config.js [network]");
  }
  if (argv.length === 1) {
    describe(loadChainConfig(argv[0]));
    return;
  }
  const { configs } = loadAllChainConfigs();
  configs.forEach(describe);
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { run };
