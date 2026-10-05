import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import {
  LenderWithdrawalStatus,
  Market,
  WithdrawalBatch,
} from "../generated/schema";

export function applyWithdrawalPaymentRemainder(
  market: Market,
  batch: WithdrawalBatch,
  scaledAmountBurned: BigInt,
  normalizedAmountPaid: BigInt
): void {
  let total = market.withdrawalRemainder;
  if (total === null) return;
  let previous = batch.paymentRemainder;
  if (previous === null) {
    log.critical("Missing payment remainder for batch {}", [batch.id]);
    return;
  }
  let ray = BigInt.fromI32(10).pow(27);
  let next = previous.plus(scaledAmountBurned.times(market.scaleFactor))
    .minus(normalizedAmountPaid.times(ray));
  if (next.lt(BigInt.zero()) || next.ge(ray)) {
    log.critical("Invalid payment remainder for batch {}", [batch.id]);
    return;
  }
  batch.paymentRemainder = next;
  market.withdrawalRemainder = total.minus(previous).plus(next);
}

// A fully paid open batch can receive more requests. Release its carry only
// when expiry or closure makes its cumulative ownership final.
export function releaseWithdrawalRemainder(market: Market, batch: WithdrawalBatch): boolean {
  let total = market.withdrawalRemainder;
  let remainder = batch.paymentRemainder;
  if (total === null || remainder === null ||
      !batch.scaledTotalAmount.equals(batch.scaledAmountBurned)) return false;
  market.withdrawalRemainder = total.minus(remainder);
  batch.paymentRemainder = BigInt.zero();
  return !remainder.isZero();
}

export function saveWithdrawalBatch(
  event: ethereum.Event,
  batch: WithdrawalBatch
): void {
  batch.updatedAtBlock = event.block.number;
  batch.updatedAtTimestamp = event.block.timestamp;
  batch.updatedAtTransaction = event.transaction.hash;
  batch.updatedAtLogIndex = event.logIndex;
  batch.save();
}

export function saveLenderWithdrawalStatus(
  event: ethereum.Event,
  status: LenderWithdrawalStatus
): void {
  status.updatedAtBlock = event.block.number;
  status.updatedAtTimestamp = event.block.timestamp;
  status.updatedAtTransaction = event.transaction.hash;
  status.updatedAtLogIndex = event.logIndex;
  status.save();
}
