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
  createController,
  generateControllerId,
  generateLenderAuthorizationId
} from "../generated/UncrashableEntityHelpers"
import { handleLenderAuthorized } from "../src/wildcat-market-controller"
import { createLenderAuthorizedEvent } from "./wildcat-market-controller-utils"

function controllerAddress(): Address {
  return Address.fromString("0x0000000000000000000000000000000000000100")
}

function lenderAddress(): Address {
  return Address.fromString("0x0000000000000000000000000000000000000001")
}

describe("WildcatMarketController", () => {
  beforeAll(() => {
    let controller = controllerAddress()
    let lender = lenderAddress()

    createController(generateControllerId(controller), {
      borrower: Address.fromString("0x0000000000000000000000000000000000000002"),
      controllerFactory: "controller-factory",
      archController: "arch-controller",
      isRegistered: true
    })
    let newLenderAuthorizedEvent = createLenderAuthorizedEvent(lender)
    newLenderAuthorizedEvent.address = controller

    handleLenderAuthorized(newLenderAuthorizedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  test("records lender authorization state and history", () => {
    let controller = controllerAddress()
    let lender = lenderAddress()
    let authorizationId = generateLenderAuthorizationId(controller, lender)

    assert.entityCount("LenderAuthorization", 1)
    assert.entityCount("LenderAuthorizationChange", 1)
    assert.fieldEquals(
      "LenderAuthorization",
      authorizationId,
      "lender",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "LenderAuthorization",
      authorizationId,
      "authorized",
      "true"
    )
    assert.fieldEquals(
      "LenderAuthorization",
      authorizationId,
      "controller",
      generateControllerId(controller)
    )
  })
})
