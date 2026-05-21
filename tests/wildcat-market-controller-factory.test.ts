import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address } from "@graphprotocol/graph-ts"
import {
  createControllerFactory,
  createParameterConstraints,
  generateControllerFactoryId,
  generateControllerId,
  generateParameterConstraintsId
} from "../generated/UncrashableEntityHelpers"
import { handleNewController } from "../src/wildcat-market-controller-factory"
import { createNewControllerEvent } from "./wildcat-market-controller-factory-utils"

function factoryAddress(): Address {
  return Address.fromString("0x0000000000000000000000000000000000000100")
}

function borrowerAddress(): Address {
  return Address.fromString("0x0000000000000000000000000000000000000001")
}

function controllerAddress(): Address {
  return Address.fromString("0x0000000000000000000000000000000000000002")
}

describe("WildcatMarketControllerFactory", () => {
  beforeAll(() => {
    let factory = factoryAddress()

    createParameterConstraints(generateParameterConstraintsId(factory), {
      minimumDelinquencyGracePeriod: 0,
      maximumDelinquencyGracePeriod: 0,
      minimumReserveRatioBips: 0,
      maximumReserveRatioBips: 0,
      minimumDelinquencyFeeBips: 0,
      maximumDelinquencyFeeBips: 0,
      minimumWithdrawalBatchDuration: 0,
      maximumWithdrawalBatchDuration: 0,
      minimumAnnualInterestBips: 0,
      maximumAnnualInterestBips: 0
    })
    createControllerFactory(generateControllerFactoryId(factory), {
      sentinel: Address.fromString("0x0000000000000000000000000000000000000003"),
      originationFeeAsset: null,
      constraints: generateParameterConstraintsId(factory),
      archController: "arch-controller",
      isRegistered: true
    })

    let event = createNewControllerEvent(
      borrowerAddress(),
      controllerAddress(),
      "Example string value",
      "Example string value"
    )
    event.address = factory

    handleNewController(event)
  })

  afterAll(() => {
    clearStore()
  })

  test("records deployed controller state", () => {
    let controllerId = generateControllerId(controllerAddress())

    assert.entityCount("Controller", 1)
    assert.fieldEquals(
      "Controller",
      controllerId,
      "borrower",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "Controller",
      controllerId,
      "controllerFactory",
      generateControllerFactoryId(factoryAddress())
    )
  })
})
