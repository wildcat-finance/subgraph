import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  createMarket,
  generateLenderAccountId,
  generateMarketId,
} from "../generated/UncrashableEntityHelpers";
import {
  handleAnnualInterestBipsUpdated,
  handleAuthorizationStatusUpdated,
} from "../src/wildcat-market";
import { createInitialMarketSnapshot } from "../src/market-domain";
import {
  createAnnualInterestBipsUpdatedEvent,
  createAuthorizationStatusUpdatedEvent,
} from "./wildcat-market-utils";

describe("wildcat market", () => {
  test("tracks annual interest bips updates", () => {
    clearStore();

    let event = createAnnualInterestBipsUpdatedEvent(BigInt.fromI32(900));
    let market = createMarket(generateMarketId(event.address), {
      address: event.address,
      archController: "arch-controller",
      isRegistered: true,
      version: "V2",
      marketKind: "STANDARD",
      originKind: "HOOKS",
      generation: "test",
      abiFamily: "test",
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
      createdAtBlock: BigInt.zero(),
      createdAtTimestamp: BigInt.zero(),
      createdAtTransaction: Address.zero(),
      createdAtLogIndex: BigInt.zero(),
      deployedEvent: "deployed-event",
    });
    createInitialMarketSnapshot(event, market, "EVENT_PROJECTION");

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
    assert.fieldEquals(
      "MarketSnapshot",
      generateMarketId(event.address),
      "annualInterestBips",
      "900"
    );
    assert.fieldEquals(
      "MarketSnapshot",
      generateMarketId(event.address),
      "updatedAtTransaction",
      event.transaction.hash.toHex()
    );

    let lender = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    );
    let authorizationEvent = createAuthorizationStatusUpdatedEvent(lender, 3);
    authorizationEvent.address = event.address;
    authorizationEvent.logIndex = BigInt.fromI32(2);
    handleAuthorizationStatusUpdated(authorizationEvent);

    let lenderAccountId = generateLenderAccountId(event.address, lender);
    assert.fieldEquals(
      "LenderAccountSnapshot",
      lenderAccountId,
      "role",
      "DepositAndWithdraw"
    );
    assert.fieldEquals(
      "LenderAccountSnapshot",
      lenderAccountId,
      "updatedAtTransaction",
      authorizationEvent.transaction.hash.toHex()
    );
  });
});
