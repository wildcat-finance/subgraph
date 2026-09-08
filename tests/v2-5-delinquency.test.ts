import {
  assert,
  clearStore,
  createMockedFunction,
  describe,
  test,
} from "matchstick-as/assembly";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Market } from "../generated/schema";
import {
  DebtRepaid,
  InterestAndFeesAccrued,
  StateUpdated,
  WithdrawalBatchCreated,
  WithdrawalBatchExpired,
} from "../generated/templates/WildcatMarketV2_5/WildcatMarketV2_5";
import { InterestAndFeesAccrued as LegacyInterestAndFeesAccrued } from "../generated/templates/WildcatMarket/WildcatMarket";
import {
  handleDebtRepaid,
  handleInterestAndFeesAccrued,
  handleStateUpdated,
  handleWithdrawalBatchCreated,
  handleWithdrawalBatchExpired,
} from "../src/wildcat-market-v2-5";
import { handleInterestAndFeesAccrued as handleLegacyInterestAndFeesAccrued } from "../src/wildcat-market";
import { getOrCreateBorrowerStats, getOrCreateProtocolStats } from "../src/daily-stats";
import { generateEventId } from "../src/utils";
import { createV25Event, pushAddress, pushBigInt, seedV25Market } from "./v2-5-test-utils";

const MARKET = Address.fromString("0x1000000000000000000000000000000000000001");
const ASSET = Address.fromString("0x2000000000000000000000000000000000000002");
const BORROWER = Address.fromString("0x3000000000000000000000000000000000000003");
const REGISTRY = Address.fromString("0x4000000000000000000000000000000000000004");
const RAY = BigInt.fromString("1000000000000000000000000000");
const EXPIRY = 1010;
const NOW = 1210;

function seedMarket(marketKind: string, delinquent: boolean, clock: i32, feeBips: i32 = 100): Market {
  let event = createV25Event(MARKET, 0);
  let market = seedV25Market(event, MARKET, ASSET, BORROWER, BORROWER, REGISTRY, null, marketKind);
  market.generation = "replacement-deployment";
  market.isDelinquent = delinquent;
  market.timeDelinquent = clock;
  market.delinquencyGracePeriod = 50;
  market.delinquencyFeeBips = feeBips;
  market.protocolFeeBips = 0;
  market.scaledTotalSupply = BigInt.fromI32(1000);
  market.save();
  let protocolStats = getOrCreateProtocolStats();
  let borrowerStats = getOrCreateBorrowerStats(BORROWER);
  protocolStats.numDelinquentMarkets = delinquent ? 1 : 0;
  borrowerStats.numDelinquentMarkets = delinquent ? 1 : 0;
  protocolStats.save();
  borrowerStats.save();
  return market;
}

function mockStoredState(clock: i32, delinquent: boolean, closed: boolean = false): void {
  let state = new ethereum.Tuple();
  state.push(ethereum.Value.fromBoolean(closed));
  for (let i = 1; i < 7; i++) state.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero()));
  state.push(ethereum.Value.fromBoolean(delinquent));
  state.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(clock)));
  for (let i = 9; i < 12; i++) state.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero()));
  state.push(ethereum.Value.fromUnsignedBigInt(RAY));
  state.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(NOW)));
  createMockedFunction(
    MARKET,
    "previousState",
    "previousState():((bool,uint128,uint128,uint128,uint104,uint104,uint32,bool,uint32,uint16,uint16,uint16,uint112,uint32))"
  ).returns([ethereum.Value.fromTuple(state)]);
  createMockedFunction(ASSET, "balanceOf", "balanceOf(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(MARKET)])
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1_000_000))]);
}

function interestEvent(from: i32, to: i32, chargedSeconds: i32, logIndex: i32, feeBips: i32 = 100): InterestAndFeesAccrued {
  let event = createV25Event(MARKET, logIndex);
  event.block.timestamp = BigInt.fromI32(NOW);
  pushBigInt(event, "fromTimestamp", BigInt.fromI32(from));
  pushBigInt(event, "toTimestamp", BigInt.fromI32(to));
  pushBigInt(event, "scaleFactor", RAY);
  pushBigInt(event, "baseInterestRay", BigInt.zero());
  // Independent forward calculation from FeeMath, including its division remainder.
  let penaltyRay = BigInt.fromI32(feeBips)
    .times(BigInt.fromI32(10).pow(23))
    .times(BigInt.fromI32(chargedSeconds))
    .div(BigInt.fromI32(31_536_000));
  pushBigInt(event, "delinquencyFeeRay", penaltyRay);
  pushBigInt(event, "protocolFees", BigInt.zero());
  return changetype<InterestAndFeesAccrued>(event);
}

function stateEvent(delinquent: boolean, logIndex: i32): StateUpdated {
  let event = createV25Event(MARKET, logIndex);
  event.block.timestamp = BigInt.fromI32(NOW);
  pushBigInt(event, "scaleFactor", RAY);
  event.parameters.push(new ethereum.EventParam("isDelinquent", ethereum.Value.fromBoolean(delinquent)));
  return changetype<StateUpdated>(event);
}

function createBatch(): void {
  let event = createV25Event(MARKET, 1);
  pushBigInt(event, "expiry", BigInt.fromI32(EXPIRY));
  handleWithdrawalBatchCreated(changetype<WithdrawalBatchCreated>(event));
}

function expireBatch(): void {
  let event = createV25Event(MARKET, 4);
  event.block.timestamp = BigInt.fromI32(NOW);
  pushBigInt(event, "expiry", BigInt.fromI32(EXPIRY));
  pushBigInt(event, "scaledTotalAmount", BigInt.zero());
  pushBigInt(event, "scaledAmountBurned", BigInt.zero());
  pushBigInt(event, "normalizedAmountPaid", BigInt.zero());
  handleWithdrawalBatchExpired(changetype<WithdrawalBatchExpired>(event));
}

describe("v2.5 delinquency accounting", () => {
  test("keeps the expiry split and records recovery despite a stale pre-expiry flag", () => {
    for (let k = 0; k < 2; k++) {
      clearStore();
      seedMarket(k == 0 ? "STANDARD" : "REVOLVING", true, 100);
      mockStoredState(0, false);
      createBatch();

      let beforeExpiry = interestEvent(1000, EXPIRY, 10, 3);
      handleInterestAndFeesAccrued(beforeExpiry);
      assert.fieldEquals("Market", MARKET.toHexString(), "timeDelinquent", "110");
      assert.fieldEquals("MarketInterestAccrued", generateEventId(beforeExpiry), "timeWithPenalties", "10");

      expireBatch();
      let afterExpiry = interestEvent(EXPIRY, NOW, 60, 5);
      handleInterestAndFeesAccrued(afterExpiry);
      assert.fieldEquals("Market", MARKET.toHexString(), "timeDelinquent", "0");
      assert.fieldEquals("MarketInterestAccrued", generateEventId(afterExpiry), "timeWithPenalties", "60");
      assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "source", "EVENT_AND_CONTRACT_CALL");

      handleStateUpdated(stateEvent(false, 6));
      assert.fieldEquals("Market", MARKET.toHexString(), "isDelinquent", "false");
      assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "timeDelinquent", "0");
      assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "isIncurringPenalties", "false");
    }
  });

  test("late repayment changes the final flag without erasing the expired interval", () => {
    for (let k = 0; k < 2; k++) {
      clearStore();
      seedMarket(k == 0 ? "STANDARD" : "REVOLVING", false, 0);
      mockStoredState(200, false);
      createBatch();

      let repayment = createV25Event(MARKET, 2);
      repayment.block.timestamp = BigInt.fromI32(NOW);
      pushAddress(repayment, "from", BORROWER);
      pushBigInt(repayment, "amount", BigInt.fromI32(1_000_000));
      handleDebtRepaid(changetype<DebtRepaid>(repayment));
      handleInterestAndFeesAccrued(interestEvent(1000, EXPIRY, 0, 3));
      expireBatch();
      let afterExpiry = interestEvent(EXPIRY, NOW, 150, 5);
      handleInterestAndFeesAccrued(afterExpiry);
      handleStateUpdated(stateEvent(false, 6));

      assert.fieldEquals("MarketInterestAccrued", generateEventId(afterExpiry), "timeWithPenalties", "150");
      assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "isDelinquent", "false");
      assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "timeDelinquent", "200");
      assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "isIncurringPenalties", "true");
      // A second state write in the same block does not accrue another interval.
      handleStateUpdated(stateEvent(false, 7));
      assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "timeDelinquent", "200");
    }
  });

  test("tracks the stored clock independently of zero-rate penalty events", () => {
    clearStore();
    seedMarket("STANDARD", false, 0, 0);
    mockStoredState(200, true);
    let event = interestEvent(EXPIRY, NOW, 0, 1, 0);
    handleInterestAndFeesAccrued(event);
    handleStateUpdated(stateEvent(true, 2));
    assert.fieldEquals("MarketInterestAccrued", generateEventId(event), "timeWithPenalties", "0");
    assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "timeDelinquent", "200");
    assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "isDelinquent", "true");
  });

  test("retains charged seconds when closure resets the block-final clock", () => {
    clearStore();
    seedMarket("STANDARD", true, 100);
    mockStoredState(0, false, true);
    let beforeExpiry = interestEvent(1000, EXPIRY, 10, 1);
    handleInterestAndFeesAccrued(beforeExpiry);
    assert.fieldEquals("Market", MARKET.toHexString(), "timeDelinquent", "110");
    let event = interestEvent(EXPIRY, NOW, 200, 2);
    handleInterestAndFeesAccrued(event);
    assert.fieldEquals("MarketInterestAccrued", generateEventId(event), "timeWithPenalties", "200");
    assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "timeDelinquent", "0");
  });

  test("recovers exact charged seconds for the minimum nonzero fee rate", () => {
    clearStore();
    seedMarket("STANDARD", true, 100, 1);
    mockStoredState(101, true);
    let event = interestEvent(NOW - 1, NOW, 1, 1, 1);
    handleInterestAndFeesAccrued(event);
    assert.fieldEquals("MarketInterestAccrued", generateEventId(event), "timeWithPenalties", "1");
  });

  test("preserves v2.0 and v2.1 event projections without v2.5 contract reads", () => {
    for (let i = 0; i < 2; i++) {
      clearStore();
      let market = seedMarket("STANDARD", true, 100);
      market.generation = i == 0 ? "v2.0" : "v2.1";
      market.eventGeneration = "LEGACY";
      market.save();
      let event = interestEvent(EXPIRY, NOW, 200, 1);
      handleLegacyInterestAndFeesAccrued(changetype<LegacyInterestAndFeesAccrued>(event));
      assert.fieldEquals("Market", MARKET.toHexString(), "timeDelinquent", "300");
      assert.fieldEquals("MarketInterestAccrued", generateEventId(event), "timeWithPenalties", "200");
      assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "source", "EVENT_PROJECTION");
    }
  });
});
