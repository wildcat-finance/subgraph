import {
  assert,
  clearStore,
  dataSourceMock,
  describe,
  test,
} from "matchstick-as/assembly/index";
import { createMockedFunction } from "matchstick-as";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  createToken,
  generateTokenId,
  getToken,
} from "../generated/UncrashableEntityHelpers";
import {
  ensureTokenDailyPrice,
  getTokenPriceUSD,
  setupTokenPriceFeeds,
} from "../src/price-feeds";

let feedRegistry = Address.fromString(
  "0x47fb2585d2c56fe188d0e6ec628a38b74fceeedf"
);
let usd = Address.fromString(
  "0x0000000000000000000000000000000000000348"
);
let eth = Address.fromString(
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
);
let btc = Address.fromString(
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
);
let btcUsdFeed = Address.fromString(
  "0xf4030086522a5beea4988f8ca5b36dbc97bee88c"
);

function saveToken(address: Address, symbol: string = "TKN"): string {
  let id = generateTokenId(address);
  createToken(id, {
    address,
    name: symbol,
    symbol,
    decimals: 18,
    isMock: false,
    isUsdStablecoin: false,
  });
  return id;
}

function mockRegistryFeed(
  asset: Address,
  quote: Address,
  feed: Address
): void {
  createMockedFunction(
    feedRegistry,
    "getFeed",
    "getFeed(address,address):(address)"
  )
    .withArgs([
      ethereum.Value.fromAddress(asset),
      ethereum.Value.fromAddress(quote),
    ])
    .returns([ethereum.Value.fromAddress(feed)]);
}

function mockFeedRound(
  feed: Address,
  decimals: i32,
  roundId: i32,
  answer: BigInt,
  updatedAt: i32,
  answeredInRound: i32
): void {
  createMockedFunction(feed, "decimals", "decimals():(uint8)")
    .withArgs([])
    .returns([
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(decimals)),
    ]);
  createMockedFunction(
    feed,
    "latestRoundData",
    "latestRoundData():(uint80,int256,uint256,uint256,uint80)"
  )
    .withArgs([])
    .returns([
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(roundId)),
      ethereum.Value.fromSignedBigInt(answer),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(updatedAt)),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(updatedAt)),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(answeredInRound)),
    ]);
}

describe("price feed chain policy", () => {
  test("uses explicit fixed-dollar addresses on each target chain", () => {
    clearStore();

    dataSourceMock.setNetwork("mainnet");
    let mainnetUsdc = Address.fromString(
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    );
    let mainnetId = saveToken(mainnetUsdc, "USDC");
    setupTokenPriceFeeds(getToken(mainnetId), BigInt.fromI32(1000000));
    assert.fieldEquals("Token", mainnetId, "isUsdStablecoin", "true");
    let mainnetPrice = getTokenPriceUSD(mainnetId, BigInt.fromI32(1000000));
    assert.assertTrue(!!mainnetPrice);
    assert.stringEquals(mainnetPrice!.toString(), "1");

    dataSourceMock.setNetwork("plasma-mainnet");
    let plasmaUsdt0 = Address.fromString(
      "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb"
    );
    let plasmaId = saveToken(plasmaUsdt0, "USDT0");
    setupTokenPriceFeeds(getToken(plasmaId), BigInt.fromI32(1000000));
    assert.fieldEquals("Token", plasmaId, "isUsdStablecoin", "true");

    dataSourceMock.setNetwork("plasma-testnet");
    let plasmaTestUsdc = Address.fromString(
      "0x8756591e2695da611a927f2a3f23dd5bc3dd97c6"
    );
    let plasmaTestId = saveToken(plasmaTestUsdc, "USDC");
    setupTokenPriceFeeds(getToken(plasmaTestId), BigInt.fromI32(1000000));
    assert.fieldEquals(
      "Token",
      plasmaTestId,
      "isUsdStablecoin",
      "true"
    );
  });

  test("does not infer stablecoins by symbol or call mainnet feeds on Plasma", () => {
    clearStore();
    dataSourceMock.setNetwork("plasma-testnet");

    let unconfigured = Address.fromString(
      "0x0000000000000000000000000000000000009090"
    );
    let tokenId = saveToken(unconfigured, "USDC");
    setupTokenPriceFeeds(getToken(tokenId), BigInt.fromI32(1000000));

    assert.fieldEquals("Token", tokenId, "isUsdStablecoin", "false");
    assert.fieldEquals("Token", tokenId, "lastPriceFeedSearchDay", "0");
    let price = getTokenPriceUSD(tokenId, BigInt.fromI32(1000000));
    assert.assertTrue(!price);
    assert.entityCount("TokenDailyPrice", 0);
  });

  test("leaves USST unpriced without an explicit product policy", () => {
    clearStore();
    dataSourceMock.setNetwork("mainnet");

    let usst = Address.fromString(
      "0xf9d82660828d8f5d121b14a9dc9c677d91f60065"
    );
    let tokenId = saveToken(usst, "USST");
    mockRegistryFeed(usst, usd, Address.zero());
    mockRegistryFeed(usst, eth, Address.zero());
    mockRegistryFeed(
      usst,
      Address.fromString(
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      ),
      Address.zero()
    );

    setupTokenPriceFeeds(getToken(tokenId), BigInt.fromI32(1000000));

    assert.fieldEquals("Token", tokenId, "isUsdStablecoin", "false");
    assert.fieldEquals("Token", tokenId, "lastPriceFeedSearchDay", "950400");
    let price = getTokenPriceUSD(tokenId, BigInt.fromI32(1000000));
    assert.assertTrue(!price);
  });
});

describe("Chainlink price validation", () => {
  test("uses feed decimals and caches a direct price by day", () => {
    clearStore();
    dataSourceMock.setNetwork("mainnet");

    let asset = Address.fromString(
      "0x0000000000000000000000000000000000009101"
    );
    let feed = Address.fromString(
      "0x0000000000000000000000000000000000009201"
    );
    let tokenId = saveToken(asset);
    mockRegistryFeed(asset, usd, feed);
    mockFeedRound(
      feed,
      18,
      9,
      BigInt.fromString("2500000000000000000"),
      999900,
      9
    );

    setupTokenPriceFeeds(getToken(tokenId), BigInt.fromI32(1000000));
    let first = ensureTokenDailyPrice(tokenId, BigInt.fromI32(1000000));
    let second = ensureTokenDailyPrice(tokenId, BigInt.fromI32(1000100));

    assert.assertTrue(!!first);
    assert.assertTrue(!!second);
    assert.stringEquals(first!.priceUSD.toString(), "2.5");
    assert.stringEquals(first!.id, second!.id);
    assert.fieldEquals(
      "TokenDailyPrice",
      first!.id,
      "timestamp",
      "950400"
    );
    assert.entityCount("TokenDailyPrice", 1);
  });

  test("multiplies independently scaled two-hop prices", () => {
    clearStore();
    dataSourceMock.setNetwork("mainnet");

    let asset = Address.fromString(
      "0x0000000000000000000000000000000000009102"
    );
    let feed0 = Address.fromString(
      "0x0000000000000000000000000000000000009202"
    );
    let ethUsdFeed = Address.fromString(
      "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419"
    );
    let tokenId = saveToken(asset);
    mockRegistryFeed(asset, usd, Address.zero());
    mockRegistryFeed(asset, eth, feed0);
    mockFeedRound(feed0, 6, 10, BigInt.fromI32(2000000), 999900, 10);
    mockFeedRound(
      ethUsdFeed,
      8,
      11,
      BigInt.fromString("300000000000"),
      999900,
      11
    );

    setupTokenPriceFeeds(getToken(tokenId), BigInt.fromI32(1000000));
    let price = getTokenPriceUSD(tokenId, BigInt.fromI32(1000000));

    assert.assertTrue(!!price);
    assert.stringEquals(price!.toString(), "6000");
  });

  test("refreshes a stale cached two-hop feed and retries pricing", () => {
    clearStore();
    dataSourceMock.setNetwork("mainnet");

    let asset = Address.fromString(
      "0x0000000000000000000000000000000000009103"
    );
    let retiredFeed = Address.fromString(
      "0x0000000000000000000000000000000000009203"
    );
    let replacementFeed = Address.fromString(
      "0x0000000000000000000000000000000000009204"
    );
    let tokenId = saveToken(asset);
    let token = getToken(tokenId);
    token.priceFeed0 = retiredFeed;
    token.priceFeed1 = btcUsdFeed;
    token.lastPriceFeedSearchDay = 950400;
    token.save();

    mockFeedRound(
      retiredFeed,
      8,
      1,
      BigInt.fromI32(100000000),
      1000000,
      1
    );
    mockRegistryFeed(asset, usd, Address.zero());
    mockRegistryFeed(asset, eth, Address.zero());
    mockRegistryFeed(asset, btc, replacementFeed);
    mockFeedRound(
      replacementFeed,
      8,
      2,
      BigInt.fromI32(100000000),
      1999900,
      2
    );
    mockFeedRound(
      btcUsdFeed,
      8,
      3,
      BigInt.fromString("6500000000000"),
      1999900,
      3
    );

    let price = getTokenPriceUSD(tokenId, BigInt.fromI32(2000000));

    assert.assertTrue(!!price);
    assert.stringEquals(price!.toString(), "65000");
    let refreshedToken = getToken(tokenId);
    assert.stringEquals(
      refreshedToken.priceFeed0!.toHexString(),
      replacementFeed.toHexString()
    );
    assert.stringEquals(
      refreshedToken.priceFeed1!.toHexString(),
      btcUsdFeed.toHexString()
    );
    assert.fieldEquals(
      "Token",
      tokenId,
      "lastPriceFeedSearchDay",
      "1987200"
    );
  });

  test("drops an obsolete second hop when refresh finds a direct feed", () => {
    clearStore();
    dataSourceMock.setNetwork("mainnet");

    let asset = Address.fromString(
      "0x0000000000000000000000000000000000009104"
    );
    let retiredFeed = Address.fromString(
      "0x0000000000000000000000000000000000009205"
    );
    let replacementFeed = Address.fromString(
      "0x0000000000000000000000000000000000009206"
    );
    let tokenId = saveToken(asset);
    let token = getToken(tokenId);
    token.priceFeed0 = retiredFeed;
    token.priceFeed1 = btcUsdFeed;
    token.save();

    mockFeedRound(
      retiredFeed,
      8,
      1,
      BigInt.fromI32(100000000),
      1000000,
      1
    );
    mockRegistryFeed(asset, usd, replacementFeed);
    mockFeedRound(
      replacementFeed,
      8,
      2,
      BigInt.fromI32(250000000),
      1999900,
      2
    );

    let price = getTokenPriceUSD(tokenId, BigInt.fromI32(2000000));

    assert.assertTrue(!!price);
    assert.stringEquals(price!.toString(), "2.5");
    assert.assertTrue(!getToken(tokenId).priceFeed1);
  });

  test("clears an unusable path and records the daily retry", () => {
    clearStore();
    dataSourceMock.setNetwork("mainnet");

    let asset = Address.fromString(
      "0x0000000000000000000000000000000000009105"
    );
    let retiredFeed = Address.fromString(
      "0x0000000000000000000000000000000000009207"
    );
    let tokenId = saveToken(asset);
    let token = getToken(tokenId);
    token.priceFeed0 = retiredFeed;
    token.save();

    mockFeedRound(
      retiredFeed,
      8,
      1,
      BigInt.fromI32(100000000),
      1000000,
      1
    );
    mockRegistryFeed(asset, usd, Address.zero());
    mockRegistryFeed(asset, eth, Address.zero());
    mockRegistryFeed(asset, btc, Address.zero());

    let first = getTokenPriceUSD(tokenId, BigInt.fromI32(2000000));
    let second = getTokenPriceUSD(tokenId, BigInt.fromI32(2000100));

    assert.assertTrue(!first);
    assert.assertTrue(!second);
    let refreshedToken = getToken(tokenId);
    assert.assertTrue(!refreshedToken.priceFeed0);
    assert.assertTrue(!refreshedToken.priceFeed1);
    assert.fieldEquals(
      "Token",
      tokenId,
      "lastPriceFeedSearchDay",
      "1987200"
    );
    assert.entityCount("TokenDailyPrice", 0);
  });

  test("rejects non-positive, incomplete, and stale rounds", () => {
    clearStore();
    dataSourceMock.setNetwork("mainnet");

    let negativeFeed = Address.fromString(
      "0x0000000000000000000000000000000000009301"
    );
    let incompleteFeed = Address.fromString(
      "0x0000000000000000000000000000000000009302"
    );
    let staleFeed = Address.fromString(
      "0x0000000000000000000000000000000000009303"
    );
    let negativeId = saveToken(
      Address.fromString("0x0000000000000000000000000000000000009401")
    );
    let incompleteId = saveToken(
      Address.fromString("0x0000000000000000000000000000000000009402")
    );
    let staleId = saveToken(
      Address.fromString("0x0000000000000000000000000000000000009403")
    );
    let negativeToken = getToken(negativeId);
    negativeToken.priceFeed0 = negativeFeed;
    negativeToken.lastPriceFeedSearchDay = 950400;
    negativeToken.save();
    let incompleteToken = getToken(incompleteId);
    incompleteToken.priceFeed0 = incompleteFeed;
    incompleteToken.lastPriceFeedSearchDay = 950400;
    incompleteToken.save();
    let staleToken = getToken(staleId);
    staleToken.priceFeed0 = staleFeed;
    staleToken.lastPriceFeedSearchDay = 950400;
    staleToken.save();

    mockFeedRound(negativeFeed, 8, 1, BigInt.fromI32(-1), 999900, 1);
    mockFeedRound(incompleteFeed, 8, 2, BigInt.fromI32(100000000), 999900, 1);
    mockFeedRound(staleFeed, 8, 3, BigInt.fromI32(100000000), 100000, 3);

    assert.assertTrue(
      !ensureTokenDailyPrice(negativeId, BigInt.fromI32(1000000))
    );
    assert.assertTrue(
      !ensureTokenDailyPrice(incompleteId, BigInt.fromI32(1000000))
    );
    assert.assertTrue(
      !ensureTokenDailyPrice(staleId, BigInt.fromI32(1000000))
    );
    assert.entityCount("TokenDailyPrice", 0);
  });
});
