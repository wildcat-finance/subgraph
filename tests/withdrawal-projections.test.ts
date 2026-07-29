import {
  assert,
  clearStore,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Market, Token } from "../generated/schema";
import {
  createMarket,
  generateLenderAccountId,
  generateLenderWithdrawalStatusId,
  generateMarketId,
  generateTokenId,
  generateWithdrawalBatchId,
} from "../generated/UncrashableEntityHelpers";
import { createInitialMarketSnapshot } from "../src/market-domain";
import { recordMarketEvent } from "../src/market-event-domain";
import { generateEventId } from "../src/utils";
import {
  handleAuthorizationStatusUpdated,
  handleDeposit,
  handleSanctionedAccountAssetsQueuedForWithdrawal,
  handleWithdrawalBatchClosed,
  handleWithdrawalBatchCreated,
  handleWithdrawalBatchExpired,
  handleWithdrawalBatchPayment,
  handleWithdrawalExecuted,
  handleWithdrawalQueued,
} from "../src/wildcat-market";
import {
  createAuthorizationStatusUpdatedEvent,
  createDepositEvent,
  createSanctionedAccountAssetsQueuedForWithdrawalEvent,
  createWithdrawalBatchClosedEvent,
  createWithdrawalBatchCreatedEvent,
  createWithdrawalBatchExpiredEvent,
  createWithdrawalBatchPaymentEvent,
  createWithdrawalExecutedEvent,
  createWithdrawalQueuedEvent,
} from "./wildcat-market-utils";

const MARKET = Address.fromString(
  "0x1000000000000000000000000000000000000001"
);
const ASSET = Address.fromString(
  "0x2000000000000000000000000000000000000002"
);
const LENDER = Address.fromString(
  "0x3000000000000000000000000000000000000003"
);
const RAY = BigInt.fromString("1000000000000000000000000000");

function positionEvent(
  event: ethereum.Event,
  logIndex: i32
): void {
  event.address = MARKET;
  event.block.number = BigInt.fromI32(1);
  event.block.timestamp = BigInt.fromI32(100);
  event.logIndex = BigInt.fromI32(logIndex);
}

function seedMarket(event: ethereum.Event): Market {
  let token = new Token(generateTokenId(ASSET));
  token.address = ASSET;
  token.name = "USD Coin";
  token.symbol = "USDC";
  token.decimals = 6;
  token.isMock = false;
  token.isUsdStablecoin = true;
  token.save();

  let market = createMarket(generateMarketId(MARKET), {
    address: MARKET,
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
    symbol: "mUSDC",
    decimals: 6,
    protocolFeeBips: 0,
    delinquencyGracePeriod: 0,
    delinquencyFeeBips: 0,
    asset: token.id,
    withdrawalBatchDuration: 3600,
    maxTotalSupply: BigInt.fromI32(1_000_000),
    annualInterestBips: 500,
    reserveRatioBips: 1000,
    scaleFactor: RAY,
    lastInterestAccruedTimestamp: 100,
    lastInterestAccruedBlockNumber: 1,
    numCollateralContracts: 0,
    createdAt: event.block.timestamp.toI32(),
    createdAtBlock: event.block.number,
    createdAtTimestamp: event.block.timestamp,
    createdAtTransaction: event.transaction.hash,
    createdAtLogIndex: event.logIndex,
    deployedEvent: "deployed-event",
  });
  createInitialMarketSnapshot(event, market, "EVENT_PROJECTION");
  recordMarketEvent(event, market, "MARKET_DEPLOYED");
  return market;
}

describe("withdrawal projections", () => {
  test("stamps market, lender, batch, and lender-withdrawal state", () => {
    clearStore();

    let creationEvent = changetype<ethereum.Event>(newMockEvent());
    positionEvent(creationEvent, 0);
    seedMarket(creationEvent);

    let authorization = createAuthorizationStatusUpdatedEvent(LENDER, 3);
    positionEvent(authorization, 1);
    handleAuthorizationStatusUpdated(authorization);

    let deposit = createDepositEvent(
      LENDER,
      BigInt.fromI32(100),
      BigInt.fromI32(100)
    );
    positionEvent(deposit, 2);
    handleDeposit(deposit);

    let expiry = BigInt.fromI32(3600);
    let batchCreated = createWithdrawalBatchCreatedEvent(expiry);
    positionEvent(batchCreated, 3);
    handleWithdrawalBatchCreated(batchCreated);

    let queued = createWithdrawalQueuedEvent(
      expiry,
      LENDER,
      BigInt.fromI32(40),
      BigInt.fromI32(40)
    );
    positionEvent(queued, 4);
    handleWithdrawalQueued(queued);

    let payment = createWithdrawalBatchPaymentEvent(
      expiry,
      BigInt.fromI32(40),
      BigInt.fromI32(40)
    );
    positionEvent(payment, 5);
    handleWithdrawalBatchPayment(payment);

    let expired = createWithdrawalBatchExpiredEvent(
      expiry,
      BigInt.fromI32(40),
      BigInt.fromI32(40),
      BigInt.fromI32(40)
    );
    positionEvent(expired, 6);
    handleWithdrawalBatchExpired(expired);

    let closed = createWithdrawalBatchClosedEvent(expiry);
    positionEvent(closed, 7);
    handleWithdrawalBatchClosed(closed);

    let executed = createWithdrawalExecutedEvent(
      expiry,
      LENDER,
      BigInt.fromI32(40)
    );
    positionEvent(executed, 8);
    handleWithdrawalExecuted(executed);

    let sanctioned = createSanctionedAccountAssetsQueuedForWithdrawalEvent(
      LENDER,
      expiry,
      BigInt.fromI32(1),
      BigInt.fromI32(1)
    );
    positionEvent(sanctioned, 9);
    handleSanctionedAccountAssetsQueuedForWithdrawal(sanctioned);

    let marketId = generateMarketId(MARKET);
    let accountId = generateLenderAccountId(MARKET, LENDER);
    let batchId = generateWithdrawalBatchId(MARKET, expiry);
    let statusId = generateLenderWithdrawalStatusId(MARKET, expiry, LENDER);

    assert.fieldEquals("MarketSnapshot", marketId, "scaledTotalSupply", "60");
    assert.fieldEquals(
      "MarketSnapshot",
      marketId,
      "normalizedUnclaimedWithdrawals",
      "0"
    );
    assert.fieldEquals("MarketSnapshot", marketId, "updatedAtLogIndex", "8");

    assert.fieldEquals(
      "LenderAccountSnapshot",
      accountId,
      "scaledBalance",
      "60"
    );
    assert.fieldEquals(
      "LenderAccountSnapshot",
      accountId,
      "numPendingWithdrawalBatches",
      "0"
    );
    assert.fieldEquals(
      "LenderAccountSnapshot",
      accountId,
      "updatedAtLogIndex",
      "8"
    );

    assert.fieldEquals("WithdrawalBatch", batchId, "isExpired", "true");
    assert.fieldEquals("WithdrawalBatch", batchId, "isClosed", "true");
    assert.fieldEquals("WithdrawalBatch", batchId, "isCompleted", "true");
    assert.fieldEquals("WithdrawalBatch", batchId, "updatedAtLogIndex", "8");

    assert.fieldEquals(
      "LenderWithdrawalStatus",
      statusId,
      "isCompleted",
      "true"
    );
    assert.fieldEquals(
      "LenderWithdrawalStatus",
      statusId,
      "batchExpiry",
      expiry.toString()
    );
    assert.fieldEquals(
      "LenderWithdrawalStatus",
      statusId,
      "updatedAtLogIndex",
      "8"
    );

    assert.entityCount("MarketEvent", 10);
    assert.fieldEquals(
      "MarketEvent",
      generateEventId(executed),
      "sequence",
      "8"
    );
    assert.fieldEquals(
      "MarketEvent",
      generateEventId(executed),
      "kind",
      "WITHDRAWAL_EXECUTED"
    );
    assert.fieldEquals(
      "SanctionedAccountAssetsQueuedForWithdrawal",
      generateEventId(sanctioned),
      "market",
      marketId
    );
    assert.fieldEquals(
      "SanctionedAccountAssetsQueuedForWithdrawal",
      generateEventId(sanctioned),
      "expiry",
      expiry.toString()
    );
  });
});
