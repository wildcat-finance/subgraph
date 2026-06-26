import {
  assert,
  clearStore,
  describe,
  test,
} from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  AnnualInterestBipsReductionExecuted,
  AnnualInterestBipsReductionProposalCancelled,
  AnnualInterestBipsReductionProposed,
  PeriodicTermClosed,
  PeriodicTermUpdated,
} from "../generated/templates/CombinedHooks/CombinedHooks";
import { AnnualInterestBipsUpdated } from "../generated/templates/WildcatMarket/WildcatMarket";
import { HooksConfig } from "../generated/schema";
import {
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
import { handleAnnualInterestBipsUpdated } from "../src/wildcat-market";
import { newMockEvent } from "matchstick-as";

let hooksAddress = Address.fromString(
  "0xa16081f360e3847006db660bae1c6d1b2e17ec2a"
);
let marketAddress = Address.fromString(
  "0x0000000000000000000000000000000000002002"
);

function marketId(): string {
  return generateMarketId(marketAddress);
}

function hooksConfigId(): string {
  return generateHooksConfigId(marketAddress);
}

function saveMarket(): void {
  createMarket(marketId(), {
    archController: "arch-controller",
    isRegistered: true,
    version: "V2",
    controller: null,
    hooksFactory: null,
    hooks: generateHooksInstanceId(hooksAddress),
    borrower: Address.zero(),
    sentinel: Address.zero(),
    feeRecipient: Address.zero(),
    name: "periodic test market",
    symbol: "ptm",
    decimals: 18,
    protocolFeeBips: 0,
    delinquencyGracePeriod: 0,
    delinquencyFeeBips: 0,
    asset: "asset",
    withdrawalBatchDuration: 0,
    maxTotalSupply: BigInt.zero(),
    annualInterestBips: 1200,
    reserveRatioBips: 0,
    scaleFactor: BigInt.zero(),
    lastInterestAccruedTimestamp: 0,
    lastInterestAccruedBlockNumber: 0,
    numCollateralContracts: 0,
    createdAt: 0,
    deployedEvent: "deployed-event",
  });
}

function saveHooksConfig(): void {
  let hooksConfig = new HooksConfig(hooksConfigId());
  hooksConfig.market = marketId();
  hooksConfig.hooks = generateHooksInstanceId(hooksAddress);
  hooksConfig.useOnDeposit = true;
  hooksConfig.useOnQueueWithdrawal = true;
  hooksConfig.useOnExecuteWithdrawal = false;
  hooksConfig.useOnTransfer = true;
  hooksConfig.useOnBorrow = false;
  hooksConfig.useOnRepay = false;
  hooksConfig.useOnCloseMarket = true;
  hooksConfig.useOnNukeFromOrbit = false;
  hooksConfig.useOnSetMaxTotalSupply = false;
  hooksConfig.useOnSetAnnualInterestAndReserveRatioBips = true;
  hooksConfig.useOnSetProtocolFeeBips = false;
  hooksConfig.depositRequiresAccess = true;
  hooksConfig.transferRequiresAccess = true;
  hooksConfig.queueWithdrawalRequiresAccess = true;
  hooksConfig.transfersDisabled = false;
  hooksConfig.allowForceBuyBacks = false;
  hooksConfig.fixedTermEndTime = 0;
  hooksConfig.allowClosureBeforeTerm = false;
  hooksConfig.allowTermReduction = false;
  hooksConfig.firstWithdrawalWindowStart = 10;
  hooksConfig.periodDuration = 20;
  hooksConfig.withdrawalWindowDuration = 30;
  hooksConfig.periodicTermClosed = false;
  hooksConfig.pendingAprChangeAnnualInterestBips = 0;
  hooksConfig.pendingAprChangeProposalTimestamp = 0;
  hooksConfig.pendingAprChangeResponseWindowStart = 0;
  hooksConfig.pendingAprChangeResponseWindowEnd = 0;
  hooksConfig.save();
}

function setupMarketAndConfig(): void {
  clearStore();
  saveMarket();
  saveHooksConfig();
}

function createPeriodicTermUpdatedEvent(
  firstWithdrawalWindowStart: i32,
  periodDuration: i32,
  withdrawalWindowDuration: i32
): PeriodicTermUpdated {
  let event = changetype<PeriodicTermUpdated>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(marketAddress))
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
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(marketAddress))
  );
  return event;
}

function createAnnualInterestBipsReductionProposedEvent(
  annualInterestBips: i32,
  proposalTimestamp: i32,
  responseWindowStart: i32,
  responseWindowEnd: i32
): AnnualInterestBipsReductionProposed {
  let event = changetype<AnnualInterestBipsReductionProposed>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(marketAddress))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "annualInterestBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(annualInterestBips))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "proposalTimestamp",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(proposalTimestamp))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "responseWindowStart",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(responseWindowStart))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "responseWindowEnd",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(responseWindowEnd))
    )
  );
  return event;
}

function createAprReductionProposalCancelledEvent(): AnnualInterestBipsReductionProposalCancelled {
  let event = changetype<AnnualInterestBipsReductionProposalCancelled>(
    newMockEvent()
  );
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(marketAddress))
  );
  return event;
}

function createAprReductionExecutedEvent(
  annualInterestBips: i32
): AnnualInterestBipsReductionExecuted {
  let event = changetype<AnnualInterestBipsReductionExecuted>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(marketAddress))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "annualInterestBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(annualInterestBips))
    )
  );
  return event;
}

function createAnnualInterestBipsUpdatedEvent(
  annualInterestBips: i32
): AnnualInterestBipsUpdated {
  let event = changetype<AnnualInterestBipsUpdated>(newMockEvent());
  event.address = marketAddress;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "annualInterestBipsUpdated",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(annualInterestBips))
    )
  );
  return event;
}

describe("periodic term hooks events", () => {
  test("updates periodic term config and records the event", () => {
    setupMarketAndConfig();

    handlePeriodicTermUpdated(createPeriodicTermUpdatedEvent(100, 604800, 86400));

    assert.entityCount("PeriodicTermUpdated", 1);
    assert.fieldEquals(
      "PeriodicTermUpdated",
      "RECORD-" + marketId() + "-0",
      "oldFirstWithdrawalWindowStart",
      "10"
    );
    assert.fieldEquals(
      "PeriodicTermUpdated",
      "RECORD-" + marketId() + "-0",
      "newPeriodDuration",
      "604800"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId(),
      "firstWithdrawalWindowStart",
      "100"
    );
    assert.fieldEquals("HooksConfig", hooksConfigId(), "periodDuration", "604800");
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId(),
      "withdrawalWindowDuration",
      "86400"
    );
    assert.fieldEquals("Market", marketId(), "eventIndex", "1");
  });

  test("marks periodic term closed and records the event", () => {
    setupMarketAndConfig();

    handlePeriodicTermClosed(createPeriodicTermClosedEvent());

    assert.entityCount("PeriodicTermClosed", 1);
    assert.fieldEquals("HooksConfig", hooksConfigId(), "periodicTermClosed", "true");
    assert.fieldEquals("Market", marketId(), "eventIndex", "1");
  });

  test("records and clears pending apr reductions", () => {
    setupMarketAndConfig();

    handleAnnualInterestBipsReductionProposed(
      createAnnualInterestBipsReductionProposedEvent(900, 1000, 2000, 3000)
    );

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
      "pendingAprChangeResponseWindowEnd",
      "3000"
    );

    handleAnnualInterestBipsUpdated(createAnnualInterestBipsUpdatedEvent(900));

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
    assert.fieldEquals("Market", marketId(), "annualInterestBips", "900");
  });

  test("records cancelled pending apr reductions", () => {
    setupMarketAndConfig();

    handleAnnualInterestBipsReductionProposed(
      createAnnualInterestBipsReductionProposedEvent(900, 1000, 2000, 3000)
    );
    handleAnnualInterestBipsReductionProposalCancelled(
      createAprReductionProposalCancelledEvent()
    );

    assert.entityCount("AnnualInterestBipsReductionProposalCancelled", 1);
    assert.fieldEquals(
      "AnnualInterestBipsReductionProposalCancelled",
      "RECORD-" + marketId() + "-1",
      "eventIndex",
      "1"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId(),
      "pendingAprChangeAnnualInterestBips",
      "0"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId(),
      "pendingAprChangeResponseWindowEnd",
      "0"
    );
    assert.fieldEquals("Market", marketId(), "eventIndex", "2");
  });

  test("records executed pending apr reductions", () => {
    setupMarketAndConfig();

    handleAnnualInterestBipsReductionProposed(
      createAnnualInterestBipsReductionProposedEvent(900, 1000, 2000, 3000)
    );
    handleAnnualInterestBipsReductionExecuted(
      createAprReductionExecutedEvent(900)
    );

    assert.entityCount("AnnualInterestBipsReductionExecuted", 1);
    assert.fieldEquals(
      "AnnualInterestBipsReductionExecuted",
      "RECORD-" + marketId() + "-1",
      "annualInterestBips",
      "900"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId(),
      "pendingAprChangeAnnualInterestBips",
      "0"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId(),
      "pendingAprChangeResponseWindowEnd",
      "0"
    );
    assert.fieldEquals("Market", marketId(), "eventIndex", "2");
  });
});
