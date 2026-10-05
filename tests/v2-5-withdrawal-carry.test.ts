import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Market, WithdrawalBatch } from "../generated/schema";
import { generateWithdrawalBatchId } from "../generated/UncrashableEntityHelpers";
import {
  WithdrawalBatchClosed, WithdrawalBatchCreated, WithdrawalBatchExpired, WithdrawalBatchPayment,
} from "../generated/templates/WildcatMarketV2_5/WildcatMarketV2_5";
import {
  handleWithdrawalBatchClosed, handleWithdrawalBatchCreated,
  handleWithdrawalBatchExpired, handleWithdrawalBatchPayment,
} from "../src/wildcat-market-v2-5";
import { calculateLiquidityRequired, calculateTotalDebt, generateEventId } from "../src/utils";
import { createV25Event, pushBigInt, seedV25Market } from "./v2-5-test-utils";

const MARKET = Address.fromString("0x1000000000000000000000000000000000000001");
const ASSET = Address.fromString("0x2000000000000000000000000000000000000002");
const BORROWER = Address.fromString("0x3000000000000000000000000000000000000003");
const SCALE = BigInt.fromString("1600000000000000000000000000");

function seed(carry: boolean = true): void {
  let market = seedV25Market(createV25Event(MARKET, 0), MARKET, ASSET, BORROWER, BORROWER, BORROWER);
  market.scaleFactor = SCALE;
  market.scaledTotalSupply = BigInt.fromI32(100);
  market.scaledPendingWithdrawals = BigInt.fromI32(100);
  if (carry) {
    market.repaymentDate = BigInt.zero();
    market.withdrawalRemainder = BigInt.zero();
  }
  market.save();
}

function batchId(expiry: i32): string {
  return generateWithdrawalBatchId(MARKET, BigInt.fromI32(expiry));
}

function createBatch(expiry: i32, amount: i32, logIndex: i32): void {
  let event = createV25Event(MARKET, logIndex);
  pushBigInt(event, "expiry", BigInt.fromI32(expiry));
  handleWithdrawalBatchCreated(changetype<WithdrawalBatchCreated>(event));
  let batch = WithdrawalBatch.load(batchId(expiry)) as WithdrawalBatch;
  batch.scaledTotalAmount = BigInt.fromI32(amount);
  batch.save();
}

function payment(expiry: i32, burned: i32, paid: i32, logIndex: i32): void {
  let event = createV25Event(MARKET, logIndex);
  pushBigInt(event, "expiry", BigInt.fromI32(expiry));
  pushBigInt(event, "scaledAmountBurned", BigInt.fromI32(burned));
  pushBigInt(event, "normalizedAmountPaid", BigInt.fromI32(paid));
  handleWithdrawalBatchPayment(changetype<WithdrawalBatchPayment>(event));
}

function expire(expiry: i32, logIndex: i32): string {
  let batch = WithdrawalBatch.load(batchId(expiry)) as WithdrawalBatch;
  let event = createV25Event(MARKET, logIndex);
  pushBigInt(event, "expiry", BigInt.fromI32(expiry));
  pushBigInt(event, "scaledTotalAmount", batch.scaledTotalAmount);
  pushBigInt(event, "scaledAmountBurned", batch.scaledAmountBurned);
  pushBigInt(event, "normalizedAmountPaid", batch.normalizedAmountPaid);
  handleWithdrawalBatchExpired(changetype<WithdrawalBatchExpired>(event));
  return generateEventId(event);
}

function close(expiry: i32, logIndex: i32): void {
  let event = createV25Event(MARKET, logIndex);
  pushBigInt(event, "expiry", BigInt.fromI32(expiry));
  handleWithdrawalBatchClosed(changetype<WithdrawalBatchClosed>(event));
}

describe("withdrawal carry accounting", () => {
  test("retains fractions between partial payments without losing debt", () => {
    clearStore();
    seed();
    createBatch(2000, 100, 1);
    payment(2000, 1, 1, 2);
    assert.fieldEquals("WithdrawalBatch", batchId(2000), "paymentRemainder", "600000000000000000000000000");
    assert.bigIntEquals(calculateTotalDebt(Market.load(MARKET.toHexString()) as Market), BigInt.fromI32(160));
    payment(2000, 1, 2, 3);
    assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "withdrawalRemainder", "200000000000000000000000000");
    assert.bigIntEquals(calculateTotalDebt(Market.load(MARKET.toHexString()) as Market), BigInt.fromI32(160));
    payment(2000, 3, 5, 4);
    assert.fieldEquals("Market", MARKET.toHexString(), "withdrawalRemainder", "0");
    assert.fieldEquals("WithdrawalBatch", batchId(2000), "normalizedAmountPaid", "8");
    assert.bigIntEquals(calculateTotalDebt(Market.load(MARKET.toHexString()) as Market), BigInt.fromI32(160));
  });

  test("sums independent batch fractions and partitions reserves after normalization", () => {
    clearStore();
    seed();
    createBatch(2000, 50, 1);
    createBatch(3000, 50, 2);
    payment(2000, 1, 1, 3);
    payment(3000, 1, 1, 4);
    assert.fieldEquals("Market", MARKET.toHexString(), "withdrawalRemainder", "1200000000000000000000000000");
    let market = Market.load(MARKET.toHexString()) as Market;
    assert.bigIntEquals(calculateTotalDebt(market), BigInt.fromI32(160));
    market.scaledTotalSupply = BigInt.fromI32(10);
    market.scaledPendingWithdrawals = BigInt.fromI32(2);
    market.reserveRatioBips = 2000;
    // Pending rounds to 4; total supply plus carry to 17; 20% of 13 rounds to 3.
    // Two whole tokens have already been reserved for claims: 4 + 3 + 2 = 9.
    assert.bigIntEquals(calculateLiquidityRequired(market), BigInt.fromI32(9));
    market.reserveRatioBips = 0;
    assert.bigIntEquals(calculateLiquidityRequired(market), BigInt.fromI32(6));
    market.reserveRatioBips = 10000;
    assert.bigIntEquals(calculateLiquidityRequired(market), BigInt.fromI32(19));
  });

  test("keeps a fully paid open batch's carry until expiry and releases it once", () => {
    clearStore();
    seed();
    createBatch(2000, 1, 1);
    payment(2000, 1, 1, 2);
    assert.fieldEquals("Market", MARKET.toHexString(), "withdrawalRemainder", "600000000000000000000000000");
    expire(2000, 3);
    assert.fieldEquals("WithdrawalBatch", batchId(2000), "paymentRemainder", "0");
    assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "withdrawalRemainder", "0");
    close(2000, 4);
    assert.fieldEquals("Market", MARKET.toHexString(), "withdrawalRemainder", "0");
  });

  test("retains unpaid expired carry through the final payment and then releases it", () => {
    clearStore();
    seed();
    createBatch(2000, 2, 1);
    payment(2000, 1, 1, 2);
    let expiration = expire(2000, 3);
    assert.fieldEquals("WithdrawalBatchExpired", expiration, "normalizedAmountOwed", "2");
    assert.fieldEquals("Market", MARKET.toHexString(), "withdrawalRemainder", "600000000000000000000000000");
    payment(2000, 1, 2, 4);
    close(2000, 5);
    assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "withdrawalRemainder", "0");
    assert.fieldEquals("WithdrawalBatch", batchId(2000), "normalizedAmountPaid", "3");
  });

  test("does not apply carry to earlier V2.5 deployments", () => {
    clearStore();
    seed(false);
    createBatch(2000, 2, 1);
    payment(2000, 1, 1, 2);
    let market = Market.load(MARKET.toHexString()) as Market;
    let batch = WithdrawalBatch.load(batchId(2000)) as WithdrawalBatch;
    assert.assertTrue(market.withdrawalRemainder === null);
    assert.assertTrue(batch.paymentRemainder === null);
    assert.bigIntEquals(calculateTotalDebt(market), BigInt.fromI32(159));
  });
});
