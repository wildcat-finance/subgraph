import {
  assert,
  afterEach,
  clearStore,
  createMockedFunction,
  describe,
  test
} from "matchstick-as/assembly/index"
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts"
import { newMockEvent } from "matchstick-as"
import { MarketDeployed } from "../generated/HooksFactory/HooksFactory"
import {
  createHooksFactory,
  createHooksInstance,
  createHooksTemplate,
  createToken,
  generateHooksConfigId,
  generateHooksFactoryId,
  generateHooksInstanceId,
  generateHooksTemplateId,
  generateMarketId,
  generateTokenId
} from "../generated/UncrashableEntityHelpers"
import { handleMarketDeployed } from "../src/hooks-factory"

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
let FIXED_TEMPLATE = Address.fromString(
  "0x0000000000000000000000000000000000002001"
)
let UNKNOWN_TEMPLATE = Address.fromString(
  "0x0000000000000000000000000000000000002002"
)
let PERIODIC_HOOKS = Address.fromString(
  "0x0000000000000000000000000000000000003000"
)
let FIXED_HOOKS = Address.fromString(
  "0x0000000000000000000000000000000000003002"
)
let UNKNOWN_HOOKS = Address.fromString(
  "0x0000000000000000000000000000000000003003"
)
let MARKET = Address.fromString("0x0000000000000000000000000000000000004000")

function singleStringValue(value: string): Array<ethereum.Value> {
  let values = new Array<ethereum.Value>()
  values.push(ethereum.Value.fromString(value))
  return values
}

function singleTupleValue(tuple: ethereum.Tuple): Array<ethereum.Value> {
  let values = new Array<ethereum.Value>()
  values.push(ethereum.Value.fromTuple(tuple))
  return values
}

function singleAddressArg(value: Address): Array<ethereum.Value> {
  let values = new Array<ethereum.Value>()
  values.push(ethereum.Value.fromAddress(value))
  return values
}

function createStoredFixtures(
  hooksAddress: Address,
  hooksTemplate: Address,
  hooksKind: string,
  templateName: string
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
  createHooksTemplate(generateHooksTemplateId(hooksTemplate), {
    name: templateName,
    feeRecipient: FEE_RECIPIENT,
    protocolFeeBips: 50,
    originationFeeAsset: null,
    originationFeeAmount: BigInt.zero(),
    hooksFactory: generateHooksFactoryId(HOOKS_FACTORY)
  })
  createHooksInstance(generateHooksInstanceId(hooksAddress), {
    borrower: BORROWER,
    name: templateName,
    hooksFactory: generateHooksFactoryId(HOOKS_FACTORY),
    hooksTemplate: generateHooksTemplateId(hooksTemplate),
    kind: hooksKind
  })
}

function createMarketDeployedEvent(
  hooksTemplate: Address,
  hooksConfig: BigInt
): MarketDeployed {
  let event = changetype<MarketDeployed>(newMockEvent())
  event.address = HOOKS_FACTORY
  event.parameters = new Array()
  event.parameters.push(
    new ethereum.EventParam(
      "hooksTemplate",
      ethereum.Value.fromAddress(hooksTemplate)
    )
  )
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(MARKET))
  )
  event.parameters.push(
    new ethereum.EventParam("name", ethereum.Value.fromString("Wildcat Mock"))
  )
  event.parameters.push(
    new ethereum.EventParam("symbol", ethereum.Value.fromString("WMOCK"))
  )
  event.parameters.push(
    new ethereum.EventParam("asset", ethereum.Value.fromAddress(ASSET))
  )
  event.parameters.push(
    new ethereum.EventParam(
      "maxTotalSupply",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000000))
    )
  )
  event.parameters.push(
    new ethereum.EventParam(
      "annualInterestBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1200))
    )
  )
  event.parameters.push(
    new ethereum.EventParam(
      "delinquencyFeeBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(200))
    )
  )
  event.parameters.push(
    new ethereum.EventParam(
      "withdrawalBatchDuration",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(86400))
    )
  )
  event.parameters.push(
    new ethereum.EventParam(
      "reserveRatioBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))
    )
  )
  event.parameters.push(
    new ethereum.EventParam(
      "delinquencyGracePeriod",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(604800))
    )
  )
  event.parameters.push(
    new ethereum.EventParam("hooks", ethereum.Value.fromUnsignedBigInt(hooksConfig))
  )

  return event
}

function mockVersion(hooksAddress: Address, version: string): void {
  createMockedFunction(hooksAddress, "version", "version():(string)")
    .returns(singleStringValue(version))
}

function mockPeriodicHookedMarket(): void {
  let tuple = new ethereum.Tuple()
  tuple.push(ethereum.Value.fromBoolean(true))
  tuple.push(ethereum.Value.fromBoolean(false))
  tuple.push(ethereum.Value.fromBoolean(true))
  tuple.push(ethereum.Value.fromBoolean(true))
  tuple.push(ethereum.Value.fromBoolean(true))
  tuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(25)))
  tuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1719792000)))
  tuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(7776000)))
  tuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(604800)))
  tuple.push(ethereum.Value.fromBoolean(true))
  tuple.push(ethereum.Value.fromBoolean(true))

  createMockedFunction(
    PERIODIC_HOOKS,
    "getHookedMarket",
    "getHookedMarket(address):((bool,bool,bool,bool,bool,uint128,uint32,uint32,uint32,bool,bool))"
  ).withArgs(singleAddressArg(MARKET))
    .returns(singleTupleValue(tuple))
}

function mockFixedHookedMarket(): void {
  let tuple = new ethereum.Tuple()
  tuple.push(ethereum.Value.fromBoolean(true))
  tuple.push(ethereum.Value.fromBoolean(true))
  tuple.push(ethereum.Value.fromBoolean(false))
  tuple.push(ethereum.Value.fromBoolean(true))
  tuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50)))
  tuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1735689600)))
  tuple.push(ethereum.Value.fromBoolean(true))
  tuple.push(ethereum.Value.fromBoolean(true))
  tuple.push(ethereum.Value.fromBoolean(false))

  createMockedFunction(
    FIXED_HOOKS,
    "getHookedMarket",
    "getHookedMarket(address):((bool,bool,bool,bool,uint128,uint32,bool,bool,bool))"
  ).withArgs(singleAddressArg(MARKET))
    .returns(singleTupleValue(tuple))
}

describe("HooksFactory MarketDeployed", () => {
  afterEach(() => {
    clearStore()
  })

  test("decodes periodic hooked market config on market deployment", () => {
    createStoredFixtures(
      PERIODIC_HOOKS,
      PERIODIC_TEMPLATE,
      "PeriodicTerm",
      "PeriodicTermHooks"
    )
    mockVersion(PERIODIC_HOOKS, "PeriodicTermHooks")
    mockPeriodicHookedMarket()

    handleMarketDeployed(
      createMarketDeployedEvent(
        PERIODIC_TEMPLATE,
        BigInt.fromString("973633883311512525315588250140672")
      )
    )

    let hooksConfigId = generateHooksConfigId(MARKET)

    assert.entityCount("HooksConfig", 1)
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "hooks",
      generateHooksInstanceId(PERIODIC_HOOKS)
    )
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "market",
      generateMarketId(MARKET)
    )
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnDeposit", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnQueueWithdrawal", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnExecuteWithdrawal", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnTransfer", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnBorrow", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnRepay", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnCloseMarket", "false")
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnNukeFromOrbit", "false")
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnSetMaxTotalSupply", "true")
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "useOnSetAnnualInterestAndReserveRatioBips",
      "true"
    )
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnSetProtocolFeeBips", "false")
    assert.fieldEquals("HooksConfig", hooksConfigId, "depositRequiresAccess", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "transferRequiresAccess", "false")
    assert.fieldEquals("HooksConfig", hooksConfigId, "queueWithdrawalRequiresAccess", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "transfersDisabled", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "minimumDeposit", "25")
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "firstWithdrawalWindowStart",
      "1719792000"
    )
    assert.fieldEquals("HooksConfig", hooksConfigId, "periodDuration", "7776000")
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "withdrawalWindowDuration",
      "604800"
    )
    assert.fieldEquals("HooksConfig", hooksConfigId, "periodicTermClosed", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "fixedTermEndTime", "0")
    assert.fieldEquals("HooksConfig", hooksConfigId, "pendingAnnualInterestBips", "0")
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "pendingAnnualInterestProposalTimestamp",
      "0"
    )
    assert.fieldEquals(
      "HooksInstance",
      generateHooksInstanceId(PERIODIC_HOOKS),
      "numMarkets",
      "1"
    )
  })

  test("still decodes fixed hooked market config through the fixed branch", () => {
    createStoredFixtures(FIXED_HOOKS, FIXED_TEMPLATE, "FixedTerm", "FixedTermHooks")
    mockVersion(FIXED_HOOKS, "FixedTermHooks")
    mockFixedHookedMarket()

    handleMarketDeployed(
      createMarketDeployedEvent(
        FIXED_TEMPLATE,
        BigInt.fromString("973792339636541053990775338041344")
      )
    )

    let hooksConfigId = generateHooksConfigId(MARKET)

    assert.entityCount("HooksConfig", 1)
    assert.fieldEquals("HooksConfig", hooksConfigId, "depositRequiresAccess", "false")
    assert.fieldEquals("HooksConfig", hooksConfigId, "transferRequiresAccess", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "queueWithdrawalRequiresAccess", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "transfersDisabled", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "minimumDeposit", "50")
    assert.fieldEquals("HooksConfig", hooksConfigId, "fixedTermEndTime", "1735689600")
    assert.fieldEquals("HooksConfig", hooksConfigId, "allowClosureBeforeTerm", "true")
    assert.fieldEquals("HooksConfig", hooksConfigId, "allowTermReduction", "false")
    assert.fieldEquals("HooksConfig", hooksConfigId, "firstWithdrawalWindowStart", "0")
  })

  test("keeps unknown hook versions neutral instead of falling back to fixed", () => {
    createStoredFixtures(UNKNOWN_HOOKS, UNKNOWN_TEMPLATE, "Unknown", "UnknownHooks")
    mockVersion(UNKNOWN_HOOKS, "UnknownHooks")

    handleMarketDeployed(
      createMarketDeployedEvent(
        UNKNOWN_TEMPLATE,
        BigInt.fromString("973871567799055318328368881991680")
      )
    )

    let hooksConfigId = generateHooksConfigId(MARKET)

    assert.entityCount("HooksConfig", 1)
    assert.fieldEquals("HooksConfig", hooksConfigId, "depositRequiresAccess", "false")
    assert.fieldEquals("HooksConfig", hooksConfigId, "transferRequiresAccess", "false")
    assert.fieldEquals("HooksConfig", hooksConfigId, "queueWithdrawalRequiresAccess", "false")
    assert.fieldEquals("HooksConfig", hooksConfigId, "transfersDisabled", "false")
    assert.fieldEquals("HooksConfig", hooksConfigId, "fixedTermEndTime", "0")
    assert.fieldEquals("HooksConfig", hooksConfigId, "firstWithdrawalWindowStart", "0")
    assert.fieldEquals("HooksConfig", hooksConfigId, "periodDuration", "0")
    assert.fieldEquals("HooksConfig", hooksConfigId, "withdrawalWindowDuration", "0")
    assert.fieldEquals("HooksConfig", hooksConfigId, "periodicTermClosed", "false")
  })
})
