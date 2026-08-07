import { BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  BorrowerDailyStats,
  BorrowerStats,
  LenderDailyStats,
  LenderStats,
  Market,
  MarketDailyStats,
  ProtocolDailyStats,
  ProtocolStats,
} from "../generated/schema";
import {
  generateBorrowerStatsId,
  generateLenderStatsId,
  generateProtocolStatsId,
  getOrInitializeBorrowerDailyStats,
  getOrInitializeBorrowerStats,
  getOrInitializeLenderDailyStats,
  getOrInitializeLenderStats,
  getOrInitializeMarketDailyStats,
  getOrInitializeProtocolDailyStats,
  getOrInitializeProtocolStats,
} from "../generated/UncrashableEntityHelpers";
import {
  ensureTokenDailyPrice,
  getTokenPriceMultiplier,
  getTokenPriceUSD,
  amountToUSD,
} from "./price-feeds";
import { calculateTotalDebt } from "./utils";

function dayTimestamp(timestamp: BigInt): i32 {
  return (timestamp.toI32() / 86400) * 86400;
}

export function getOrCreateProtocolStats(): ProtocolStats {
  return getOrInitializeProtocolStats(generateProtocolStatsId(), {
    usdTotalsComplete: true,
  }).entity;
}

export function getOrCreateBorrowerStats(borrower: Bytes): BorrowerStats {
  return getOrInitializeBorrowerStats(generateBorrowerStatsId(borrower), {
    borrower,
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

function refreshProtocolDaily(
  daily: ProtocolDailyStats,
  stats: ProtocolStats
): void {
  daily.totalDepositedUSD = stats.totalDepositedUSD;
  daily.totalBorrowedUSD = stats.totalBorrowedUSD;
  daily.totalRepaidUSD = stats.totalRepaidUSD;
  daily.totalWithdrawalsRequestedUSD = stats.totalWithdrawalsRequestedUSD;
  daily.totalWithdrawalsExecutedUSD = stats.totalWithdrawalsExecutedUSD;
  daily.totalBaseInterestAccruedUSD = stats.totalBaseInterestAccruedUSD;
  daily.totalDelinquencyFeesAccruedUSD =
    stats.totalDelinquencyFeesAccruedUSD;
  daily.totalProtocolFeesAccruedUSD = stats.totalProtocolFeesAccruedUSD;
  daily.cumulativeUsdTotalsComplete = stats.usdTotalsComplete;
  daily.numMarkets = stats.numMarkets;
  daily.numActiveMarkets = stats.numActiveMarkets;
  daily.numDelinquentMarkets = stats.numDelinquentMarkets;
  daily.numClosedMarkets = stats.numClosedMarkets;
  daily.numActiveBorrowers = stats.numActiveBorrowers;
  daily.numActiveLenders = stats.numActiveLenders;
  daily.numActiveLenderAccounts = stats.numActiveLenderAccounts;
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
      totalDelinquencyFeesAccruedUSD:
        stats.totalDelinquencyFeesAccruedUSD,
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
  refreshProtocolDaily(result.entity, stats);
  return result.entity;
}

function refreshBorrowerDaily(
  daily: BorrowerDailyStats,
  stats: BorrowerStats
): void {
  daily.totalDepositedUSD = stats.totalDepositedUSD;
  daily.totalBorrowedUSD = stats.totalBorrowedUSD;
  daily.totalRepaidUSD = stats.totalRepaidUSD;
  daily.totalWithdrawalsRequestedUSD = stats.totalWithdrawalsRequestedUSD;
  daily.totalWithdrawalsExecutedUSD = stats.totalWithdrawalsExecutedUSD;
  daily.totalBaseInterestAccruedUSD = stats.totalBaseInterestAccruedUSD;
  daily.totalDelinquencyFeesAccruedUSD =
    stats.totalDelinquencyFeesAccruedUSD;
  daily.totalProtocolFeesAccruedUSD = stats.totalProtocolFeesAccruedUSD;
  daily.cumulativeUsdTotalsComplete = stats.usdTotalsComplete;
  daily.numMarkets = stats.numMarkets;
  daily.numActiveMarkets = stats.numActiveMarkets;
  daily.numDelinquentMarkets = stats.numDelinquentMarkets;
  daily.numClosedMarkets = stats.numClosedMarkets;
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
      borrower,
      startTimestamp: start,
      endTimestamp: start + 86400,
      totalDepositedUSD: stats.totalDepositedUSD,
      totalBorrowedUSD: stats.totalBorrowedUSD,
      totalRepaidUSD: stats.totalRepaidUSD,
      totalWithdrawalsRequestedUSD: stats.totalWithdrawalsRequestedUSD,
      totalWithdrawalsExecutedUSD: stats.totalWithdrawalsExecutedUSD,
      totalBaseInterestAccruedUSD: stats.totalBaseInterestAccruedUSD,
      totalDelinquencyFeesAccruedUSD:
        stats.totalDelinquencyFeesAccruedUSD,
      totalProtocolFeesAccruedUSD: stats.totalProtocolFeesAccruedUSD,
      dayUsdTotalsComplete: true,
      cumulativeUsdTotalsComplete: stats.usdTotalsComplete,
      numMarkets: stats.numMarkets,
      numActiveMarkets: stats.numActiveMarkets,
      numDelinquentMarkets: stats.numDelinquentMarkets,
      numClosedMarkets: stats.numClosedMarkets,
    }
  );
  refreshBorrowerDaily(result.entity, stats);
  return result.entity;
}

function refreshLenderDaily(
  daily: LenderDailyStats,
  stats: LenderStats
): void {
  daily.totalDepositedUSD = stats.totalDepositedUSD;
  daily.totalWithdrawalsRequestedUSD = stats.totalWithdrawalsRequestedUSD;
  daily.totalWithdrawalsExecutedUSD = stats.totalWithdrawalsExecutedUSD;
  daily.totalInterestEarnedUSD = stats.totalInterestEarnedUSD;
  daily.cumulativeUsdTotalsComplete = stats.usdTotalsComplete;
  daily.numMarkets = stats.numMarkets;
  daily.numActiveMarkets = stats.numActiveMarkets;
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
      lender,
      startTimestamp: start,
      endTimestamp: start + 86400,
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
  refreshLenderDaily(result.entity, stats);
  return result.entity;
}

function refreshMarketDaily(daily: MarketDailyStats, market: Market): void {
  daily.cumulativeDeposited = market.totalDeposited;
  daily.cumulativeWithdrawalsRequested = market.totalWithdrawalsRequested;
  daily.cumulativeWithdrawalsExecuted = market.totalWithdrawalsExecuted;
  daily.cumulativeBorrowed = market.totalBorrowed;
  daily.cumulativeRepaid = market.totalRepaid;
  daily.cumulativeBaseInterestAccrued = market.totalBaseInterestAccrued;
  daily.cumulativeDelinquencyFeesAccrued =
    market.totalDelinquencyFeesAccrued;
  daily.cumulativeProtocolFeesAccrued = market.totalProtocolFeesAccrued;
  daily.cumulativeDepositedUSD = market.totalDepositedUSD;
  daily.cumulativeWithdrawalsRequestedUSD =
    market.totalWithdrawalsRequestedUSD;
  daily.cumulativeWithdrawalsExecutedUSD =
    market.totalWithdrawalsExecutedUSD;
  daily.cumulativeBorrowedUSD = market.totalBorrowedUSD;
  daily.cumulativeRepaidUSD = market.totalRepaidUSD;
  daily.cumulativeBaseInterestAccruedUSD =
    market.totalBaseInterestAccruedUSD;
  daily.cumulativeDelinquencyFeesAccruedUSD =
    market.totalDelinquencyFeesAccruedUSD;
  daily.cumulativeProtocolFeesAccruedUSD = market.totalProtocolFeesAccruedUSD;
  daily.cumulativeUsdTotalsComplete = market.usdTotalsComplete;
  daily.scaledTotalSupply = market.scaledTotalSupply;
  daily.scaleFactor = market.scaleFactor;
}

export function getOrCreateMarketDailyStats(
  market: Market,
  timestamp: BigInt
): MarketDailyStats {
  let start = dayTimestamp(timestamp);
  let dailyPrice = ensureTokenDailyPrice(market.asset, timestamp);
  if (dailyPrice) {
    market.tokenDailyPrice = dailyPrice.id;
  }
  let priceUSD = getTokenPriceUSD(market.asset, timestamp);
  let result = getOrInitializeMarketDailyStats(
    market.id + "-" + start.toString(),
    {
      startTimestamp: start,
      endTimestamp: start + 86400,
      market: market.id,
      cumulativeDeposited: market.totalDeposited,
      cumulativeWithdrawalsRequested: market.totalWithdrawalsRequested,
      cumulativeWithdrawalsExecuted: market.totalWithdrawalsExecuted,
      cumulativeBorrowed: market.totalBorrowed,
      cumulativeRepaid: market.totalRepaid,
      cumulativeBaseInterestAccrued: market.totalBaseInterestAccrued,
      cumulativeDelinquencyFeesAccrued:
        market.totalDelinquencyFeesAccrued,
      cumulativeProtocolFeesAccrued: market.totalProtocolFeesAccrued,
      cumulativeDepositedUSD: market.totalDepositedUSD,
      cumulativeWithdrawalsRequestedUSD:
        market.totalWithdrawalsRequestedUSD,
      cumulativeWithdrawalsExecutedUSD:
        market.totalWithdrawalsExecutedUSD,
      cumulativeBorrowedUSD: market.totalBorrowedUSD,
      cumulativeRepaidUSD: market.totalRepaidUSD,
      cumulativeBaseInterestAccruedUSD:
        market.totalBaseInterestAccruedUSD,
      cumulativeDelinquencyFeesAccruedUSD:
        market.totalDelinquencyFeesAccruedUSD,
      cumulativeProtocolFeesAccruedUSD: market.totalProtocolFeesAccruedUSD,
      cumulativeUsdTotalsComplete: market.usdTotalsComplete,
      scaledTotalSupply: market.scaledTotalSupply,
      scaleFactor: market.scaleFactor,
    }
  );
  result.entity.usdPrice = priceUSD;
  refreshMarketDaily(result.entity, market);
  return result.entity;
}

export function updateMarketTotalDebtUSD(
  market: Market,
  timestamp: BigInt
): void {
  let multiplier = getTokenPriceMultiplier(
    market.decimals,
    market.asset,
    timestamp
  );
  if (!multiplier) {
    market.totalDebtUSD = null;
    return;
  }
  market.totalDebtUSD = amountToUSD(
    calculateTotalDebt(market),
    multiplier as BigDecimal
  );
}

export function updateLenderActiveMarketCount(
  stats: LenderStats,
  protocol: ProtocolStats,
  previousBalance: BigInt,
  nextBalance: BigInt
): void {
  let wasActive = !previousBalance.isZero();
  let isActive = !nextBalance.isZero();
  if (wasActive == isActive) return;

  if (isActive) {
    stats.numActiveMarkets = stats.numActiveMarkets + 1;
    protocol.numActiveLenderAccounts = protocol.numActiveLenderAccounts + 1;
    if (stats.numActiveMarkets == 1) {
      protocol.numActiveLenders = protocol.numActiveLenders + 1;
    }
  } else {
    stats.numActiveMarkets = stats.numActiveMarkets - 1;
    protocol.numActiveLenderAccounts = protocol.numActiveLenderAccounts - 1;
    if (stats.numActiveMarkets == 0) {
      protocol.numActiveLenders = protocol.numActiveLenders - 1;
    }
  }
}

export function updateBorrowerActiveMarketCount(
  stats: BorrowerStats,
  protocol: ProtocolStats,
  previousSupply: BigInt,
  nextSupply: BigInt,
  wasClosed: boolean,
  isClosed: boolean
): void {
  let wasActive = !previousSupply.isZero() && !wasClosed;
  let isActive = !nextSupply.isZero() && !isClosed;
  if (wasActive == isActive) return;

  if (isActive) {
    protocol.numActiveMarkets = protocol.numActiveMarkets + 1;
    stats.numActiveMarkets = stats.numActiveMarkets + 1;
    if (stats.numActiveMarkets == 1) {
      protocol.numActiveBorrowers = protocol.numActiveBorrowers + 1;
    }
  } else {
    protocol.numActiveMarkets = protocol.numActiveMarkets - 1;
    stats.numActiveMarkets = stats.numActiveMarkets - 1;
    if (stats.numActiveMarkets == 0) {
      protocol.numActiveBorrowers = protocol.numActiveBorrowers - 1;
    }
  }
}

export function recordMarketCreated(borrower: Bytes, timestamp: BigInt): void {
  let protocol = getOrCreateProtocolStats();
  let borrowerStats = getOrCreateBorrowerStats(borrower);
  protocol.numMarkets = protocol.numMarkets + 1;
  borrowerStats.numMarkets = borrowerStats.numMarkets + 1;

  let protocolDaily = getOrCreateProtocolDailyStats(timestamp, protocol);
  let borrowerDaily = getOrCreateBorrowerDailyStats(
    borrower,
    timestamp,
    borrowerStats
  );
  protocol.save();
  borrowerStats.save();
  protocolDaily.save();
  borrowerDaily.save();
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
