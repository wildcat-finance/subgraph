import {
  assert,
  clearStore,
  describe,
  test,
} from "matchstick-as/assembly/index";
import { newMockEvent } from "matchstick-as";
import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  AnnualInterestBipsReductionExecuted,
  AnnualInterestBipsReductionProposalCancelled,
  AnnualInterestBipsReductionProposed,
  PeriodicTermClosed,
  PeriodicTermUpdated,
} from "../generated/templates/CombinedHooks/CombinedHooks";
import {
  createHooksConfig,
  createMarket,
  generateHooksConfigId,
  generateHooksInstanceId,
  generateMarketId,
} from "../generated/UncrashableEntityHelpers";
import {
  handleAnnualInterestBipsReductionExecuted,
  handleAnnualInterestBipsReductionProposalCancelled,
  handleAnnualInterestBipsReductionProposed,
  handlePeriodicTermClosed,
  handlePeriodicTermUpdated,
} from "../src/hooks-instance";

let hooksAddress = Address.fromString(
  "0x0000000000000000000000000000000000003001"
);
let marketAddress = Address.fromString(
  "0x0000000000000000000000000000000000003002"
);

function marketId(): string {
  return generateMarketId(marketAddress);
}

function hooksConfigId(): string {
  return generateHooksConfigId(marketAddress);
}

function savePeriodicMarket(): void {
  createMarket(marketId(), {
    archController: "arch-controller",
    isRegistered: true,
    version: "V2",
    controller: null,
    hooksFactory: "hooks-factory",
    hooks: generateHooksInstanceId(hooksAddress),
    borrower: Address.zero(),
    sentinel: Address.zero(),
    feeRecipient: Address.zero(),
    name: "periodic test market",
    symbol: "PTM",
    decimals: 18,
    protocolFeeBips: 0,
    delinquencyGracePeriod: 0,
    delinquencyFeeBips: 0,
    asset: "asset",
    withdrawalBatchDuration: 0,
    totalAssets: BigInt.zero(),
    maxTotalSupply: BigInt.zero(),
    annualInterestBips: 1200,
    reserveRatioBips: 0,
    scaleFactor: BigInt.fromI32(10).pow(27),
    lastInterestAccruedTimestamp: 0,
    lastInterestAccruedBlockNumber: 0,
    usdTotalsComplete: true,
    totalDebtUSD: BigDecimal.zero(),
    numCollateralContracts: 0,
    createdAt: 0,
    deployedEvent: "deployed-event",
  });
  createHooksConfig(hooksConfigId(), {
    market: marketId(),
    hooks: generateHooksInstanceId(hooksAddress),
    useOnDeposit: true,
    useOnQueueWithdrawal: true,
    useOnExecuteWithdrawal: false,
    useOnTransfer: true,
    useOnBorrow: false,
    useOnRepay: false,
    useOnCloseMarket: true,
    useOnNukeFromOrbit: false,
    useOnSetMaxTotalSupply: false,
    useOnSetAnnualInterestAndReserveRatioBips: true,
    useOnSetProtocolFeeBips: false,
    depositRequiresAccess: true,
    transferRequiresAccess: true,
    queueWithdrawalRequiresAccess: true,
    transfersDisabled: false,
    minimumDeposit: BigInt.zero(),
    allowForceBuyBacks: false,
    fixedTermEndTime: 0,
    allowClosureBeforeTerm: false,
    allowTermReduction: false,
    firstWithdrawalWindowStart: 10,
    periodDuration: 20,
    withdrawalWindowDuration: 30,
    periodicTermClosed: false,
    pendingAprChangeAnnualInterestBips: 0,
    pendingAprChangeProposalTimestamp: 0,
    pendingAprChangeResponseWindowStart: 0,
    pendingAprChangeResponseWindowEnd: 0,
  });
}

function createPeriodicTermUpdatedEvent(
  firstWithdrawalWindowStart: i32,
  periodDuration: i32,
  withdrawalWindowDuration: i32
): PeriodicTermUpdated {
  let event = changetype<PeriodicTermUpdated>(newMockEvent());
  event.address = hooksAddress;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "market",
      ethereum.Value.fromAddress(marketAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "firstWithdrawalWindowStart",
      ethereum.Value.fromUnsignedBigInt(
        BigInt.fromI32(firstWithdrawalWindowStart)
      )
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "periodDuration",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(periodDuration))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "withdrawalWindowDuration",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(withdrawalWindowDuration))
    )
  );
  return event;
}

function createPeriodicTermClosedEvent(): PeriodicTermClosed {
  let event = changetype<PeriodicTermClosed>(newMockEvent());
  event.address = hooksAddress;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "market",
      ethereum.Value.fromAddress(marketAddress)
    )
  );
  return event;
}

function createProposalEvent(): AnnualInterestBipsReductionProposed {
  let event = changetype<AnnualInterestBipsReductionProposed>(newMockEvent());
  event.address = hooksAddress;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "market",
      ethereum.Value.fromAddress(marketAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "annualInterestBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(900))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "proposalTimestamp",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "responseWindowStart",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2000))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "responseWindowEnd",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(3000))
    )
  );
  return event;
}

function createProposalCancelledEvent(): AnnualInterestBipsReductionProposalCancelled {
  let event = changetype<AnnualInterestBipsReductionProposalCancelled>(
    newMockEvent()
  );
  event.address = hooksAddress;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "market",
      ethereum.Value.fromAddress(marketAddress)
    )
  );
  return event;
}

function createReductionExecutedEvent(): AnnualInterestBipsReductionExecuted {
  let event = changetype<AnnualInterestBipsReductionExecuted>(newMockEvent());
  event.address = hooksAddress;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "market",
      ethereum.Value.fromAddress(marketAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "annualInterestBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(900))
    )
  );
  return event;
}

function assertPendingAprChangeCleared(): void {
  assert.fieldEquals(
    "HooksConfig",
    hooksConfigId(),
    "pendingAprChangeAnnualInterestBips",
    "0"
  );
  assert.fieldEquals(
    "HooksConfig",
    hooksConfigId(),
    "pendingAprChangeProposalTimestamp",
    "0"
  );
  assert.fieldEquals(
    "HooksConfig",
    hooksConfigId(),
    "pendingAprChangeResponseWindowStart",
    "0"
  );
  assert.fieldEquals(
    "HooksConfig",
    hooksConfigId(),
    "pendingAprChangeResponseWindowEnd",
    "0"
  );
}

describe("periodic term hooks events", () => {
  test("updates periodic term config and records the event", () => {
    clearStore();
    savePeriodicMarket();

    handlePeriodicTermUpdated(
      createPeriodicTermUpdatedEvent(100, 604800, 86400)
    );

    let recordId = "RECORD-" + marketId() + "-0";
    assert.entityCount("PeriodicTermUpdated", 1);
    assert.fieldEquals(
      "PeriodicTermUpdated",
      recordId,
      "oldFirstWithdrawalWindowStart",
      "10"
    );
    assert.fieldEquals(
      "PeriodicTermUpdated",
      recordId,
      "newPeriodDuration",
      "604800"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId(),
      "firstWithdrawalWindowStart",
      "100"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId(),
      "periodDuration",
      "604800"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId(),
      "withdrawalWindowDuration",
      "86400"
    );
    assert.fieldEquals("Market", marketId(), "eventIndex", "1");
  });

  test("marks periodic term closed and records the event", () => {
    clearStore();
    savePeriodicMarket();

    handlePeriodicTermClosed(createPeriodicTermClosedEvent());

    assert.entityCount("PeriodicTermClosed", 1);
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId(),
      "periodicTermClosed",
      "true"
    );
    assert.fieldEquals("Market", marketId(), "eventIndex", "1");
  });

  test("records pending APR reductions", () => {
    clearStore();
    savePeriodicMarket();

    handleAnnualInterestBipsReductionProposed(createProposalEvent());

    assert.entityCount("AnnualInterestBipsReductionProposed", 1);
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId(),
      "pendingAprChangeAnnualInterestBips",
      "900"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId(),
      "pendingAprChangeProposalTimestamp",
      "1000"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId(),
      "pendingAprChangeResponseWindowEnd",
      "3000"
    );
    assert.fieldEquals("Market", marketId(), "eventIndex", "1");
  });

  test("clears pending APR state when a proposal is cancelled", () => {
    clearStore();
    savePeriodicMarket();
    handleAnnualInterestBipsReductionProposed(createProposalEvent());

    handleAnnualInterestBipsReductionProposalCancelled(
      createProposalCancelledEvent()
    );

    assertPendingAprChangeCleared();
    assert.fieldEquals("Market", marketId(), "eventIndex", "1");
  });

  test("clears pending APR state when a reduction is executed", () => {
    clearStore();
    savePeriodicMarket();
    handleAnnualInterestBipsReductionProposed(createProposalEvent());

    handleAnnualInterestBipsReductionExecuted(
      createReductionExecutedEvent()
    );

    assertPendingAprChangeCleared();
    assert.fieldEquals("Market", marketId(), "eventIndex", "1");
  });

  test("ignores stateful events for markets that are not indexed", () => {
    clearStore();

    handlePeriodicTermClosed(createPeriodicTermClosedEvent());
    handleAnnualInterestBipsReductionProposed(createProposalEvent());

    assert.entityCount("PeriodicTermClosed", 0);
    assert.entityCount("AnnualInterestBipsReductionProposed", 0);
    assert.entityCount("HooksConfig", 0);
  });
});
