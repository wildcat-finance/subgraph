import {
  assert,
  afterEach,
  beforeEach,
  clearStore,
  createMockedFunction,
  describe,
  test
} from "matchstick-as/assembly/index"
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts"
import { newMockEvent } from "matchstick-as"
import { HooksInstanceDeployed } from "../generated/HooksFactory/HooksFactory"
import {
  createHooksFactory,
  createHooksTemplate,
  generateHooksFactoryId,
  generateHooksInstanceId,
  generateHooksTemplateId,
  generateRoleProviderId
} from "../generated/UncrashableEntityHelpers"
import { handleHooksInstanceDeployed } from "../src/hooks-factory"

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
let PERIODIC_TEMPLATE = Address.fromString(
  "0x0000000000000000000000000000000000002000"
)
let UNKNOWN_TEMPLATE = Address.fromString(
  "0x0000000000000000000000000000000000002001"
)
let PERIODIC_HOOKS = Address.fromString(
  "0x0000000000000000000000000000000000003000"
)
let UNKNOWN_HOOKS = Address.fromString(
  "0x0000000000000000000000000000000000003001"
)
let ROLE_PROVIDER = Address.fromString(
  "0x00000000000000000000000000000000000000aa"
)

function createHooksInstanceDeployedEvent(
  hooksInstance: Address,
  hooksTemplate: Address
): HooksInstanceDeployed {
  let event = changetype<HooksInstanceDeployed>(newMockEvent())
  event.address = HOOKS_FACTORY
  event.parameters = new Array()
  event.parameters.push(
    new ethereum.EventParam(
      "hooksInstance",
      ethereum.Value.fromAddress(hooksInstance)
    )
  )
  event.parameters.push(
    new ethereum.EventParam(
      "hooksTemplate",
      ethereum.Value.fromAddress(hooksTemplate)
    )
  )

  return event
}

function createStoredHooksFactory(): void {
  createHooksFactory(generateHooksFactoryId(HOOKS_FACTORY), {
    archController: ARCH_CONTROLLER.toHex(),
    isRegistered: true,
    sentinel: SENTINEL
  })
}

function createStoredHooksTemplate(
  hooksTemplate: Address,
  templateName: string
): void {
  createHooksTemplate(generateHooksTemplateId(hooksTemplate), {
    name: templateName,
    feeRecipient: FEE_RECIPIENT,
    protocolFeeBips: 0,
    originationFeeAsset: null,
    originationFeeAmount: BigInt.zero(),
    hooksFactory: generateHooksFactoryId(HOOKS_FACTORY)
  })
}

function singleAddressValue(value: Address): Array<ethereum.Value> {
  let values = new Array<ethereum.Value>()
  values.push(ethereum.Value.fromAddress(value))
  return values
}

function singleStringValue(value: string): Array<ethereum.Value> {
  let values = new Array<ethereum.Value>()
  values.push(ethereum.Value.fromString(value))
  return values
}

function singleProviderValue(encodedProvider: BigInt): Array<ethereum.Value> {
  let providers = new Array<BigInt>()
  providers.push(encodedProvider)

  let values = new Array<ethereum.Value>()
  values.push(ethereum.Value.fromUnsignedBigIntArray(providers))
  return values
}

function emptyProviderValue(): Array<ethereum.Value> {
  let providers = new Array<BigInt>()
  let values = new Array<ethereum.Value>()
  values.push(ethereum.Value.fromUnsignedBigIntArray(providers))
  return values
}

function mockHooksIdentity(hooksInstance: Address, name: string): void {
  createMockedFunction(hooksInstance, "borrower", "borrower():(address)")
    .returns(singleAddressValue(BORROWER))
  createMockedFunction(hooksInstance, "name", "name():(string)")
    .returns(singleStringValue(name))
}

describe("HooksFactory", () => {
  beforeEach(() => {
    createStoredHooksFactory()
  })

  afterEach(() => {
    clearStore()
  })

  test("classifies PeriodicTermHooks as provider-capable periodic hooks", () => {
    createStoredHooksTemplate(PERIODIC_TEMPLATE, "PeriodicTermHooks")
    mockHooksIdentity(PERIODIC_HOOKS, "Periodic hooks")

    createMockedFunction(
      PERIODIC_HOOKS,
      "getPullProviders",
      "getPullProviders():(uint256[])"
    ).returns(
      singleProviderValue(
        BigInt.fromString(
          "1617596800029038387680020905221177840418228665355570295360946261917696"
        )
      )
    )
    createMockedFunction(
      PERIODIC_HOOKS,
      "getPushProviders",
      "getPushProviders():(uint256[])"
    ).returns(emptyProviderValue())

    let event = createHooksInstanceDeployedEvent(
      PERIODIC_HOOKS,
      PERIODIC_TEMPLATE
    )
    handleHooksInstanceDeployed(event)

    let hooksId = generateHooksInstanceId(PERIODIC_HOOKS)
    let templateId = generateHooksTemplateId(PERIODIC_TEMPLATE)
    let providerId = generateRoleProviderId(PERIODIC_HOOKS, ROLE_PROVIDER)

    assert.entityCount("HooksInstance", 1)
    assert.fieldEquals("HooksInstance", hooksId, "kind", "PeriodicTerm")
    assert.fieldEquals("HooksInstance", hooksId, "name", "Periodic hooks")
    assert.fieldEquals("HooksInstance", hooksId, "borrower", BORROWER.toHex())
    assert.fieldEquals("HooksInstance", hooksId, "hooksTemplate", templateId)
    assert.fieldEquals(
      "HooksInstance",
      hooksId,
      "hooksFactory",
      generateHooksFactoryId(HOOKS_FACTORY)
    )
    assert.fieldEquals("HooksInstance", hooksId, "eventIndex", "1")
    assert.fieldEquals("HooksInstance", hooksId, "numMarkets", "0")

    assert.entityCount("RoleProvider", 1)
    assert.fieldEquals(
      "RoleProvider",
      providerId,
      "providerAddress",
      ROLE_PROVIDER.toHex()
    )
    assert.fieldEquals("RoleProvider", providerId, "hooks", hooksId)
    assert.fieldEquals("RoleProvider", providerId, "timeToLive", "60")
    assert.fieldEquals("RoleProvider", providerId, "isPullProvider", "true")
    assert.fieldEquals("RoleProvider", providerId, "pullProviderIndex", "1")
    assert.fieldEquals("RoleProvider", providerId, "isPushProvider", "false")
    assert.fieldEquals(
      "RoleProvider",
      providerId,
      "pushProviderIndex",
      "16777215"
    )
    assert.fieldEquals("RoleProvider", providerId, "isApproved", "true")

    assert.entityCount("RoleProviderAdded", 1)
    assert.fieldEquals(
      "RoleProviderAdded",
      "RECORD-" + hooksId + "-0",
      "provider",
      providerId
    )
    assert.fieldEquals(
      "RoleProviderAdded",
      "RECORD-" + hooksId + "-0",
      "eventIndex",
      "0"
    )

    assert.entityCount("HooksInstanceDeployed", 1)
    assert.fieldEquals(
      "HooksInstanceDeployed",
      hooksId + "-0",
      "hooks",
      hooksId
    )
    assert.fieldEquals(
      "HooksInstanceDeployed",
      hooksId + "-0",
      "hooksTemplate",
      templateId
    )

    assert.fieldEquals(
      "HooksFactory",
      generateHooksFactoryId(HOOKS_FACTORY),
      "eventIndex",
      "1"
    )
  })

  test("leaves unknown hook templates classified as unknown without decoding providers", () => {
    createStoredHooksTemplate(UNKNOWN_TEMPLATE, "UnknownHooks")
    mockHooksIdentity(UNKNOWN_HOOKS, "Unknown hooks")

    let event = createHooksInstanceDeployedEvent(UNKNOWN_HOOKS, UNKNOWN_TEMPLATE)
    handleHooksInstanceDeployed(event)

    let hooksId = generateHooksInstanceId(UNKNOWN_HOOKS)

    assert.entityCount("HooksInstance", 1)
    assert.fieldEquals("HooksInstance", hooksId, "kind", "Unknown")
    assert.fieldEquals("HooksInstance", hooksId, "name", "Unknown hooks")
    assert.fieldEquals("HooksInstance", hooksId, "borrower", BORROWER.toHex())
    assert.fieldEquals("HooksInstance", hooksId, "eventIndex", "0")

    assert.entityCount("RoleProvider", 0)
    assert.entityCount("RoleProviderAdded", 0)
    assert.entityCount("HooksInstanceDeployed", 1)
  })
})
