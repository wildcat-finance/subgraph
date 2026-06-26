import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  createMarket,
  generateMarketId,
} from "../generated/UncrashableEntityHelpers";
import { handleAnnualInterestBipsUpdated } from "../src/wildcat-market";
import { createAnnualInterestBipsUpdatedEvent } from "./wildcat-market-utils";

describe("wildcat market", () => {
  test("tracks annual interest bips updates", () => {
    clearStore();

    let event = createAnnualInterestBipsUpdatedEvent(BigInt.fromI32(900));
    createMarket(generateMarketId(event.address), {
      archController: "arch-controller",
      isRegistered: true,
      version: "V2",
      controller: null,
      hooksFactory: null,
      hooks: null,
      borrower: Address.zero(),
      sentinel: Address.zero(),
      feeRecipient: Address.zero(),
      name: "market",
      symbol: "mkt",
      decimals: 18,
      protocolFeeBips: 0,
      delinquencyGracePeriod: 0,
      delinquencyFeeBips: 0,
      asset: "asset",
      withdrawalBatchDuration: 0,
      maxTotalSupply: BigInt.zero(),
      annualInterestBips: 1200,
      reserveRatioBips: 0,
      scaleFactor: BigInt.zero(),
      lastInterestAccruedTimestamp: 0,
      lastInterestAccruedBlockNumber: 0,
      numCollateralContracts: 0,
      createdAt: 0,
      deployedEvent: "deployed-event",
    });

    handleAnnualInterestBipsUpdated(event);

    let updateId = "RECORD-" + generateMarketId(event.address) + "-0";
    assert.entityCount("AnnualInterestBipsUpdated", 1);
    assert.fieldEquals(
      "AnnualInterestBipsUpdated",
      updateId,
      "oldAnnualInterestBips",
      "1200"
    );
    assert.fieldEquals(
      "AnnualInterestBipsUpdated",
      updateId,
      "newAnnualInterestBips",
      "900"
    );
    assert.fieldEquals("Market", generateMarketId(event.address), "eventIndex", "1");
    assert.fieldEquals(
      "Market",
      generateMarketId(event.address),
      "annualInterestBips",
      "900"
    );
  });
});
