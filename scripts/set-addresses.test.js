const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildWildcat4626WrapperFactoryDataSources,
  getIndexedWrapperFactories,
} = require("./set-addresses");

const wrapperFactories = [
  {
    name: "Wildcat4626WrapperFactoryLegacy",
    address: "0x0000000000000000000000000000000000000001",
    startBlock: 1,
    indexed: true,
  },
  {
    name: "Wildcat4626WrapperFactoryV2_5",
    address: "0x0000000000000000000000000000000000000002",
    startBlock: 2,
    indexed: true,
  },
  {
    name: "Wildcat4626WrapperFactoryRetired",
    address: "0x0000000000000000000000000000000000000003",
    startBlock: 3,
    indexed: false,
  },
];

test("generates one data source for each indexed wrapper factory", () => {
  const indexedFactories = getIndexedWrapperFactories({ wrapperFactories });
  const dataSources = buildWildcat4626WrapperFactoryDataSources(
    "sepolia",
    indexedFactories
  );

  assert.deepEqual(
    indexedFactories.map(({ name }) => name),
    ["Wildcat4626WrapperFactoryLegacy", "Wildcat4626WrapperFactoryV2_5"]
  );
  assert.match(dataSources, /name: Wildcat4626WrapperFactoryLegacy/);
  assert.match(dataSources, /name: Wildcat4626WrapperFactoryV2_5/);
  assert.doesNotMatch(dataSources, /name: Wildcat4626WrapperFactoryRetired/);
});

test("rejects duplicate indexed wrapper factory addresses", () => {
  assert.throws(
    () =>
      getIndexedWrapperFactories({
        wrapperFactories: [
          wrapperFactories[0],
          {
            ...wrapperFactories[1],
            address: wrapperFactories[0].address.toUpperCase(),
          },
        ],
      }),
    /Duplicate indexed wrapper factory address/
  );
});

test("keeps the legacy singleton wrapper-factory config fallback", () => {
  const [wrapperFactory] = getIndexedWrapperFactories({
    contracts: {
      Wildcat4626WrapperFactory: {
        address: "0x0000000000000000000000000000000000000004",
        startBlock: 4,
      },
    },
  });

  assert.deepEqual(wrapperFactory, {
    name: "Wildcat4626WrapperFactory",
    address: "0x0000000000000000000000000000000000000004",
    startBlock: 4,
    indexed: true,
  });
});
