import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { createMockedFunction, newMockEvent } from "matchstick-as";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  InterestAndFeesAccrued,
  MarketClosed,
  StateUpdated,
  Transfer,
} from "../generated/templates/WildcatMarket/WildcatMarket";
import {
  createLenderAccount,
  createMarket,
  generateLenderAccountId,
  generateMarketId,
  generateTokenId,
  getMarket,
} from "../generated/UncrashableEntityHelpers";
import {
  handleAnnualInterestBipsUpdated,
  handleInterestAndFeesAccrued,
  handleMarketClosed,
  handleStateUpdated,
  handleTransfer,
} from "../src/wildcat-market";
import { generateEventId } from "../src/utils";
import { createAnnualInterestBipsUpdatedEvent } from "./wildcat-market-utils";

let marketAddress = Address.fromString(
  "0x0000000000000000000000000000000000001001"
);
let assetAddress = Address.fromString(
  "0x0000000000000000000000000000000000001002"
);
let lenderAddress = Address.fromString(
  "0x0000000000000000000000000000000000001003"
);
let secondLenderAddress = Address.fromString(
  "0x0000000000000000000000000000000000001004"
);

function createTransferEvent(
  from: Address,
  to: Address,
  value: BigInt
): Transfer {
  let event = changetype<Transfer>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  );
  event.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "value",
      ethereum.Value.fromUnsignedBigInt(value)
    )
  );
  return event;
}

function createInterestAndFeesAccruedEvent(
  timeDelta: BigInt,
  scaleFactor: BigInt
): InterestAndFeesAccrued {
  let event = changetype<InterestAndFeesAccrued>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "fromTimestamp",
      ethereum.Value.fromUnsignedBigInt(BigInt.zero())
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "toTimestamp",
      ethereum.Value.fromUnsignedBigInt(timeDelta)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "scaleFactor",
      ethereum.Value.fromUnsignedBigInt(scaleFactor)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "baseInterestRay",
      ethereum.Value.fromUnsignedBigInt(BigInt.zero())
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "delinquencyFeeRay",
      ethereum.Value.fromUnsignedBigInt(BigInt.zero())
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "protocolFees",
      ethereum.Value.fromUnsignedBigInt(BigInt.zero())
    )
  );
  return event;
}

function createMarketClosedEvent(timestamp: BigInt): MarketClosed {
  let event = changetype<MarketClosed>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  );
  return event;
}

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

function saveLender(
  address: Address,
  scaledBalance: BigInt,
  lastScaleFactor: BigInt
): string {
  let lenderId = generateLenderAccountId(marketAddress, address);
  let lender = createLenderAccount(lenderId, {
    address,
    market: generateMarketId(marketAddress),
    lastScaleFactor,
    lastUpdatedTimestamp: 0,
    lastUpdatedBlockNumber: 0,
    controllerAuthorization: null,
    hooksAccess: null,
    addedTimestamp: 0,
  });
  lender.scaledBalance = scaledBalance;
  lender.save();
  return lenderId;
}

function accrueInterest(
  isDelinquent: boolean,
  previousTimeDelinquent: i32,
  gracePeriod: i32,
  timeDelta: i32
): string {
  let ray = BigInt.fromI32(10).pow(27);
  saveTotalAssetsMarket();
  let market = getMarket(generateMarketId(marketAddress));
  market.isDelinquent = isDelinquent;
  market.timeDelinquent = previousTimeDelinquent;
  market.delinquencyGracePeriod = gracePeriod;
  market.save();

  let event = createInterestAndFeesAccruedEvent(
    BigInt.fromI32(timeDelta),
    ray
  );
  event.address = marketAddress;
  handleInterestAndFeesAccrued(event);
  return generateEventId(event);
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

  test("self-transfers accrue interest once without changing the balance", () => {
    clearStore();

    let ray = BigInt.fromI32(10).pow(27);
    let marketScaleFactor = BigInt.fromI32(11).times(
      BigInt.fromI32(10).pow(26)
    );
    saveTotalAssetsMarket();
    let market = getMarket(generateMarketId(marketAddress));
    market.scaleFactor = marketScaleFactor;
    market.save();

    let lenderId = saveLender(lenderAddress, BigInt.fromI32(100), ray);

    let event = createTransferEvent(
      lenderAddress,
      lenderAddress,
      BigInt.fromI32(55)
    );
    event.address = marketAddress;
    handleTransfer(event);

    let eventId = generateEventId(event);
    assert.fieldEquals("LenderAccount", lenderId, "scaledBalance", "100");
    assert.fieldEquals(
      "LenderAccount",
      lenderId,
      "lastScaleFactor",
      marketScaleFactor.toString()
    );
    assert.fieldEquals("LenderAccount", lenderId, "totalInterestEarned", "10");
    assert.entityCount("LenderInterestAccrued", 1);
    let interestRecordId = eventId.concat("-").concat(lenderId);
    assert.fieldEquals(
      "LenderInterestAccrued",
      interestRecordId,
      "account",
      lenderId
    );
    assert.fieldEquals(
      "LenderInterestAccrued",
      interestRecordId,
      "interestEarned",
      "10"
    );
    assert.entityCount("Transfer", 1);
    assert.fieldEquals("Transfer", eventId, "from", lenderId);
    assert.fieldEquals("Transfer", eventId, "to", lenderId);
    assert.fieldEquals("Transfer", eventId, "amount", "55");
    assert.fieldEquals("Transfer", eventId, "scaledAmount", "50");
  });

  test("ordinary transfers retain interest records for both lenders", () => {
    clearStore();

    let ray = BigInt.fromI32(10).pow(27);
    let marketScaleFactor = BigInt.fromI32(11).times(
      BigInt.fromI32(10).pow(26)
    );
    saveTotalAssetsMarket();
    let market = getMarket(generateMarketId(marketAddress));
    market.scaleFactor = marketScaleFactor;
    market.save();

    let fromId = saveLender(lenderAddress, BigInt.fromI32(100), ray);
    let toId = saveLender(secondLenderAddress, BigInt.fromI32(40), ray);
    let event = createTransferEvent(
      lenderAddress,
      secondLenderAddress,
      BigInt.fromI32(55)
    );
    event.address = marketAddress;
    handleTransfer(event);

    let eventId = generateEventId(event);
    assert.fieldEquals("LenderAccount", fromId, "scaledBalance", "50");
    assert.fieldEquals("LenderAccount", toId, "scaledBalance", "90");
    assert.fieldEquals("LenderAccount", fromId, "totalInterestEarned", "10");
    assert.fieldEquals("LenderAccount", toId, "totalInterestEarned", "4");
    assert.entityCount("LenderInterestAccrued", 2);
    assert.fieldEquals(
      "LenderInterestAccrued",
      eventId.concat("-").concat(fromId),
      "interestEarned",
      "10"
    );
    assert.fieldEquals(
      "LenderInterestAccrued",
      eventId.concat("-").concat(toId),
      "interestEarned",
      "4"
    );
    assert.fieldEquals("Transfer", eventId, "from", fromId);
    assert.fieldEquals("Transfer", eventId, "to", toId);
    assert.fieldEquals("Transfer", eventId, "amount", "55");
    assert.fieldEquals("Transfer", eventId, "scaledAmount", "50");
  });

  test("healthy periods reduce delinquency time without going negative", () => {
    clearStore();
    let eventId = accrueInterest(false, 20, 60, 30);

    assert.fieldEquals(
      "Market",
      generateMarketId(marketAddress),
      "timeDelinquent",
      "0"
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(marketAddress),
      "isIncurringPenalties",
      "false"
    );
    assert.fieldEquals(
      "MarketInterestAccrued",
      eventId,
      "timeWithPenalties",
      "0"
    );
  });

  test("healthy periods only charge remaining time above grace", () => {
    clearStore();
    let eventId = accrueInterest(false, 70, 60, 30);

    assert.fieldEquals(
      "Market",
      generateMarketId(marketAddress),
      "timeDelinquent",
      "40"
    );
    assert.fieldEquals(
      "MarketInterestAccrued",
      eventId,
      "timeWithPenalties",
      "10"
    );
  });

  test("delinquency crossing grace only charges time beyond grace", () => {
    clearStore();
    let eventId = accrueInterest(true, 50, 60, 30);

    assert.fieldEquals(
      "Market",
      generateMarketId(marketAddress),
      "timeDelinquent",
      "80"
    );
    assert.fieldEquals(
      "MarketInterestAccrued",
      eventId,
      "timeWithPenalties",
      "20"
    );
  });

  test("delinquency already beyond grace charges the full period", () => {
    clearStore();
    let eventId = accrueInterest(true, 70, 60, 30);

    assert.fieldEquals(
      "Market",
      generateMarketId(marketAddress),
      "timeDelinquent",
      "100"
    );
    assert.fieldEquals(
      "MarketInterestAccrued",
      eventId,
      "timeWithPenalties",
      "30"
    );
  });

  test("market closure applies terminal values omitted from its event", () => {
    clearStore();
    saveTotalAssetsMarket();
    let market = getMarket(generateMarketId(marketAddress));
    market.annualInterestBips = 1234;
    market.reserveRatioBips = 2500;
    market.timeDelinquent = 99;
    market.isDelinquent = false;
    market.isIncurringPenalties = true;
    market.save();

    let event = createMarketClosedEvent(BigInt.fromI32(777));
    event.address = marketAddress;
    handleMarketClosed(event);

    let id = generateMarketId(marketAddress);
    assert.fieldEquals("Market", id, "isClosed", "true");
    assert.fieldEquals("Market", id, "annualInterestBips", "0");
    assert.fieldEquals("Market", id, "reserveRatioBips", "10000");
    assert.fieldEquals("Market", id, "timeDelinquent", "0");
    assert.fieldEquals("Market", id, "isDelinquent", "false");
    assert.fieldEquals("Market", id, "isIncurringPenalties", "false");
    assert.entityCount("MarketClosed", 1);
    assert.fieldEquals(
      "MarketClosed",
      "RECORD-".concat(id).concat("-0"),
      "timestamp",
      "777"
    );
  });
});
