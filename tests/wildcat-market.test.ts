import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { createMockedFunction, newMockEvent } from "matchstick-as";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { StateUpdated } from "../generated/templates/WildcatMarket/WildcatMarket";
import {
  createMarket,
  generateMarketId,
  generateTokenId,
} from "../generated/UncrashableEntityHelpers";
import {
  handleAnnualInterestBipsUpdated,
  handleStateUpdated,
} from "../src/wildcat-market";
import { createAnnualInterestBipsUpdatedEvent } from "./wildcat-market-utils";

let marketAddress = Address.fromString(
  "0x0000000000000000000000000000000000001001"
);
let assetAddress = Address.fromString(
  "0x0000000000000000000000000000000000001002"
);

function saveTotalAssetsMarket(): void {
  createMarket(generateMarketId(marketAddress), {
    archController: "arch-controller",
    isRegistered: true,
    version: "V2",
    controller: null,
    hooksFactory: null,
    hooks: null,
    borrower: Address.zero(),
    sentinel: Address.zero(),
    feeRecipient: Address.zero(),
    name: "total assets test market",
    symbol: "TATM",
    decimals: 18,
    protocolFeeBips: 0,
    delinquencyGracePeriod: 0,
    delinquencyFeeBips: 0,
    asset: generateTokenId(assetAddress),
    withdrawalBatchDuration: 0,
    totalAssets: BigInt.zero(),
    maxTotalSupply: BigInt.zero(),
    annualInterestBips: 0,
    reserveRatioBips: 0,
    scaleFactor: BigInt.fromI32(10).pow(27),
    lastInterestAccruedTimestamp: 0,
    lastInterestAccruedBlockNumber: 0,
    numCollateralContracts: 0,
    createdAt: 0,
    deployedEvent: "deployed-event",
  });
}

function createStateUpdatedEvent(isDelinquent: boolean): StateUpdated {
  let event = changetype<StateUpdated>(newMockEvent());
  event.address = marketAddress;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "scaleFactor",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10).pow(27))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "isDelinquent",
      ethereum.Value.fromBoolean(isDelinquent)
    )
  );
  return event;
}

function mockMarketBalance(totalAssets: BigInt): void {
  createMockedFunction(
    assetAddress,
    "balanceOf",
    "balanceOf(address):(uint256)"
  )
    .withArgs([ethereum.Value.fromAddress(marketAddress)])
    .returns([ethereum.Value.fromUnsignedBigInt(totalAssets)]);
}

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
      totalAssets: BigInt.zero(),
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

  test("refreshes totalAssets when delinquency is unchanged", () => {
    clearStore();
    saveTotalAssetsMarket();
    mockMarketBalance(BigInt.fromI32(123));

    handleStateUpdated(createStateUpdatedEvent(false));

    assert.fieldEquals(
      "Market",
      generateMarketId(marketAddress),
      "totalAssets",
      "123"
    );
    assert.entityCount("DelinquencyStatusChanged", 0);
  });

  test("uses the refreshed balance in delinquency records", () => {
    clearStore();
    saveTotalAssetsMarket();
    mockMarketBalance(BigInt.fromI32(456));

    handleStateUpdated(createStateUpdatedEvent(true));

    let id = generateMarketId(marketAddress);
    assert.fieldEquals("Market", id, "totalAssets", "456");
    assert.fieldEquals("Market", id, "isDelinquent", "true");
    assert.fieldEquals(
      "DelinquencyStatusChanged",
      "RECORD-" + id + "-0",
      "totalAssets",
      "456"
    );
  });
});
