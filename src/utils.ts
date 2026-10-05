import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { LenderAccount, LenderHooksAccess, Market, WithdrawalBatch } from "../generated/schema";
import { generateLenderAccountId, generateLenderAuthorizationId, generateLenderHooksAccessId, GetOrCreateReturn, getOrInitializeLenderAccount, getOrInitializeLenderAuthorization } from "../generated/UncrashableEntityHelpers";
import { createInitialLenderAccountSnapshot } from "./lender-account-domain";

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

export function rayDivDown(a: BigInt, b: BigInt): BigInt {
  return a.times(BigInt.fromI32(10).pow(27)).div(b);
}

export function rayMul(a: BigInt, b: BigInt): BigInt {
  return normalizeWithRemainder(a, b, null);
}

export function normalizeWithRemainder(
  scaledAmount: BigInt,
  scaleFactor: BigInt,
  remainder: BigInt | null
): BigInt {
  let halfRay = BigInt.fromI32(10)
    .pow(27)
    .div(BigInt.fromI32(2));
  let numerator = scaledAmount.times(scaleFactor).plus(halfRay);
  if (remainder !== null) numerator = numerator.plus(remainder);
  return numerator.div(BigInt.fromI32(10).pow(27));
}

export function isMarketIncurringPenalties(market: Market, timestamp: BigInt): boolean {
  if (market.isClosed) return false;
  let date = market.repaymentDate;
  return market.timeDelinquent > market.delinquencyGracePeriod ||
    (date !== null && date.gt(BigInt.zero()) && timestamp.ge(date) && market.isDelinquent);
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
  let reserveRatioBips = BigInt.fromI32(market.reserveRatioBips);
  let normalizedSupplyRequired: BigInt;

  // legacy markets apply the reserve ratio before normalization. v2.5 applies
  // it to normalized outstanding supply to match MarketState.liquidityRequired.
  if (market.eventGeneration == "V2_5") {
    let normalizedWithdrawals = normalizeWithRemainder(
      scaledWithdrawals, market.scaleFactor, market.withdrawalRemainder
    );
    let normalizedOutstandingSupply = normalizeWithRemainder(
      market.scaledTotalSupply, market.scaleFactor, market.withdrawalRemainder
    ).minus(normalizedWithdrawals);
    normalizedSupplyRequired = bipMul(
      normalizedOutstandingSupply, reserveRatioBips
    ).plus(normalizedWithdrawals);
  } else {
    let scaledRequiredReserves = bipMul(
      market.scaledTotalSupply.minus(scaledWithdrawals),
      reserveRatioBips
    ).plus(scaledWithdrawals);
    normalizedSupplyRequired = rayMul(
      scaledRequiredReserves,
      market.scaleFactor
    );
  }

  return normalizedSupplyRequired
    .plus(market.pendingProtocolFees)
    .plus(market.normalizedUnclaimedWithdrawals);
}

export function calculateTotalDebt(market: Market): BigInt {
  return normalizeWithRemainder(market.scaledTotalSupply, market.scaleFactor, market.withdrawalRemainder)
    .plus(market.normalizedUnclaimedWithdrawals)
    .plus(market.pendingProtocolFees);
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
  let lastBalance = normalizeWithRemainder(scaledAmountOwed, batch.lastScaleFactor, batch.paymentRemainder);
  let currentBalance = normalizeWithRemainder(scaledAmountOwed, market.scaleFactor, batch.paymentRemainder);
  return currentBalance.minus(lastBalance);
}

export function satSub(a: BigInt, b: BigInt): BigInt {
  if (a.lt(b)) {
    return BigInt.zero();
  }
  return a.minus(b);
}

export function isNullAddress(address: Address): bool {
  return address.equals(Address.zero());
}

export function loadExistingMarket(
  marketId: string,
  handlerName: string
): Market | null {
  let market = Market.load(marketId);
  if (market == null) {
    log.warning("{}: skipping unknown market {}", [handlerName, marketId]);
  }
  return market;
}

export function getOrCreateLenderAccount(
  market: Market,
  marketAddress: Address,
  lenderAddress: Address,
  event: ethereum.Event
): GetOrCreateReturn<LenderAccount> {
  let lenderAccountId = generateLenderAccountId(marketAddress, lenderAddress);
  let _lenderAccount = LenderAccount.load(lenderAccountId);
  if (_lenderAccount != null) {
    return new GetOrCreateReturn<LenderAccount>(_lenderAccount, false);
  }
  const _controller = market.controller;
  const _hooks = market.hooks;
  let authorization_id: string | null = null;
  let hooks_access_id: string | null = null;
  if (_controller != null) {
    const controller = _controller as string;
    let authorization = getOrInitializeLenderAuthorization(
      generateLenderAuthorizationId(
        Bytes.fromHexString(controller),
        lenderAddress
      ),
      {
        authorized: false,
        controller: controller,
        lender: lenderAddress,
        addedTimestamp: event.block.timestamp.toI32(),
      }
    ).entity;
    authorization_id = authorization.id;
  }
  if (_hooks != null) {
    const hooks = _hooks as string;
    let access_id = generateLenderHooksAccessId(
      Bytes.fromHexString(hooks),
      lenderAddress
    );
    if (LenderHooksAccess.load(access_id) != null) {
      hooks_access_id = access_id;
    }
  }
  let result = getOrInitializeLenderAccount(lenderAccountId, {
    address: lenderAddress,
    principalBasis: BigInt.zero(),
    lastScaleFactor: market.scaleFactor,
    lastUpdatedTimestamp: market.lastInterestAccruedTimestamp,
    lastUpdatedBlockNumber: market.lastInterestAccruedBlockNumber,
    market: market.id,
    controllerAuthorization: authorization_id,
    hooksAccess: hooks_access_id,
    addedTimestamp: event.block.timestamp.toI32(),
  });
  createInitialLenderAccountSnapshot(event, result.entity);
  return result;
}
