import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import { ChainlinkFeedRegistry } from "../generated/templates/WildcatMarket/ChainlinkFeedRegistry";
import { ChainlinkAggregator } from "../generated/templates/WildcatMarket/ChainlinkAggregator";
import { Token, TokenDailyPrice } from "../generated/schema";
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
  contextString,
} from "./deployment-context";

const SECONDS_PER_DAY = BigInt.fromI32(86400);
// This is a dead-feed guard, not a substitute for each feed's heartbeat.
const MAX_PRICE_AGE = BigInt.fromI32(7 * 86400);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

class SyntheticPrice {
  priceUSD: BigDecimal;
  usdPeg: boolean;

  constructor(priceUSD: BigDecimal, usdPeg: boolean) {
    this.priceUSD = priceUSD;
    this.usdPeg = usdPeg;
  }
}

function dayTimestamp(timestamp: BigInt): i32 {
  return timestamp.div(SECONDS_PER_DAY).times(SECONDS_PER_DAY).toI32();
}

function pricingMode(): string {
  let mode = contextString(CONTEXT_PRICING_MODE);
  return mode == null ? "NONE" : (mode as string);
}

function configuredAddress(key: string): string {
  let value = contextString(key);
  if (value == null) return "";
  let configured = value as string;
  return configured.length == 0 ? "" : configured;
}

function isUsableAddress(value: string): boolean {
  return value.length != 0 && value != ZERO_ADDRESS;
}

function isUsableFeed(address: Address): boolean {
  return address.toHexString() != ZERO_ADDRESS;
}

function configuredListContains(key: string, value: string): boolean {
  let encoded = contextString(key);
  if (encoded == null) return false;
  let configured = encoded as string;
  if (configured.length == 0) return false;
  let entries = configured.split(",");
  for (let i = 0; i < entries.length; i++) {
    if (entries[i] == value) return true;
  }
  return false;
}

function configuredDirectFeed(tokenAddress: string): string {
  let encoded = contextString(CONTEXT_PRICING_DIRECT_FEEDS);
  if (encoded == null) return "";
  let configured = encoded as string;
  if (configured.length == 0) return "";
  let entries = configured.split(",");
  for (let i = 0; i < entries.length; i++) {
    let parts = entries[i].split("=");
    if (parts.length == 2 && parts[0] == tokenAddress) {
      return parts[1];
    }
  }
  return "";
}

function configuredSyntheticPrice(symbol: string): SyntheticPrice | null {
  let encoded = contextString(CONTEXT_PRICING_SYNTHETIC_PRICES);
  if (encoded == null) return null;
  let configured = encoded as string;
  if (configured.length == 0) return null;
  let entries = configured.split(",");
  for (let i = 0; i < entries.length; i++) {
    let parts = entries[i].split("=");
    if (parts.length == 3 && parts[0] == symbol) {
      return new SyntheticPrice(
        BigDecimal.fromString(parts[1]),
        parts[2] == "true"
      );
    }
  }
  return null;
}

function nullableStringEquals(
  value: string | null,
  expected: string
): boolean {
  if (!value) return false;
  return (value as string) == expected;
}

function discoverChainlinkPriceFeeds(
  token: Token,
  timestamp: BigInt,
  replaceExisting: boolean
): void {
  if (pricingMode() != "CHAINLINK") return;
  if (!replaceExisting && token.priceFeed0) return;

  let searchDay = dayTimestamp(timestamp);
  if (token.lastPriceFeedSearchDay == searchDay) return;
  token.lastPriceFeedSearchDay = searchDay;
  token.priceFeed0 = null;
  token.priceFeed1 = null;
  token.priceSource = null;

  let address = token.address.toHexString();
  let configuredFeed = configuredDirectFeed(address);
  if (isUsableAddress(configuredFeed)) {
    token.priceFeed0 = Address.fromString(configuredFeed);
    token.priceSource = "CHAINLINK_DIRECT";
    token.save();
    return;
  }

  let feedRegistry = configuredAddress(CONTEXT_PRICING_FEED_REGISTRY);
  let usd = configuredAddress(CONTEXT_PRICING_USD_DENOMINATION);
  let eth = configuredAddress(CONTEXT_PRICING_ETH_DENOMINATION);
  let btc = configuredAddress(CONTEXT_PRICING_BTC_DENOMINATION);
  let ethUsdFeed = configuredAddress(CONTEXT_PRICING_ETH_USD_FEED);
  let btcUsdFeed = configuredAddress(CONTEXT_PRICING_BTC_USD_FEED);
  if (
    !isUsableAddress(feedRegistry) ||
    !isUsableAddress(usd) ||
    !isUsableAddress(eth) ||
    !isUsableAddress(btc) ||
    !isUsableAddress(ethUsdFeed) ||
    !isUsableAddress(btcUsdFeed)
  ) {
    log.warning("Incomplete Chainlink pricing context for token {}", [address]);
    token.save();
    return;
  }

  let registry = ChainlinkFeedRegistry.bind(Address.fromString(feedRegistry));
  let asset = Address.fromBytes(token.address);
  let direct = registry.try_getFeed(asset, Address.fromString(usd));
  if (!direct.reverted && isUsableFeed(direct.value)) {
    token.priceFeed0 = direct.value;
    token.priceSource = "CHAINLINK_DIRECT";
    token.save();
    return;
  }

  let ethFeed = registry.try_getFeed(asset, Address.fromString(eth));
  if (!ethFeed.reverted && isUsableFeed(ethFeed.value)) {
    token.priceFeed0 = ethFeed.value;
    token.priceFeed1 = Address.fromString(ethUsdFeed);
    token.priceSource = "CHAINLINK_TWO_HOP";
    token.save();
    return;
  }

  let btcFeed = registry.try_getFeed(asset, Address.fromString(btc));
  if (!btcFeed.reverted && isUsableFeed(btcFeed.value)) {
    token.priceFeed0 = btcFeed.value;
    token.priceFeed1 = Address.fromString(btcUsdFeed);
    token.priceSource = "CHAINLINK_TWO_HOP";
  }
  // Persist failed discovery so an unpriced token does not make three
  // registry calls on every event. Discovery retries on the next UTC day.
  token.save();
}

/**
 * Applies generated per-chain pricing policy when token metadata is first
 * indexed. Transaction preparation and live views must never use this
 * analytics projection as an oracle.
 */
export function setupTokenPriceFeeds(token: Token, timestamp: BigInt): void {
  let mode = pricingMode();
  if (mode == "NONE") return;

  if (mode == "SYNTHETIC_TESTNET") {
    let synthetic = configuredSyntheticPrice(token.symbol);
    if (synthetic == null) {
      log.warning("No configured synthetic price for token {} ({})", [
        token.symbol,
        token.address.toHexString(),
      ]);
      return;
    }
    let configured = synthetic as SyntheticPrice;
    token.isUsdStablecoin = configured.usdPeg;
    token.priceSource = "SYNTHETIC_TESTNET";
    token.save();
    return;
  }

  if (mode == "USD_PEG" || mode == "CHAINLINK") {
    if (
      configuredListContains(
        CONTEXT_PRICING_STABLECOINS,
        token.address.toHexString()
      )
    ) {
      token.isUsdStablecoin = true;
      token.priceSource = "USD_PEG";
      token.save();
      return;
    }
    if (mode == "USD_PEG") return;
    discoverChainlinkPriceFeeds(token, timestamp, false);
    return;
  }

  log.warning("Unsupported pricing mode {} for token {}", [
    mode,
    token.address.toHexString(),
  ]);
}

function priceObservationId(token: Token, timestamp: BigInt): string {
  return (
    "TKNPRICE-" +
    token.address.toHexString() +
    "-" +
    dayTimestamp(timestamp).toString()
  );
}

function savePriceObservation(
  token: Token,
  event: ethereum.Event,
  priceUSD: BigDecimal,
  source: string
): TokenDailyPrice {
  let daily = new TokenDailyPrice(
    priceObservationId(token, event.block.timestamp)
  );
  daily.token = token.id;
  daily.timestamp = dayTimestamp(event.block.timestamp);
  daily.priceUSD = priceUSD;
  daily.source = source;
  daily.feed0 = token.priceFeed0;
  daily.feed1 = token.priceFeed1;
  daily.observedAtBlock = event.block.number;
  daily.observedAtTimestamp = event.block.timestamp;
  daily.observedAtTransaction = event.transaction.hash;
  daily.observedAtLogIndex = event.logIndex;
  daily.save();
  return daily;
}

function readFeedPrice(feed: Bytes, timestamp: BigInt): BigDecimal | null {
  let aggregator = ChainlinkAggregator.bind(Address.fromBytes(feed));
  let decimalsResult = aggregator.try_decimals();
  let roundResult = aggregator.try_latestRoundData();
  if (decimalsResult.reverted || roundResult.reverted) return null;

  let decimals = decimalsResult.value;
  let round = roundResult.value;
  let roundId = round.value0;
  let answer = round.value1;
  let updatedAt = round.value3;
  let answeredInRound = round.value4;
  if (decimals < 0 || decimals > 36) return null;
  if (answer.le(BigInt.zero())) return null;
  if (updatedAt.isZero() || updatedAt.gt(timestamp)) return null;
  if (answeredInRound.lt(roundId)) return null;
  if (timestamp.minus(updatedAt).gt(MAX_PRICE_AGE)) return null;

  let divisor = BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal();
  return answer.toBigDecimal().div(divisor);
}

function readTokenPricePath(
  token: Token,
  timestamp: BigInt
): BigDecimal | null {
  let feed0 = token.priceFeed0;
  if (!feed0) return null;
  let price = readFeedPrice(feed0 as Bytes, timestamp);
  if (!price) return null;

  let feed1 = token.priceFeed1;
  if (feed1) {
    let secondPrice = readFeedPrice(feed1 as Bytes, timestamp);
    if (!secondPrice) return null;
    price = (price as BigDecimal).times(secondPrice as BigDecimal);
  }
  return price;
}

export function ensureTokenDailyPrice(
  tokenId: string,
  event: ethereum.Event
): TokenDailyPrice | null {
  let token = Token.load(tokenId);
  if (token == null) return null;
  let configuredToken = token as Token;

  let cacheId = priceObservationId(configuredToken, event.block.timestamp);
  let cached = TokenDailyPrice.load(cacheId);
  if (cached != null) return cached as TokenDailyPrice;

  let source = configuredToken.priceSource;
  if (configuredToken.isUsdStablecoin) {
    if (!nullableStringEquals(source, "SYNTHETIC_TESTNET")) {
      return savePriceObservation(
        configuredToken,
        event,
        BigDecimal.fromString("1"),
        "USD_PEG"
      );
    }
  }

  if (nullableStringEquals(source, "SYNTHETIC_TESTNET")) {
    let synthetic = configuredSyntheticPrice(configuredToken.symbol);
    if (synthetic == null) return null;
    return savePriceObservation(
      configuredToken,
      event,
      (synthetic as SyntheticPrice).priceUSD,
      "SYNTHETIC_TESTNET"
    );
  }

  if (pricingMode() != "CHAINLINK") return null;
  if (!configuredToken.priceFeed0) {
    discoverChainlinkPriceFeeds(
      configuredToken,
      event.block.timestamp,
      false
    );
  }
  let price = readTokenPricePath(configuredToken, event.block.timestamp);
  let currentDay = dayTimestamp(event.block.timestamp);
  if (!price && configuredToken.lastPriceFeedSearchDay != currentDay) {
    discoverChainlinkPriceFeeds(
      configuredToken,
      event.block.timestamp,
      true
    );
    price = readTokenPricePath(configuredToken, event.block.timestamp);
  }
  if (!price) {
    // Stop calling a dead path on every event. The daily discovery throttle
    // allows it to be retried after the next UTC boundary.
    if (configuredToken.priceFeed0) {
      configuredToken.priceFeed0 = null;
      configuredToken.priceFeed1 = null;
      configuredToken.priceSource = null;
      configuredToken.save();
    }
    return null;
  }

  let observationSource = configuredToken.priceFeed1
    ? "CHAINLINK_TWO_HOP"
    : "CHAINLINK_DIRECT";
  return savePriceObservation(
    configuredToken,
    event,
    price as BigDecimal,
    observationSource
  );
}

export function getTokenPriceUSD(
  tokenId: string,
  event: ethereum.Event
): BigDecimal | null {
  let daily = ensureTokenDailyPrice(tokenId, event);
  return daily == null ? null : (daily as TokenDailyPrice).priceUSD;
}
