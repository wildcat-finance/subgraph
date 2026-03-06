import { Address, BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { ChainlinkFeedRegistry } from "../generated/templates/WildcatMarket/ChainlinkFeedRegistry";
import { ChainlinkAggregator } from "../generated/templates/WildcatMarket/ChainlinkAggregator";
import { Token, TokenDailyPrice } from "../generated/schema";
import { log } from "matchstick-as";

// Chainlink Feed Registry (mainnet only)
const FEED_REGISTRY = Address.fromString(
  "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf"
);

// Chainlink denomination addresses
const USD = Address.fromString(
  "0x0000000000000000000000000000000000000348"
);
const ETH = Address.fromString(
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
);
const BTC = Address.fromString(
  "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"
);

// Hardcoded second-hop feed addresses (mainnet)
const ETH_USD_FEED = Address.fromString(
  "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"
);
const BTC_USD_FEED = Address.fromString(
  "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c"
);
const SOL_USD_FEED = Address.fromString("0x4ffC43a60e009B551865A93d232E33Fce9f01507");

// Known stablecoin addresses (mainnet)
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const SOL = "0xd31a59c85ae9d8edefec411d448f90841571b89c";

const ONE_E8 = new BigDecimal(BigInt.fromI64(100000000)); // 10^8
const SECONDS_PER_DAY: i64 = 86400;

/**
 * Called once per token at creation time to discover Chainlink price feed paths.
 * On non-mainnet networks, all registry calls revert and fields stay null.
 */
export function setupTokenPriceFeeds(token: Token): void {
  let addr = token.address.toHexString();
  log.warning("Setting up token price feeds for token: {}", [addr]);
  // Stablecoins
  if (addr == USDC || addr == USDT) {
    token.isUsdStablecoin = true;
    log.warning("Token is a USD stablecoin: {}", [addr]);
    token.save();
    return;
  }

  // Check if token is WETH
  if (addr == WETH) {
    token.priceFeed0 = ETH_USD_FEED
    log.warning("Token is WETH: {}", [addr]);
    token.save();
    return;
  }

  if (addr == SOL) {
    token.priceFeed0 = SOL_USD_FEED;
    log.warning("Token is SOL: {}", [addr]);
    token.save();
    return;
  }

  let registry = ChainlinkFeedRegistry.bind(FEED_REGISTRY);
  let tokenAddress = Address.fromBytes(token.address);
  let revertMsg: string = "";

  // Try direct TOKEN/USD feed
  let directResult = registry.try_getFeed(tokenAddress, USD);
  if (directResult.reverted) {
    revertMsg = "Feed reverted";
  } else {
    revertMsg = "Found feed";
  }
  log.warning("DIRECT result: {}", [revertMsg]);
  if (!directResult.reverted) {
    token.priceFeed0 = directResult.value;
    token.save();
    return;
  }

  // Try TOKEN/ETH + ETH/USD two-hop
  let ethResult = registry.try_getFeed(tokenAddress, ETH);
  if (ethResult.reverted) {
    revertMsg = "Feed reverted";
  } else {
    revertMsg = "Found feed";
  }
  log.warning("ETH result: {}", [revertMsg]);
  if (!ethResult.reverted) {
    token.priceFeed0 = ethResult.value;
    token.priceFeed1 = ETH_USD_FEED;
    token.save();
    return;
  }

  // Try TOKEN/BTC + BTC/USD two-hop
  let btcResult = registry.try_getFeed(tokenAddress, BTC);
  if (btcResult.reverted) {
    revertMsg = "Feed reverted";
  } else {
    revertMsg = "Found feed";
  }
  log.warning("BTC result: {}", [revertMsg]);
  if (!btcResult.reverted) {
    token.priceFeed0 = btcResult.value;
    token.priceFeed1 = BTC_USD_FEED;
    token.save();
    return;
  }

  // No feed found — fields remain null
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
    return new BigDecimal(BigInt.fromI64(1));
  }

  let daily = ensureTokenDailyPrice(tokenId, timestamp);
  if (daily != null) {
    return daily.priceUSD;
  }

  return null;
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

  let feed0 = token.priceFeed0;
  if (!feed0) {
    return null;
  }

  // Daily cache
  let dayTimestamp = timestamp
    .div(BigInt.fromI64(SECONDS_PER_DAY))
    .times(BigInt.fromI64(SECONDS_PER_DAY));
  let cacheId =
    "TKNPRICE-" +
    token.address.toHexString() +
    "-" +
    dayTimestamp.toString();

  let cached = TokenDailyPrice.load(cacheId);
  if (cached) {
    return cached;
  }

  // Query first feed
  let aggregator0 = ChainlinkAggregator.bind(
    Address.fromBytes(feed0 as Bytes)
  );
  let result0 = aggregator0.try_latestAnswer();
  if (result0.reverted) {
    return null;
  }
  let price = new BigDecimal(result0.value).div(ONE_E8);

  // Two-hop path
  let feed1 = token.priceFeed1;
  if (feed1) {
    let aggregator1 = ChainlinkAggregator.bind(
      Address.fromBytes(feed1 as Bytes)
    );
    let result1 = aggregator1.try_latestAnswer();
    if (result1.reverted) {
      return null;
    }
    // price = (price0 * price1) / 10^8
    let price1 = new BigDecimal(result1.value).div(ONE_E8);
    price = price.times(price1);
  }

  // Save to daily cache
  let daily = new TokenDailyPrice(cacheId);
  daily.token = tokenId;
  daily.timestamp = dayTimestamp.toI32();
  daily.priceUSD = price;
  daily.save();

  return daily;
}
