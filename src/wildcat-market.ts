import {
  AnnualInterestBipsUpdated as AnnualInterestBipsUpdatedEvent,
  Approval as ApprovalEvent,
  AuthorizationStatusUpdated as AuthorizationStatusUpdatedEvent,
  Borrow as BorrowEvent,
  ChangedSpherexEngineAddress as ChangedSpherexEngineAddressEvent,
  ChangedSpherexOperator as ChangedSpherexOperatorEvent,
  DebtRepaid as DebtRepaidEvent,
  Deposit as DepositEvent,
  FeesCollected as FeesCollectedEvent,
  MarketClosed as MarketClosedEvent,
  MaxTotalSupplyUpdated as MaxTotalSupplyUpdatedEvent,
  ReserveRatioBipsUpdated as ReserveRatioBipsUpdatedEvent,
  SanctionedAccountAssetsSentToEscrow as SanctionedAccountAssetsSentToEscrowEvent,
  SanctionedAccountAssetsQueuedForWithdrawal as SanctionedAccountAssetsQueuedForWithdrawalEvent,
  SanctionedAccountWithdrawalSentToEscrow as SanctionedAccountWithdrawalSentToEscrowEvent,
  InterestAndFeesAccrued as InterestAndFeesAccruedEvent,
  StateUpdated as StateUpdatedEvent,
  Transfer as TransferEvent,
  WithdrawalBatchClosed as WithdrawalBatchClosedEvent,
  WithdrawalBatchCreated as WithdrawalBatchCreatedEvent,
  WithdrawalBatchExpired as WithdrawalBatchExpiredEvent,
  WithdrawalBatchPayment as WithdrawalBatchPaymentEvent,
  WithdrawalExecuted as WithdrawalExecutedEvent,
  WithdrawalQueued as WithdrawalQueuedEvent,
  ProtocolFeeBipsUpdated as ProtocolFeeBipsUpdatedEvent,
  ForceBuyBack as ForceBuyBackEvent,
} from "../generated/templates/WildcatMarket/WildcatMarket";
import { IERC20 } from "../generated/templates/WildcatMarket/IERC20";
import {
  GetOrCreateReturn,
  createAnnualInterestBipsUpdated,
  createBorrow,
  createDebtRepaid,
  createDelinquencyStatusChanged,
  createDeposit,
  createFeesCollected,
  createForceBuyBack,
  createLenderInterestAccrued,
  createMarketClosed,
  createMarketInterestAccrued,
  createMaxTotalSupplyUpdated,
  createProtocolFeeBipsUpdated,
  createReserveRatioBipsUpdated,
  createTransfer,
  createWithdrawalBatch,
  createWithdrawalBatchCreated,
  createWithdrawalBatchExpired,
  createWithdrawalBatchInterestAccrued,
  createWithdrawalBatchPayment,
  createWithdrawalExecution,
  createWithdrawalRequest,
  generateAnnualInterestBipsUpdatedId,
  generateBorrowId,
  generateDebtRepaidId,
  generateDepositId,
  generateFeesCollectedId,
  generateHooksConfigId,
  generateLenderAccountId,
  generateLenderAuthorizationId,
  generateLenderHooksAccessId,
  generateLenderWithdrawalStatusId,
  generateMarketId,
  generateMaxTotalSupplyUpdatedId,
  generateWithdrawalBatchId,
  generateWithdrawalBatchPaymentId,
  generateWithdrawalExecutionId,
  generateWithdrawalRequestId,
  getLenderAccount,
  getLenderWithdrawalStatus,
  getMarket,
  getOrInitializeLenderAccount,
  getOrInitializeLenderAuthorization,
  getOrInitializeLenderWithdrawalStatus,
  getOrInitializeMarketDailyStats,
  getProtocolStats,
  getWithdrawalBatch,
  getWithdrawalBatchExpired,
  setAnnualInterestBips,
  setMarketIsClosed,
} from "../generated/UncrashableEntityHelpers";
import {
  Approval,
  SanctionedAccountAssetsSentToEscrow,
  SanctionedAccountWithdrawalSentToEscrow,
  LenderAccount,
  Market,
  WithdrawalBatch,
  LenderHooksAccess,
  MarketDailyStats,
  HooksConfig,
} from "../generated/schema";
import {
  calculateBatchInterestEarned,
  calculateInterestEarned,
  calculateLiquidityRequired,
  generateEventId,
  generateMarketEventId,
  isNullAddress,
  rayDiv,
  rayMul,
  satSub,
  getOrCreateLenderAccount,
} from "./utils";
import { ensureTokenDailyPrice } from "./price-feeds";
import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Token } from "../generated/schema";
import {
  getTokenPriceMultiplier,
  amountToUSD,
  getOrCreateProtocolStats,
  getOrCreateBorrowerStats,
  getOrCreateLenderStats,
  getOrCreateProtocolDailyStats,
  getOrCreateBorrowerDailyStats,
  getOrCreateLenderDailyStats,
  updateBorrowerActiveMarketCount,
  updateLenderActiveMarketCount,
  getOrCreateMarketDailyStats,
  setMarketTotalDebtUSD,
  updateMarketTotalDebtUSD,
} from "./daily-stats";

export function handleAnnualInterestBipsUpdated(
  event: AnnualInterestBipsUpdatedEvent
): void {
  let newAnnualInterestBips = event.params.annualInterestBipsUpdated.toI32();
  let market = getMarket(generateMarketId(event.address));
  // PeriodicTermHooks deletes a pending APR reduction proposal when the APR is
  // increased and when a proposed reduction executes — both change the APR.
  // Setting the APR to its current value emits this event but does NOT delete
  // the proposal on-chain, so only clear the mirrored fields when the APR
  // actually changed. (Must be evaluated before market.annualInterestBips is
  // overwritten below.)
  let aprChanged = newAnnualInterestBips != market.annualInterestBips;
  createAnnualInterestBipsUpdated(generateMarketEventId(market), {
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    oldAnnualInterestBips: market.annualInterestBips,
    newAnnualInterestBips: newAnnualInterestBips,
    transactionHash: event.transaction.hash,
    annualInterestBipsUpdatedIndex: market.annualInterestBipsUpdatedIndex,
    eventIndex: market.eventIndex,
    market: market.id,
    blockLogIndex: event.logIndex.toI32(),
  });
  market.annualInterestBips = newAnnualInterestBips;
  market.annualInterestBipsUpdatedIndex =
    market.annualInterestBipsUpdatedIndex + 1;
  market.eventIndex = market.eventIndex + 1;
  if (aprChanged) {
    let hooksConfig = HooksConfig.load(generateHooksConfigId(event.address));
    if (hooksConfig != null) {
      hooksConfig.pendingAprChangeAnnualInterestBips = 0;
      hooksConfig.pendingAprChangeProposalTimestamp = 0;
      hooksConfig.pendingAprChangeResponseWindowStart = 0;
      hooksConfig.pendingAprChangeResponseWindowEnd = 0;
      hooksConfig.save();
    }
  }
  market.save();
}

export function handleApproval(event: ApprovalEvent): void {
  let entity = new Approval(generateEventId(event));
  entity.owner = event.params.owner;
  entity.spender = event.params.spender;
  entity.value = event.params.value;

  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;
  entity.blockLogIndex = event.logIndex.toI32();

  entity.save();
}

export function handleAuthorizationStatusUpdated(
  event: AuthorizationStatusUpdatedEvent
): void {
  let market = getMarket(generateMarketId(event.address));
  let lenderRoles = ["Null", "Blocked", "WithdrawOnly", "DepositAndWithdraw"];
  let lenderResult = getOrCreateLenderAccount(
    market,
    event.address,
    event.params.account,
    event.block.timestamp
  );
  let lender = lenderResult.entity;
  lender.role = lenderRoles[event.params.role];
  lender.save();

  if (lenderResult.wasCreated) {
    let ls = getOrCreateLenderStats(event.params.account, event.block.timestamp);
    ls.numMarkets = ls.numMarkets + 1;
    ls.save();
  }
}

export function handleBorrow(event: BorrowEvent): void {
  let market = getMarket(generateMarketId(event.address));

  createBorrow(generateMarketEventId(market), {
    assetAmount: event.params.assetAmount,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    market: market.id,
    borrowIndex: market.borrowIndex,
    eventIndex: market.eventIndex,
    blockLogIndex: event.logIndex.toI32(),
  });
  market.borrowIndex = market.borrowIndex + 1;
  market.eventIndex = market.eventIndex + 1;
  market.totalBorrowed = market.totalBorrowed.plus(event.params.assetAmount);

  let priceMul = getTokenPriceMultiplier(market.decimals, market.asset, event.block.timestamp);
  let hasPrice = !priceMul.equals(BigDecimal.zero());

  if (hasPrice) {
    let usdDelta = amountToUSD(event.params.assetAmount, priceMul);
    market.totalBorrowedUSD = market.totalBorrowedUSD.plus(usdDelta);

    let ps = getOrCreateProtocolStats();
    let bs = getOrCreateBorrowerStats(market.borrower);
    ps.totalBorrowedUSD = ps.totalBorrowedUSD.plus(usdDelta);
    bs.totalBorrowedUSD = bs.totalBorrowedUSD.plus(usdDelta);
    let bds = getOrCreateBorrowerDailyStats(market.borrower, event.block.timestamp, bs);
    let pds = getOrCreateProtocolDailyStats(event.block.timestamp, ps);
    bds.dayBorrowedUSD = bds.dayBorrowedUSD.plus(usdDelta);
    pds.dayBorrowedUSD = pds.dayBorrowedUSD.plus(usdDelta);

    ps.save();
    bs.save();
    bds.save();
    pds.save();
  }
  let mds = getOrCreateMarketDailyStats(market, event.block.timestamp);
  mds.dayBorrowed = mds.dayBorrowed.plus(event.params.assetAmount);
  market.save();
  mds.save();
}

export function handleDebtRepaid(event: DebtRepaidEvent): void {
  let market = getMarket(generateMarketId(event.address));
  createDebtRepaid(generateMarketEventId(market), {
    assetAmount: event.params.assetAmount,
    from: event.params.from,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    market: market.id,
    debtRepaidIndex: market.debtRepaidIndex,
    eventIndex: market.eventIndex,
    blockLogIndex: event.logIndex.toI32(),
  });
  market.debtRepaidIndex = market.debtRepaidIndex + 1;
  market.eventIndex = market.eventIndex + 1;

  let priceMul = getTokenPriceMultiplier(market.decimals, market.asset, event.block.timestamp);
  let hasPrice = !priceMul.equals(BigDecimal.zero());

  market.totalRepaid = market.totalRepaid.plus(event.params.assetAmount);

  if (hasPrice) {
    let usdDelta = amountToUSD(event.params.assetAmount, priceMul);
    market.totalRepaidUSD = market.totalRepaidUSD.plus(usdDelta);

    let ps = getOrCreateProtocolStats();
    let bs = getOrCreateBorrowerStats(market.borrower);
    ps.totalRepaidUSD = ps.totalRepaidUSD.plus(usdDelta);
    bs.totalRepaidUSD = bs.totalRepaidUSD.plus(usdDelta);


    let pds = getOrCreateProtocolDailyStats(event.block.timestamp, ps);
    let bds = getOrCreateBorrowerDailyStats(market.borrower, event.block.timestamp, bs);
    pds.dayRepaidUSD = pds.dayRepaidUSD.plus(usdDelta);
    bds.dayRepaidUSD = bds.dayRepaidUSD.plus(usdDelta);

    ps.save();
    pds.save();
    bs.save();
    bds.save();
  }
  let mds = getOrCreateMarketDailyStats(market, event.block.timestamp);
  mds.dayRepaid = mds.dayRepaid.plus(event.params.assetAmount);
  market.save();
  mds.save();
}

function processLenderInterestAccrued(
  event: ethereum.Event,
  lender: LenderAccount,
  market: Market,
): BigInt {
  let interestEarned = BigInt.zero();
  if (lender.lastScaleFactor.notEqual(market.scaleFactor)) {
    interestEarned = calculateInterestEarned(lender, market);
    lender.lastScaleFactor = market.scaleFactor;
    lender.totalInterestEarned = lender.totalInterestEarned.plus(
      interestEarned
    );
    createLenderInterestAccrued(generateEventId(event), {
      account: lender.id,
      interestEarned,
      market: market.id,
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
    });
  }
  if (lender.lastUpdatedTimestamp != event.block.timestamp.toI32()) {
    lender.lastUpdatedTimestamp = event.block.timestamp.toI32();
    lender.lastUpdatedBlockNumber = event.block.number.toI32();
  }
  return interestEarned;
}

function processWithdrawalBatchInterestAccrued(
  event: ethereum.Event,
  batch: WithdrawalBatch,
  market: Market
): void {
  if (batch.lastScaleFactor.notEqual(market.scaleFactor)) {
    let interestEarned = calculateBatchInterestEarned(batch, market);
    batch.lastScaleFactor = market.scaleFactor;
    batch.totalInterestEarned = batch.totalInterestEarned.plus(interestEarned);
    createWithdrawalBatchInterestAccrued(generateEventId(event), {
      batch: batch.id,
      interestEarned,
      market: market.id,
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
    });
  }
  if (batch.lastUpdatedTimestamp != event.block.timestamp.toI32()) {
    batch.lastUpdatedTimestamp = event.block.timestamp.toI32();
  }
}

export function handleDeposit(event: DepositEvent): void {
  let market = getMarket(generateMarketId(event.address));
  let lenderResult = getOrCreateLenderAccount(
    market,
    event.address,
    event.params.account,
    event.block.timestamp
  );
  let lender = lenderResult.entity;
  let lenderAccountCreated = lenderResult.wasCreated;

  createDeposit(generateMarketEventId(market), {
    account: lender.id,
    scaledAmount: event.params.scaledAmount,
    assetAmount: event.params.assetAmount,
    market: market.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    depositIndex: market.depositIndex,
    eventIndex: market.eventIndex,
    blockLogIndex: event.logIndex.toI32(),
  });
  market.depositIndex = market.depositIndex + 1;
  market.eventIndex = market.eventIndex + 1;

  let prevLenderBalance = lender.scaledBalance;
  let interestEarned = processLenderInterestAccrued(event, lender, market);
  lender.totalDeposited = lender.totalDeposited.plus(event.params.assetAmount);
  lender.scaledBalance = lender.scaledBalance.plus(event.params.scaledAmount);
  lender.lastScaleFactor = market.scaleFactor;
  lender.save();

  let prevSupply = market.scaledTotalSupply;
  market.scaledTotalSupply = market.scaledTotalSupply.plus(
    event.params.scaledAmount
  );
  market.totalDeposited = market.totalDeposited.plus(event.params.assetAmount);

  let priceMul = getTokenPriceMultiplier(market.decimals, market.asset, event.block.timestamp);
  setMarketTotalDebtUSD(market, priceMul);

  let hasPrice = !priceMul.equals(BigDecimal.zero());
  let ps = getOrCreateProtocolStats();
  let bs = getOrCreateBorrowerStats(market.borrower);
  let ls = getOrCreateLenderStats(event.params.account, event.block.timestamp);
  updateBorrowerActiveMarketCount(bs, ps, prevSupply, market.scaledTotalSupply, market.isClosed, market.isClosed);
  if (lenderAccountCreated) {
    ls.numMarkets = ls.numMarkets + 1;
  }
  updateLenderActiveMarketCount(ls, ps, prevLenderBalance, lender.scaledBalance);

  if (hasPrice) {
    let usdDelta = amountToUSD(event.params.assetAmount, priceMul);
    market.totalDepositedUSD = market.totalDepositedUSD.plus(usdDelta);
    ps.totalDepositedUSD = ps.totalDepositedUSD.plus(usdDelta);
    bs.totalDepositedUSD = bs.totalDepositedUSD.plus(usdDelta);
    ls.totalDepositedUSD = ls.totalDepositedUSD.plus(usdDelta);
    if (!interestEarned.isZero()) {
      let interestUSD = amountToUSD(interestEarned, priceMul);
      ls.totalInterestEarnedUSD = ls.totalInterestEarnedUSD.plus(interestUSD);
    }

    let pds = getOrCreateProtocolDailyStats(event.block.timestamp, ps);
    let bds = getOrCreateBorrowerDailyStats(market.borrower, event.block.timestamp, bs);
    let lds = getOrCreateLenderDailyStats(event.params.account, event.block.timestamp, ls);
    pds.dayDepositedUSD = pds.dayDepositedUSD.plus(usdDelta);
    bds.dayDepositedUSD = bds.dayDepositedUSD.plus(usdDelta);
    lds.dayDepositedUSD = lds.dayDepositedUSD.plus(usdDelta);
    if (!interestEarned.isZero()) {
      let interestUSD = amountToUSD(interestEarned, priceMul);
      lds.dayInterestEarnedUSD = lds.dayInterestEarnedUSD.plus(interestUSD);
    }
    pds.save();
    bds.save();
    lds.save();
  }

  let mds = getOrCreateMarketDailyStats(market, event.block.timestamp);
  mds.dayDeposited = mds.dayDeposited.plus(event.params.assetAmount);

  market.save();
  mds.save();
  ps.save();
  bs.save();
  ls.save();
}

export function handleFeesCollected(event: FeesCollectedEvent): void {
  let market = getMarket(generateMarketId(event.address));
  market.pendingProtocolFees = market.pendingProtocolFees.minus(
    event.params.assets
  );
  createFeesCollected(generateMarketEventId(market), {
    market: market.id,
    feesCollected: event.params.assets,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    feesCollectedIndex: market.feesCollectedIndex,
    eventIndex: market.eventIndex,
    blockLogIndex: event.logIndex.toI32(),
  });
  market.feesCollectedIndex = market.feesCollectedIndex + 1;
  market.eventIndex = market.eventIndex + 1;

  updateMarketTotalDebtUSD(market, event.block.timestamp);
  market.save();
}

export function handleMarketClosed(event: MarketClosedEvent): void {
  let market = getMarket(generateMarketId(event.address));
  let prevSupply = market.scaledTotalSupply;
  let wasClosed = market.isClosed;
  market.isClosed = true;
  createMarketClosed(generateMarketEventId(market), {
    market: market.id,
    timestamp: event.params.timestamp.toI32(),
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    eventIndex: market.eventIndex,
    blockLogIndex: event.logIndex.toI32(),
  });
  market.eventIndex = market.eventIndex + 1;
  market.save();

  if (!wasClosed) {
    let ps = getOrCreateProtocolStats();
    ps.numClosedMarkets = ps.numClosedMarkets + 1;

    let bs = getOrCreateBorrowerStats(market.borrower);
    bs.numClosedMarkets = bs.numClosedMarkets + 1;

    // Borrower active count: market with nonzero supply becoming closed => inactive
    updateBorrowerActiveMarketCount(bs, ps, prevSupply, market.scaledTotalSupply, false, market.isClosed);

    ps.save();
    bs.save();
    let pds = getOrCreateProtocolDailyStats(event.block.timestamp, ps);
    let bds = getOrCreateBorrowerDailyStats(market.borrower, event.block.timestamp, bs);
    pds.save();
    bds.save();
  }
}

export function handleMaxTotalSupplyUpdated(
  event: MaxTotalSupplyUpdatedEvent
): void {
  let market = getMarket(generateMarketId(event.address));
  createMaxTotalSupplyUpdated(generateMarketEventId(market), {
    market: market.id,
    oldMaxTotalSupply: market.maxTotalSupply,
    newMaxTotalSupply: event.params.assets,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    maxTotalSupplyUpdatedIndex: market.maxTotalSupplyUpdatedIndex,
    eventIndex: market.eventIndex,
    blockLogIndex: event.logIndex.toI32(),
  });
  market.maxTotalSupplyUpdatedIndex = market.maxTotalSupplyUpdatedIndex + 1;
  market.eventIndex = market.eventIndex + 1;
  market.maxTotalSupply = event.params.assets;
  market.save();
}

export function handleReserveRatioBipsUpdated(
  event: ReserveRatioBipsUpdatedEvent
): void {
  let market = getMarket(generateMarketId(event.address));
  createReserveRatioBipsUpdated(generateEventId(event), {
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    newReserveRatioBips: event.params.reserveRatioBipsUpdated.toI32(),
    oldReserveRatioBips: market.reserveRatioBips,
    market: market.id,
    blockLogIndex: event.logIndex.toI32(),
  });
  market.reserveRatioBips = event.params.reserveRatioBipsUpdated.toI32();
  market.save();
}

export function handleSanctionedAccountAssetsSentToEscrow(
  event: SanctionedAccountAssetsSentToEscrowEvent
): void {
  let entity = new SanctionedAccountAssetsSentToEscrow(generateEventId(event));
  entity.account = event.params.account;
  entity.escrow = event.params.escrow;
  entity.amount = event.params.amount;

  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;
  entity.blockLogIndex = event.logIndex.toI32();
  entity.save();
}

export function handleSanctionedAccountWithdrawalSentToEscrow(
  event: SanctionedAccountWithdrawalSentToEscrowEvent
): void {
  let entity = new SanctionedAccountWithdrawalSentToEscrow(
    generateEventId(event)
  );
  entity.account = event.params.account;
  entity.escrow = event.params.escrow;
  entity.expiry = event.params.expiry;
  entity.amount = event.params.amount;

  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;
  entity.blockLogIndex = event.logIndex.toI32();

  entity.save();
}

function updateTimeDelinquentAndGetPenaltyTime(
  market: Market,
  timeDelta: BigInt
): BigInt {
  // Seconds in delinquency at last update
  let previousTimeDelinquent = BigInt.fromI32(market.timeDelinquent);

  if (market.isDelinquent) {
    // Since the borrower is still delinquent, increase the total
    // time in delinquency by the time elapsed.
    market.timeDelinquent = previousTimeDelinquent.plus(timeDelta).toI32();

    // Calculate the number of seconds the borrower had remaining
    // in the grace period.
    let secondsRemainingWithoutPenalty = satSub(
      BigInt.fromI32(market.delinquencyGracePeriod),
      previousTimeDelinquent
    );

    // Penalties apply for the number of seconds the market spent in
    // delinquency outside of the grace period since the last update.
    return satSub(timeDelta, secondsRemainingWithoutPenalty);
  }

  // Reduce the total time in delinquency by the time elapsed, stopping
  // when it reaches zero.
  market.timeDelinquent = satSub(previousTimeDelinquent, timeDelta).toI32();

  // Calculate the number of seconds the old timeDelinquent had remaining
  // outside the grace period, or zero if it was already in the grace period.
  let secondsRemainingWithPenalty = satSub(
    previousTimeDelinquent,
    BigInt.fromI32(market.delinquencyGracePeriod)
  );

  // Only apply penalties for the remaining time outside of the grace period.
  if (secondsRemainingWithPenalty.lt(timeDelta)) {
    return secondsRemainingWithPenalty;
  }
  return timeDelta;
}

export function handleInterestAndFeesAccrued(
  event: InterestAndFeesAccruedEvent
): void {
  let market = getMarket(generateMarketId(event.address));
  let baseInterestRay = event.params.baseInterestRay;
  let delinquencyFeeRay = event.params.delinquencyFeeRay;
  let protocolFee = event.params.protocolFees;
  let scaleFactor = event.params.scaleFactor;
  let baseInterestAccrued = rayMul(market.scaledTotalSupply, baseInterestRay);
  let delinquencyFeesAccrued = rayMul(
    market.scaledTotalSupply,
    delinquencyFeeRay
  );
  let fromTimestamp = event.params.fromTimestamp;
  let toTimestamp = event.params.toTimestamp;
  market.totalDelinquencyFeesAccrued = market.totalDelinquencyFeesAccrued.plus(
    delinquencyFeesAccrued
  );
  market.totalBaseInterestAccrued = market.totalBaseInterestAccrued.plus(
    baseInterestAccrued
  );
  let timeWithPenalties = updateTimeDelinquentAndGetPenaltyTime(
    market,
    toTimestamp.minus(fromTimestamp)
  );
  createMarketInterestAccrued(generateEventId(event), {
    fromTimestamp: fromTimestamp.toI32(),
    toTimestamp: toTimestamp.toI32(),
    baseInterestRay: baseInterestRay,
    delinquencyFeeRay: delinquencyFeeRay,
    baseInterestAccrued,
    delinquencyFeesAccrued,
    protocolFeesAccrued: protocolFee,
    market: market.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    timeWithPenalties: timeWithPenalties.toI32(),
    blockLogIndex: event.logIndex.toI32(),
  });
  market.isIncurringPenalties =
    market.timeDelinquent > market.delinquencyGracePeriod;

  market.scaleFactor = scaleFactor;
  market.totalProtocolFeesAccrued = market.totalProtocolFeesAccrued.plus(
    protocolFee
  );
  market.pendingProtocolFees = market.pendingProtocolFees.plus(protocolFee);
  market.lastInterestAccruedTimestamp = toTimestamp.toI32();
  market.lastInterestAccruedBlockNumber = event.block.number.toI32();

  // Single price lookup for all three USD conversions
  let priceMul = getTokenPriceMultiplier(market.decimals, market.asset, event.block.timestamp);
  setMarketTotalDebtUSD(market, priceMul);
  let hasPrice = !priceMul.equals(BigDecimal.zero());
  
  if (hasPrice) {
    let baseInterestUSD = amountToUSD(baseInterestAccrued, priceMul);
    let delinquencyFeesUSD = amountToUSD(delinquencyFeesAccrued, priceMul);
    let protocolFeesUSD = amountToUSD(protocolFee, priceMul);
    market.totalBaseInterestAccruedUSD = market.totalBaseInterestAccruedUSD.plus(baseInterestUSD);
    market.totalDelinquencyFeesAccruedUSD = market.totalDelinquencyFeesAccruedUSD.plus(delinquencyFeesUSD);
    market.totalProtocolFeesAccruedUSD = market.totalProtocolFeesAccruedUSD.plus(protocolFeesUSD);

    let ps = getOrCreateProtocolStats();
    let bs = getOrCreateBorrowerStats(market.borrower);
    ps.totalBaseInterestAccruedUSD = ps.totalBaseInterestAccruedUSD.plus(baseInterestUSD);
    ps.totalDelinquencyFeesAccruedUSD = ps.totalDelinquencyFeesAccruedUSD.plus(delinquencyFeesUSD);
    ps.totalProtocolFeesAccruedUSD = ps.totalProtocolFeesAccruedUSD.plus(protocolFeesUSD);
    bs.totalBaseInterestAccruedUSD = bs.totalBaseInterestAccruedUSD.plus(baseInterestUSD);
    bs.totalDelinquencyFeesAccruedUSD = bs.totalDelinquencyFeesAccruedUSD.plus(delinquencyFeesUSD);
    bs.totalProtocolFeesAccruedUSD = bs.totalProtocolFeesAccruedUSD.plus(protocolFeesUSD);
    ps.save();
    bs.save();
    let bds = getOrCreateBorrowerDailyStats(market.borrower, event.block.timestamp, bs);
    let pds = getOrCreateProtocolDailyStats(event.block.timestamp, ps);
    bds.dayBaseInterestAccruedUSD = bds.dayBaseInterestAccruedUSD.plus(baseInterestUSD);
    bds.dayDelinquencyFeesAccruedUSD = bds.dayDelinquencyFeesAccruedUSD.plus(delinquencyFeesUSD);
    bds.dayProtocolFeesAccruedUSD = bds.dayProtocolFeesAccruedUSD.plus(protocolFeesUSD);
    pds.dayBaseInterestAccruedUSD = pds.dayBaseInterestAccruedUSD.plus(baseInterestUSD);
    pds.dayDelinquencyFeesAccruedUSD = pds.dayDelinquencyFeesAccruedUSD.plus(delinquencyFeesUSD);
    pds.dayProtocolFeesAccruedUSD = pds.dayProtocolFeesAccruedUSD.plus(protocolFeesUSD);
    bds.save();
    pds.save();
  }

  let mds = getOrCreateMarketDailyStats(market, event.block.timestamp);
  mds.dayBaseInterestAccrued = mds.dayBaseInterestAccrued.plus(baseInterestAccrued);
  mds.dayDelinquencyFeesAccrued = mds.dayDelinquencyFeesAccrued.plus(delinquencyFeesAccrued);
  mds.dayProtocolFeesAccrued = mds.dayProtocolFeesAccrued.plus(protocolFee);

  market.save();
  mds.save();
}

export function handleStateUpdated(event: StateUpdatedEvent): void {
  let isDelinquent = event.params.isDelinquent;
  let marketId = generateMarketId(event.address);
  let market = getMarket(marketId);
  if (market.isDelinquent != isDelinquent) {
    let wasDelinquent = market.isDelinquent;
    market.isDelinquent = isDelinquent;
    let assetAddress = market.asset.slice(market.asset.indexOf(`0x`));
    let totalAssets = IERC20.bind(
      Address.fromBytes(Bytes.fromHexString(assetAddress))
    ).balanceOf(event.address);
    let liquidityRequired = calculateLiquidityRequired(market);
    createDelinquencyStatusChanged(generateMarketEventId(market), {
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      isDelinquent: isDelinquent,
      totalAssets: totalAssets,
      liquidityCoverageRequired: liquidityRequired,
      market: market.id,
      delinquencyStatusChangedIndex: market.delinquencyStatusChangedIndex,
      eventIndex: market.eventIndex,
      blockLogIndex: event.logIndex.toI32(),
    });
    market.delinquencyStatusChangedIndex =
      market.delinquencyStatusChangedIndex + 1;
    market.eventIndex = market.eventIndex + 1;

    // Update delinquency counts
    let ps = getOrCreateProtocolStats();
    let bs = getOrCreateBorrowerStats(market.borrower);
    if (isDelinquent && !wasDelinquent) {
      ps.numDelinquentMarkets = ps.numDelinquentMarkets + 1;
      bs.numDelinquentMarkets = bs.numDelinquentMarkets + 1;
    } else if (!isDelinquent && wasDelinquent) {
      ps.numDelinquentMarkets = ps.numDelinquentMarkets - 1;
      bs.numDelinquentMarkets = bs.numDelinquentMarkets - 1;
    }
    ps.save();
    bs.save();
    let pds = getOrCreateProtocolDailyStats(event.block.timestamp, ps);
    let bds = getOrCreateBorrowerDailyStats(market.borrower, event.block.timestamp, bs);
    pds.save();
    bds.save();
  }
  market.save();
}

export function handleTransfer(event: TransferEvent): void {
  let fromAddress = event.params.from;
  let toAddress = event.params.to;
  let value = event.params.value;
  if (
    !(
      isNullAddress(fromAddress) ||
      isNullAddress(toAddress) ||
      toAddress.equals(event.address)
    )
  ) {
    let market = getMarket(generateMarketId(event.address));
    let fromResult = getOrCreateLenderAccount(
      market,
      event.address,
      fromAddress,
      event.block.timestamp
    );
    let from = fromResult.entity;
    let toResult = getOrCreateLenderAccount(
      market,
      event.address,
      toAddress,
      event.block.timestamp
    );
    let to = toResult.entity;

    let prevFromBalance = from.scaledBalance;
    let prevToBalance = to.scaledBalance;
    let fromInterest = processLenderInterestAccrued(event, from, market);
    let toInterest = processLenderInterestAccrued(event, to, market);
    let scaledAmount = rayDiv(value, market.scaleFactor);
    from.scaledBalance = satSub(from.scaledBalance, scaledAmount);
    to.scaledBalance = to.scaledBalance.plus(scaledAmount);
    from.save();
    to.save();

    let ps = getOrCreateProtocolStats();
    let fromLs = getOrCreateLenderStats(fromAddress, event.block.timestamp);
    let toLs = getOrCreateLenderStats(toAddress, event.block.timestamp);
    if (fromResult.wasCreated) {
      fromLs.numMarkets = fromLs.numMarkets + 1;
    }
    if (toResult.wasCreated) {
      toLs.numMarkets = toLs.numMarkets + 1;
    }
    updateLenderActiveMarketCount(fromLs, ps, prevFromBalance, from.scaledBalance);
    updateLenderActiveMarketCount(toLs, ps, prevToBalance, to.scaledBalance);

    let priceMul = getTokenPriceMultiplier(market.decimals, market.asset, event.block.timestamp);
    let hasPrice = !priceMul.equals(BigDecimal.zero());

    if (hasPrice) {
      if (!fromInterest.isZero()) {
        let fromInterestUSD = amountToUSD(fromInterest, priceMul);
        fromLs.totalInterestEarnedUSD = fromLs.totalInterestEarnedUSD.plus(fromInterestUSD);
      }
      if (!toInterest.isZero()) {
        let toInterestUSD = amountToUSD(toInterest, priceMul);
        toLs.totalInterestEarnedUSD = toLs.totalInterestEarnedUSD.plus(toInterestUSD);
      }

      let fromLds = getOrCreateLenderDailyStats(fromAddress, event.block.timestamp, fromLs);
      let toLds = getOrCreateLenderDailyStats(toAddress, event.block.timestamp, toLs);
      if (!fromInterest.isZero()) {
        fromLds.dayInterestEarnedUSD = fromLds.dayInterestEarnedUSD.plus(amountToUSD(fromInterest, priceMul));
      }
      if (!toInterest.isZero()) {
        toLds.dayInterestEarnedUSD = toLds.dayInterestEarnedUSD.plus(amountToUSD(toInterest, priceMul));
      }
      fromLds.save();
      toLds.save();
    }

    ps.save();
    fromLs.save();
    toLs.save();

    createTransfer(generateEventId(event), {
      market: market.id,
      from: from.id,
      to: to.id,
      scaledAmount: scaledAmount,
      amount: value,
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
    });
  }
}

export function handleWithdrawalBatchClosed(
  event: WithdrawalBatchClosedEvent
): void {
  let batchId = generateWithdrawalBatchId(event.address, event.params.expiry);
  let batch = getWithdrawalBatch(batchId);
  let market = getMarket(generateMarketId(event.address));
  processWithdrawalBatchInterestAccrued(event, batch, market);
  batch.isClosed = true;
  batch.save();

  let bs = getOrCreateBorrowerStats(market.borrower);
  if (batch.expiration != null) {
    let expId = batch.expiration as string;
    let expirationTime = getWithdrawalBatchExpired(expId).blockTimestamp;
    if (expirationTime < event.block.timestamp.toI32()) {
      bs.numBatchesPaidLate = bs.numBatchesPaidLate + 1;
    }
  }
  bs.save();
  let bds = getOrCreateBorrowerDailyStats(market.borrower, event.block.timestamp, bs);
  bds.save();
  
}

export function handleWithdrawalBatchCreated(
  event: WithdrawalBatchCreatedEvent
): void {
  let expiry = event.params.expiry;
  let id = generateWithdrawalBatchId(event.address, expiry);
  createWithdrawalBatchCreated(generateEventId(event), {
    batch: id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
  });
  let market = getMarket(event.address.toHex());
  createWithdrawalBatch(id, {
    expiry: expiry,
    market: market.id,
    lastScaleFactor: market.scaleFactor,
    lastUpdatedTimestamp: event.block.timestamp.toI32(),
  });
  market.pendingWithdrawalExpiry = expiry;
  market.save();
}

export function handleWithdrawalBatchExpired(
  event: WithdrawalBatchExpiredEvent
): void {
  let expiry = event.params.expiry;
  let normalizedAmountPaid = event.params.normalizedAmountPaid;
  let scaledAmountBurned = event.params.scaledAmountBurned;
  let scaledTotalAmount = event.params.scaledTotalAmount;
  let id = generateWithdrawalBatchId(event.address, expiry);
  let batch = getWithdrawalBatch(id);
  let market = getMarket(event.address.toHex());
  processWithdrawalBatchInterestAccrued(event, batch, market);

  let scaledAmountOwed = batch.scaledTotalAmount.minus(
    batch.scaledAmountBurned
  );
  let normalizedAmountOwed = scaledAmountOwed;
  if (scaledAmountOwed.gt(BigInt.zero())) {
    normalizedAmountOwed = rayMul(scaledAmountOwed, batch.lastScaleFactor);
  }

  let result = createWithdrawalBatchExpired(generateEventId(event), {
    batch: id,
    normalizedAmountPaid: normalizedAmountPaid,
    scaledAmountBurned: scaledAmountBurned,
    scaledTotalAmount: scaledTotalAmount,
    normalizedAmountOwed: normalizedAmountOwed,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
  });
  batch.isExpired = true;
  market.pendingWithdrawalExpiry = BigInt.zero();
  batch.expiration = result.id;
  batch.save();
  market.save();
  let bs = getOrCreateBorrowerStats(market.borrower);
  bs.numBatchesExpired = bs.numBatchesExpired + 1;
  if (batch.scaledAmountBurned.lt(batch.scaledTotalAmount)) {
    bs.numBatchesExpiredUnpaid = bs.numBatchesExpiredUnpaid + 1;
  }
  bs.save();
}

export function handleWithdrawalBatchPayment(
  event: WithdrawalBatchPaymentEvent
): void {
  let expiry = event.params.expiry;
  let normalizedAmountPaid = event.params.normalizedAmountPaid;
  let scaledAmountBurned = event.params.scaledAmountBurned;

  let batch = getWithdrawalBatch(
    generateWithdrawalBatchId(event.address, expiry)
  );
  let market = getMarket(batch.market);
  processWithdrawalBatchInterestAccrued(event, batch, market);
  let paymentId = generateWithdrawalBatchPaymentId(
    event.address,
    expiry,
    batch.paymentsCount
  );
  createWithdrawalBatchPayment(paymentId, {
    batch: batch.id,
    normalizedAmountPaid: normalizedAmountPaid,
    scaledAmountBurned: scaledAmountBurned,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
  });
  batch.paymentsCount = batch.paymentsCount + 1;
  batch.scaledAmountBurned = batch.scaledAmountBurned.plus(scaledAmountBurned);
  batch.normalizedAmountPaid = batch.normalizedAmountPaid.plus(
    normalizedAmountPaid
  );
  batch.save();

  market.scaledPendingWithdrawals = market.scaledPendingWithdrawals.minus(
    scaledAmountBurned
  );
  market.normalizedUnclaimedWithdrawals = market.normalizedUnclaimedWithdrawals.plus(
    normalizedAmountPaid
  );
  // Withdrawal batch payment burns market tokens
  let prevSupply = market.scaledTotalSupply;
  market.scaledTotalSupply = market.scaledTotalSupply.minus(scaledAmountBurned);
  updateMarketTotalDebtUSD(market, event.block.timestamp);
  market.save();

  // Borrower active count: supply may go to 0
  let ps = getOrCreateProtocolStats();
  let bs = getOrCreateBorrowerStats(market.borrower);
  updateBorrowerActiveMarketCount(bs, ps, prevSupply, market.scaledTotalSupply, market.isClosed, market.isClosed);
  ps.save();
  bs.save();

  let mds = getOrCreateMarketDailyStats(market, event.block.timestamp);
  let pds = getOrCreateProtocolDailyStats(event.block.timestamp, ps);
  let bds = getOrCreateBorrowerDailyStats(market.borrower, event.block.timestamp, bs);
  mds.dayRepaid = mds.dayRepaid.plus(normalizedAmountPaid);
  mds.save();
  pds.save();
  bds.save();
}

export function handleWithdrawalExecuted(event: WithdrawalExecutedEvent): void {
  let expiry = event.params.expiry;
  let account = event.params.account;
  let normalizedAmount = event.params.normalizedAmount;
  let market = getMarket(generateMarketId(event.address));
  let status = getLenderWithdrawalStatus(
    generateLenderWithdrawalStatusId(event.address, expiry, account)
  );
  let batch = getWithdrawalBatch(
    generateWithdrawalBatchId(event.address, expiry)
  );
  processWithdrawalBatchInterestAccrued(event, batch, market);
  status.executionsCount = status.executionsCount + 1;
  createWithdrawalExecution(
    generateWithdrawalExecutionId(
      event.address,
      expiry,
      account,
      status.executionsCount
    ),
    {
      batch: status.batch,
      status: status.id,
      account: status.account,
      normalizedAmount: normalizedAmount,
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
    }
  );
  status.normalizedAmountWithdrawn = status.normalizedAmountWithdrawn.plus(
    normalizedAmount
  );
  batch.normalizedAmountClaimed = batch.normalizedAmountClaimed.plus(
    normalizedAmount
  );
  market.normalizedUnclaimedWithdrawals = market.normalizedUnclaimedWithdrawals.minus(
    normalizedAmount
  );

  let priceMul = getTokenPriceMultiplier(market.decimals, market.asset, event.block.timestamp);
  setMarketTotalDebtUSD(market, priceMul);
  let hasPrice = !priceMul.equals(BigDecimal.zero());

  market.totalWithdrawalsExecuted = market.totalWithdrawalsExecuted.plus(normalizedAmount);

  if (hasPrice) {
    let usdDelta = amountToUSD(normalizedAmount, priceMul);
    market.totalWithdrawalsExecutedUSD = market.totalWithdrawalsExecutedUSD.plus(usdDelta);

    let ps = getOrCreateProtocolStats();
    let bs = getOrCreateBorrowerStats(market.borrower);
    let ls = getOrCreateLenderStats(account, event.block.timestamp);
    ps.totalWithdrawalsExecutedUSD = ps.totalWithdrawalsExecutedUSD.plus(usdDelta);
    bs.totalWithdrawalsExecutedUSD = bs.totalWithdrawalsExecutedUSD.plus(usdDelta);
    ls.totalWithdrawalsExecutedUSD = ls.totalWithdrawalsExecutedUSD.plus(usdDelta);
    ps.save();
    bs.save();
    ls.save();

    let pds = getOrCreateProtocolDailyStats(event.block.timestamp, ps);
    let bds = getOrCreateBorrowerDailyStats(market.borrower, event.block.timestamp, bs);
    let lds = getOrCreateLenderDailyStats(account, event.block.timestamp, ls);
    pds.dayWithdrawalsExecutedUSD = pds.dayWithdrawalsExecutedUSD.plus(usdDelta);
    bds.dayWithdrawalsExecutedUSD = bds.dayWithdrawalsExecutedUSD.plus(usdDelta);
    lds.dayWithdrawalsExecutedUSD = lds.dayWithdrawalsExecutedUSD.plus(usdDelta);
    bds.save();
    pds.save();
    lds.save();
  }
  if (batch.isClosed) {
    status.isCompleted = true;
    let lender = getLenderAccount(
      generateLenderAccountId(event.address, account)
    );
    lender.numPendingWithdrawalBatches = lender.numPendingWithdrawalBatches - 1;
    lender.save();
    batch.completedWithdrawalsCount = batch.completedWithdrawalsCount + 1;
    // Track whether batch is complete by counting the number of lenders who have
    // completed their withdrawals. Tracking it by the claimed vs unclaimed
    // amount can be inaccurate due to rounding errors.
    if (batch.lenderWithdrawalsCount == batch.completedWithdrawalsCount) {
      batch.isCompleted = true;
    }
  }
  batch.save();
  status.save();
  market.save();
  let mds = getOrCreateMarketDailyStats(market, event.block.timestamp);
  mds.dayWithdrawalsExecuted = mds.dayWithdrawalsExecuted.plus(normalizedAmount);
  mds.save();
}

export function handleWithdrawalQueued(event: WithdrawalQueuedEvent): void {
  let account = event.params.account;
  let expiry = event.params.expiry;
  let normalizedAmount = event.params.normalizedAmount;
  let scaledAmount = event.params.scaledAmount;

  let lender = getLenderAccount(
    generateLenderAccountId(event.address, account)
  );
  let market = getMarket(generateMarketId(event.address));
  let batch = getWithdrawalBatch(
    generateWithdrawalBatchId(event.address, expiry)
  );
  let statusCreation = getOrInitializeLenderWithdrawalStatus(
    generateLenderWithdrawalStatusId(event.address, expiry, account),
    {
      account: lender.id,
      batch: batch.id,
    }
  );
  let status = statusCreation.entity;
  processWithdrawalBatchInterestAccrued(event, batch, market);
  createWithdrawalRequest(generateMarketEventId(market), {
    requestIndex: status.requestsCount,
    batch: status.batch,
    status: status.id,
    account: status.account,
    scaledAmount,
    normalizedAmount,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    withdrawalRequestsIndex: market.withdrawalRequestsIndex,
    eventIndex: market.eventIndex,
    market: market.id,
    blockLogIndex: event.logIndex.toI32(),
  });
  market.withdrawalRequestsIndex = market.withdrawalRequestsIndex + 1;
  market.eventIndex = market.eventIndex + 1;
  status.requestsCount = status.requestsCount + 1;
  status.scaledAmount = status.scaledAmount.plus(scaledAmount);
  status.totalNormalizedRequests = status.totalNormalizedRequests.plus(
    normalizedAmount
  );
  let priceMul = getTokenPriceMultiplier(market.decimals, market.asset, event.block.timestamp);

  let prevLenderBalance = lender.scaledBalance;
  let interestEarned = processLenderInterestAccrued(event, lender, market);
  lender.scaledBalance = lender.scaledBalance.minus(scaledAmount);
  market.scaledPendingWithdrawals = market.scaledPendingWithdrawals.plus(
    scaledAmount
  );
  batch.scaledTotalAmount = batch.scaledTotalAmount.plus(scaledAmount);
  batch.totalNormalizedRequests = batch.totalNormalizedRequests.plus(
    normalizedAmount
  );

  if (statusCreation.wasCreated) {
    lender.numPendingWithdrawalBatches = lender.numPendingWithdrawalBatches + 1;
    batch.lenderWithdrawalsCount = batch.lenderWithdrawalsCount + 1;
  }

  let hasPrice = !priceMul.equals(BigDecimal.zero());

  market.totalWithdrawalsRequested = market.totalWithdrawalsRequested.plus(normalizedAmount);

  let ps = getOrCreateProtocolStats();
  let ls = getOrCreateLenderStats(account, event.block.timestamp);
  updateLenderActiveMarketCount(ls, ps, prevLenderBalance, lender.scaledBalance);

  if (hasPrice) {
    let usdDelta = amountToUSD(normalizedAmount, priceMul);
    market.totalWithdrawalsRequestedUSD = market.totalWithdrawalsRequestedUSD.plus(usdDelta);

    let bs = getOrCreateBorrowerStats(market.borrower);
    ps.totalWithdrawalsRequestedUSD = ps.totalWithdrawalsRequestedUSD.plus(usdDelta);
    bs.totalWithdrawalsRequestedUSD = bs.totalWithdrawalsRequestedUSD.plus(usdDelta);
    ls.totalWithdrawalsRequestedUSD = ls.totalWithdrawalsRequestedUSD.plus(usdDelta);
    if (!interestEarned.isZero()) {
      let interestUSD = amountToUSD(interestEarned, priceMul);
      ls.totalInterestEarnedUSD = ls.totalInterestEarnedUSD.plus(interestUSD);
    }
    bs.save();

    let bds = getOrCreateBorrowerDailyStats(market.borrower, event.block.timestamp, bs);
    bds.dayWithdrawalsRequestedUSD = bds.dayWithdrawalsRequestedUSD.plus(usdDelta);
    bds.save();

    let pds = getOrCreateProtocolDailyStats(event.block.timestamp, ps);
    pds.dayWithdrawalsRequestedUSD = pds.dayWithdrawalsRequestedUSD.plus(usdDelta);
    pds.save();

    let lds = getOrCreateLenderDailyStats(account, event.block.timestamp, ls);
    lds.dayWithdrawalsRequestedUSD = lds.dayWithdrawalsRequestedUSD.plus(usdDelta);
    if (!interestEarned.isZero()) {
      lds.dayInterestEarnedUSD = lds.dayInterestEarnedUSD.plus(amountToUSD(interestEarned, priceMul));
    }
    lds.save();
  }
  ps.save();
  ls.save();
  let mds = getOrCreateMarketDailyStats(market, event.block.timestamp);
  mds.dayWithdrawalsRequested = mds.dayWithdrawalsRequested.plus(normalizedAmount);
  lender.save();
  status.save();
  market.save();
  batch.save();
  mds.save();
}

export function handleChangedSpherexEngineAddress(
  event: ChangedSpherexEngineAddressEvent
): void {}

export function handleChangedSpherexOperator(
  event: ChangedSpherexOperatorEvent
): void {}

export function handleProtocolFeeBipsUpdated(
  event: ProtocolFeeBipsUpdatedEvent
): void {
  let newProtocolFeeBips = event.params.protocolFeeBips.toI32();
  let market = getMarket(generateMarketId(event.address));
  createProtocolFeeBipsUpdated(generateMarketEventId(market), {
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    oldProtocolFeeBips: market.protocolFeeBips,
    newProtocolFeeBips: newProtocolFeeBips,
    transactionHash: event.transaction.hash,
    protocolFeeBipsUpdatedIndex: market.protocolFeeBipsUpdatedIndex,
    eventIndex: market.eventIndex,
    market: market.id,
    blockLogIndex: event.logIndex.toI32(),
  });
  market.protocolFeeBips = newProtocolFeeBips;
  market.protocolFeeBipsUpdatedIndex = market.protocolFeeBipsUpdatedIndex + 1;
  market.eventIndex = market.eventIndex + 1;
  market.save();
}

export function handleForceBuyBack(event: ForceBuyBackEvent): void {
  let market = getMarket(generateMarketId(event.address));
  createForceBuyBack(generateMarketEventId(market), {
    account: generateLenderAccountId(event.address, event.params.lender),
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    eventIndex: market.eventIndex,
    forceBuyBackIndex: market.forceBuyBackIndex,
    market: market.id,
    normalizedAmount: event.params.normalizedAmount,
    scaledAmount: event.params.scaledAmount,
    withdrawalExpiry: event.params.withdrawalExpiry.toI32(),
    blockLogIndex: event.logIndex.toI32(),
  });
  market.forceBuyBackIndex = market.forceBuyBackIndex + 1;
  market.eventIndex = market.eventIndex + 1;
  market.save();
}
