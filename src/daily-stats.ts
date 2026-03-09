import { BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ProtocolStats,
  BorrowerStats,
  LenderStats,
  ProtocolDailyStats,
  BorrowerDailyStats,
  LenderDailyStats,
  Token,
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

// -------------------------------------------------------------------------- //
//                            Price helpers                                    //
// -------------------------------------------------------------------------- //

/**
 * Returns the USD multiplier for 1 whole token unit, or BigDecimal.zero() if
 * no price is available. Call once per handler, then multiply by individual
 * amounts to avoid repeated Token.load + ensureTokenDailyPrice calls.
 */
export function getTokenPriceMultiplier(
  decimals: i32,
  tokenId: string,
  timestamp: BigInt
): BigDecimal {
  let token = Token.load(tokenId);
  if (token == null) return BigDecimal.zero();

  let priceValue: BigDecimal;
  if (token.isUsdStablecoin) {
    priceValue = new BigDecimal(BigInt.fromI32(1));
  } else {
    let daily = ensureTokenDailyPrice(tokenId, timestamp);
    if (daily == null) return BigDecimal.zero();
    priceValue = daily.priceUSD;
  }

  let divisor = BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal();
  // multiplier = priceUSD / 10^decimals
  return priceValue.div(divisor);
}

/** Converts a raw token amount to USD using a pre-computed multiplier. */
export function amountToUSD(amount: BigInt, multiplier: BigDecimal): BigDecimal {
  return amount.toBigDecimal().times(multiplier);
}

/**
 * Returns USD value of a token amount, or BigDecimal.zero() if no price.
 * Convenience wrapper — prefer getTokenPriceMultiplier + amountToUSD when
 * converting multiple amounts with the same token in one handler.
 */
export function computeUsdDelta(
  amount: BigInt,
  decimals: i32,
  tokenId: string,
  timestamp: BigInt
): BigDecimal {
  let m = getTokenPriceMultiplier(decimals, tokenId, timestamp);
  if (m.equals(BigDecimal.zero())) return BigDecimal.zero();
  return amount.toBigDecimal().times(m);
}

// -------------------------------------------------------------------------- //
//                         Singleton get-or-create                            //
// -------------------------------------------------------------------------- //

export function getOrCreateProtocolStats(): ProtocolStats {
  let id = generateProtocolStatsId();
  return getOrInitializeProtocolStats(id, {}).entity;
}

export function getOrCreateBorrowerStats(borrower: Bytes): BorrowerStats {
  let id = generateBorrowerStatsId(borrower);
  return getOrInitializeBorrowerStats(id, {
    borrower,
  }).entity;
}

export function getOrCreateLenderStats(lender: Bytes, timestamp: BigInt): LenderStats {
  let id = generateLenderStatsId(lender);
  return getOrInitializeLenderStats(id, {
    lender,
    firstSeenTimestamp: timestamp.toI32(),
  }).entity;
}

// -------------------------------------------------------------------------- //
//                           Daily snapshot helpers                           //
// -------------------------------------------------------------------------- //

function dayTimestamp(timestamp: BigInt): i32 {
  return (timestamp.toI32() / 86400) * 86400;
}

export function refreshProtocolDailyFromStats(entity: ProtocolDailyStats, ps: ProtocolStats): void {
  entity.totalDepositedUSD = ps.totalDepositedUSD;
  entity.totalBorrowedUSD = ps.totalBorrowedUSD;
  entity.totalRepaidUSD = ps.totalRepaidUSD;
  entity.totalWithdrawalsRequestedUSD = ps.totalWithdrawalsRequestedUSD;
  entity.totalWithdrawalsExecutedUSD = ps.totalWithdrawalsExecutedUSD;
  entity.totalBaseInterestAccruedUSD = ps.totalBaseInterestAccruedUSD;
  entity.totalDelinquencyFeesAccruedUSD = ps.totalDelinquencyFeesAccruedUSD;
  entity.totalProtocolFeesAccruedUSD = ps.totalProtocolFeesAccruedUSD;
  entity.numMarkets = ps.numMarkets;
  entity.numActiveMarkets = ps.numActiveMarkets;
  entity.numDelinquentMarkets = ps.numDelinquentMarkets;
  entity.numClosedMarkets = ps.numClosedMarkets;
  entity.numActiveBorrowers = ps.numActiveBorrowers;
  entity.numActiveLenders = ps.numActiveLenders;
  entity.numActiveLenderAccounts = ps.numActiveLenderAccounts;
}

export function getOrCreateProtocolDailyStats(timestamp: BigInt, ps: ProtocolStats): ProtocolDailyStats {
  let startOfDay = dayTimestamp(timestamp);
  let id = "PROTOCOL-" + startOfDay.toString();
  let result = getOrInitializeProtocolDailyStats(id, {
    startTimestamp: startOfDay,
    endTimestamp: startOfDay + 86400,
    totalDepositedUSD: ps.totalDepositedUSD,
    totalBorrowedUSD: ps.totalBorrowedUSD,
    totalRepaidUSD: ps.totalRepaidUSD,
    totalWithdrawalsRequestedUSD: ps.totalWithdrawalsRequestedUSD,
    totalWithdrawalsExecutedUSD: ps.totalWithdrawalsExecutedUSD,
    totalBaseInterestAccruedUSD: ps.totalBaseInterestAccruedUSD,
    totalDelinquencyFeesAccruedUSD: ps.totalDelinquencyFeesAccruedUSD,
    totalProtocolFeesAccruedUSD: ps.totalProtocolFeesAccruedUSD,
    numActiveBorrowers: ps.numActiveBorrowers,
    numActiveLenderAccounts: ps.numActiveLenderAccounts,
    numActiveLenders: ps.numActiveLenders,
    numActiveMarkets: ps.numActiveMarkets,
    numDelinquentMarkets: ps.numDelinquentMarkets,
    numClosedMarkets: ps.numClosedMarkets,
    numMarkets: ps.numMarkets,
  });
  if (!result.wasCreated) {
    result.entity.totalDepositedUSD = ps.totalDepositedUSD;
    result.entity.totalBorrowedUSD = ps.totalBorrowedUSD;
    result.entity.totalRepaidUSD = ps.totalRepaidUSD;
    result.entity.totalWithdrawalsRequestedUSD = ps.totalWithdrawalsRequestedUSD;
    result.entity.totalWithdrawalsExecutedUSD = ps.totalWithdrawalsExecutedUSD;
    result.entity.totalBaseInterestAccruedUSD = ps.totalBaseInterestAccruedUSD;
    result.entity.totalDelinquencyFeesAccruedUSD = ps.totalDelinquencyFeesAccruedUSD;
    result.entity.totalProtocolFeesAccruedUSD = ps.totalProtocolFeesAccruedUSD;
    result.entity.numActiveBorrowers = ps.numActiveBorrowers;
    result.entity.numActiveLenderAccounts = ps.numActiveLenderAccounts;
    result.entity.numActiveLenders = ps.numActiveLenders;
    result.entity.numActiveMarkets = ps.numActiveMarkets;
    result.entity.numDelinquentMarkets = ps.numDelinquentMarkets;
    result.entity.numClosedMarkets = ps.numClosedMarkets;
    result.entity.numMarkets = ps.numMarkets;
  }
  return result.entity;
}

export function getOrCreateBorrowerDailyStats(borrower: Bytes, timestamp: BigInt, bs: BorrowerStats): BorrowerDailyStats {
  let startOfDay = dayTimestamp(timestamp);
  let id = "BORROWER-DAILY-" + borrower.toHex() + "-" + startOfDay.toString();

  let result = getOrInitializeBorrowerDailyStats(id, {
    startTimestamp: startOfDay,
    endTimestamp: startOfDay + 86400,
    borrower: borrower,
    numMarkets: bs.numMarkets,
    numActiveMarkets: bs.numActiveMarkets,
    numDelinquentMarkets: bs.numDelinquentMarkets,
    numClosedMarkets: bs.numClosedMarkets,
    totalBaseInterestAccruedUSD: bs.totalBaseInterestAccruedUSD,
    totalDelinquencyFeesAccruedUSD: bs.totalDelinquencyFeesAccruedUSD,
    totalProtocolFeesAccruedUSD: bs.totalProtocolFeesAccruedUSD,
    totalDepositedUSD: bs.totalDepositedUSD,
    totalBorrowedUSD: bs.totalBorrowedUSD,
    totalRepaidUSD: bs.totalRepaidUSD,
    totalWithdrawalsRequestedUSD: bs.totalWithdrawalsRequestedUSD,
    totalWithdrawalsExecutedUSD: bs.totalWithdrawalsExecutedUSD,
  });
  if (!result.wasCreated) {
    result.entity.numMarkets = bs.numMarkets;
    result.entity.numActiveMarkets = bs.numActiveMarkets;
    result.entity.numDelinquentMarkets = bs.numDelinquentMarkets;
    result.entity.numClosedMarkets = bs.numClosedMarkets;
    result.entity.totalBaseInterestAccruedUSD = bs.totalBaseInterestAccruedUSD;
    result.entity.totalDelinquencyFeesAccruedUSD = bs.totalDelinquencyFeesAccruedUSD;
    result.entity.totalProtocolFeesAccruedUSD = bs.totalProtocolFeesAccruedUSD;
    result.entity.totalDepositedUSD = bs.totalDepositedUSD;
    result.entity.totalBorrowedUSD = bs.totalBorrowedUSD;
    result.entity.totalRepaidUSD = bs.totalRepaidUSD;
    result.entity.totalWithdrawalsRequestedUSD = bs.totalWithdrawalsRequestedUSD;
    result.entity.totalWithdrawalsExecutedUSD = bs.totalWithdrawalsExecutedUSD;
  }

  return result.entity;
}

export function getOrCreateLenderDailyStats(lender: Bytes, timestamp: BigInt, ls: LenderStats): LenderDailyStats {
  let startOfDay = dayTimestamp(timestamp);
  let id = "LENDER-DAILY-" + lender.toHex() + "-" + startOfDay.toString();

  let result = getOrInitializeLenderDailyStats(id, {
    startTimestamp: startOfDay,
    endTimestamp: startOfDay + 86400,
    lender: lender,
    numMarkets: ls.numMarkets,
    numActiveMarkets: ls.numActiveMarkets,
    totalDepositedUSD: ls.totalDepositedUSD,
    totalWithdrawalsRequestedUSD: ls.totalWithdrawalsRequestedUSD,
    totalWithdrawalsExecutedUSD: ls.totalWithdrawalsExecutedUSD,
    totalInterestEarnedUSD: ls.totalInterestEarnedUSD,
  });
  if (!result.wasCreated) {
    result.entity.numMarkets = ls.numMarkets;
    result.entity.numActiveMarkets = ls.numActiveMarkets;
    result.entity.totalDepositedUSD = ls.totalDepositedUSD;
    result.entity.totalWithdrawalsRequestedUSD = ls.totalWithdrawalsRequestedUSD;
    result.entity.totalWithdrawalsExecutedUSD = ls.totalWithdrawalsExecutedUSD;
    result.entity.totalInterestEarnedUSD = ls.totalInterestEarnedUSD;
  }

  return result.entity;
}

export function getOrCreateMarketDailyStats(market: Market, timestamp: BigInt): MarketDailyStats {
  let startOfDay = dayTimestamp(timestamp);
  let id = market.id.concat("-").concat(startOfDay.toString());
  let dailyPrice = ensureTokenDailyPrice(market.asset, timestamp);
  if (dailyPrice != null) {
    market.tokenDailyPrice = dailyPrice.id;
  }
  let usdPrice: BigDecimal | null = null;
  if (dailyPrice != null) {
    usdPrice = dailyPrice.priceUSD;
  }
  let result = getOrInitializeMarketDailyStats(id, {
    startTimestamp: startOfDay,
    endTimestamp: startOfDay + 86400,
    market: market.id,
    scaledTotalSupply: market.scaledTotalSupply,
    scaleFactor: market.scaleFactor,
    usdPrice: usdPrice,
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
  });
  if (!result.wasCreated) {
    result.entity.scaledTotalSupply = market.scaledTotalSupply;
    result.entity.scaleFactor = market.scaleFactor;
    result.entity.totalBorrowed = market.totalBorrowed;
    result.entity.totalRepaid = market.totalRepaid;
    result.entity.totalBaseInterestAccrued = market.totalBaseInterestAccrued;
    result.entity.totalDelinquencyFeesAccrued = market.totalDelinquencyFeesAccrued;
    result.entity.totalProtocolFeesAccrued = market.totalProtocolFeesAccrued;
    result.entity.totalDeposited = market.totalDeposited;
    result.entity.totalWithdrawalsRequested = market.totalWithdrawalsRequested;
    result.entity.totalWithdrawalsExecuted = market.totalWithdrawalsExecuted;
    result.entity.totalBorrowedUSD = market.totalBorrowedUSD;
    result.entity.totalRepaidUSD = market.totalRepaidUSD;
    result.entity.totalBaseInterestAccruedUSD = market.totalBaseInterestAccruedUSD;
    result.entity.totalDelinquencyFeesAccruedUSD = market.totalDelinquencyFeesAccruedUSD;
    result.entity.totalProtocolFeesAccruedUSD = market.totalProtocolFeesAccruedUSD;
    result.entity.totalDepositedUSD = market.totalDepositedUSD;
    result.entity.totalWithdrawalsRequestedUSD = market.totalWithdrawalsRequestedUSD;
    result.entity.totalWithdrawalsExecutedUSD = market.totalWithdrawalsExecutedUSD;
  }

  return result.entity;
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
