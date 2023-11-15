import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { NewController } from "../generated/schema"
import { NewController as NewControllerEvent } from "../generated/WildcatMarketControllerFactory/WildcatMarketControllerFactory"
import { handleNewController } from "../src/wildcat-market-controller-factory"
import { createNewControllerEvent } from "./wildcat-market-controller-factory-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let borrower = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let controller = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let namePrefix = "Example string value"
    let symbolPrefix = "Example string value"
    let newNewControllerEvent = createNewControllerEvent(
      borrower,
      controller,
      namePrefix,
      symbolPrefix
    )
    handleNewController(newNewControllerEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("NewController created and stored", () => {
    assert.entityCount("NewController", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "NewController",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "borrower",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "NewController",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "controller",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "NewController",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "namePrefix",
      "Example string value"
    )
    assert.fieldEquals(
      "NewController",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "symbolPrefix",
      "Example string value"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
