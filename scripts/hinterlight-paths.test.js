const assert = require("assert");
const { getHinterlightPaths } = require("./hinterlight-paths");

const paths = getHinterlightPaths("mainnet", "v2.0.28");

assert.strictEqual(paths.internalSubgraphName, "mainnet/v2-0-28");
assert.strictEqual(paths.publicSubgraphName, "mainnet/v2.0.28");
assert.strictEqual(
  paths.publicQueryUrl,
  "https://graph.hinterlight.net/mainnet/v2.0.28"
);

const revisionPaths = getHinterlightPaths("plasma-mainnet", "v2.0.22.4");

assert.strictEqual(
  revisionPaths.internalSubgraphName,
  "plasma-mainnet/v2-0-22-4"
);
assert.strictEqual(
  revisionPaths.publicSubgraphName,
  "plasma-mainnet/v2.0.22.4"
);
assert.strictEqual(
  revisionPaths.publicQueryUrl,
  "https://graph.hinterlight.net/plasma-mainnet/v2.0.22.4"
);

const inkPaths = getHinterlightPaths("ink-sepolia", "v2.1.9");
assert.strictEqual(inkPaths.internalSubgraphName, "ink-sepolia/v2-1-9");
assert.strictEqual(inkPaths.publicSubgraphName, "ink-sepolia/v2.1.9");
assert.strictEqual(inkPaths.publicQueryUrl, "https://graph.hinterlight.net/ink-sepolia/v2.1.9");

console.log("Hinterlight internal and public paths are formatted correctly.");
