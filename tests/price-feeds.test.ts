import {
  assert,
  clearStore,
  dataSourceMock,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly";
import { createMockedFunction } from "matchstick-as";
import {
  Address,
  BigInt,
  DataSourceContext,
  ethereum,
} from "@graphprotocol/graph-ts";
import { Token } from "../generated/schema";
import { generateTokenId } from "../generated/UncrashableEntityHelpers";
import {
  CONTEXT_PRICING_BTC_DENOMINATION,
  CONTEXT_PRICING_BTC_USD_FEED,
  CONTEXT_PRICING_DIRECT_FEEDS,
  CONTEXT_PRICING_ETH_DENOMINATION,
  CONTEXT_PRICING_ETH_USD_FEED,
  CONTEXT_PRICING_FEED_REGISTRY,
  CONTEXT_PRICING_MODE,
  CONTEXT_PRICING_STABLECOINS,
  CONTEXT_PRICING_SYNTHETIC_PRICES,
  CONTEXT_PRICING_USD_DENOMINATION,
} from "../src/deployment-context";
import {
  ensureTokenDailyPrice,
  setupTokenPriceFeeds,
} from "../src/price-feeds";

const USDC = Address.fromString(
  "0x1000000000000000000000000000000000000001"
);
const WETH = Address.fromString(
  "0x2000000000000000000000000000000000000002"
);
const FEED_REGISTRY = Address.fromString(
  "0x3000000000000000000000000000000000000003"
);
const USD = Address.fromString(
  "0x0000000000000000000000000000000000000348"
);
const ETH = Address.fromString(
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
);
const BTC = Address.fromString(
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
);
const ETH_USD_FEED = Address.fromString(
  "0x4000000000000000000000000000000000000004"
);
const BTC_USD_FEED = Address.fromString(
  "0x5000000000000000000000000000000000000005"
);

function setSyntheticPricingContext(): void {
  let context = new DataSourceContext();
  context.setString(CONTEXT_PRICING_MODE, "SYNTHETIC_TESTNET");
  context.setString(
    CONTEXT_PRICING_SYNTHETIC_PRICES,
    "USDC=1=true,WETH=2000=false"
  );
  dataSourceMock.setContext(context);
}

function setUsdPegPricingContext(stablecoins: string): void {
  let context = new DataSourceContext();
  context.setString(CONTEXT_PRICING_MODE, "USD_PEG");
  context.setString(CONTEXT_PRICING_STABLECOINS, stablecoins);
  context.setString(CONTEXT_PRICING_DIRECT_FEEDS, "");
  context.setString(CONTEXT_PRICING_SYNTHETIC_PRICES, "");
  dataSourceMock.setContext(context);
}

function setChainlinkPricingContext(
  stablecoins: string = "",
  directFeeds: string = ""
): void {
  let context = new DataSourceContext();
  context.setString(CONTEXT_PRICING_MODE, "CHAINLINK");
  context.setString(
    CONTEXT_PRICING_FEED_REGISTRY,
    FEED_REGISTRY.toHexString()
  );
  context.setString(CONTEXT_PRICING_USD_DENOMINATION, USD.toHexString());
  context.setString(CONTEXT_PRICING_ETH_DENOMINATION, ETH.toHexString());
  context.setString(CONTEXT_PRICING_BTC_DENOMINATION, BTC.toHexString());
  context.setString(CONTEXT_PRICING_ETH_USD_FEED, ETH_USD_FEED.toHexString());
  context.setString(CONTEXT_PRICING_BTC_USD_FEED, BTC_USD_FEED.toHexString());
  context.setString(CONTEXT_PRICING_STABLECOINS, stablecoins);
  context.setString(CONTEXT_PRICING_DIRECT_FEEDS, directFeeds);
  context.setString(CONTEXT_PRICING_SYNTHETIC_PRICES, "");
  dataSourceMock.setContext(context);
}

function seedToken(address: Address, name: string, symbol: string): Token {
  let token = new Token(generateTokenId(address));
  token.address = address;
  token.name = name;
  token.symbol = symbol;
  token.decimals = 18;
  token.isMock = false;
  token.isUsdStablecoin = false;
  token.lastPriceFeedSearchDay = -1;
  token.save();
  return token;
}

function createObservationEvent(timestamp: i32 = 172923): ethereum.Event {
  let event = newMockEvent();
  event.block.number = BigInt.fromI32(42);
  event.block.timestamp = BigInt.fromI32(timestamp);
  event.logIndex = BigInt.fromI32(7);
  return event;
}

function mockRegistryFeed(
  asset: Address,
  quote: Address,
  feed: Address
): void {
  createMockedFunction(
    FEED_REGISTRY,
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

describe("configured price observations", () => {
  test("records synthetic prices with exact observation provenance", () => {
    clearStore();
    setSyntheticPricingContext();

    let token = seedToken(USDC, "USD Coin", "USDC");
    let event = createObservationEvent();
    setupTokenPriceFeeds(token, event.block.timestamp);
    ensureTokenDailyPrice(token.id, event);

    let observationId = "TKNPRICE-" + USDC.toHexString() + "-172800";
    assert.fieldEquals("Token", token.id, "isUsdStablecoin", "true");
    assert.fieldEquals(
      "Token",
      token.id,
      "priceSource",
      "SYNTHETIC_TESTNET"
    );
    assert.fieldEquals("TokenDailyPrice", observationId, "priceUSD", "1");
    assert.fieldEquals(
      "TokenDailyPrice",
      observationId,
      "source",
      "SYNTHETIC_TESTNET"
    );
    assert.fieldEquals("TokenDailyPrice", observationId, "observedAtBlock", "42");
    assert.fieldEquals(
      "TokenDailyPrice",
      observationId,
      "observedAtTimestamp",
      "172923"
    );
    assert.fieldEquals(
      "TokenDailyPrice",
      observationId,
      "observedAtTransaction",
      event.transaction.hash.toHexString()
    );
    assert.fieldEquals("TokenDailyPrice", observationId, "observedAtLogIndex", "7");
    dataSourceMock.resetValues();
  });

  test("uses explicit USD pegs without inferring them from symbols", () => {
    clearStore();
    setUsdPegPricingContext(USDC.toHexString());
    let event = createObservationEvent();

    let configured = seedToken(USDC, "USD Coin", "USDC");
    setupTokenPriceFeeds(configured, event.block.timestamp);
    ensureTokenDailyPrice(configured.id, event);

    let unconfigured = seedToken(WETH, "Fake USD Coin", "USDC");
    setupTokenPriceFeeds(unconfigured, event.block.timestamp);
    ensureTokenDailyPrice(unconfigured.id, event);

    let observationId = "TKNPRICE-" + USDC.toHexString() + "-172800";
    assert.fieldEquals("Token", configured.id, "isUsdStablecoin", "true");
    assert.fieldEquals("Token", configured.id, "priceSource", "USD_PEG");
    assert.fieldEquals("TokenDailyPrice", observationId, "priceUSD", "1");
    assert.fieldEquals("TokenDailyPrice", observationId, "source", "USD_PEG");
    assert.fieldEquals("Token", unconfigured.id, "isUsdStablecoin", "false");
    assert.entityCount("TokenDailyPrice", 1);
    dataSourceMock.resetValues();
  });
});

describe("Chainlink price validation", () => {
  test("uses feed decimals, caches by day, and records direct-feed provenance", () => {
    clearStore();
    let feed = Address.fromString(
      "0x6000000000000000000000000000000000000006"
    );
    setChainlinkPricingContext("", USDC.toHexString() + "=" + feed.toHexString());
    let token = seedToken(USDC, "Token", "TKN");
    let firstEvent = createObservationEvent(1_000_000);
    let secondEvent = createObservationEvent(1_000_100);
    mockFeedRound(
      feed,
      18,
      9,
      BigInt.fromString("2500000000000000000"),
      999_900,
      9
    );

    setupTokenPriceFeeds(token, firstEvent.block.timestamp);
    let first = ensureTokenDailyPrice(token.id, firstEvent);
    let second = ensureTokenDailyPrice(token.id, secondEvent);

    assert.assertTrue(!!first);
    assert.assertTrue(!!second);
    assert.stringEquals(first!.priceUSD.toString(), "2.5");
    assert.stringEquals(first!.id, second!.id);
    assert.fieldEquals("TokenDailyPrice", first!.id, "source", "CHAINLINK_DIRECT");
    assert.fieldEquals("TokenDailyPrice", first!.id, "feed0", feed.toHexString());
    assert.entityCount("TokenDailyPrice", 1);
    dataSourceMock.resetValues();
  });

  test("multiplies independently scaled two-hop prices and records both feeds", () => {
    clearStore();
    setChainlinkPricingContext();
    let asset = Address.fromString(
      "0x7000000000000000000000000000000000000007"
    );
    let assetEthFeed = Address.fromString(
      "0x8000000000000000000000000000000000000008"
    );
    let token = seedToken(asset, "Token", "TKN");
    let event = createObservationEvent(1_000_000);
    mockRegistryFeed(asset, USD, Address.zero());
    mockRegistryFeed(asset, ETH, assetEthFeed);
    mockFeedRound(assetEthFeed, 6, 10, BigInt.fromI32(2_000_000), 999_900, 10);
    mockFeedRound(
      ETH_USD_FEED,
      8,
      11,
      BigInt.fromString("300000000000"),
      999_900,
      11
    );

    setupTokenPriceFeeds(token, event.block.timestamp);
    let price = ensureTokenDailyPrice(token.id, event);

    assert.assertTrue(!!price);
    assert.stringEquals(price!.priceUSD.toString(), "6000");
    assert.fieldEquals("TokenDailyPrice", price!.id, "source", "CHAINLINK_TWO_HOP");
    assert.fieldEquals(
      "TokenDailyPrice",
      price!.id,
      "feed0",
      assetEthFeed.toHexString()
    );
    assert.fieldEquals(
      "TokenDailyPrice",
      price!.id,
      "feed1",
      ETH_USD_FEED.toHexString()
    );
    dataSourceMock.resetValues();
  });

  test("rejects non-positive, incomplete, stale, and future rounds", () => {
    clearStore();
    let negativeFeed = Address.fromString(
      "0x9000000000000000000000000000000000000001"
    );
    let incompleteFeed = Address.fromString(
      "0x9000000000000000000000000000000000000002"
    );
    let staleFeed = Address.fromString(
      "0x9000000000000000000000000000000000000003"
    );
    let futureFeed = Address.fromString(
      "0x9000000000000000000000000000000000000004"
    );
    let negative = Address.fromString(
      "0xa000000000000000000000000000000000000001"
    );
    let incomplete = Address.fromString(
      "0xa000000000000000000000000000000000000002"
    );
    let stale = Address.fromString(
      "0xa000000000000000000000000000000000000003"
    );
    let future = Address.fromString(
      "0xa000000000000000000000000000000000000004"
    );
    setChainlinkPricingContext(
      "",
      negative.toHexString() + "=" + negativeFeed.toHexString() +
        "," + incomplete.toHexString() + "=" + incompleteFeed.toHexString() +
        "," + stale.toHexString() + "=" + staleFeed.toHexString() +
        "," + future.toHexString() + "=" + futureFeed.toHexString()
    );
    let event = createObservationEvent(1_000_000);
    let negativeToken = seedToken(negative, "Negative", "NEG");
    let incompleteToken = seedToken(incomplete, "Incomplete", "INC");
    let staleToken = seedToken(stale, "Stale", "STL");
    let futureToken = seedToken(future, "Future", "FUT");
    setupTokenPriceFeeds(negativeToken, event.block.timestamp);
    setupTokenPriceFeeds(incompleteToken, event.block.timestamp);
    setupTokenPriceFeeds(staleToken, event.block.timestamp);
    setupTokenPriceFeeds(futureToken, event.block.timestamp);
    mockFeedRound(negativeFeed, 8, 1, BigInt.fromI32(-1), 999_900, 1);
    mockFeedRound(incompleteFeed, 8, 2, BigInt.fromI32(100_000_000), 999_900, 1);
    mockFeedRound(staleFeed, 8, 3, BigInt.fromI32(100_000_000), 100_000, 3);
    mockFeedRound(futureFeed, 8, 4, BigInt.fromI32(100_000_000), 1_000_001, 4);

    assert.assertTrue(!ensureTokenDailyPrice(negativeToken.id, event));
    assert.assertTrue(!ensureTokenDailyPrice(incompleteToken.id, event));
    assert.assertTrue(!ensureTokenDailyPrice(staleToken.id, event));
    assert.assertTrue(!ensureTokenDailyPrice(futureToken.id, event));
    assert.entityCount("TokenDailyPrice", 0);
    dataSourceMock.resetValues();
  });

  test("ignores zero-address feeds and rediscovers a dead path on a later day", () => {
    clearStore();
    setChainlinkPricingContext();
    let asset = Address.fromString(
      "0xb000000000000000000000000000000000000001"
    );
    let retiredFeed = Address.fromString(
      "0xb000000000000000000000000000000000000002"
    );
    let replacementFeed = Address.fromString(
      "0xb000000000000000000000000000000000000003"
    );
    let token = seedToken(asset, "Token", "TKN");
    let firstEvent = createObservationEvent(1_000_000);
    mockRegistryFeed(asset, USD, Address.zero());
    mockRegistryFeed(asset, ETH, Address.zero());
    mockRegistryFeed(asset, BTC, Address.zero());
    setupTokenPriceFeeds(token, firstEvent.block.timestamp);
    assert.fieldEquals("Token", token.id, "priceFeed0", "null");

    let stored = Token.load(token.id);
    if (stored) {
      stored.priceFeed0 = retiredFeed;
      stored.lastPriceFeedSearchDay = 950_400;
      stored.save();
    }
    mockFeedRound(retiredFeed, 8, 1, BigInt.fromI32(100_000_000), 1_000_000, 1);
    mockRegistryFeed(asset, USD, replacementFeed);
    mockFeedRound(replacementFeed, 8, 2, BigInt.fromI32(250_000_000), 1_999_900, 2);

    let secondEvent = createObservationEvent(2_000_000);
    let price = ensureTokenDailyPrice(token.id, secondEvent);

    assert.assertTrue(!!price);
    assert.stringEquals(price!.priceUSD.toString(), "2.5");
    assert.fieldEquals(
      "Token",
      token.id,
      "priceFeed0",
      replacementFeed.toHexString()
    );
    assert.fieldEquals("Token", token.id, "priceFeed1", "null");
    assert.fieldEquals("Token", token.id, "lastPriceFeedSearchDay", "1987200");
    dataSourceMock.resetValues();
  });
});
