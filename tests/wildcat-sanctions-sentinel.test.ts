import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address } from "@graphprotocol/graph-ts"
import { NewSanctionsEscrow } from "../generated/schema"
import { NewSanctionsEscrow as NewSanctionsEscrowEvent } from "../generated/WildcatSanctionsSentinel/WildcatSanctionsSentinel"
import { handleNewSanctionsEscrow } from "../src/wildcat-sanctions-sentinel"
import { createNewSanctionsEscrowEvent } from "./wildcat-sanctions-sentinel-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let borrower = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let account = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let asset = Address.fromString("0x0000000000000000000000000000000000000001")
    let newNewSanctionsEscrowEvent = createNewSanctionsEscrowEvent(
      borrower,
      account,
      asset
    )
    handleNewSanctionsEscrow(newNewSanctionsEscrowEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("NewSanctionsEscrow created and stored", () => {
    assert.entityCount("NewSanctionsEscrow", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "NewSanctionsEscrow",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "borrower",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "NewSanctionsEscrow",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "account",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "NewSanctionsEscrow",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "asset",
      "0x0000000000000000000000000000000000000001"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
