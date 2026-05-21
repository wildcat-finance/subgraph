import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  createMarket,
  createToken,
  generateMarketId,
  generateTokenId
} from "../generated/UncrashableEntityHelpers"
import { handleAnnualInterestBipsUpdated } from "../src/wildcat-market"
import { createAnnualInterestBipsUpdatedEvent } from "./wildcat-market-utils"

function archControllerAddress(): Address {
  return Address.fromString("0x0000000000000000000000000000000000000100")
}

function borrowerAddress(): Address {
  return Address.fromString("0x0000000000000000000000000000000000000001")
}

function marketAddress(): Address {
  return Address.fromString("0x0000000000000000000000000000000000000002")
}

function assetAddress(): Address {
  return Address.fromString("0x0000000000000000000000000000000000000003")
}

describe("WildcatMarket", () => {
  beforeAll(() => {
    let asset = assetAddress()
    let market = marketAddress()

    createToken(generateTokenId(asset), {
      address: asset,
      name: "Mock Asset",
      symbol: "MOCK",
      decimals: 18,
      isMock: true
    })
    createMarket(generateMarketId(market), {
      archController: archControllerAddress().toHex(),
      isRegistered: true,
      version: "V2",
      controller: null,
      hooksFactory: null,
      hooks: null,
      borrower: borrowerAddress(),
      sentinel: Address.fromString("0x0000000000000000000000000000000000000004"),
      feeRecipient: Address.fromString("0x0000000000000000000000000000000000000005"),
      name: "Wildcat Mock",
      symbol: "WMOCK",
      decimals: 18,
      protocolFeeBips: 50,
      delinquencyGracePeriod: 604800,
      delinquencyFeeBips: 200,
      asset: generateTokenId(asset),
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

    let event = createAnnualInterestBipsUpdatedEvent(BigInt.fromI32(234))
    event.address = market

    handleAnnualInterestBipsUpdated(event)
  })

  afterAll(() => {
    clearStore()
  })

  test("records APR update history and current market APR", () => {
    let marketId = generateMarketId(marketAddress())
    let recordId = "RECORD-" + marketId + "-0"

    assert.entityCount("AnnualInterestBipsUpdated", 1)
    assert.fieldEquals(
      "AnnualInterestBipsUpdated",
      recordId,
      "market",
      marketId
    )
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
      "234"
    )
    assert.fieldEquals("Market", marketId, "annualInterestBips", "234")
  })
})
