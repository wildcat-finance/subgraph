import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { LenderAccount, Market, WithdrawalBatch } from "../generated/schema";

export function generateEventId(event: ethereum.Event): string {
  return event.transaction.hash
    .toHex()
    .concat("-")
    .concat(event.logIndex.toString());
}

export function generateMarketEventId(market: Market): string {
  return "RECORD" + "-" + market.id + "-" + market.eventIndex.toString()
}

export function rayDiv(a: BigInt, b: BigInt): BigInt {
  let halfB = b.div(BigInt.fromI32(2));
  let numerator = a.times(BigInt.fromI32(10).pow(27)).plus(halfB);
  return numerator.div(b);
}

export function rayMul(a: BigInt, b: BigInt): BigInt {
  let halfRay = BigInt.fromI32(10)
    .pow(27)
    .div(BigInt.fromI32(2));
  let numerator = a.times(b).plus(halfRay);
  return numerator.div(BigInt.fromI32(10).pow(27));
}

export function bipMul(a: BigInt, b: BigInt): BigInt {
  let halfBip = BigInt.fromI32(10)
    .pow(4)
    .div(BigInt.fromI32(2));
  let numerator = a.times(b).plus(halfBip);
  return numerator.div(BigInt.fromI32(10).pow(4));
}

export function calculateLiquidityRequired(market: Market): BigInt {
  let scaledWithdrawals = market.scaledPendingWithdrawals;
  let scaledRequiredReserves = bipMul(
    market.scaledTotalSupply.minus(scaledWithdrawals),
    BigInt.fromI32(market.reserveRatioBips)
  ).plus(scaledWithdrawals);
  return rayMul(scaledRequiredReserves, market.scaleFactor)
    .plus(market.pendingProtocolFees)
    .plus(market.normalizedUnclaimedWithdrawals);
}

export function calculateNormalizedBalance(
  lender: LenderAccount,
  market: Market
): BigInt {
  return rayMul(lender.scaledBalance, market.scaleFactor);
}

export function calculateInterestEarned(
  lender: LenderAccount,
  market: Market
): BigInt {
  if (lender.lastScaleFactor.equals(market.scaleFactor)) {
    return BigInt.fromI32(0);
  }
  let lastBalance = rayMul(lender.scaledBalance, lender.lastScaleFactor);
  let currentBalance = rayMul(lender.scaledBalance, market.scaleFactor);
  return currentBalance.minus(lastBalance);
}

export function calculateBatchInterestEarned(
  batch: WithdrawalBatch,
  market: Market
): BigInt {
  let scaledAmountOwed = batch.scaledTotalAmount.minus(
    batch.scaledAmountBurned
  );
  if (
    scaledAmountOwed.equals(BigInt.zero()) ||
    batch.lastScaleFactor.equals(market.scaleFactor)
  ) {
    return BigInt.fromI32(0);
  }
  let lastBalance = rayMul(scaledAmountOwed, batch.lastScaleFactor);
  let currentBalance = rayMul(scaledAmountOwed, market.scaleFactor);
  return currentBalance.minus(lastBalance);
}

export function satSub(a: BigInt, b: BigInt): BigInt {
  if (a.gt(b)) {
    return BigInt.zero();
  }
  return a.minus(b);
}

export function isNullAddress(address: Address): bool {
  return address.equals(Address.zero());
}