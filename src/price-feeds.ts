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
  CONTEXT_PRICING_FEED_DECIMALS,
  CONTEXT_PRICING_FEED_REGISTRY,
  CONTEXT_PRICING_MODE,
  CONTEXT_PRICING_STABLECOINS,
  CONTEXT_PRICING_SYNTHETIC_PRICES,
  CONTEXT_PRICING_USD_DENOMINATION,
  contextString,
} from "./deployment-context";

const SECONDS_PER_DAY: i64 = 86400;

class SyntheticPrice {
  priceUSD: BigDecimal;
  usdPeg: boolean;

  constructor(priceUSD: BigDecimal, usdPeg: boolean) {
    this.priceUSD = priceUSD;
    this.usdPeg = usdPeg;
  }
}

function pricingMode(): string {
  let mode = contextString(CONTEXT_PRICING_MODE);
  if (mode == null) {
    return "NONE";
  }
  return mode as string;
}

function configuredAddress(key: string): string {
  let value = contextString(key);
  if (value == null) {
    return "";
  }
  let configured = value as string;
  if (configured.length == 0) {
    return "";
  }
  return configured;
}

function configuredFeedDivisor(): BigDecimal | null {
  let value = contextString(CONTEXT_PRICING_FEED_DECIMALS);
  if (value == null) {
    return null;
  }
  let configured = value as string;
  if (configured.length == 0) {
    return null;
  }
  let decimals = I32.parseInt(configured);
  return BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal();
}

function configuredListContains(key: string, value: string): boolean {
  let encoded = contextString(key);
  if (encoded == null) {
    return false;
  }
  let configured = encoded as string;
  if (configured.length == 0) {
    return false;
  }
  let entries = configured.split(",");
  for (let i = 0; i < entries.length; i++) {
    if (entries[i] == value) {
      return true;
    }
  }
  return false;
}

function configuredDirectFeed(tokenAddress: string): string {
  let encoded = contextString(CONTEXT_PRICING_DIRECT_FEEDS);
  if (encoded == null) {
    return "";
  }
  let configured = encoded as string;
  if (configured.length == 0) {
    return "";
  }
  let entries = configured.split(",");
  for (let i = 0; i < entries.length; i++) {
    let parts = entries[i].split("=");
    if (parts.length != 2) {
      continue;
    }
    if (parts[0] == tokenAddress) {
      return parts[1];
    }
  }
  return "";
}

function configuredSyntheticPrice(symbol: string): SyntheticPrice | null {
  let encoded = contextString(CONTEXT_PRICING_SYNTHETIC_PRICES);
  if (encoded == null) {
    return null;
  }
  let configured = encoded as string;
  if (configured.length == 0) {
    return null;
  }
  let entries = configured.split(",");
  for (let i = 0; i < entries.length; i++) {
    let parts = entries[i].split("=");
    if (parts.length != 3) {
      continue;
    }
    if (parts[0] == symbol) {
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
  if (value == null) {
    return false;
  }
  return (value as string) == expected;
}

/**
 * Resolve a token's configured analytics price path once, when its metadata is
 * first indexed. Transaction preparation and live views must never use this
 * projection as a price oracle.
 */
export function setupTokenPriceFeeds(token: Token): void {
  let address = token.address.toHexString();
  let mode = pricingMode();

  if (mode == "NONE") {
    return;
  }

  if (mode == "SYNTHETIC_TESTNET") {
    let synthetic = configuredSyntheticPrice(token.symbol);
    if (synthetic == null) {
      log.warning("No configured synthetic price for token {} ({})", [
        token.symbol,
        address,
      ]);
      return;
    }
    let configured = synthetic as SyntheticPrice;
    token.isUsdStablecoin = configured.usdPeg;
    token.priceSource = "SYNTHETIC_TESTNET";
    token.save();
    return;
  }

  if (mode != "CHAINLINK") {
    log.warning("Unsupported pricing mode {} for token {}", [mode, address]);
    return;
  }

  if (configuredListContains(CONTEXT_PRICING_STABLECOINS, address)) {
    token.isUsdStablecoin = true;
    token.priceSource = "USD_PEG";
    token.save();
    return;
  }

  let directFeed = configuredDirectFeed(address);
  if (directFeed.length != 0) {
    token.priceFeed0 = Address.fromString(directFeed);
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
    feedRegistry.length == 0 ||
    usd.length == 0 ||
    eth.length == 0 ||
    btc.length == 0 ||
    ethUsdFeed.length == 0 ||
    btcUsdFeed.length == 0
  ) {
    log.warning("Incomplete Chainlink pricing context for token {}", [address]);
    return;
  }

  let registry = ChainlinkFeedRegistry.bind(Address.fromString(feedRegistry));
  let tokenAddress = Address.fromBytes(token.address);

  let directResult = registry.try_getFeed(tokenAddress, Address.fromString(usd));
  if (!directResult.reverted) {
    token.priceFeed0 = directResult.value;
    token.priceSource = "CHAINLINK_DIRECT";
    token.save();
    return;
  }

  let ethResult = registry.try_getFeed(tokenAddress, Address.fromString(eth));
  if (!ethResult.reverted) {
    token.priceFeed0 = ethResult.value;
    token.priceFeed1 = Address.fromString(ethUsdFeed);
    token.priceSource = "CHAINLINK_TWO_HOP";
    token.save();
    return;
  }

  let btcResult = registry.try_getFeed(tokenAddress, Address.fromString(btc));
  if (!btcResult.reverted) {
    token.priceFeed0 = btcResult.value;
    token.priceFeed1 = Address.fromString(btcUsdFeed);
    token.priceSource = "CHAINLINK_TWO_HOP";
    token.save();
  }
}

function priceObservationId(token: Token, timestamp: BigInt): string {
  let dayTimestamp = timestamp
    .div(BigInt.fromI64(SECONDS_PER_DAY))
    .times(BigInt.fromI64(SECONDS_PER_DAY));
  return (
    "TKNPRICE-" +
    token.address.toHexString() +
    "-" +
    dayTimestamp.toString()
  );
}

function savePriceObservation(
  token: Token,
  event: ethereum.Event,
  priceUSD: BigDecimal,
  source: string
): TokenDailyPrice {
  let dayTimestamp = event.block.timestamp
    .div(BigInt.fromI64(SECONDS_PER_DAY))
    .times(BigInt.fromI64(SECONDS_PER_DAY));
  let daily = new TokenDailyPrice(
    priceObservationId(token, event.block.timestamp)
  );
  daily.token = token.id;
  daily.timestamp = dayTimestamp.toI32();
  daily.priceUSD = priceUSD;
  daily.source = source;
  daily.observedAtBlock = event.block.number;
  daily.observedAtTimestamp = event.block.timestamp;
  daily.observedAtTransaction = event.transaction.hash;
  daily.observedAtLogIndex = event.logIndex;
  daily.save();
  return daily;
}

export function getTokenPriceUSD(
  tokenId: string,
  event: ethereum.Event
): BigDecimal | null {
  let daily = ensureTokenDailyPrice(tokenId, event);
  if (daily == null) {
    return null;
  }
  return (daily as TokenDailyPrice).priceUSD;
}

export function ensureTokenDailyPrice(
  tokenId: string,
  event: ethereum.Event
): TokenDailyPrice | null {
  let token = Token.load(tokenId);
  if (token == null) {
    return null;
  }
  let configuredToken = token as Token;

  let cacheId = priceObservationId(configuredToken, event.block.timestamp);
  let cached = TokenDailyPrice.load(cacheId);
  if (cached != null) {
    return cached as TokenDailyPrice;
  }

  let tokenPriceSource = configuredToken.priceSource;
  if (configuredToken.isUsdStablecoin) {
    if (!nullableStringEquals(tokenPriceSource, "SYNTHETIC_TESTNET")) {
      return savePriceObservation(
        configuredToken,
        event,
        BigDecimal.fromString("1"),
        "USD_PEG"
      );
    }
  }

  if (nullableStringEquals(tokenPriceSource, "SYNTHETIC_TESTNET")) {
    let synthetic = configuredSyntheticPrice(configuredToken.symbol);
    if (synthetic == null) {
      return null;
    }
    let configuredSynthetic = synthetic as SyntheticPrice;
    return savePriceObservation(
      configuredToken,
      event,
      configuredSynthetic.priceUSD,
      "SYNTHETIC_TESTNET"
    );
  }

  let feed0 = configuredToken.priceFeed0;
  let feedDivisor = configuredFeedDivisor();
  if (!feed0) {
    return null;
  }
  if (!feedDivisor) {
    return null;
  }
  let configuredDivisor = feedDivisor as BigDecimal;

  let aggregator0 = ChainlinkAggregator.bind(Address.fromBytes(feed0 as Bytes));
  let result0 = aggregator0.try_latestAnswer();
  if (result0.reverted) {
    return null;
  }
  let price = result0.value.toBigDecimal().div(configuredDivisor);

  let source = "CHAINLINK_DIRECT";
  let feed1 = configuredToken.priceFeed1;
  if (feed1) {
    let aggregator1 = ChainlinkAggregator.bind(
      Address.fromBytes(feed1 as Bytes)
    );
    let result1 = aggregator1.try_latestAnswer();
    if (result1.reverted) {
      return null;
    }
    price = price.times(result1.value.toBigDecimal().div(configuredDivisor));
    source = "CHAINLINK_TWO_HOP";
  }

  return savePriceObservation(configuredToken, event, price, source);
}
