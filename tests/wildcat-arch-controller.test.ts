import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address } from "@graphprotocol/graph-ts"
import { generateRegisteredBorrowerId } from "../generated/UncrashableEntityHelpers"
import { handleBorrowerAdded } from "../src/wildcat-arch-controller"
import { createBorrowerAddedEvent } from "./wildcat-arch-controller-utils"

function archControllerAddress(): Address {
  return Address.fromString("0x0000000000000000000000000000000000000100")
}

function borrowerAddress(): Address {
  return Address.fromString("0x0000000000000000000000000000000000000001")
}

describe("WildcatArchController", () => {
  beforeAll(() => {
    let event = createBorrowerAddedEvent(borrowerAddress())
    event.address = archControllerAddress()

    handleBorrowerAdded(event)
  })

  afterAll(() => {
    clearStore()
  })

  test("records borrower registration state and history", () => {
    let registrationId = generateRegisteredBorrowerId(
      archControllerAddress(),
      borrowerAddress()
    )

    assert.entityCount("RegisteredBorrower", 1)
    assert.entityCount("BorrowerRegistrationChange", 1)
    assert.fieldEquals(
      "RegisteredBorrower",
      registrationId,
      "borrower",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "RegisteredBorrower",
      registrationId,
      "isRegistered",
      "true"
    )
  })
})
