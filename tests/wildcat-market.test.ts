import {
  assert,
  clearStore,
  describe,
  test,
} from "matchstick-as/assembly/index";
import { createMockedFunction, newMockEvent } from "matchstick-as";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { StateUpdated } from "../generated/templates/WildcatMarket/WildcatMarket";
import {
  createMarket,
  generateMarketId,
  generateTokenId,
} from "../generated/UncrashableEntityHelpers";
import { handleStateUpdated } from "../src/wildcat-market";

let marketAddress = Address.fromString(
  "0x0000000000000000000000000000000000001001"
);
let assetAddress = Address.fromString(
  "0x0000000000000000000000000000000000001002"
);

function marketId(): string {
  return generateMarketId(marketAddress);
}

function saveMarket(): void {
  createMarket(marketId(), {
    archController: "arch-controller",
    isRegistered: true,
    version: "V2",
    controller: null,
    hooksFactory: "hooks-factory",
    hooks: "hooks",
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

describe("market total assets", () => {
  test("refreshes totalAssets when delinquency is unchanged", () => {
    clearStore();
    saveMarket();
    mockMarketBalance(BigInt.fromI32(123));

    handleStateUpdated(createStateUpdatedEvent(false));

    assert.fieldEquals("Market", marketId(), "totalAssets", "123");
    assert.entityCount("DelinquencyStatusChanged", 0);
  });

  test("uses the refreshed balance in delinquency records", () => {
    clearStore();
    saveMarket();
    mockMarketBalance(BigInt.fromI32(456));

    handleStateUpdated(createStateUpdatedEvent(true));

    assert.fieldEquals("Market", marketId(), "totalAssets", "456");
    assert.fieldEquals("Market", marketId(), "isDelinquent", "true");
    assert.fieldEquals(
      "DelinquencyStatusChanged",
      "RECORD-" + marketId() + "-0",
      "totalAssets",
      "456"
    );
  });
});
