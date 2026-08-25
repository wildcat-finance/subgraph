import {
  assert,
  clearStore,
  describe,
  test,
} from "matchstick-as/assembly/index";
import {
  Address,
  BigDecimal,
  BigInt,
  ethereum,
} from "@graphprotocol/graph-ts";
import {
  AnnualInterestBipsReductionExecuted,
  AnnualInterestBipsReductionProposalCancelled,
  AnnualInterestBipsReductionProposed,
  PeriodicTermClosed,
  PeriodicTermUpdated,
  RoleProviderAdded,
  RoleProviderRemoved,
  RoleProviderUpdated,
} from "../generated/templates/CombinedHooks/CombinedHooks";
import { AnnualInterestBipsUpdated } from "../generated/templates/WildcatMarket/WildcatMarket";
import { HooksConfig } from "../generated/schema";
import {
  createHooksInstance,
  createMarket,
  generateHooksConfigId,
  generateHooksInstanceId,
  generateMarketId,
  generateRoleProviderId,
} from "../generated/UncrashableEntityHelpers";
import {
  handleAnnualInterestBipsReductionExecuted,
  handleAnnualInterestBipsReductionProposalCancelled,
  handleAnnualInterestBipsReductionProposed,
  handlePeriodicTermClosed,
  handlePeriodicTermUpdated,
  handleRoleProviderAdded,
  handleRoleProviderRemoved,
  handleRoleProviderUpdated,
} from "../src/hooks-instance";
import { handleAnnualInterestBipsUpdated } from "../src/wildcat-market";
import { createInitialMarketSnapshot } from "../src/market-domain";
import { newMockEvent } from "matchstick-as";

let hooksAddress = Address.fromString(
  "0xa16081f360e3847006db660bae1c6d1b2e17ec2a"
);
let marketAddress = Address.fromString(
  "0x0000000000000000000000000000000000002002"
);
let providerAddress = Address.fromString(
  "0x0000000000000000000000000000000000003003"
);

function marketId(): string {
  return generateMarketId(marketAddress);
}

function hooksConfigId(): string {
  return generateHooksConfigId(marketAddress);
}

function saveMarket(): void {
  let market = createMarket(marketId(), {
    address: marketAddress,
    archController: "arch-controller",
    isRegistered: true,
    version: "V2",
    marketKind: "STANDARD",
    originKind: "HOOKS",
    generation: "test",
    abiFamily: "test",
    eventGeneration: "LEGACY",
    controller: null,
    hooksFactory: null,
    hooks: generateHooksInstanceId(hooksAddress),
    borrower: Address.zero(),
    borrowerAccount: null,
    borrowerPrincipal: Address.zero(),
    borrowerProfile: null,
    initialBorrower: Address.zero(),
    initialBorrowerPrincipal: Address.zero(),
    borrowerIdentityRegistry: null,
    borrowerIdentityRegistryAddress: null,
    sentinel: Address.zero(),
    feeRecipient: Address.zero(),
    originationFeeAsset: null,
    originationFeeAmount: BigInt.zero(),
    name: "periodic test market",
    symbol: "ptm",
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
    scaleFactor: BigInt.zero(),
    lastInterestAccruedTimestamp: 0,
    lastInterestAccruedBlockNumber: 0,
    usdTotalsComplete: true,
    totalDebtUSD: BigDecimal.zero(),
    numCollateralContracts: 0,
    createdAt: 0,
    createdAtBlock: BigInt.zero(),
    createdAtTimestamp: BigInt.zero(),
    createdAtTransaction: Address.zero(),
    createdAtLogIndex: BigInt.zero(),
    deployedEvent: "deployed-event",
  });
  createInitialMarketSnapshot(
    changetype<ethereum.Event>(newMockEvent()),
    market,
    "EVENT_PROJECTION"
  );
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

function saveHooksInstance(): void {
  createHooksInstance(generateHooksInstanceId(hooksAddress), {
    address: hooksAddress,
    name: "role provider test hooks",
    kind: "PeriodicTerm",
    marketKind: "STANDARD",
    generation: "test",
    abiFamily: "test",
    eventGeneration: "LEGACY",
    borrower: providerAddress,
    administrator: providerAddress,
    deployer: providerAddress,
    version: "PeriodicTermHooks",
    providerMetadataState: "UNKNOWN",
    hooksTemplate: "hooks-template",
    templateRegistration: "template-registration",
    hooksFactory: "hooks-factory",
    deployedAtBlock: BigInt.zero(),
    deployedAtTimestamp: BigInt.zero(),
    deployedAtTransaction: Address.zero(),
    deployedAtLogIndex: BigInt.zero(),
  });
}

function createRoleProviderAddedEvent(
  timeToLive: BigInt,
  pullProviderIndex: i32,
  pushProviderIndex: i32
): RoleProviderAdded {
  let event = changetype<RoleProviderAdded>(newMockEvent());
  event.address = hooksAddress;
  event.logIndex = BigInt.fromI32(1);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "providerAddress",
      ethereum.Value.fromAddress(providerAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "timeToLive",
      ethereum.Value.fromUnsignedBigInt(timeToLive)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pullProviderIndex",
      ethereum.Value.fromI32(pullProviderIndex)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pushProviderIndex",
      ethereum.Value.fromI32(pushProviderIndex)
    )
  );
  return event;
}

function createRoleProviderUpdatedEvent(
  timeToLive: BigInt,
  pullProviderIndex: i32,
  pushProviderIndex: i32
): RoleProviderUpdated {
  let event = changetype<RoleProviderUpdated>(newMockEvent());
  event.address = hooksAddress;
  event.logIndex = BigInt.fromI32(2);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "providerAddress",
      ethereum.Value.fromAddress(providerAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "timeToLive",
      ethereum.Value.fromUnsignedBigInt(timeToLive)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pullProviderIndex",
      ethereum.Value.fromI32(pullProviderIndex)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pushProviderIndex",
      ethereum.Value.fromI32(pushProviderIndex)
    )
  );
  return event;
}

function createRoleProviderRemovedEvent(
  pullProviderIndex: i32,
  pushProviderIndex: i32
): RoleProviderRemoved {
  let event = changetype<RoleProviderRemoved>(newMockEvent());
  event.address = hooksAddress;
  event.logIndex = BigInt.fromI32(2);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "providerAddress",
      ethereum.Value.fromAddress(providerAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pullProviderIndex",
      ethereum.Value.fromI32(pullProviderIndex)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pushProviderIndex",
      ethereum.Value.fromI32(pushProviderIndex)
    )
  );
  return event;
}

function createPeriodicTermUpdatedEvent(
  firstWithdrawalWindowStart: i32,
  periodDuration: i32,
  withdrawalWindowDuration: i32
): PeriodicTermUpdated {
  let event = changetype<PeriodicTermUpdated>(newMockEvent());
  event.logIndex = BigInt.fromI32(1);
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
  event.logIndex = BigInt.fromI32(1);
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
  event.logIndex = BigInt.fromI32(1);
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
  event.logIndex = BigInt.fromI32(2);
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
  event.logIndex = BigInt.fromI32(2);
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
  event.logIndex = BigInt.fromI32(2);
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

describe("role provider events", () => {
  test("preserves uint32 TTLs and uint24 sentinel classifications", () => {
    clearStore();
    saveHooksInstance();

    let nullProviderIndex = 2 ** 24 - 1;
    let maxTimeToLive = BigInt.fromString("4294967295");
    let providerId = generateRoleProviderId(hooksAddress, providerAddress);
    let hooksId = generateHooksInstanceId(hooksAddress);

    handleRoleProviderAdded(
      createRoleProviderAddedEvent(maxTimeToLive, nullProviderIndex, 0)
    );

    assert.fieldEquals(
      "RoleProvider",
      providerId,
      "timeToLive",
      "4294967295"
    );
    assert.fieldEquals("RoleProvider", providerId, "isPullProvider", "false");
    assert.fieldEquals(
      "RoleProvider",
      providerId,
      "pullProviderIndex",
      "16777215"
    );
    assert.fieldEquals("RoleProvider", providerId, "isPushProvider", "true");
    assert.fieldEquals("RoleProvider", providerId, "pushProviderIndex", "0");
    assert.fieldEquals(
      "RoleProviderAdded",
      "RECORD-" + hooksId + "-0",
      "timeToLive",
      "4294967295"
    );
    assert.fieldEquals(
      "RoleProvider",
      providerId,
      "addedEvent",
      "RECORD-" + hooksId + "-0"
    );

    handleRoleProviderUpdated(
      createRoleProviderUpdatedEvent(BigInt.zero(), 0, nullProviderIndex)
    );

    assert.fieldEquals("RoleProvider", providerId, "timeToLive", "0");
    assert.fieldEquals("RoleProvider", providerId, "isPullProvider", "true");
    assert.fieldEquals("RoleProvider", providerId, "pullProviderIndex", "0");
    assert.fieldEquals("RoleProvider", providerId, "isPushProvider", "false");
    assert.fieldEquals(
      "RoleProvider",
      providerId,
      "pushProviderIndex",
      "16777215"
    );
    assert.fieldEquals(
      "RoleProviderUpdated",
      "RECORD-" + hooksId + "-1",
      "timeToLive",
      "0"
    );
    assert.fieldEquals("HooksInstance", hooksId, "eventIndex", "2");
  });

  test("preserves lifecycle history across removal and re-addition", () => {
    clearStore();
    saveHooksInstance();

    let nullProviderIndex = 2 ** 24 - 1;
    let providerId = generateRoleProviderId(hooksAddress, providerAddress);
    let hooksId = generateHooksInstanceId(hooksAddress);

    handleRoleProviderAdded(
      createRoleProviderAddedEvent(
        BigInt.fromString("4294967295"),
        nullProviderIndex,
        0
      )
    );
    handleRoleProviderRemoved(
      createRoleProviderRemovedEvent(nullProviderIndex, 0)
    );

    assert.fieldEquals("RoleProvider", providerId, "isApproved", "false");
    assert.fieldEquals("RoleProvider", providerId, "timeToLive", "0");
    assert.fieldEquals("RoleProvider", providerId, "isPullProvider", "false");
    assert.fieldEquals("RoleProvider", providerId, "pullProviderIndex", "0");
    assert.fieldEquals("RoleProvider", providerId, "isPushProvider", "false");
    assert.fieldEquals("RoleProvider", providerId, "pushProviderIndex", "0");
    assert.fieldEquals(
      "RoleProvider",
      providerId,
      "addedEvent",
      "RECORD-" + hooksId + "-0"
    );
    assert.fieldEquals(
      "RoleProvider",
      providerId,
      "removedEvent",
      "RECORD-" + hooksId + "-1"
    );
    assert.entityCount("RoleProviderRemoved", 1);

    handleRoleProviderAdded(
      createRoleProviderAddedEvent(BigInt.fromI32(120), 0, nullProviderIndex)
    );

    assert.fieldEquals("RoleProvider", providerId, "isApproved", "true");
    assert.fieldEquals("RoleProvider", providerId, "timeToLive", "120");
    assert.fieldEquals(
      "RoleProvider",
      providerId,
      "addedEvent",
      "RECORD-" + hooksId + "-2"
    );
    assert.fieldEquals(
      "RoleProvider",
      providerId,
      "removedEvent",
      "RECORD-" + hooksId + "-1"
    );
    assert.entityCount("RoleProviderAdded", 2);
    assert.entityCount("RoleProviderRemoved", 1);
    assert.fieldEquals("HooksInstance", hooksId, "eventIndex", "3");
  });
});
