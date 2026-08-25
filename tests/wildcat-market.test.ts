import {
  assert,
  clearStore,
  describe,
  test,
} from "matchstick-as/assembly";
import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
} from "@graphprotocol/graph-ts";
import { Token, Wildcat4626Wrapper } from "../generated/schema";
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
import {
  handleDeposit as handleWrapperDeposit,
  handleTokensSwept as handleWrapperTokensSwept,
  handleTransfer as handleWrapperTransfer,
  handleWithdraw as handleWrapperWithdraw,
} from "../src/wildcat-4626-wrapper";
import { createInitialMarketSnapshot } from "../src/market-domain";
import { createInitialLenderAccountSnapshot } from "../src/lender-account-domain";
import {
  getOrCreateLenderStats,
  getOrCreateProtocolStats,
} from "../src/daily-stats";
import { generateEventId } from "../src/utils";
import { generateWrapperAccountId } from "../src/wrapper-principal-basis";
import {
  createWrapperDepositEvent,
  createWrapperTokensSweptEvent,
  createWrapperTransferEvent,
  createWrapperWithdrawEvent,
} from "./wildcat-4626-wrapper-utils";
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
const WRAPPER = Address.fromString(
  "0x5000000000000000000000000000000000000005"
);
const TRANSACTION_1 = Bytes.fromHexString(
  "0x1111111111111111111111111111111111111111111111111111111111111111"
);
const TRANSACTION_2 = Bytes.fromHexString(
  "0x2222222222222222222222222222222222222222222222222222222222222222"
);
const TRANSACTION_3 = Bytes.fromHexString(
  "0x3333333333333333333333333333333333333333333333333333333333333333"
);
const TRANSACTION_4 = Bytes.fromHexString(
  "0x4444444444444444444444444444444444444444444444444444444444444444"
);
const TRANSACTION_5 = Bytes.fromHexString(
  "0x5555555555555555555555555555555555555555555555555555555555555555"
);
const RAY = BigInt.fromString("1000000000000000000000000000");
const UPDATED_SCALE_FACTOR = BigInt.fromString(
  "1100000000000000000000000000"
);
const ROUNDING_SCALE_FACTOR = BigInt.fromString(
  "1000000342465782383371674669"
);
const ROUNDING_TRANSFER_AMOUNT = BigInt.fromString("1000000342465782384");
const ROUNDING_FROM_BALANCE = BigInt.fromString("3000000000000000000");
const ROUNDING_TO_BALANCE = BigInt.fromString("1000000000000000000");

function positionEvent(event: ethereum.Event, logIndex: i32): void {
  event.address = MARKET;
  event.block.number = BigInt.fromI32(1);
  event.block.timestamp = BigInt.fromI32(100);
  event.logIndex = BigInt.fromI32(logIndex);
}

function positionSequenceEvent(
  event: ethereum.Event,
  address: Address,
  logIndex: i32,
  transactionHash: Bytes
): void {
  event.address = address;
  event.block.number = BigInt.fromI32(1);
  event.block.timestamp = BigInt.fromI32(100);
  event.logIndex = BigInt.fromI32(logIndex);
  event.transaction.hash = transactionHash;
}

function seedTransferMarket(
  event: ethereum.Event,
  generation: string,
  scaleFactor: BigInt
): void {
  let token = new Token(generateTokenId(ASSET));
  token.address = ASSET;
  token.name = "Test Dollar";
  token.symbol = "TUSD";
  token.decimals = 0;
  token.isMock = false;
  token.isUsdStablecoin = true;
  token.lastPriceFeedSearchDay = -1;
  token.save();

  let market = createMarket(generateMarketId(MARKET), {
    address: MARKET,
    archController: "arch-controller",
    isRegistered: true,
    version: "V2",
    marketKind: "STANDARD",
    originKind: "HOOKS",
    generation,
    abiFamily: "test",
    eventGeneration: "LEGACY",
    controller: null,
    hooksFactory: null,
    hooks: null,
    borrower: Address.zero(),
    borrowerAccount: null,
    borrowerPrincipal: Address.zero(),
    borrowerProfile: null,
    initialBorrower: Address.zero(),
    initialBorrowerPrincipal: Address.zero(),
    borrowerIdentityRegistry: null,
    borrowerIdentityRegistryAddress: null,
    sentinel: Address.zero(),
    feeRecipient: Address.zero(),
    originationFeeAsset: null,
    originationFeeAmount: BigInt.zero(),
    name: "market",
    symbol: "mTUSD",
    decimals: 0,
    protocolFeeBips: 0,
    delinquencyGracePeriod: 0,
    delinquencyFeeBips: 0,
    asset: token.id,
    withdrawalBatchDuration: 0,
    totalAssets: BigInt.zero(),
    maxTotalSupply: BigInt.fromI32(1_000_000),
    annualInterestBips: 500,
    commitmentFeeBips: null,
    reserveRatioBips: 0,
    drawnAmount: null,
    scaleFactor,
    lastInterestAccruedTimestamp: 100,
    lastInterestAccruedBlockNumber: 1,
    usdTotalsComplete: true,
    totalDebtUSD: BigDecimal.zero(),
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
    principalBasis: scaledBalance,
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

function seedWrapper(event: ethereum.Event): void {
  let wrapper = new Wildcat4626Wrapper(WRAPPER.toHexString());
  wrapper.address = WRAPPER;
  wrapper.factory = "wrapper-factory";
  wrapper.market = generateMarketId(MARKET);
  wrapper.marketAddress = MARKET;
  wrapper.marketToken = generateTokenId(MARKET);
  wrapper.token = generateTokenId(WRAPPER);
  wrapper.totalShares = BigInt.zero();
  wrapper.principalBasis = BigInt.zero();
  wrapper.blockNumber = event.block.number.toI32();
  wrapper.blockTimestamp = event.block.timestamp.toI32();
  wrapper.transactionHash = event.transaction.hash;
  wrapper.blockLogIndex = event.logIndex.toI32();
  wrapper.save();
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
      eventGeneration: "LEGACY",
      controller: null,
      hooksFactory: null,
      hooks: null,
      borrower: Address.zero(),
      borrowerAccount: null,
      borrowerPrincipal: Address.zero(),
      borrowerProfile: null,
      initialBorrower: Address.zero(),
      initialBorrowerPrincipal: Address.zero(),
      borrowerIdentityRegistry: null,
      borrowerIdentityRegistryAddress: null,
      sentinel: Address.zero(),
      feeRecipient: Address.zero(),
      originationFeeAsset: null,
      originationFeeAmount: BigInt.zero(),
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
      usdTotalsComplete: true,
      totalDebtUSD: BigDecimal.zero(),
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
    seedTransferMarket(event, "v2.5", UPDATED_SCALE_FACTOR);
    seedLender(event, LENDER_A, BigInt.fromI32(100));
    seedProtocolActiveLenders(1);

    handleTransfer(event);

    let accountId = generateLenderAccountId(MARKET, LENDER_A);
    let eventId = generateEventId(event);
    let lenderStatsId = generateLenderStatsId(LENDER_A);
    let lenderDailyStatsId =
      "LENDER-DAILY-" + LENDER_A.toHex() + "-0";

    assert.fieldEquals("LenderAccount", accountId, "scaledBalance", "100");
    assert.fieldEquals("LenderAccount", accountId, "principalBasis", "100");
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
      "LenderDailyStats",
      lenderDailyStatsId,
      "totalInterestEarnedUSD",
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
    assert.fieldEquals("Transfer", eventId, "principalBasisAmount", "0");
    assert.entityCount("MarketEvent", 1);
    assert.fieldEquals("MarketEvent", eventId, "kind", "TRANSFER");
  });

  test("preserves two-lender processing for an ordinary transfer", () => {
    clearStore();

    let event = createTransferEvent(LENDER_A, LENDER_B, BigInt.fromI32(55));
    positionEvent(event, 6);
    seedTransferMarket(event, "v2.5", UPDATED_SCALE_FACTOR);
    seedLender(event, LENDER_A, BigInt.fromI32(100));
    seedLender(event, LENDER_B, BigInt.fromI32(40));
    seedProtocolActiveLenders(2);

    handleTransfer(event);

    let fromId = generateLenderAccountId(MARKET, LENDER_A);
    let toId = generateLenderAccountId(MARKET, LENDER_B);
    let eventId = generateEventId(event);

    assert.fieldEquals("LenderAccount", fromId, "scaledBalance", "50");
    assert.fieldEquals("LenderAccountSnapshot", fromId, "scaledBalance", "50");
    assert.fieldEquals("LenderAccount", fromId, "principalBasis", "50");
    assert.fieldEquals("LenderAccountSnapshot", fromId, "principalBasis", "50");
    assert.fieldEquals("LenderAccount", toId, "scaledBalance", "90");
    assert.fieldEquals("LenderAccountSnapshot", toId, "scaledBalance", "90");
    assert.fieldEquals("LenderAccount", toId, "principalBasis", "90");
    assert.fieldEquals("LenderAccountSnapshot", toId, "principalBasis", "90");
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
    assert.fieldEquals("Transfer", eventId, "principalBasisAmount", "50");
    assert.entityCount("MarketEvent", 1);
  });

  test("rounds V2.5 transfer scaling down", () => {
    clearStore();

    let event = createTransferEvent(
      LENDER_A,
      LENDER_B,
      ROUNDING_TRANSFER_AMOUNT
    );
    positionEvent(event, 7);
    seedTransferMarket(event, "v2.5", ROUNDING_SCALE_FACTOR);
    seedLender(event, LENDER_A, ROUNDING_FROM_BALANCE);
    seedLender(event, LENDER_B, ROUNDING_TO_BALANCE);
    seedProtocolActiveLenders(2);

    handleTransfer(event);

    let fromId = generateLenderAccountId(MARKET, LENDER_A);
    let toId = generateLenderAccountId(MARKET, LENDER_B);
    let eventId = generateEventId(event);

    assert.fieldEquals(
      "LenderAccount",
      fromId,
      "scaledBalance",
      "2000000000000000000"
    );
    assert.fieldEquals(
      "LenderAccount",
      toId,
      "scaledBalance",
      "2000000000000000000"
    );
    assert.fieldEquals(
      "Transfer",
      eventId,
      "scaledAmount",
      "1000000000000000000"
    );
  });

  test("preserves half-up transfer scaling for legacy generations", () => {
    clearStore();

    let event = createTransferEvent(
      LENDER_A,
      LENDER_B,
      ROUNDING_TRANSFER_AMOUNT
    );
    positionEvent(event, 8);
    seedTransferMarket(event, "v2.1", ROUNDING_SCALE_FACTOR);
    seedLender(event, LENDER_A, ROUNDING_FROM_BALANCE);
    seedLender(event, LENDER_B, ROUNDING_TO_BALANCE);
    seedProtocolActiveLenders(2);

    handleTransfer(event);

    let fromId = generateLenderAccountId(MARKET, LENDER_A);
    let toId = generateLenderAccountId(MARKET, LENDER_B);
    let eventId = generateEventId(event);

    assert.fieldEquals(
      "LenderAccount",
      fromId,
      "scaledBalance",
      "1999999999999999999"
    );
    assert.fieldEquals(
      "LenderAccount",
      toId,
      "scaledBalance",
      "2000000000000000001"
    );
    assert.fieldEquals(
      "Transfer",
      eventId,
      "scaledAmount",
      "1000000000000000001"
    );
  });

  test("follows principal through wrapper custody without attributing donated surplus", () => {
    clearStore();

    let depositTransfer = createTransferEvent(
      LENDER_A,
      WRAPPER,
      BigInt.fromI32(55)
    );
    positionSequenceEvent(depositTransfer, MARKET, 1, TRANSACTION_1);
    seedTransferMarket(depositTransfer, "v2.5", UPDATED_SCALE_FACTOR);
    seedLender(depositTransfer, LENDER_A, BigInt.fromI32(100));
    seedProtocolActiveLenders(1);
    seedWrapper(depositTransfer);
    handleTransfer(depositTransfer);

    let mint = createWrapperTransferEvent(
      Address.zero(),
      LENDER_B,
      BigInt.fromI32(50)
    );
    positionSequenceEvent(mint, WRAPPER, 2, TRANSACTION_1);
    handleWrapperTransfer(mint);

    let deposit = createWrapperDepositEvent(
      LENDER_A,
      LENDER_B,
      BigInt.fromI32(55),
      BigInt.fromI32(50)
    );
    positionSequenceEvent(deposit, WRAPPER, 3, TRANSACTION_1);
    handleWrapperDeposit(deposit);

    let directAccountId = generateLenderAccountId(MARKET, LENDER_A);
    let wrapperMarketAccountId = generateLenderAccountId(MARKET, WRAPPER);
    let holderAId = generateWrapperAccountId(WRAPPER, LENDER_A);
    let holderBId = generateWrapperAccountId(WRAPPER, LENDER_B);

    assert.fieldEquals("LenderAccount", directAccountId, "scaledBalance", "50");
    assert.fieldEquals("LenderAccount", directAccountId, "principalBasis", "50");
    assert.fieldEquals(
      "LenderAccount",
      wrapperMarketAccountId,
      "scaledBalance",
      "50"
    );
    assert.fieldEquals(
      "LenderAccount",
      wrapperMarketAccountId,
      "principalBasis",
      "50"
    );
    assert.fieldEquals(
      "Wildcat4626Wrapper",
      WRAPPER.toHexString(),
      "totalShares",
      "50"
    );
    assert.fieldEquals(
      "Wildcat4626Wrapper",
      WRAPPER.toHexString(),
      "principalBasis",
      "50"
    );
    assert.fieldEquals("Wildcat4626WrapperAccount", holderBId, "shares", "50");
    assert.fieldEquals(
      "Wildcat4626WrapperAccount",
      holderBId,
      "principalBasis",
      "50"
    );
    assert.fieldEquals(
      "Wildcat4626WrapperDeposit",
      generateEventId(deposit),
      "principalBasisAmount",
      "50"
    );
    assert.fieldEquals(
      "Wildcat4626WrapperDeposit",
      generateEventId(deposit),
      "marketTransfer",
      generateEventId(depositTransfer)
    );

    let shareTransfer = createWrapperTransferEvent(
      LENDER_B,
      LENDER_A,
      BigInt.fromI32(10)
    );
    positionSequenceEvent(shareTransfer, WRAPPER, 1, TRANSACTION_2);
    handleWrapperTransfer(shareTransfer);

    assert.fieldEquals(
      "Wildcat4626WrapperAccount",
      holderAId,
      "shares",
      "10"
    );
    assert.fieldEquals(
      "Wildcat4626WrapperAccount",
      holderAId,
      "principalBasis",
      "10"
    );
    assert.fieldEquals(
      "Wildcat4626WrapperAccount",
      holderBId,
      "shares",
      "40"
    );
    assert.fieldEquals(
      "Wildcat4626WrapperAccount",
      holderBId,
      "principalBasis",
      "40"
    );

    let burn = createWrapperTransferEvent(
      LENDER_B,
      Address.zero(),
      BigInt.fromI32(10)
    );
    positionSequenceEvent(burn, WRAPPER, 1, TRANSACTION_3);
    handleWrapperTransfer(burn);

    let redemptionTransfer = createTransferEvent(
      WRAPPER,
      LENDER_A,
      BigInt.fromI32(11)
    );
    positionSequenceEvent(redemptionTransfer, MARKET, 2, TRANSACTION_3);
    handleTransfer(redemptionTransfer);

    let withdrawal = createWrapperWithdrawEvent(
      LENDER_B,
      LENDER_A,
      LENDER_B,
      BigInt.fromI32(11),
      BigInt.fromI32(10)
    );
    positionSequenceEvent(withdrawal, WRAPPER, 3, TRANSACTION_3);
    handleWrapperWithdraw(withdrawal);

    assert.fieldEquals(
      "Wildcat4626Wrapper",
      WRAPPER.toHexString(),
      "totalShares",
      "40"
    );
    assert.fieldEquals(
      "Wildcat4626Wrapper",
      WRAPPER.toHexString(),
      "principalBasis",
      "40"
    );
    assert.fieldEquals(
      "Wildcat4626WrapperAccount",
      holderBId,
      "shares",
      "30"
    );
    assert.fieldEquals(
      "Wildcat4626WrapperAccount",
      holderBId,
      "principalBasis",
      "30"
    );
    assert.fieldEquals(
      "LenderAccount",
      wrapperMarketAccountId,
      "principalBasis",
      "40"
    );
    assert.fieldEquals(
      "LenderAccount",
      directAccountId,
      "principalBasis",
      "60"
    );
    assert.fieldEquals(
      "Wildcat4626WrapperWithdrawal",
      generateEventId(withdrawal),
      "principalBasisAmount",
      "10"
    );
    assert.fieldEquals(
      "Wildcat4626WrapperWithdrawal",
      generateEventId(withdrawal),
      "marketTransfer",
      generateEventId(redemptionTransfer)
    );

    let donation = createTransferEvent(
      LENDER_A,
      WRAPPER,
      BigInt.fromI32(22)
    );
    positionSequenceEvent(donation, MARKET, 1, TRANSACTION_4);
    handleTransfer(donation);

    assert.fieldEquals(
      "LenderAccount",
      wrapperMarketAccountId,
      "principalBasis",
      "60"
    );
    assert.fieldEquals(
      "Wildcat4626Wrapper",
      WRAPPER.toHexString(),
      "principalBasis",
      "40"
    );

    let sweepTransfer = createTransferEvent(
      WRAPPER,
      LENDER_A,
      BigInt.fromI32(22)
    );
    positionSequenceEvent(sweepTransfer, MARKET, 1, TRANSACTION_5);
    handleTransfer(sweepTransfer);

    let sweep = createWrapperTokensSweptEvent(
      MARKET,
      LENDER_A,
      BigInt.fromI32(22)
    );
    positionSequenceEvent(sweep, WRAPPER, 2, TRANSACTION_5);
    handleWrapperTokensSwept(sweep);

    assert.fieldEquals(
      "LenderAccount",
      wrapperMarketAccountId,
      "scaledBalance",
      "40"
    );
    assert.fieldEquals(
      "LenderAccount",
      wrapperMarketAccountId,
      "principalBasis",
      "40"
    );
    assert.fieldEquals(
      "LenderAccount",
      directAccountId,
      "principalBasis",
      "60"
    );
    assert.fieldEquals(
      "Wildcat4626Wrapper",
      WRAPPER.toHexString(),
      "principalBasis",
      "40"
    );
    assert.fieldEquals(
      "Wildcat4626WrapperTokensSwept",
      generateEventId(sweep),
      "principalBasisAmount",
      "20"
    );
    assert.fieldEquals(
      "Wildcat4626WrapperTokensSwept",
      generateEventId(sweep),
      "marketTransfer",
      generateEventId(sweepTransfer)
    );
    assert.entityCount("IndexerDiagnostic", 0);
  });
});
