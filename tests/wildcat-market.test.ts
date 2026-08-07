import {
  assert,
  clearStore,
  dataSourceMock,
  describe,
  test
} from "matchstick-as/assembly/index";
import { createMockedFunction, newMockEvent } from "matchstick-as";
import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { StateUpdated } from "../generated/templates/WildcatMarket/WildcatMarket";
import {
  createLenderAccount,
  createMarket,
  createToken,
  createWithdrawalBatch,
  generateBorrowerStatsId,
  generateLenderAccountId,
  generateLenderStatsId,
  generateMarketId,
  generateProtocolStatsId,
  generateTokenId,
  generateWithdrawalBatchId,
  getMarket
} from "../generated/UncrashableEntityHelpers";
import {
  handleBorrow,
  handleDeposit,
  handleFeesCollected,
  handleInterestAndFeesAccrued,
  handleMarketClosed,
  handleSanctionedAccountAssetsQueuedForWithdrawal,
  handleStateUpdated,
  handleTransfer,
  handleWithdrawalBatchClosed,
  handleWithdrawalBatchExpired,
  handleWithdrawalBatchPayment,
  handleWithdrawalExecuted,
  handleWithdrawalQueued
} from "../src/wildcat-market";
import { updateMarketTotalDebtUSD } from "../src/daily-stats";
import { generateEventId } from "../src/utils";
import {
  createBorrowEvent,
  createDepositEvent,
  createFeesCollectedEvent,
  createMarketClosedEvent,
  createSanctionedAccountAssetsQueuedForWithdrawalEvent,
  createScaleFactorUpdatedEvent,
  createTransferEvent,
  createWithdrawalBatchClosedEvent,
  createWithdrawalBatchExpiredEvent,
  createWithdrawalBatchPaymentEvent,
  createWithdrawalExecutedEvent,
  createWithdrawalQueuedEvent
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
    hooks: Address.zero().toHex(),
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
    usdTotalsComplete: true,
    totalDebtUSD: BigDecimal.zero(),
    numCollateralContracts: 0,
    createdAt: 0,
    deployedEvent: "deployed-event"
  });
}

function saveStableToken(decimals: i32): void {
  createToken(generateTokenId(assetAddress), {
    address: assetAddress,
    name: "Test USD",
    symbol: "TUSD",
    decimals,
    isMock: false,
    isUsdStablecoin: true
  });
  let market = getMarket(marketId());
  market.decimals = decimals;
  market.save();
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

describe("market analytics accounting", () => {
  test("reports zero debt in USD without requiring a token price", () => {
    clearStore();
    dataSourceMock.setNetwork("plasma-testnet");
    saveMarket();
    createToken(generateTokenId(assetAddress), {
      address: assetAddress,
      name: "Unpriced",
      symbol: "NOPE",
      decimals: 18,
      isMock: false,
      isUsdStablecoin: false
    });
    let market = getMarket(marketId());
    market.totalDebtUSD = null;

    updateMarketTotalDebtUSD(market, BigInt.zero());
    market.save();

    assert.fieldEquals("Market", marketId(), "totalDebtUSD", "0");
  });

  test("preserves legacy daily deltas alongside cumulative snapshots", () => {
    clearStore();
    saveMarket();
    saveStableToken(6);

    let deposit = createDepositEvent(
      lenderAddress,
      BigInt.fromI32(1500000),
      BigInt.fromI32(1500000)
    );
    deposit.address = marketAddress;
    handleDeposit(deposit);

    let borrow = createBorrowEvent(BigInt.fromI32(500000));
    borrow.address = marketAddress;
    handleBorrow(borrow);

    let dailyId = marketId().concat("-0");
    assert.fieldEquals("Market", marketId(), "totalDeposited", "1500000");
    assert.fieldEquals("Market", marketId(), "totalBorrowed", "500000");
    assert.fieldEquals("Market", marketId(), "totalDepositedUSD", "1.5");
    assert.fieldEquals("Market", marketId(), "totalBorrowedUSD", "0.5");
    assert.fieldEquals("Market", marketId(), "totalDebtUSD", "1.5");
    assert.fieldEquals("Market", marketId(), "usdTotalsComplete", "true");

    assert.fieldEquals("MarketDailyStats", dailyId, "totalDeposited", "1500000");
    assert.fieldEquals("MarketDailyStats", dailyId, "dayDeposited", "1500000");
    assert.fieldEquals(
      "MarketDailyStats",
      dailyId,
      "cumulativeDeposited",
      "1500000"
    );
    assert.fieldEquals("MarketDailyStats", dailyId, "totalBorrowed", "500000");
    assert.fieldEquals("MarketDailyStats", dailyId, "dayBorrowed", "500000");
    assert.fieldEquals(
      "MarketDailyStats",
      dailyId,
      "cumulativeBorrowed",
      "500000"
    );
    assert.fieldEquals("MarketDailyStats", dailyId, "usdPrice", "1");

    let protocolId = generateProtocolStatsId();
    assert.fieldEquals("ProtocolStats", protocolId, "totalDepositedUSD", "1.5");
    assert.fieldEquals("ProtocolStats", protocolId, "totalBorrowedUSD", "0.5");
    assert.fieldEquals("ProtocolStats", protocolId, "numActiveMarkets", "1");
    assert.fieldEquals("ProtocolStats", protocolId, "numActiveBorrowers", "1");
    assert.fieldEquals("ProtocolStats", protocolId, "numActiveLenders", "1");
    assert.fieldEquals(
      "ProtocolStats",
      protocolId,
      "numActiveLenderAccounts",
      "1"
    );
    assert.fieldEquals("ProtocolDailyStats", "PROTOCOL-0", "numActiveMarkets", "1");
    assert.fieldEquals("ProtocolDailyStats", "PROTOCOL-0", "dayDepositedUSD", "1.5");
    assert.fieldEquals("ProtocolDailyStats", "PROTOCOL-0", "dayBorrowedUSD", "0.5");
  });

  test("marks aggregates incomplete instead of treating a missing price as zero", () => {
    clearStore();
    dataSourceMock.setNetwork("plasma-testnet");
    saveMarket();
    createToken(generateTokenId(assetAddress), {
      address: assetAddress,
      name: "Unpriced",
      symbol: "NOPE",
      decimals: 18,
      isMock: false,
      isUsdStablecoin: false
    });

    let deposit = createDepositEvent(
      lenderAddress,
      BigInt.fromI32(100),
      BigInt.fromI32(100)
    );
    deposit.address = marketAddress;
    handleDeposit(deposit);

    let market = getMarket(marketId());
    assert.assertTrue(!market.totalDebtUSD);
    assert.fieldEquals("Market", marketId(), "totalDepositedUSD", "0");
    assert.fieldEquals("Market", marketId(), "usdTotalsComplete", "false");
    assert.fieldEquals(
      "ProtocolStats",
      generateProtocolStatsId(),
      "usdTotalsComplete",
      "false"
    );
    assert.fieldEquals(
      "BorrowerStats",
      generateBorrowerStatsId(Address.zero()),
      "usdTotalsComplete",
      "false"
    );
    assert.fieldEquals(
      "LenderStats",
      generateLenderStatsId(lenderAddress),
      "usdTotalsComplete",
      "false"
    );
    assert.fieldEquals(
      "ProtocolDailyStats",
      "PROTOCOL-0",
      "dayUsdTotalsComplete",
      "false"
    );
    assert.fieldEquals(
      "MarketDailyStats",
      marketId().concat("-0"),
      "cumulativeUsdTotalsComplete",
      "false"
    );
  });

  test("computes full legacy debt with ray rounding and non-supply components", () => {
    clearStore();
    saveMarket();
    saveStableToken(0);
    let market = getMarket(marketId());
    market.scaledTotalSupply = BigInt.fromI32(3);
    market.scaleFactor = BigInt.fromI32(15).times(BigInt.fromI32(10).pow(26));
    market.normalizedUnclaimedWithdrawals = BigInt.fromI32(7);
    market.pendingProtocolFees = BigInt.fromI32(13);
    market.save();

    let fees = createFeesCollectedEvent(BigInt.fromI32(2));
    fees.address = marketAddress;
    handleFeesCollected(fees);

    // rayMul(3, 1.5 RAY) rounds 4.5 to 5; 5 + 7 + 11 = 23.
    assert.fieldEquals("Market", marketId(), "pendingProtocolFees", "11");
    assert.fieldEquals("Market", marketId(), "totalDebtUSD", "23");
  });

  test("does not classify withdrawal-batch payments as requests or repayments", () => {
    clearStore();
    saveMarket();
    saveStableToken(0);
    let ray = BigInt.fromI32(10).pow(27);
    let expiry = BigInt.fromI32(1000);
    let market = getMarket(marketId());
    market.scaledTotalSupply = BigInt.fromI32(10);
    market.scaledPendingWithdrawals = BigInt.fromI32(10);
    market.save();
    let batch = createWithdrawalBatch(
      generateWithdrawalBatchId(marketAddress, expiry),
      {
        market: marketId(),
        expiry,
        lastScaleFactor: ray,
        lastUpdatedTimestamp: 0
      }
    );
    batch.scaledTotalAmount = BigInt.fromI32(10);
    batch.save();

    let payment = createWithdrawalBatchPaymentEvent(
      expiry,
      BigInt.fromI32(4),
      BigInt.fromI32(4)
    );
    payment.address = marketAddress;
    handleWithdrawalBatchPayment(payment);

    assert.fieldEquals("Market", marketId(), "totalWithdrawalsRequested", "0");
    assert.fieldEquals("Market", marketId(), "totalRepaid", "0");
    assert.fieldEquals("Market", marketId(), "scaledTotalSupply", "6");
    assert.fieldEquals("Market", marketId(), "scaledPendingWithdrawals", "6");
    assert.fieldEquals(
      "Market",
      marketId(),
      "normalizedUnclaimedWithdrawals",
      "4"
    );
    assert.fieldEquals("Market", marketId(), "totalDebtUSD", "10");
    assert.fieldEquals(
      "MarketDailyStats",
      marketId().concat("-0"),
      "totalWithdrawalsRequested",
      "0"
    );
    assert.fieldEquals(
      "ProtocolStats",
      generateProtocolStatsId(),
      "totalRepaidUSD",
      "0"
    );
  });

  test("stores expiration shortfall and counts same-block late closure once", () => {
    clearStore();
    saveMarket();
    let expiry = BigInt.fromI32(1000);
    let batchId = generateWithdrawalBatchId(marketAddress, expiry);
    let batch = createWithdrawalBatch(batchId, {
      market: marketId(),
      expiry,
      lastScaleFactor: BigInt.fromI32(10).pow(27),
      lastUpdatedTimestamp: 0
    });
    batch.scaledTotalAmount = BigInt.fromI32(10);
    batch.scaledAmountBurned = BigInt.fromI32(4);
    batch.save();

    let expired = createWithdrawalBatchExpiredEvent(
      expiry,
      BigInt.fromI32(10),
      BigInt.fromI32(4),
      BigInt.fromI32(4)
    );
    expired.address = marketAddress;
    handleWithdrawalBatchExpired(expired);

    let closed = createWithdrawalBatchClosedEvent(expiry);
    closed.address = marketAddress;
    handleWithdrawalBatchClosed(closed);
    handleWithdrawalBatchClosed(closed);

    let expirationId = generateEventId(expired);
    assert.fieldEquals("WithdrawalBatch", batchId, "expiration", expirationId);
    assert.fieldEquals("WithdrawalBatchExpired", expirationId, "normalizedAmountOwed", "6");
    let borrowerId = generateBorrowerStatsId(Address.zero());
    assert.fieldEquals("BorrowerStats", borrowerId, "numBatchesExpired", "1");
    assert.fieldEquals(
      "BorrowerStats",
      borrowerId,
      "numBatchesExpiredUnpaid",
      "1"
    );
    assert.fieldEquals("BorrowerStats", borrowerId, "numBatchesPaidLate", "1");
  });

  test("attributes post-queue batch interest to the lender on completion", () => {
    clearStore();
    saveMarket();
    saveStableToken(0);
    let ray = BigInt.fromI32(10).pow(27);
    let expiry = BigInt.fromI32(1000);

    let deposit = createDepositEvent(
      lenderAddress,
      BigInt.fromI32(10),
      BigInt.fromI32(10)
    );
    deposit.address = marketAddress;
    handleDeposit(deposit);

    createWithdrawalBatch(generateWithdrawalBatchId(marketAddress, expiry), {
      market: marketId(),
      expiry,
      lastScaleFactor: ray,
      lastUpdatedTimestamp: 0
    });
    let queued = createWithdrawalQueuedEvent(
      expiry,
      lenderAddress,
      BigInt.fromI32(10),
      BigInt.fromI32(10)
    );
    queued.address = marketAddress;
    handleWithdrawalQueued(queued);

    let market = getMarket(marketId());
    market.scaleFactor = BigInt.fromI32(12).times(BigInt.fromI32(10).pow(26));
    market.save();
    let payment = createWithdrawalBatchPaymentEvent(
      expiry,
      BigInt.fromI32(10),
      BigInt.fromI32(12)
    );
    payment.address = marketAddress;
    handleWithdrawalBatchPayment(payment);
    let closed = createWithdrawalBatchClosedEvent(expiry);
    closed.address = marketAddress;
    handleWithdrawalBatchClosed(closed);
    let executed = createWithdrawalExecutedEvent(
      expiry,
      lenderAddress,
      BigInt.fromI32(12)
    );
    executed.address = marketAddress;
    handleWithdrawalExecuted(executed);

    let lenderStatsId = generateLenderStatsId(lenderAddress);
    assert.fieldEquals(
      "LenderStats",
      lenderStatsId,
      "totalInterestEarnedUSD",
      "2"
    );
    assert.fieldEquals(
      "LenderDailyStats",
      "LENDER-DAILY-".concat(lenderAddress.toHex()).concat("-0"),
      "dayInterestEarnedUSD",
      "2"
    );
  });
});

describe("sanctioned withdrawal records", () => {
  test("persists queued assets using the emitted expiry and amounts", () => {
    clearStore();
    let event = createSanctionedAccountAssetsQueuedForWithdrawalEvent(
      lenderAddress,
      BigInt.fromI32(111),
      BigInt.fromI32(222),
      BigInt.fromI32(333)
    );
    event.address = marketAddress;
    handleSanctionedAccountAssetsQueuedForWithdrawal(event);

    let eventId = generateEventId(event);
    assert.fieldEquals(
      "SanctionedAccountAssetsQueuedForWithdrawal",
      eventId,
      "expiry",
      "111"
    );
    assert.fieldEquals(
      "SanctionedAccountAssetsQueuedForWithdrawal",
      eventId,
      "scaledAmount",
      "222"
    );
    assert.fieldEquals(
      "SanctionedAccountAssetsQueuedForWithdrawal",
      eventId,
      "normalizedAmount",
      "333"
    );
    assert.fieldEquals(
      "SanctionedAccountAssetsQueuedForWithdrawal",
      eventId,
      "amount",
      "333"
    );
  });
});
