import { assert, clearStore, createMockedFunction, describe, test } from "matchstick-as/assembly";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createHooksConfig, generateHooksConfigId } from "../generated/UncrashableEntityHelpers";
import {
  DefaultRecorded, InterestAndFeesAccrued, MarketClosed,
  RepaymentDateReached, StateUpdated,
} from "../generated/templates/WildcatMarketV2_5/WildcatMarketV2_5";
import { handleMarketRepaymentTerms } from "../src/hooks-factory-v2-5";
import {
  handleDefaultRecorded, handleInterestAndFeesAccrued, handleMarketClosed,
  handleRepaymentDateReached, handleStateUpdated,
} from "../src/wildcat-market-v2-5";
import { generateEventId } from "../src/utils";
import { createV25Event, pushAddress, pushBigInt, seedV25Market } from "./v2-5-test-utils";

const MARKET = Address.fromString("0x1000000000000000000000000000000000000001");
const ASSET = Address.fromString("0x2000000000000000000000000000000000000002");
const BORROWER = Address.fromString("0x3000000000000000000000000000000000000003");
const FACTORY = Address.fromString("0x4000000000000000000000000000000000000004");
const RAY = BigInt.fromString("1000000000000000000000000000");

function eventAt(logIndex: i32): ethereum.Event {
  let event = createV25Event(MARKET, logIndex);
  event.block.timestamp = BigInt.fromI32(1500);
  return event;
}

function seed(scheduled: boolean = true): void {
  seedV25Market(eventAt(0), MARKET, ASSET, BORROWER, BORROWER, FACTORY);
  let event = createV25Event(FACTORY, 1);
  pushAddress(event, "market", MARKET);
  pushBigInt(event, "repaymentDate", BigInt.fromI32(scheduled ? 1100 : 0));
  pushBigInt(event, "repaymentPeriod", BigInt.fromI32(scheduled ? 200 : 0));
  handleMarketRepaymentTerms(event);
}

function mockState(clock: i32, delinquent: boolean, closed: boolean = false): void {
  let tuple = new ethereum.Tuple();
  tuple.push(ethereum.Value.fromBoolean(closed));
  for (let i = 1; i < 7; i++) tuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero()));
  tuple.push(ethereum.Value.fromBoolean(delinquent));
  tuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(clock)));
  for (let i = 9; i < 12; i++) tuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero()));
  tuple.push(ethereum.Value.fromUnsignedBigInt(RAY));
  tuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1500)));
  tuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero()));
  createMockedFunction(MARKET, "previousState",
    "previousState():((bool,uint128,uint128,uint128,uint104,uint104,uint32,bool,uint32,uint16,uint16,uint16,uint112,uint32,uint128))")
    .returns([ethereum.Value.fromTuple(tuple)]);
  createMockedFunction(ASSET, "balanceOf", "balanceOf(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(MARKET)])
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.zero())]);
}

function stateEvent(delinquent: boolean, logIndex: i32): StateUpdated {
  let event = eventAt(logIndex);
  pushBigInt(event, "scaleFactor", RAY);
  event.parameters.push(new ethereum.EventParam("isDelinquent", ethereum.Value.fromBoolean(delinquent)));
  return changetype<StateUpdated>(event);
}

describe("repayment lifecycle", () => {
  test("records effective dates separately from logs and keeps default through closure", () => {
    clearStore();
    seed();
    let reached = eventAt(2);
    pushBigInt(reached, "effectiveTimestamp", BigInt.fromI32(1100));
    handleRepaymentDateReached(changetype<RepaymentDateReached>(reached));
    assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "reserveRatioBips", "10000");
    assert.fieldEquals("MarketRepaymentDateReached", generateEventId(reached), "effectiveTimestamp", "1100");
    assert.fieldEquals("MarketRepaymentDateReached", generateEventId(reached), "blockTimestamp", "1500");
    let defaulted = eventAt(3);
    pushBigInt(defaulted, "effectiveTimestamp", BigInt.fromI32(1300));
    handleDefaultRecorded(changetype<DefaultRecorded>(defaulted));
    assert.fieldEquals("Market", MARKET.toHexString(), "isClosed", "false");
    let closed = eventAt(4);
    pushAddress(closed, "borrower", BORROWER);
    pushBigInt(closed, "timestamp", BigInt.fromI32(1400));
    handleMarketClosed(changetype<MarketClosed>(closed));
    assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "defaultedAt", "1300");
    assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "closedAt", "1400");
    assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "repaymentActivatedAt", "1100");
    assert.fieldEquals("MarketEvent", generateEventId(defaulted), "kind", "DEFAULT_RECORDED");
    assert.fieldEquals("MarketEvent", generateEventId(closed), "sequence", "3");
  });

  test("uses the fifteen-word state decoder and immediate repayment penalty", () => {
    clearStore();
    seed();
    mockState(10, true);
    let reached = eventAt(2);
    pushBigInt(reached, "effectiveTimestamp", BigInt.fromI32(1100));
    handleRepaymentDateReached(changetype<RepaymentDateReached>(reached));
    handleStateUpdated(stateEvent(true, 3));
    assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "timeDelinquent", "10");
    assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "isIncurringPenalties", "true");
    mockState(10, false);
    handleStateUpdated(stateEvent(false, 4));
    assert.fieldEquals("MarketSnapshot", MARKET.toHexString(), "isIncurringPenalties", "false");
  });

  test("retains grace on unscheduled carry markets and does not invent a default", () => {
    clearStore();
    seed(false);
    mockState(10, true);
    handleStateUpdated(stateEvent(true, 2));
    assert.fieldEquals("Market", MARKET.toHexString(), "isIncurringPenalties", "false");
    assert.fieldEquals("Market", MARKET.toHexString(), "defaultedAt", "0");
    assert.entityCount("MarketDefaultRecorded", 0);
  });

  test("reflects automatic periodic closure without fabricating hook events", () => {
    clearStore();
    seed();
    let id = generateHooksConfigId(MARKET);
    createHooksConfig(id, {
      market: MARKET.toHexString(), hooks: FACTORY.toHexString(),
      useOnDeposit: false, useOnQueueWithdrawal: true, useOnExecuteWithdrawal: false,
      useOnTransfer: false, useOnBorrow: false, useOnRepay: false, useOnCloseMarket: true,
      useOnNukeFromOrbit: false, useOnSetMaxTotalSupply: false,
      useOnSetAnnualInterestAndReserveRatioBips: true, useOnSetProtocolFeeBips: false,
      depositRequiresAccess: false, transferRequiresAccess: false, queueWithdrawalRequiresAccess: false,
      transfersDisabled: false, minimumDeposit: BigInt.zero(), allowForceBuyBacks: false,
      fixedTermEndTime: 0, allowClosureBeforeTerm: false, allowTermReduction: false,
      firstWithdrawalWindowStart: 1600, periodDuration: 600, withdrawalWindowDuration: 100,
      periodicTermClosed: false, pendingAprChangeAnnualInterestBips: 100,
      pendingAprChangeProposalTimestamp: 900, pendingAprChangeResponseWindowStart: 1600,
      pendingAprChangeResponseWindowEnd: 1700,
    });
    let closed = eventAt(2);
    pushAddress(closed, "borrower", BORROWER);
    pushBigInt(closed, "timestamp", BigInt.fromI32(1100));
    handleMarketClosed(changetype<MarketClosed>(closed));
    assert.fieldEquals("HooksConfig", id, "periodicTermClosed", "true");
    assert.fieldEquals("HooksConfig", id, "pendingAprChangeAnnualInterestBips", "0");
    assert.fieldEquals("HooksConfig", id, "pendingAprChangeResponseWindowEnd", "0");
    assert.entityCount("PeriodicTermClosed", 0);
    assert.entityCount("AnnualInterestBipsReductionProposalCancelled", 0);
  });

  test("preserves charged penalty seconds across repayment and deadline accrual splits", () => {
    clearStore();
    seed();
    mockState(400, true);
    let boundaries = [1000, 1100, 1300, 1500];
    for (let i = 0; i < 3; i++) {
      let event = eventAt(i + 2);
      let seconds = i == 0 ? 0 : boundaries[i + 1] - boundaries[i];
      pushBigInt(event, "fromTimestamp", BigInt.fromI32(boundaries[i]));
      pushBigInt(event, "toTimestamp", BigInt.fromI32(boundaries[i + 1]));
      pushBigInt(event, "scaleFactor", RAY);
      pushBigInt(event, "baseInterestRay", BigInt.zero());
      pushBigInt(event, "delinquencyFeeRay", BigInt.fromI32(100).times(BigInt.fromI32(10).pow(23))
        .times(BigInt.fromI32(seconds)).div(BigInt.fromI32(31_536_000)));
      pushBigInt(event, "protocolFees", BigInt.zero());
      handleInterestAndFeesAccrued(changetype<InterestAndFeesAccrued>(event));
      assert.fieldEquals("MarketInterestAccrued", generateEventId(event), "timeWithPenalties", seconds.toString());
    }
    assert.fieldEquals("Market", MARKET.toHexString(), "timeDelinquent", "400");
  });
});
