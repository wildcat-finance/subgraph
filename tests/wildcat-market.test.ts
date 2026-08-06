import {
  assert,
  clearStore,
  describe,
  test
} from "matchstick-as/assembly/index";
import { createMockedFunction, newMockEvent } from "matchstick-as";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { StateUpdated } from "../generated/templates/WildcatMarket/WildcatMarket";
import {
  createLenderAccount,
  createMarket,
  generateLenderAccountId,
  generateMarketId,
  generateTokenId,
  getMarket
} from "../generated/UncrashableEntityHelpers";
import {
  handleInterestAndFeesAccrued,
  handleMarketClosed,
  handleStateUpdated,
  handleTransfer
} from "../src/wildcat-market";
import { generateEventId } from "../src/utils";
import {
  createMarketClosedEvent,
  createScaleFactorUpdatedEvent,
  createTransferEvent
} from "./wildcat-market-utils";

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
    deployedEvent: "deployed-event"
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
    market: marketId(),
    lastScaleFactor,
    lastUpdatedTimestamp: 0,
    lastUpdatedBlockNumber: 0,
    controllerAuthorization: null,
    hooksAccess: null,
    addedTimestamp: 0
  });
  lender.scaledBalance = scaledBalance;
  lender.save();
  return lenderId;
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

describe("market transfers", () => {
  test("self-transfers accrue interest once without changing the balance", () => {
    clearStore();

    let ray = BigInt.fromI32(10).pow(27);
    let marketScaleFactor = BigInt.fromI32(11).times(
      BigInt.fromI32(10).pow(26)
    );
    saveMarket();
    let market = getMarket(marketId());
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
    saveMarket();
    let market = getMarket(marketId());
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
});

function accrueInterest(
  isDelinquent: boolean,
  previousTimeDelinquent: i32,
  gracePeriod: i32,
  timeDelta: i32
): string {
  let ray = BigInt.fromI32(10).pow(27);
  saveMarket();
  let market = getMarket(marketId());
  market.isDelinquent = isDelinquent;
  market.timeDelinquent = previousTimeDelinquent;
  market.delinquencyGracePeriod = gracePeriod;
  market.save();

  let event = createScaleFactorUpdatedEvent(
    BigInt.zero(),
    BigInt.fromI32(timeDelta),
    ray,
    BigInt.zero(),
    BigInt.zero(),
    BigInt.zero()
  );
  event.address = marketAddress;
  handleInterestAndFeesAccrued(event);
  return generateEventId(event);
}

describe("market delinquency timing", () => {
  test("healthy periods reduce delinquency time without going negative", () => {
    clearStore();
    let eventId = accrueInterest(false, 20, 60, 30);

    assert.fieldEquals("Market", marketId(), "timeDelinquent", "0");
    assert.fieldEquals("Market", marketId(), "isIncurringPenalties", "false");
    assert.fieldEquals(
      "MarketInterestAccrued",
      eventId,
      "timeWithPenalties",
      "0"
    );
  });

  test("healthy periods only charge the remaining time above grace", () => {
    clearStore();
    let eventId = accrueInterest(false, 70, 60, 30);

    assert.fieldEquals("Market", marketId(), "timeDelinquent", "40");
    assert.fieldEquals("Market", marketId(), "isIncurringPenalties", "false");
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

    assert.fieldEquals("Market", marketId(), "timeDelinquent", "80");
    assert.fieldEquals("Market", marketId(), "isIncurringPenalties", "true");
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

    assert.fieldEquals("Market", marketId(), "timeDelinquent", "100");
    assert.fieldEquals("Market", marketId(), "isIncurringPenalties", "true");
    assert.fieldEquals(
      "MarketInterestAccrued",
      eventId,
      "timeWithPenalties",
      "30"
    );
  });
});

describe("market closure", () => {
  test("applies terminal market values not included in MarketClosed", () => {
    clearStore();
    saveMarket();
    let market = getMarket(marketId());
    market.annualInterestBips = 1234;
    market.reserveRatioBips = 2500;
    market.timeDelinquent = 99;
    market.isDelinquent = false;
    market.isIncurringPenalties = true;
    market.save();

    let event = createMarketClosedEvent(BigInt.fromI32(777));
    event.address = marketAddress;
    handleMarketClosed(event);

    assert.fieldEquals("Market", marketId(), "isClosed", "true");
    assert.fieldEquals("Market", marketId(), "annualInterestBips", "0");
    assert.fieldEquals("Market", marketId(), "reserveRatioBips", "10000");
    assert.fieldEquals("Market", marketId(), "timeDelinquent", "0");
    assert.fieldEquals("Market", marketId(), "isDelinquent", "false");
    assert.fieldEquals("Market", marketId(), "isIncurringPenalties", "false");
    assert.entityCount("MarketClosed", 1);
    assert.fieldEquals(
      "MarketClosed",
      "RECORD-".concat(marketId()).concat("-0"),
      "timestamp",
      "777"
    );
  });
});
