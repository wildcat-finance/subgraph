import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  dataSource,
} from "@graphprotocol/graph-ts";
import { ChainlinkAggregator } from "../generated/templates/WildcatMarket/ChainlinkAggregator";
import { ChainlinkFeedRegistry } from "../generated/templates/WildcatMarket/ChainlinkFeedRegistry";
import { Token, TokenDailyPrice } from "../generated/schema";

const MAINNET = "mainnet";
const PLASMA_MAINNET = "plasma-mainnet";
const PLASMA_TESTNET = "plasma-testnet";
const SECONDS_PER_DAY = BigInt.fromI32(86400);
// This is a dead-feed guard, not a substitute for each feed's heartbeat.
const MAX_PRICE_AGE = BigInt.fromI32(7 * 86400);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const FEED_REGISTRY = Address.fromString(
  "0x47fb2585d2c56fe188d0e6ec628a38b74fceeedf"
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
  "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419"
);
const BTC_USD_FEED = Address.fromString(
  "0xf4030086522a5beea4988f8ca5b36dbc97bee88c"
);
const SOL_USD_FEED = Address.fromString(
  "0x4ffc43a60e009b551865a93d232e33fce9f01507"
);

function dayTimestamp(timestamp: BigInt): i32 {
  return timestamp.div(SECONDS_PER_DAY).times(SECONDS_PER_DAY).toI32();
}

function isConfiguredUsdStablecoin(network: string, address: string): boolean {
  if (network == MAINNET) {
    if (address == "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48") {
      return true;
    }
    return address == "0xdac17f958d2ee523a2206206994597c13d831ec7";
  }
  if (network == PLASMA_MAINNET) {
    // USDT0, already treated as $1 by the production app's Plasma path.
    return address == "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb";
  }
  if (network == PLASMA_TESTNET) {
    // Explicit deployment addresses only. Symbols are deliberately ignored.
    if (address == "0x8756591e2695da611a927f2a3f23dd5bc3dd97c6") return true;
    if (address == "0x98b1ffa19befdcc43df4edd6569dff8f01900aa6") return true;
    if (address == "0x998b1d2b82b03b3f9eadace173496e9a00117650") return true;
    if (address == "0xc69cec70647a144561acc63c4380b8d81fcf5f18") return true;
    if (address == "0xd48ca6f2506afb586a283740a657ce5158f0c213") return true;
    if (address == "0xd8f42112168a7459f6590811e95e5ff8b70e3e53") return true;
    if (address == "0xe4183d4562f6c06a5d312c82078be55cb4b8cb64") return true;
    if (address == "0xe59e9598017a59b33ccf2a88ce15d0e3a79ab682") return true;
    return address == "0xf925dc937d10c3cda5914457d18db1ffb0f460d2";
  }
  return false;
}

function isUsableFeed(address: Address): boolean {
  return address.toHexString() != ZERO_ADDRESS;
}

function discoverTokenPriceFeeds(
  token: Token,
  timestamp: BigInt,
  replaceExisting: boolean
): void {
  let network = dataSource.network();
  let tokenAddress = token.address.toHexString();

  if (isConfiguredUsdStablecoin(network, tokenAddress)) {
    token.isUsdStablecoin = true;
    token.save();
    return;
  }

  if (network != MAINNET) {
    return;
  }
  if (!replaceExisting && token.priceFeed0) {
    return;
  }

  let searchDay = dayTimestamp(timestamp);
  if (token.lastPriceFeedSearchDay == searchDay) {
    return;
  }
  token.lastPriceFeedSearchDay = searchDay;
  token.priceFeed0 = null;
  token.priceFeed1 = null;

  if (tokenAddress == "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2") {
    token.priceFeed0 = ETH_USD_FEED;
    token.save();
    return;
  }
  if (tokenAddress == "0xd31a59c85ae9d8edefec411d448f90841571b89c") {
    token.priceFeed0 = SOL_USD_FEED;
    token.save();
    return;
  }

  let registry = ChainlinkFeedRegistry.bind(FEED_REGISTRY);
  let asset = Address.fromBytes(token.address);
  let direct = registry.try_getFeed(asset, USD);
  if (!direct.reverted && isUsableFeed(direct.value)) {
    token.priceFeed0 = direct.value;
    token.save();
    return;
  }

  let eth = registry.try_getFeed(asset, ETH);
  if (!eth.reverted && isUsableFeed(eth.value)) {
    token.priceFeed0 = eth.value;
    token.priceFeed1 = ETH_USD_FEED;
    token.save();
    return;
  }

  let btc = registry.try_getFeed(asset, BTC);
  if (!btc.reverted && isUsableFeed(btc.value)) {
    token.priceFeed0 = btc.value;
    token.priceFeed1 = BTC_USD_FEED;
  }
  // Persist the search day even when no path exists so an unpriced token does
  // not make three registry calls on every event. Discovery retries next day.
  token.save();
}

/**
 * Applies chain-specific fixed-price policy and discovers a Chainlink path.
 * Ethereum registry calls are never made on Plasma or other networks.
 */
export function setupTokenPriceFeeds(token: Token, timestamp: BigInt): void {
  discoverTokenPriceFeeds(token, timestamp, false);
}

function readFeedPrice(feed: Bytes, timestamp: BigInt): BigDecimal | null {
  let aggregator = ChainlinkAggregator.bind(Address.fromBytes(feed));
  let decimalsResult = aggregator.try_decimals();
  let roundResult = aggregator.try_latestRoundData();
  if (decimalsResult.reverted || roundResult.reverted) {
    return null;
  }

  let decimals = decimalsResult.value;
  let round = roundResult.value;
  let roundId = round.value0;
  let answer = round.value1;
  let updatedAt = round.value3;
  let answeredInRound = round.value4;
  if (decimals < 0) return null;
  if (decimals > 36) return null;
  if (answer.le(BigInt.zero())) return null;
  if (updatedAt.isZero()) return null;
  if (updatedAt.gt(timestamp)) return null;
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
  if (!feed0) {
    return null;
  }

  let price = readFeedPrice(feed0 as Bytes, timestamp);
  if (!price) {
    return null;
  }
  let feed1 = token.priceFeed1;
  if (feed1) {
    let secondPrice = readFeedPrice(feed1 as Bytes, timestamp);
    if (!secondPrice) {
      return null;
    }
    price = price.times(secondPrice as BigDecimal);
  }
  return price;
}

export function ensureTokenDailyPrice(
  tokenId: string,
  timestamp: BigInt
): TokenDailyPrice | null {
  let token = Token.load(tokenId);
  if (!token) {
    return null;
  }
  if (token.isUsdStablecoin) {
    return null;
  }

  let startOfDay = dayTimestamp(timestamp);
  let cacheId =
    "TKNPRICE-" + token.address.toHexString() + "-" + startOfDay.toString();
  let cached = TokenDailyPrice.load(cacheId);
  if (cached) {
    return cached;
  }

  if (!token.priceFeed0) {
    setupTokenPriceFeeds(token, timestamp);
  }
  let price = readTokenPricePath(token, timestamp);
  if (
    !price &&
    dataSource.network() == MAINNET &&
    token.lastPriceFeedSearchDay != startOfDay
  ) {
    discoverTokenPriceFeeds(token, timestamp, true);
    price = readTokenPricePath(token, timestamp);
  }
  if (!price) {
    // Do not repeatedly call a dead path for every event. Discovery is already
    // throttled by lastPriceFeedSearchDay and will run again on the next day.
    if (dataSource.network() == MAINNET && token.priceFeed0) {
      token.priceFeed0 = null;
      token.priceFeed1 = null;
      token.save();
    }
    return null;
  }

  let dailyPrice = new TokenDailyPrice(cacheId);
  dailyPrice.token = token.id;
  dailyPrice.timestamp = startOfDay;
  dailyPrice.priceUSD = price as BigDecimal;
  dailyPrice.save();
  return dailyPrice;
}

export function getTokenPriceUSD(
  tokenId: string,
  timestamp: BigInt
): BigDecimal | null {
  let token = Token.load(tokenId);
  if (!token) {
    return null;
  }
  if (token.isUsdStablecoin) {
    return BigDecimal.fromString("1");
  }
  let dailyPrice = ensureTokenDailyPrice(tokenId, timestamp);
  if (!dailyPrice) {
    return null;
  }
  return dailyPrice.priceUSD;
}

export function getTokenPriceMultiplier(
  decimals: i32,
  tokenId: string,
  timestamp: BigInt
): BigDecimal | null {
  let priceUSD = getTokenPriceUSD(tokenId, timestamp);
  if (!priceUSD) {
    return null;
  }
  let divisor = BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal();
  return priceUSD.div(divisor);
}

export function amountToUSD(
  amount: BigInt,
  multiplier: BigDecimal
): BigDecimal {
  return amount.toBigDecimal().times(multiplier);
}
