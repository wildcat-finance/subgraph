const assert = require("node:assert/strict");
const test = require("node:test");
const { getHinterlightPaths } = require("./hinterlight-paths");

test("formats Hinterlight internal and public release paths", () => {
  assert.deepEqual(getHinterlightPaths("sepolia", "v2.5.8"), {
    internalSubgraphName: "sepolia/v2-5-8",
    publicSubgraphName: "sepolia/v2.5.8",
    publicQueryUrl: "https://graph.hinterlight.net/sepolia/v2.5.8",
  });

  assert.deepEqual(getHinterlightPaths("plasma-mainnet", "v2.0.22.4"), {
    internalSubgraphName: "plasma-mainnet/v2-0-22-4",
    publicSubgraphName: "plasma-mainnet/v2.0.22.4",
    publicQueryUrl:
      "https://graph.hinterlight.net/plasma-mainnet/v2.0.22.4",
  });
});
