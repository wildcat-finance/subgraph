import {
  assert,
  afterEach,
  clearStore,
  describe,
  test
} from "matchstick-as/assembly/index"
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts"
import { newMockEvent } from "matchstick-as"
import {
  AnnualInterestBipsReductionProposed,
  PeriodicTermClosed
} from "../generated/templates/CombinedHooks/CombinedHooks"
import {
  createHooksConfig,
  createHooksFactory,
  createHooksInstance,
  createHooksTemplate,
  createMarket,
  createToken,
  generateHooksConfigId,
  generateHooksFactoryId,
  generateHooksInstanceId,
  generateHooksTemplateId,
  generateMarketId,
  generateTokenId
} from "../generated/UncrashableEntityHelpers"
import {
  handleAnnualInterestBipsReductionProposed,
  handlePeriodicTermClosed
} from "../src/hooks-instance"

let HOOKS_FACTORY = Address.fromString(
  "0x0000000000000000000000000000000000001000"
)
let ARCH_CONTROLLER = Address.fromString(
  "0x0000000000000000000000000000000000001001"
)
let SENTINEL = Address.fromString("0x0000000000000000000000000000000000001002")
let FEE_RECIPIENT = Address.fromString(
  "0x0000000000000000000000000000000000001003"
)
let BORROWER = Address.fromString("0x0000000000000000000000000000000000001004")
let ASSET = Address.fromString("0x0000000000000000000000000000000000001005")
let PERIODIC_TEMPLATE = Address.fromString(
  "0x0000000000000000000000000000000000002000"
)
let PERIODIC_HOOKS = Address.fromString(
  "0x0000000000000000000000000000000000003000"
)
let MARKET = Address.fromString("0x0000000000000000000000000000000000004000")

function createStoredPeriodicMarket(): void {
  createToken(generateTokenId(ASSET), {
    address: ASSET,
    name: "Mock Asset",
    symbol: "MOCK",
    decimals: 18,
    isMock: true
  })
  createHooksFactory(generateHooksFactoryId(HOOKS_FACTORY), {
    archController: ARCH_CONTROLLER.toHex(),
    isRegistered: true,
    sentinel: SENTINEL
  })
  createHooksTemplate(generateHooksTemplateId(PERIODIC_TEMPLATE), {
    name: "PeriodicTermHooks",
    feeRecipient: FEE_RECIPIENT,
    protocolFeeBips: 50,
    originationFeeAsset: null,
    originationFeeAmount: BigInt.zero(),
    hooksFactory: generateHooksFactoryId(HOOKS_FACTORY)
  })
  createHooksInstance(generateHooksInstanceId(PERIODIC_HOOKS), {
    borrower: BORROWER,
    name: "PeriodicTermHooks",
    hooksFactory: generateHooksFactoryId(HOOKS_FACTORY),
    hooksTemplate: generateHooksTemplateId(PERIODIC_TEMPLATE),
    kind: "PeriodicTerm"
  })
  createHooksConfig(generateHooksConfigId(MARKET), {
    hooks: generateHooksInstanceId(PERIODIC_HOOKS),
    market: generateMarketId(MARKET),
    useOnDeposit: true,
    useOnQueueWithdrawal: true,
    useOnExecuteWithdrawal: true,
    useOnTransfer: true,
    useOnBorrow: true,
    useOnRepay: true,
    useOnCloseMarket: false,
    useOnNukeFromOrbit: false,
    useOnSetMaxTotalSupply: true,
    useOnSetAnnualInterestAndReserveRatioBips: true,
    useOnSetProtocolFeeBips: false,
    depositRequiresAccess: true,
    transferRequiresAccess: false,
    queueWithdrawalRequiresAccess: true,
    transfersDisabled: false,
    minimumDeposit: BigInt.fromI32(25),
    allowForceBuyBacks: false,
    fixedTermEndTime: 0,
    allowClosureBeforeTerm: false,
    allowTermReduction: false
  })
  createMarket(generateMarketId(MARKET), {
    archController: ARCH_CONTROLLER.toHex(),
    isRegistered: true,
    version: "V2",
    controller: null,
    hooksFactory: generateHooksFactoryId(HOOKS_FACTORY),
    hooks: generateHooksInstanceId(PERIODIC_HOOKS),
    borrower: BORROWER,
    sentinel: SENTINEL,
    feeRecipient: FEE_RECIPIENT,
    name: "Wildcat Mock",
    symbol: "WMOCK",
    decimals: 18,
    protocolFeeBips: 50,
    delinquencyGracePeriod: 604800,
    delinquencyFeeBips: 200,
    asset: generateTokenId(ASSET),
    withdrawalBatchDuration: 86400,
    maxTotalSupply: BigInt.fromI32(1000000),
    annualInterestBips: 1200,
    reserveRatioBips: 1000,
    scaleFactor: BigInt.fromI32(10).pow(27),
    lastInterestAccruedTimestamp: 1700000000,
    lastInterestAccruedBlockNumber: 1,
    numCollateralContracts: 0,
    createdAt: 1700000000,
    deployedEvent: "market-deployed"
  })
}

function createPeriodicTermClosedEvent(market: Address): PeriodicTermClosed {
  let event = changetype<PeriodicTermClosed>(newMockEvent())
  event.address = PERIODIC_HOOKS
  event.parameters = new Array()
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(market))
  )
  return event
}

function createAnnualInterestBipsReductionProposedEvent(
  market: Address,
  annualInterestBips: i32,
  proposalTimestamp: i32,
  responseWindowStart: i32,
  responseWindowEnd: i32
): AnnualInterestBipsReductionProposed {
  let event = changetype<AnnualInterestBipsReductionProposed>(newMockEvent())
  event.address = PERIODIC_HOOKS
  event.parameters = new Array()
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(market))
  )
  event.parameters.push(
    new ethereum.EventParam(
      "annualInterestBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(annualInterestBips))
    )
  )
  event.parameters.push(
    new ethereum.EventParam(
      "proposalTimestamp",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(proposalTimestamp))
    )
  )
  event.parameters.push(
    new ethereum.EventParam(
      "responseWindowStart",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(responseWindowStart))
    )
  )
  event.parameters.push(
    new ethereum.EventParam(
      "responseWindowEnd",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(responseWindowEnd))
    )
  )
  return event
}

describe("Periodic hooks instance events", () => {
  afterEach(() => {
    clearStore()
  })

  test("records APR reduction proposals and updates pending APR state", () => {
    createStoredPeriodicMarket()

    handleAnnualInterestBipsReductionProposed(
      createAnnualInterestBipsReductionProposedEvent(
        MARKET,
        950,
        1720000000,
        1720396800,
        1721001600
      )
    )

    let marketId = generateMarketId(MARKET)
    let hooksConfigId = generateHooksConfigId(MARKET)
    let recordId = "RECORD-" + marketId + "-0"

    assert.entityCount("AnnualInterestBipsReductionProposed", 1)
    assert.fieldEquals(
      "AnnualInterestBipsReductionProposed",
      recordId,
      "hooks",
      generateHooksInstanceId(PERIODIC_HOOKS)
    )
    assert.fieldEquals(
      "AnnualInterestBipsReductionProposed",
      recordId,
      "market",
      marketId
    )
    assert.fieldEquals(
      "AnnualInterestBipsReductionProposed",
      recordId,
      "annualInterestBips",
      "950"
    )
    assert.fieldEquals(
      "AnnualInterestBipsReductionProposed",
      recordId,
      "proposalTimestamp",
      "1720000000"
    )
    assert.fieldEquals(
      "AnnualInterestBipsReductionProposed",
      recordId,
      "responseWindowStart",
      "1720396800"
    )
    assert.fieldEquals(
      "AnnualInterestBipsReductionProposed",
      recordId,
      "responseWindowEnd",
      "1721001600"
    )
    assert.fieldEquals(
      "AnnualInterestBipsReductionProposed",
      recordId,
      "eventIndex",
      "0"
    )
    assert.fieldEquals("HooksConfig", hooksConfigId, "pendingAnnualInterestBips", "950")
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "pendingAnnualInterestProposalTimestamp",
      "1720000000"
    )
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "pendingAnnualInterestResponseWindowStart",
      "1720396800"
    )
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "pendingAnnualInterestResponseWindowEnd",
      "1721001600"
    )
    assert.fieldEquals("Market", marketId, "eventIndex", "1")
  })

  test("records periodic term closure and marks config closed", () => {
    createStoredPeriodicMarket()

    handlePeriodicTermClosed(createPeriodicTermClosedEvent(MARKET))

    let marketId = generateMarketId(MARKET)
    let hooksConfigId = generateHooksConfigId(MARKET)
    let recordId = "RECORD-" + marketId + "-0"

    assert.entityCount("PeriodicTermClosed", 1)
    assert.fieldEquals(
      "PeriodicTermClosed",
      recordId,
      "hooks",
      generateHooksInstanceId(PERIODIC_HOOKS)
    )
    assert.fieldEquals("PeriodicTermClosed", recordId, "market", marketId)
    assert.fieldEquals("PeriodicTermClosed", recordId, "eventIndex", "0")
    assert.fieldEquals("HooksConfig", hooksConfigId, "periodicTermClosed", "true")
    assert.fieldEquals("Market", marketId, "eventIndex", "1")
  })

  test("ignores periodic hook events for markets that have not been indexed", () => {
    handlePeriodicTermClosed(createPeriodicTermClosedEvent(MARKET))
    handleAnnualInterestBipsReductionProposed(
      createAnnualInterestBipsReductionProposedEvent(
        MARKET,
        950,
        1720000000,
        1720396800,
        1721001600
      )
    )

    assert.entityCount("PeriodicTermClosed", 0)
    assert.entityCount("AnnualInterestBipsReductionProposed", 0)
    assert.entityCount("HooksConfig", 0)
  })
})
