import {
  assert,
  afterEach,
  clearStore,
  describe,
  test
} from "matchstick-as/assembly/index"
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts"
import { newMockEvent } from "matchstick-as"
import { AnnualInterestBipsUpdated } from "../generated/templates/WildcatMarket/WildcatMarket"
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
import { handleAnnualInterestBipsUpdated } from "../src/wildcat-market"

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
let HOOKS_TEMPLATE = Address.fromString(
  "0x0000000000000000000000000000000000002000"
)
let HOOKS = Address.fromString("0x0000000000000000000000000000000000003000")
let MARKET = Address.fromString("0x0000000000000000000000000000000000004000")

function createAnnualInterestBipsUpdatedEvent(
  newAnnualInterestBips: i32
): AnnualInterestBipsUpdated {
  let event = changetype<AnnualInterestBipsUpdated>(newMockEvent())
  event.address = MARKET
  event.parameters = new Array()
  event.parameters.push(
    new ethereum.EventParam(
      "annualInterestBipsUpdated",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(newAnnualInterestBips))
    )
  )
  return event
}

function createStoredMarket(
  hooksKind: string,
  createConfig: boolean
): void {
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
  createHooksTemplate(generateHooksTemplateId(HOOKS_TEMPLATE), {
    name: hooksKind == "PeriodicTerm" ? "PeriodicTermHooks" : "FixedTermHooks",
    feeRecipient: FEE_RECIPIENT,
    protocolFeeBips: 50,
    originationFeeAsset: null,
    originationFeeAmount: BigInt.zero(),
    hooksFactory: generateHooksFactoryId(HOOKS_FACTORY)
  })
  createHooksInstance(generateHooksInstanceId(HOOKS), {
    borrower: BORROWER,
    name: hooksKind == "PeriodicTerm" ? "PeriodicTermHooks" : "FixedTermHooks",
    hooksFactory: generateHooksFactoryId(HOOKS_FACTORY),
    hooksTemplate: generateHooksTemplateId(HOOKS_TEMPLATE),
    kind: hooksKind
  })
  if (createConfig) {
    let hooksConfig = createHooksConfig(generateHooksConfigId(MARKET), {
      hooks: generateHooksInstanceId(HOOKS),
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
    hooksConfig.pendingAnnualInterestBips = 950
    hooksConfig.pendingAnnualInterestProposalTimestamp = 1720000000
    hooksConfig.pendingAnnualInterestResponseWindowStart = 1720396800
    hooksConfig.pendingAnnualInterestResponseWindowEnd = 1721001600
    hooksConfig.save()
  }
  createMarket(generateMarketId(MARKET), {
    archController: ARCH_CONTROLLER.toHex(),
    isRegistered: true,
    version: "V2",
    controller: null,
    hooksFactory: generateHooksFactoryId(HOOKS_FACTORY),
    hooks: generateHooksInstanceId(HOOKS),
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

describe("Periodic APR proposal clear", () => {
  afterEach(() => {
    clearStore()
  })

  test("clears pending APR proposal state when periodic APR update is applied", () => {
    createStoredMarket("PeriodicTerm", true)

    handleAnnualInterestBipsUpdated(createAnnualInterestBipsUpdatedEvent(950))

    let marketId = generateMarketId(MARKET)
    let hooksConfigId = generateHooksConfigId(MARKET)
    let recordId = "RECORD-" + marketId + "-0"

    assert.entityCount("AnnualInterestBipsUpdated", 1)
    assert.fieldEquals("AnnualInterestBipsUpdated", recordId, "market", marketId)
    assert.fieldEquals(
      "AnnualInterestBipsUpdated",
      recordId,
      "oldAnnualInterestBips",
      "1200"
    )
    assert.fieldEquals(
      "AnnualInterestBipsUpdated",
      recordId,
      "newAnnualInterestBips",
      "950"
    )
    assert.fieldEquals("Market", marketId, "annualInterestBips", "950")
    assert.fieldEquals("Market", marketId, "annualInterestBipsUpdatedIndex", "1")
    assert.fieldEquals("Market", marketId, "eventIndex", "1")
    assert.fieldEquals("HooksConfig", hooksConfigId, "pendingAnnualInterestBips", "0")
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "pendingAnnualInterestProposalTimestamp",
      "0"
    )
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "pendingAnnualInterestResponseWindowStart",
      "0"
    )
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "pendingAnnualInterestResponseWindowEnd",
      "0"
    )
  })

  test("leaves pending APR fields untouched for non-periodic hooks", () => {
    createStoredMarket("FixedTerm", true)

    handleAnnualInterestBipsUpdated(createAnnualInterestBipsUpdatedEvent(950))

    let hooksConfigId = generateHooksConfigId(MARKET)

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
  })

  test("does not create hooks config when APR updates a market without hooks config", () => {
    createStoredMarket("PeriodicTerm", false)

    handleAnnualInterestBipsUpdated(createAnnualInterestBipsUpdatedEvent(950))

    assert.entityCount("HooksConfig", 0)
    assert.entityCount("AnnualInterestBipsUpdated", 1)
  })
})
