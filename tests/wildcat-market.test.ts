import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Address } from "@graphprotocol/graph-ts"
import { AnnualInterestBipsUpdated } from "../generated/schema"
import { AnnualInterestBipsUpdated as AnnualInterestBipsUpdatedEvent } from "../generated/WildcatMarket/WildcatMarket"
import { handleAnnualInterestBipsUpdated } from "../src/wildcat-market"
import { createAnnualInterestBipsUpdatedEvent } from "./wildcat-market-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let annualInterestBipsUpdated = BigInt.fromI32(234)
    let newAnnualInterestBipsUpdatedEvent = createAnnualInterestBipsUpdatedEvent(
      annualInterestBipsUpdated
    )
    handleAnnualInterestBipsUpdated(newAnnualInterestBipsUpdatedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("AnnualInterestBipsUpdated created and stored", () => {
    assert.entityCount("AnnualInterestBipsUpdated", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "AnnualInterestBipsUpdated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "annualInterestBipsUpdated",
      "234"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
