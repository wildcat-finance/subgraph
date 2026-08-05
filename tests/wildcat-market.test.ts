import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Token } from "../generated/schema";
import {
  createLenderAccount,
  createMarket,
  generateLenderAccountId,
  generateLenderStatsId,
  generateMarketId,
  generateProtocolStatsId,
  generateTokenId,
} from "../generated/UncrashableEntityHelpers";
import {
  handleAnnualInterestBipsUpdated,
  handleAuthorizationStatusUpdated,
  handleTransfer,
} from "../src/wildcat-market";
import { createInitialMarketSnapshot } from "../src/market-domain";
import { createInitialLenderAccountSnapshot } from "../src/lender-account-domain";
import {
  getOrCreateLenderStats,
  getOrCreateProtocolStats,
} from "../src/daily-stats";
import { generateEventId } from "../src/utils";
import {
  createAnnualInterestBipsUpdatedEvent,
  createAuthorizationStatusUpdatedEvent,
  createTransferEvent,
} from "./wildcat-market-utils";

const MARKET = Address.fromString(
  "0x1000000000000000000000000000000000000001"
);
const ASSET = Address.fromString(
  "0x2000000000000000000000000000000000000002"
);
const LENDER_A = Address.fromString(
  "0x3000000000000000000000000000000000000003"
);
const LENDER_B = Address.fromString(
  "0x4000000000000000000000000000000000000004"
);
const RAY = BigInt.fromString("1000000000000000000000000000");
const UPDATED_SCALE_FACTOR = BigInt.fromString(
  "1100000000000000000000000000"
);

function positionEvent(event: ethereum.Event, logIndex: i32): void {
  event.address = MARKET;
  event.block.number = BigInt.fromI32(1);
  event.block.timestamp = BigInt.fromI32(100);
  event.logIndex = BigInt.fromI32(logIndex);
}

function seedTransferMarket(event: ethereum.Event): void {
  let token = new Token(generateTokenId(ASSET));
  token.address = ASSET;
  token.name = "Test Dollar";
  token.symbol = "TUSD";
  token.decimals = 0;
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
    borrowerProfile: null,
    sentinel: Address.zero(),
    feeRecipient: Address.zero(),
    name: "market",
    symbol: "mTUSD",
    decimals: 0,
    protocolFeeBips: 0,
    delinquencyGracePeriod: 0,
    delinquencyFeeBips: 0,
    asset: token.id,
    withdrawalBatchDuration: 0,
    maxTotalSupply: BigInt.fromI32(1_000_000),
    annualInterestBips: 500,
    commitmentFeeBips: null,
    reserveRatioBips: 0,
    drawnAmount: null,
    scaleFactor: UPDATED_SCALE_FACTOR,
    lastInterestAccruedTimestamp: 100,
    lastInterestAccruedBlockNumber: 1,
    tokenWrapper: null,
    numCollateralContracts: 0,
    createdAt: event.block.timestamp.toI32(),
    createdAtBlock: event.block.number,
    createdAtTimestamp: event.block.timestamp,
    createdAtTransaction: event.transaction.hash,
    createdAtLogIndex: event.logIndex,
    deployedEvent: "deployed-event",
  });
  createInitialMarketSnapshot(event, market, "EVENT_PROJECTION");
}

function seedLender(
  event: ethereum.Event,
  address: Address,
  scaledBalance: BigInt
): void {
  let id = generateLenderAccountId(MARKET, address);
  let lender = createLenderAccount(id, {
    address,
    market: generateMarketId(MARKET),
    lastScaleFactor: RAY,
    lastUpdatedTimestamp: 0,
    lastUpdatedBlockNumber: 0,
    controllerAuthorization: null,
    hooksAccess: null,
    addedTimestamp: 0,
  });
  lender.scaledBalance = scaledBalance;
  lender.save();
  createInitialLenderAccountSnapshot(event, lender);

  let stats = getOrCreateLenderStats(address, event.block.timestamp);
  stats.numMarkets = 1;
  stats.numActiveMarkets = 1;
  stats.save();
}

function seedProtocolActiveLenders(count: i32): void {
  let stats = getOrCreateProtocolStats();
  stats.numActiveLenders = count;
  stats.numActiveLenderAccounts = count;
  stats.save();
}

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

  test("processes a self-transfer as one unchanged lender", () => {
    clearStore();

    let event = createTransferEvent(LENDER_A, LENDER_A, BigInt.fromI32(55));
    positionEvent(event, 5);
    seedTransferMarket(event);
    seedLender(event, LENDER_A, BigInt.fromI32(100));
    seedProtocolActiveLenders(1);

    handleTransfer(event);

    let accountId = generateLenderAccountId(MARKET, LENDER_A);
    let eventId = generateEventId(event);
    let lenderStatsId = generateLenderStatsId(LENDER_A);
    let lenderDailyStatsId =
      "LENDER-DAILY-" + LENDER_A.toHex() + "-0";

    assert.fieldEquals("LenderAccount", accountId, "scaledBalance", "100");
    assert.fieldEquals(
      "LenderAccountSnapshot",
      accountId,
      "scaledBalance",
      "100"
    );
    assert.fieldEquals(
      "LenderAccount",
      accountId,
      "lastScaleFactor",
      UPDATED_SCALE_FACTOR.toString()
    );
    assert.fieldEquals(
      "LenderAccountSnapshot",
      accountId,
      "lastScaleFactor",
      UPDATED_SCALE_FACTOR.toString()
    );
    assert.fieldEquals("LenderAccount", accountId, "totalInterestEarned", "10");
    assert.fieldEquals(
      "LenderAccountSnapshot",
      accountId,
      "totalInterestEarned",
      "10"
    );

    assert.entityCount("LenderInterestAccrued", 1);
    assert.fieldEquals(
      "LenderInterestAccrued",
      eventId + "-" + accountId,
      "interestEarned",
      "10"
    );
    assert.fieldEquals(
      "LenderStats",
      lenderStatsId,
      "totalInterestEarnedUSD",
      "10"
    );
    assert.fieldEquals(
      "LenderStats",
      lenderStatsId,
      "numActiveMarkets",
      "1"
    );
    assert.fieldEquals(
      "LenderDailyStats",
      lenderDailyStatsId,
      "dayInterestEarnedUSD",
      "10"
    );
    assert.fieldEquals(
      "ProtocolStats",
      generateProtocolStatsId(),
      "numActiveLenders",
      "1"
    );
    assert.fieldEquals(
      "ProtocolStats",
      generateProtocolStatsId(),
      "numActiveLenderAccounts",
      "1"
    );

    assert.entityCount("Transfer", 1);
    assert.fieldEquals("Transfer", eventId, "from", accountId);
    assert.fieldEquals("Transfer", eventId, "to", accountId);
    assert.fieldEquals("Transfer", eventId, "amount", "55");
    assert.fieldEquals("Transfer", eventId, "scaledAmount", "50");
    assert.entityCount("MarketEvent", 1);
    assert.fieldEquals("MarketEvent", eventId, "kind", "TRANSFER");
  });

  test("preserves two-lender processing for an ordinary transfer", () => {
    clearStore();

    let event = createTransferEvent(LENDER_A, LENDER_B, BigInt.fromI32(55));
    positionEvent(event, 6);
    seedTransferMarket(event);
    seedLender(event, LENDER_A, BigInt.fromI32(100));
    seedLender(event, LENDER_B, BigInt.fromI32(40));
    seedProtocolActiveLenders(2);

    handleTransfer(event);

    let fromId = generateLenderAccountId(MARKET, LENDER_A);
    let toId = generateLenderAccountId(MARKET, LENDER_B);
    let eventId = generateEventId(event);

    assert.fieldEquals("LenderAccount", fromId, "scaledBalance", "50");
    assert.fieldEquals("LenderAccountSnapshot", fromId, "scaledBalance", "50");
    assert.fieldEquals("LenderAccount", toId, "scaledBalance", "90");
    assert.fieldEquals("LenderAccountSnapshot", toId, "scaledBalance", "90");
    assert.entityCount("LenderInterestAccrued", 2);
    assert.fieldEquals(
      "LenderInterestAccrued",
      eventId + "-" + fromId,
      "interestEarned",
      "10"
    );
    assert.fieldEquals(
      "LenderInterestAccrued",
      eventId + "-" + toId,
      "interestEarned",
      "4"
    );
    assert.fieldEquals(
      "LenderStats",
      generateLenderStatsId(LENDER_A),
      "totalInterestEarnedUSD",
      "10"
    );
    assert.fieldEquals(
      "LenderStats",
      generateLenderStatsId(LENDER_B),
      "totalInterestEarnedUSD",
      "4"
    );
    assert.fieldEquals(
      "ProtocolStats",
      generateProtocolStatsId(),
      "numActiveLenders",
      "2"
    );
    assert.fieldEquals(
      "ProtocolStats",
      generateProtocolStatsId(),
      "numActiveLenderAccounts",
      "2"
    );
    assert.fieldEquals("Transfer", eventId, "from", fromId);
    assert.fieldEquals("Transfer", eventId, "to", toId);
    assert.fieldEquals("Transfer", eventId, "amount", "55");
    assert.fieldEquals("Transfer", eventId, "scaledAmount", "50");
    assert.entityCount("MarketEvent", 1);
  });
});
