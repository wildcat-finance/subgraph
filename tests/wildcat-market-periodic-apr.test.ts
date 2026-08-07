import {
  assert,
  clearStore,
  describe,
  test,
} from "matchstick-as/assembly/index";
import { newMockEvent } from "matchstick-as";
import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { AnnualInterestBipsUpdated } from "../generated/templates/WildcatMarket/WildcatMarket";
import {
  createHooksConfig,
  createMarket,
  generateHooksConfigId,
  generateHooksInstanceId,
  generateMarketId,
} from "../generated/UncrashableEntityHelpers";
import { handleAnnualInterestBipsUpdated } from "../src/wildcat-market";

let hooksAddress = Address.fromString(
  "0x0000000000000000000000000000000000004001"
);
let marketAddress = Address.fromString(
  "0x0000000000000000000000000000000000004002"
);

function marketId(): string {
  return generateMarketId(marketAddress);
}

function hooksConfigId(): string {
  return generateHooksConfigId(marketAddress);
}

function saveMarket(createConfig: boolean): void {
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
    name: "periodic APR test market",
    symbol: "PATM",
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
  if (createConfig) {
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
      pendingAprChangeAnnualInterestBips: 900,
      pendingAprChangeProposalTimestamp: 1000,
      pendingAprChangeResponseWindowStart: 2000,
      pendingAprChangeResponseWindowEnd: 3000,
    });
  }
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

describe("periodic APR proposal state", () => {
  test("preserves a proposal when an APR update repeats the current value", () => {
    clearStore();
    saveMarket(true);

    handleAnnualInterestBipsUpdated(
      createAnnualInterestBipsUpdatedEvent(1200)
    );

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
    assert.fieldEquals("Market", marketId(), "annualInterestBips", "1200");
    assert.fieldEquals("Market", marketId(), "eventIndex", "1");
  });

  test("clears a proposal when the APR actually changes", () => {
    clearStore();
    saveMarket(true);

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
    assert.fieldEquals("Market", marketId(), "annualInterestBips", "900");
    assert.fieldEquals("Market", marketId(), "eventIndex", "1");
  });

  test("does not synthesize hooks config for markets without it", () => {
    clearStore();
    saveMarket(false);

    handleAnnualInterestBipsUpdated(createAnnualInterestBipsUpdatedEvent(900));

    assert.entityCount("HooksConfig", 0);
    assert.entityCount("AnnualInterestBipsUpdated", 1);
  });
});
