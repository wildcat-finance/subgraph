import {
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
} from "@graphprotocol/graph-ts";
import {
  ProtocolStats,
  BorrowerStats,
  LenderStats,
  ProtocolDailyStats,
  BorrowerDailyStats,
  LenderDailyStats,
  Market,
  MarketDailyStats,
} from "../generated/schema";
import {
  generateProtocolStatsId,
  generateBorrowerStatsId,
  generateLenderStatsId,
  getOrInitializeProtocolStats,
  getOrInitializeBorrowerStats,
  getOrInitializeLenderStats,
  getOrInitializeProtocolDailyStats,
  getOrInitializeBorrowerDailyStats,
  getOrInitializeLenderDailyStats,
  getOrInitializeMarketDailyStats,
} from "../generated/UncrashableEntityHelpers";
import { ensureTokenDailyPrice } from "./price-feeds";
import { calculateTotalDebt } from "./utils";

// -------------------------------------------------------------------------- //
//                            Price helpers                                    //
// -------------------------------------------------------------------------- //

/**
 * Returns the USD multiplier for one raw token unit, or null when no valid
 * price observation can be made for this event.
 */
export function getTokenPriceMultiplier(
  decimals: i32,
  tokenId: string,
  event: ethereum.Event
): BigDecimal | null {
  let daily = ensureTokenDailyPrice(tokenId, event);
  if (!daily) return null;
  let divisor = BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal();
  return daily.priceUSD.div(divisor);
}

export function amountToUSD(
  amount: BigInt,
  multiplier: BigDecimal
): BigDecimal {
  return amount.toBigDecimal().times(multiplier);
}

export function computeUsdDelta(
  amount: BigInt,
  decimals: i32,
  tokenId: string,
  event: ethereum.Event
): BigDecimal | null {
  let multiplier = getTokenPriceMultiplier(decimals, tokenId, event);
  if (!multiplier) return null;
  return amountToUSD(amount, multiplier as BigDecimal);
}

export function setMarketTotalDebtUSD(
  market: Market,
  priceMultiplier: BigDecimal | null
): void {
  let totalDebt = calculateTotalDebt(market);
  if (totalDebt.isZero()) {
    market.totalDebtUSD = BigDecimal.zero();
    return;
  }
  if (!priceMultiplier) {
    market.totalDebtUSD = null;
    return;
  }
  market.totalDebtUSD = amountToUSD(
    totalDebt,
    priceMultiplier as BigDecimal
  );
}

export function updateMarketTotalDebtUSD(
  market: Market,
  event: ethereum.Event
): void {
  setMarketTotalDebtUSD(
    market,
    getTokenPriceMultiplier(market.decimals, market.asset, event)
  );
}

// -------------------------------------------------------------------------- //
//                         Singleton get-or-create                            //
// -------------------------------------------------------------------------- //

export function getOrCreateProtocolStats(): ProtocolStats {
  return getOrInitializeProtocolStats(generateProtocolStatsId(), {
    usdTotalsComplete: true,
  }).entity;
}

export function getOrCreateBorrowerStats(borrower: Bytes): BorrowerStats {
  return getOrInitializeBorrowerStats(generateBorrowerStatsId(borrower), {
    borrower,
    profile: borrower.toHexString(),
    usdTotalsComplete: true,
  }).entity;
}

export function getOrCreateLenderStats(
  lender: Bytes,
  timestamp: BigInt
): LenderStats {
  return getOrInitializeLenderStats(generateLenderStatsId(lender), {
    lender,
    firstSeenTimestamp: timestamp.toI32(),
    usdTotalsComplete: true,
  }).entity;
}

export function recordMarketCreated(
  borrower: Bytes,
  timestamp: BigInt
): void {
  let protocolStats = getOrCreateProtocolStats();
  let borrowerStats = getOrCreateBorrowerStats(borrower);
  protocolStats.numMarkets = protocolStats.numMarkets + 1;
  borrowerStats.numMarkets = borrowerStats.numMarkets + 1;

  let protocolDaily = getOrCreateProtocolDailyStats(
    timestamp,
    protocolStats
  );
  let borrowerDaily = getOrCreateBorrowerDailyStats(
    borrower,
    timestamp,
    borrowerStats
  );
  protocolStats.save();
  borrowerStats.save();
  protocolDaily.save();
  borrowerDaily.save();
}

// -------------------------------------------------------------------------- //
//                           Daily snapshot helpers                           //
// -------------------------------------------------------------------------- //

function dayTimestamp(timestamp: BigInt): i32 {
  return (timestamp.toI32() / 86400) * 86400;
}

export function refreshProtocolDailyFromStats(
  entity: ProtocolDailyStats,
  stats: ProtocolStats
): void {
  entity.totalDepositedUSD = stats.totalDepositedUSD;
  entity.totalBorrowedUSD = stats.totalBorrowedUSD;
  entity.totalRepaidUSD = stats.totalRepaidUSD;
  entity.totalWithdrawalsRequestedUSD = stats.totalWithdrawalsRequestedUSD;
  entity.totalWithdrawalsExecutedUSD = stats.totalWithdrawalsExecutedUSD;
  entity.totalBaseInterestAccruedUSD = stats.totalBaseInterestAccruedUSD;
  entity.totalDelinquencyFeesAccruedUSD = stats.totalDelinquencyFeesAccruedUSD;
  entity.totalProtocolFeesAccruedUSD = stats.totalProtocolFeesAccruedUSD;
  entity.cumulativeUsdTotalsComplete = stats.usdTotalsComplete;
  entity.numMarkets = stats.numMarkets;
  entity.numActiveMarkets = stats.numActiveMarkets;
  entity.numDelinquentMarkets = stats.numDelinquentMarkets;
  entity.numClosedMarkets = stats.numClosedMarkets;
  entity.numActiveBorrowers = stats.numActiveBorrowers;
  entity.numActiveLenders = stats.numActiveLenders;
  entity.numActiveLenderAccounts = stats.numActiveLenderAccounts;
}

export function getOrCreateProtocolDailyStats(
  timestamp: BigInt,
  stats: ProtocolStats
): ProtocolDailyStats {
  let start = dayTimestamp(timestamp);
  let result = getOrInitializeProtocolDailyStats(
    "PROTOCOL-" + start.toString(),
    {
      startTimestamp: start,
      endTimestamp: start + 86400,
      totalDepositedUSD: stats.totalDepositedUSD,
      totalBorrowedUSD: stats.totalBorrowedUSD,
      totalRepaidUSD: stats.totalRepaidUSD,
      totalWithdrawalsRequestedUSD: stats.totalWithdrawalsRequestedUSD,
      totalWithdrawalsExecutedUSD: stats.totalWithdrawalsExecutedUSD,
      totalBaseInterestAccruedUSD: stats.totalBaseInterestAccruedUSD,
      totalDelinquencyFeesAccruedUSD: stats.totalDelinquencyFeesAccruedUSD,
      totalProtocolFeesAccruedUSD: stats.totalProtocolFeesAccruedUSD,
      dayUsdTotalsComplete: true,
      cumulativeUsdTotalsComplete: stats.usdTotalsComplete,
      numMarkets: stats.numMarkets,
      numActiveMarkets: stats.numActiveMarkets,
      numDelinquentMarkets: stats.numDelinquentMarkets,
      numClosedMarkets: stats.numClosedMarkets,
      numActiveBorrowers: stats.numActiveBorrowers,
      numActiveLenders: stats.numActiveLenders,
      numActiveLenderAccounts: stats.numActiveLenderAccounts,
    }
  );
  refreshProtocolDailyFromStats(result.entity, stats);
  return result.entity;
}

function refreshBorrowerDailyFromStats(
  entity: BorrowerDailyStats,
  stats: BorrowerStats
): void {
  entity.totalDepositedUSD = stats.totalDepositedUSD;
  entity.totalBorrowedUSD = stats.totalBorrowedUSD;
  entity.totalRepaidUSD = stats.totalRepaidUSD;
  entity.totalWithdrawalsRequestedUSD = stats.totalWithdrawalsRequestedUSD;
  entity.totalWithdrawalsExecutedUSD = stats.totalWithdrawalsExecutedUSD;
  entity.totalBaseInterestAccruedUSD = stats.totalBaseInterestAccruedUSD;
  entity.totalDelinquencyFeesAccruedUSD = stats.totalDelinquencyFeesAccruedUSD;
  entity.totalProtocolFeesAccruedUSD = stats.totalProtocolFeesAccruedUSD;
  entity.cumulativeUsdTotalsComplete = stats.usdTotalsComplete;
  entity.numMarkets = stats.numMarkets;
  entity.numActiveMarkets = stats.numActiveMarkets;
  entity.numDelinquentMarkets = stats.numDelinquentMarkets;
  entity.numClosedMarkets = stats.numClosedMarkets;
}

export function getOrCreateBorrowerDailyStats(
  borrower: Bytes,
  timestamp: BigInt,
  stats: BorrowerStats
): BorrowerDailyStats {
  let start = dayTimestamp(timestamp);
  let result = getOrInitializeBorrowerDailyStats(
    "BORROWER-DAILY-" + borrower.toHex() + "-" + start.toString(),
    {
      startTimestamp: start,
      endTimestamp: start + 86400,
      borrower,
      profile: borrower.toHexString(),
      totalDepositedUSD: stats.totalDepositedUSD,
      totalBorrowedUSD: stats.totalBorrowedUSD,
      totalRepaidUSD: stats.totalRepaidUSD,
      totalWithdrawalsRequestedUSD: stats.totalWithdrawalsRequestedUSD,
      totalWithdrawalsExecutedUSD: stats.totalWithdrawalsExecutedUSD,
      totalBaseInterestAccruedUSD: stats.totalBaseInterestAccruedUSD,
      totalDelinquencyFeesAccruedUSD: stats.totalDelinquencyFeesAccruedUSD,
      totalProtocolFeesAccruedUSD: stats.totalProtocolFeesAccruedUSD,
      dayUsdTotalsComplete: true,
      cumulativeUsdTotalsComplete: stats.usdTotalsComplete,
      numMarkets: stats.numMarkets,
      numActiveMarkets: stats.numActiveMarkets,
      numDelinquentMarkets: stats.numDelinquentMarkets,
      numClosedMarkets: stats.numClosedMarkets,
    }
  );
  refreshBorrowerDailyFromStats(result.entity, stats);
  return result.entity;
}

function refreshLenderDailyFromStats(
  entity: LenderDailyStats,
  stats: LenderStats
): void {
  entity.totalDepositedUSD = stats.totalDepositedUSD;
  entity.totalWithdrawalsRequestedUSD = stats.totalWithdrawalsRequestedUSD;
  entity.totalWithdrawalsExecutedUSD = stats.totalWithdrawalsExecutedUSD;
  entity.totalInterestEarnedUSD = stats.totalInterestEarnedUSD;
  entity.cumulativeUsdTotalsComplete = stats.usdTotalsComplete;
  entity.numMarkets = stats.numMarkets;
  entity.numActiveMarkets = stats.numActiveMarkets;
}

export function getOrCreateLenderDailyStats(
  lender: Bytes,
  timestamp: BigInt,
  stats: LenderStats
): LenderDailyStats {
  let start = dayTimestamp(timestamp);
  let result = getOrInitializeLenderDailyStats(
    "LENDER-DAILY-" + lender.toHex() + "-" + start.toString(),
    {
      startTimestamp: start,
      endTimestamp: start + 86400,
      lender,
      totalDepositedUSD: stats.totalDepositedUSD,
      totalWithdrawalsRequestedUSD: stats.totalWithdrawalsRequestedUSD,
      totalWithdrawalsExecutedUSD: stats.totalWithdrawalsExecutedUSD,
      totalInterestEarnedUSD: stats.totalInterestEarnedUSD,
      dayUsdTotalsComplete: true,
      cumulativeUsdTotalsComplete: stats.usdTotalsComplete,
      numMarkets: stats.numMarkets,
      numActiveMarkets: stats.numActiveMarkets,
    }
  );
  refreshLenderDailyFromStats(result.entity, stats);
  return result.entity;
}

function refreshMarketDailyFromMarket(
  entity: MarketDailyStats,
  market: Market
): void {
  entity.scaledTotalSupply = market.scaledTotalSupply;
  entity.scaleFactor = market.scaleFactor;
  entity.totalBorrowed = market.totalBorrowed;
  entity.totalRepaid = market.totalRepaid;
  entity.totalBaseInterestAccrued = market.totalBaseInterestAccrued;
  entity.totalDelinquencyFeesAccrued = market.totalDelinquencyFeesAccrued;
  entity.totalProtocolFeesAccrued = market.totalProtocolFeesAccrued;
  entity.totalDeposited = market.totalDeposited;
  entity.totalWithdrawalsRequested = market.totalWithdrawalsRequested;
  entity.totalWithdrawalsExecuted = market.totalWithdrawalsExecuted;
  entity.totalBorrowedUSD = market.totalBorrowedUSD;
  entity.totalRepaidUSD = market.totalRepaidUSD;
  entity.totalBaseInterestAccruedUSD = market.totalBaseInterestAccruedUSD;
  entity.totalDelinquencyFeesAccruedUSD = market.totalDelinquencyFeesAccruedUSD;
  entity.totalProtocolFeesAccruedUSD = market.totalProtocolFeesAccruedUSD;
  entity.totalDepositedUSD = market.totalDepositedUSD;
  entity.totalWithdrawalsRequestedUSD = market.totalWithdrawalsRequestedUSD;
  entity.totalWithdrawalsExecutedUSD = market.totalWithdrawalsExecutedUSD;
  entity.cumulativeUsdTotalsComplete = market.usdTotalsComplete;
}

export function getOrCreateMarketDailyStats(
  market: Market,
  event: ethereum.Event
): MarketDailyStats {
  let start = dayTimestamp(event.block.timestamp);
  let dailyPrice = ensureTokenDailyPrice(market.asset, event);
  let usdPrice: BigDecimal | null = null;
  if (dailyPrice) {
    market.tokenDailyPrice = dailyPrice.id;
    usdPrice = dailyPrice.priceUSD;
  }
  let result = getOrInitializeMarketDailyStats(
    market.id + "-" + start.toString(),
    {
      startTimestamp: start,
      endTimestamp: start + 86400,
      market: market.id,
      scaledTotalSupply: market.scaledTotalSupply,
      scaleFactor: market.scaleFactor,
      usdPrice,
      totalBorrowed: market.totalBorrowed,
      totalRepaid: market.totalRepaid,
      totalBaseInterestAccrued: market.totalBaseInterestAccrued,
      totalDelinquencyFeesAccrued: market.totalDelinquencyFeesAccrued,
      totalProtocolFeesAccrued: market.totalProtocolFeesAccrued,
      totalDeposited: market.totalDeposited,
      totalWithdrawalsRequested: market.totalWithdrawalsRequested,
      totalWithdrawalsExecuted: market.totalWithdrawalsExecuted,
      totalBorrowedUSD: market.totalBorrowedUSD,
      totalRepaidUSD: market.totalRepaidUSD,
      totalBaseInterestAccruedUSD: market.totalBaseInterestAccruedUSD,
      totalDelinquencyFeesAccruedUSD: market.totalDelinquencyFeesAccruedUSD,
      totalProtocolFeesAccruedUSD: market.totalProtocolFeesAccruedUSD,
      totalDepositedUSD: market.totalDepositedUSD,
      totalWithdrawalsRequestedUSD: market.totalWithdrawalsRequestedUSD,
      totalWithdrawalsExecutedUSD: market.totalWithdrawalsExecutedUSD,
      dayUsdTotalsComplete: true,
      cumulativeUsdTotalsComplete: market.usdTotalsComplete,
    }
  );
  result.entity.usdPrice = usdPrice;
  refreshMarketDailyFromMarket(result.entity, market);
  return result.entity;
}

export function markProtocolUsdIncomplete(
  stats: ProtocolStats,
  daily: ProtocolDailyStats
): void {
  stats.usdTotalsComplete = false;
  daily.dayUsdTotalsComplete = false;
  daily.cumulativeUsdTotalsComplete = false;
}

export function markBorrowerUsdIncomplete(
  stats: BorrowerStats,
  daily: BorrowerDailyStats
): void {
  stats.usdTotalsComplete = false;
  daily.dayUsdTotalsComplete = false;
  daily.cumulativeUsdTotalsComplete = false;
}

export function markLenderUsdIncomplete(
  stats: LenderStats,
  daily: LenderDailyStats
): void {
  stats.usdTotalsComplete = false;
  daily.dayUsdTotalsComplete = false;
  daily.cumulativeUsdTotalsComplete = false;
}

export function markMarketUsdIncomplete(
  market: Market,
  daily: MarketDailyStats
): void {
  market.usdTotalsComplete = false;
  daily.dayUsdTotalsComplete = false;
  daily.cumulativeUsdTotalsComplete = false;
}

// -------------------------------------------------------------------------- //
//                     Active market count transitions                        //
// -------------------------------------------------------------------------- //

/**
 * On zero↔nonzero transitions of a lender's scaledBalance:
 * adjusts LenderStats.numActiveMarkets, ProtocolStats.numActiveLenders,
 * and ProtocolStats.numActiveLenderAccounts.
 *
 * Does NOT save the entities — caller must save ls and ps after all mutations.
 */
export function updateLenderActiveMarketCount(
  ls: LenderStats,
  ps: ProtocolStats,
  prevBalance: BigInt,
  newBalance: BigInt
): void {
  let wasZero = prevBalance.isZero();
  let isZero = newBalance.isZero();
  if (wasZero == isZero) return;

  if (wasZero && !isZero) {
    ls.numActiveMarkets = ls.numActiveMarkets + 1;
    ps.numActiveLenderAccounts = ps.numActiveLenderAccounts + 1;
    if (ls.numActiveMarkets == 1) {
      ps.numActiveLenders = ps.numActiveLenders + 1;
    }
  } else {
    ls.numActiveMarkets = ls.numActiveMarkets - 1;
    ps.numActiveLenderAccounts = ps.numActiveLenderAccounts - 1;
    if (ls.numActiveMarkets == 0) {
      ps.numActiveLenders = ps.numActiveLenders - 1;
    }
  }
}

/**
 * On zero↔nonzero transitions of scaledTotalSupply on non-closed markets,
 * or on market close with nonzero supply:
 * adjusts BorrowerStats.numActiveMarkets and ProtocolStats.numActiveBorrowers.
 *
 * Does NOT save the entities — caller must save bs and ps after all mutations.
 */
export function updateBorrowerActiveMarketCount(
  bs: BorrowerStats,
  ps: ProtocolStats,
  prevSupply: BigInt,
  newSupply: BigInt,
  wasClosed: boolean,
  isClosed: boolean
): void {
  let wasActive = !prevSupply.isZero() && !wasClosed;
  let isActive = !newSupply.isZero() && !isClosed;
  if (wasActive == isActive) return;

  if (!wasActive && isActive) {
    ps.numActiveMarkets = ps.numActiveMarkets + 1;
    bs.numActiveMarkets = bs.numActiveMarkets + 1;
    if (bs.numActiveMarkets == 1) {
      ps.numActiveBorrowers = ps.numActiveBorrowers + 1;
    }
  } else {
    ps.numActiveMarkets = ps.numActiveMarkets - 1;
    bs.numActiveMarkets = bs.numActiveMarkets - 1;
    if (bs.numActiveMarkets == 0) {
      ps.numActiveBorrowers = ps.numActiveBorrowers - 1;
    }
  }
}
