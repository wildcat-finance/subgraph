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
  getWithdrawalBatch,
  getWithdrawalBatchExpired,
  setAnnualInterestBips,
  setMarketIsClosed,
} from "../generated/UncrashableEntityHelpers";
import {
  Approval,
  SanctionedAccountAssetsQueuedForWithdrawal,
  SanctionedAccountAssetsSentToEscrow,
  SanctionedAccountWithdrawalSentToEscrow,
  HooksConfig,
  LenderAccount,
  Market,
  WithdrawalBatch,
  LenderHooksAccess,
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
import {
  getOrCreateBorrowerDailyStats,
  getOrCreateBorrowerStats,
  getOrCreateLenderDailyStats,
  getOrCreateLenderStats,
  getOrCreateMarketDailyStats,
  getOrCreateProtocolDailyStats,
  getOrCreateProtocolStats,
  markBorrowerUsdIncomplete,
  markLenderUsdIncomplete,
  markProtocolUsdIncomplete,
  updateBorrowerActiveMarketCount,
  updateLenderActiveMarketCount,
  updateMarketTotalDebtUSD,
} from "./daily-stats";
import { amountToUSD, getTokenPriceMultiplier } from "./price-feeds";
import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
} from "@graphprotocol/graph-ts";

function getTotalAssets(market: Market, marketAddress: Address): BigInt {
  let assetAddress = market.asset.slice(market.asset.indexOf("0x"));
  return IERC20.bind(
    Address.fromBytes(Bytes.fromHexString(assetAddress))
  ).balanceOf(marketAddress);
}

// function getOrCreateLenderAccount(
//   market: Market,
//   marketAddress: Address,
//   lenderAddress: Address
// ): GetOrCreateReturn<LenderAccount> {
//   let lenderAccountId = generateLenderAccountId(marketAddress, lenderAddress);
//   let _lenderAccount = LenderAccount.load(lenderAccountId);
//   if (_lenderAccount != null) {
//     return new GetOrCreateReturn<LenderAccount>(_lenderAccount, false);
//   }
//   const _controller = market.controller;
//   const _hooks = market.hooks;
//   let authorization_id: string | null = null;
//   let hooks_access_id: string | null = null;
//   if (_controller != null) {
//     const controller = _controller as string;
//     let authorization = getOrInitializeLenderAuthorization(
//       generateLenderAuthorizationId(
//         Bytes.fromHexString(controller),
//         lenderAddress
//       ),
//       {
//         authorized: false,
//         controller: controller,
//         lender: lenderAddress,
//       }
//     ).entity;
//     authorization_id = authorization.id;
//   }
//   if (_hooks != null) {
//     const hooks = _hooks as string;
//     let access_id = generateLenderHooksAccessId(
//       Bytes.fromHexString(hooks),
//       lenderAddress
//     );
//     if (LenderHooksAccess.load(access_id) != null) {
//       hooks_access_id = access_id;
//     }
//   }
//   return getOrInitializeLenderAccount(lenderAccountId, {
//     address: lenderAddress,
//     lastScaleFactor: market.scaleFactor,
//     lastUpdatedTimestamp: market.lastInterestAccruedTimestamp,
//     market: market.id,
//     controllerAuthorization: authorization_id,
//     hooksAccess: hooks_access_id,
//   });
// }

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
    let lenderStats = getOrCreateLenderStats(
      event.params.account,
      event.block.timestamp
    );
    lenderStats.numMarkets = lenderStats.numMarkets + 1;
    let lenderDaily = getOrCreateLenderDailyStats(
      event.params.account,
      event.block.timestamp,
      lenderStats
    );
    lenderStats.save();
    lenderDaily.save();
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

  let protocolStats = getOrCreateProtocolStats();
  let borrowerStats = getOrCreateBorrowerStats(market.borrower);
  let priceMultiplier = getTokenPriceMultiplier(
    market.decimals,
    market.asset,
    event.block.timestamp
  );
  let usdAmount: BigDecimal | null = null;
  if (priceMultiplier) {
    usdAmount = amountToUSD(
      event.params.assetAmount,
      priceMultiplier as BigDecimal
    );
    market.totalBorrowedUSD = market.totalBorrowedUSD.plus(
      usdAmount as BigDecimal
    );
    protocolStats.totalBorrowedUSD =
      protocolStats.totalBorrowedUSD.plus(usdAmount as BigDecimal);
    borrowerStats.totalBorrowedUSD =
      borrowerStats.totalBorrowedUSD.plus(usdAmount as BigDecimal);
  }

  let protocolDaily = getOrCreateProtocolDailyStats(
    event.block.timestamp,
    protocolStats
  );
  let borrowerDaily = getOrCreateBorrowerDailyStats(
    market.borrower,
    event.block.timestamp,
    borrowerStats
  );
  if (usdAmount) {
    protocolDaily.dayBorrowedUSD = protocolDaily.dayBorrowedUSD.plus(
      usdAmount as BigDecimal
    );
    borrowerDaily.dayBorrowedUSD = borrowerDaily.dayBorrowedUSD.plus(
      usdAmount as BigDecimal
    );
  } else if (!event.params.assetAmount.isZero()) {
    market.usdTotalsComplete = false;
    markProtocolUsdIncomplete(protocolStats, protocolDaily);
    markBorrowerUsdIncomplete(borrowerStats, borrowerDaily);
  }

  let marketDaily = getOrCreateMarketDailyStats(
    market,
    event.block.timestamp
  );
  marketDaily.totalBorrowed = marketDaily.totalBorrowed.plus(
    event.params.assetAmount
  );
  marketDaily.dayBorrowed = marketDaily.dayBorrowed.plus(
    event.params.assetAmount
  );
  market.save();
  protocolStats.save();
  borrowerStats.save();
  protocolDaily.save();
  borrowerDaily.save();
  marketDaily.save();
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
  market.totalRepaid = market.totalRepaid.plus(event.params.assetAmount);

  let protocolStats = getOrCreateProtocolStats();
  let borrowerStats = getOrCreateBorrowerStats(market.borrower);
  let priceMultiplier = getTokenPriceMultiplier(
    market.decimals,
    market.asset,
    event.block.timestamp
  );
  let usdAmount: BigDecimal | null = null;
  if (priceMultiplier) {
    usdAmount = amountToUSD(
      event.params.assetAmount,
      priceMultiplier as BigDecimal
    );
    market.totalRepaidUSD = market.totalRepaidUSD.plus(
      usdAmount as BigDecimal
    );
    protocolStats.totalRepaidUSD = protocolStats.totalRepaidUSD.plus(
      usdAmount as BigDecimal
    );
    borrowerStats.totalRepaidUSD = borrowerStats.totalRepaidUSD.plus(
      usdAmount as BigDecimal
    );
  }

  let protocolDaily = getOrCreateProtocolDailyStats(
    event.block.timestamp,
    protocolStats
  );
  let borrowerDaily = getOrCreateBorrowerDailyStats(
    market.borrower,
    event.block.timestamp,
    borrowerStats
  );
  if (usdAmount) {
    protocolDaily.dayRepaidUSD = protocolDaily.dayRepaidUSD.plus(
      usdAmount as BigDecimal
    );
    borrowerDaily.dayRepaidUSD = borrowerDaily.dayRepaidUSD.plus(
      usdAmount as BigDecimal
    );
  } else if (!event.params.assetAmount.isZero()) {
    market.usdTotalsComplete = false;
    markProtocolUsdIncomplete(protocolStats, protocolDaily);
    markBorrowerUsdIncomplete(borrowerStats, borrowerDaily);
  }

  let marketDaily = getOrCreateMarketDailyStats(
    market,
    event.block.timestamp
  );
  marketDaily.totalRepaid = marketDaily.totalRepaid.plus(
    event.params.assetAmount
  );
  marketDaily.dayRepaid = marketDaily.dayRepaid.plus(event.params.assetAmount);
  market.save();
  protocolStats.save();
  borrowerStats.save();
  protocolDaily.save();
  borrowerDaily.save();
  marketDaily.save();
}

function processLenderInterestAccrued(
  event: ethereum.Event,
  lender: LenderAccount,
  market: Market
): BigInt {
  let interestEarned = BigInt.zero();
  if (lender.lastScaleFactor.notEqual(market.scaleFactor)) {
    interestEarned = calculateInterestEarned(lender, market);
    lender.lastScaleFactor = market.scaleFactor;
    lender.totalInterestEarned = lender.totalInterestEarned.plus(
      interestEarned
    );
    createLenderInterestAccrued(
      generateEventId(event).concat("-").concat(lender.id),
      {
        account: lender.id,
        interestEarned,
        market: market.id,
        blockNumber: event.block.number.toI32(),
        blockTimestamp: event.block.timestamp.toI32(),
        transactionHash: event.transaction.hash,
      }
    );
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

  let previousLenderBalance = lender.scaledBalance;
  let interestEarned = processLenderInterestAccrued(event, lender, market);
  lender.totalDeposited = lender.totalDeposited.plus(event.params.assetAmount);
  lender.scaledBalance = lender.scaledBalance.plus(event.params.scaledAmount);
  lender.lastScaleFactor = market.scaleFactor;

  let previousSupply = market.scaledTotalSupply;
  market.scaledTotalSupply = market.scaledTotalSupply.plus(
    event.params.scaledAmount
  );
  market.totalDeposited = market.totalDeposited.plus(event.params.assetAmount);
  updateMarketTotalDebtUSD(market, event.block.timestamp);

  let protocolStats = getOrCreateProtocolStats();
  let borrowerStats = getOrCreateBorrowerStats(market.borrower);
  let lenderStats = getOrCreateLenderStats(
    event.params.account,
    event.block.timestamp
  );
  if (lenderResult.wasCreated) {
    lenderStats.numMarkets = lenderStats.numMarkets + 1;
  }
  updateBorrowerActiveMarketCount(
    borrowerStats,
    protocolStats,
    previousSupply,
    market.scaledTotalSupply,
    market.isClosed,
    market.isClosed
  );
  updateLenderActiveMarketCount(
    lenderStats,
    protocolStats,
    previousLenderBalance,
    lender.scaledBalance
  );

  let priceMultiplier = getTokenPriceMultiplier(
    market.decimals,
    market.asset,
    event.block.timestamp
  );
  let depositUSD: BigDecimal | null = null;
  let interestUSD: BigDecimal | null = null;
  if (priceMultiplier) {
    depositUSD = amountToUSD(
      event.params.assetAmount,
      priceMultiplier as BigDecimal
    );
    interestUSD = amountToUSD(
      interestEarned,
      priceMultiplier as BigDecimal
    );
    market.totalDepositedUSD = market.totalDepositedUSD.plus(
      depositUSD as BigDecimal
    );
    protocolStats.totalDepositedUSD = protocolStats.totalDepositedUSD.plus(
      depositUSD as BigDecimal
    );
    borrowerStats.totalDepositedUSD = borrowerStats.totalDepositedUSD.plus(
      depositUSD as BigDecimal
    );
    lenderStats.totalDepositedUSD = lenderStats.totalDepositedUSD.plus(
      depositUSD as BigDecimal
    );
    lenderStats.totalInterestEarnedUSD =
      lenderStats.totalInterestEarnedUSD.plus(interestUSD as BigDecimal);
  }

  let protocolDaily = getOrCreateProtocolDailyStats(
    event.block.timestamp,
    protocolStats
  );
  let borrowerDaily = getOrCreateBorrowerDailyStats(
    market.borrower,
    event.block.timestamp,
    borrowerStats
  );
  let lenderDaily = getOrCreateLenderDailyStats(
    event.params.account,
    event.block.timestamp,
    lenderStats
  );
  if (depositUSD) {
    protocolDaily.dayDepositedUSD = protocolDaily.dayDepositedUSD.plus(
      depositUSD as BigDecimal
    );
    borrowerDaily.dayDepositedUSD = borrowerDaily.dayDepositedUSD.plus(
      depositUSD as BigDecimal
    );
    lenderDaily.dayDepositedUSD = lenderDaily.dayDepositedUSD.plus(
      depositUSD as BigDecimal
    );
    lenderDaily.dayInterestEarnedUSD =
      lenderDaily.dayInterestEarnedUSD.plus(interestUSD as BigDecimal);
  } else {
    if (!event.params.assetAmount.isZero()) {
      market.usdTotalsComplete = false;
      markProtocolUsdIncomplete(protocolStats, protocolDaily);
      markBorrowerUsdIncomplete(borrowerStats, borrowerDaily);
    }
    if (!event.params.assetAmount.isZero() || !interestEarned.isZero()) {
      markLenderUsdIncomplete(lenderStats, lenderDaily);
    }
  }

  let marketDaily = getOrCreateMarketDailyStats(
    market,
    event.block.timestamp
  );
  marketDaily.totalDeposited = marketDaily.totalDeposited.plus(
    event.params.assetAmount
  );
  marketDaily.dayDeposited = marketDaily.dayDeposited.plus(
    event.params.assetAmount
  );

  lender.save();
  market.save();
  protocolStats.save();
  borrowerStats.save();
  lenderStats.save();
  protocolDaily.save();
  borrowerDaily.save();
  lenderDaily.save();
  marketDaily.save();
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
  let marketDaily = getOrCreateMarketDailyStats(
    market,
    event.block.timestamp
  );
  market.save();
  marketDaily.save();
}

export function handleMarketClosed(event: MarketClosedEvent): void {
  let market = getMarket(generateMarketId(event.address));
  let wasClosed = market.isClosed;
  let previousSupply = market.scaledTotalSupply;
  market.annualInterestBips = 0;
  market.isClosed = true;
  market.reserveRatioBips = 10000;
  market.timeDelinquent = 0;
  market.isIncurringPenalties = false;
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
    let protocolStats = getOrCreateProtocolStats();
    let borrowerStats = getOrCreateBorrowerStats(market.borrower);
    protocolStats.numClosedMarkets = protocolStats.numClosedMarkets + 1;
    borrowerStats.numClosedMarkets = borrowerStats.numClosedMarkets + 1;
    updateBorrowerActiveMarketCount(
      borrowerStats,
      protocolStats,
      previousSupply,
      market.scaledTotalSupply,
      false,
      true
    );
    let protocolDaily = getOrCreateProtocolDailyStats(
      event.block.timestamp,
      protocolStats
    );
    let borrowerDaily = getOrCreateBorrowerDailyStats(
      market.borrower,
      event.block.timestamp,
      borrowerStats
    );
    protocolStats.save();
    borrowerStats.save();
    protocolDaily.save();
    borrowerDaily.save();
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

export function handleSanctionedAccountAssetsQueuedForWithdrawal(
  event: SanctionedAccountAssetsQueuedForWithdrawalEvent
): void {
  let entity = new SanctionedAccountAssetsQueuedForWithdrawal(
    generateEventId(event)
  );
  entity.account = event.params.account;
  entity.expiry = event.params.expiry;
  entity.scaledAmount = event.params.scaledAmount;
  entity.normalizedAmount = event.params.normalizedAmount;
  entity.amount = event.params.normalizedAmount;
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

  updateMarketTotalDebtUSD(market, event.block.timestamp);
  let protocolStats = getOrCreateProtocolStats();
  let borrowerStats = getOrCreateBorrowerStats(market.borrower);
  let priceMultiplier = getTokenPriceMultiplier(
    market.decimals,
    market.asset,
    event.block.timestamp
  );
  let baseInterestUSD: BigDecimal | null = null;
  let delinquencyFeesUSD: BigDecimal | null = null;
  let protocolFeesUSD: BigDecimal | null = null;
  if (priceMultiplier) {
    baseInterestUSD = amountToUSD(
      baseInterestAccrued,
      priceMultiplier as BigDecimal
    );
    delinquencyFeesUSD = amountToUSD(
      delinquencyFeesAccrued,
      priceMultiplier as BigDecimal
    );
    protocolFeesUSD = amountToUSD(
      protocolFee,
      priceMultiplier as BigDecimal
    );
    market.totalBaseInterestAccruedUSD =
      market.totalBaseInterestAccruedUSD.plus(
        baseInterestUSD as BigDecimal
      );
    market.totalDelinquencyFeesAccruedUSD =
      market.totalDelinquencyFeesAccruedUSD.plus(
        delinquencyFeesUSD as BigDecimal
      );
    market.totalProtocolFeesAccruedUSD =
      market.totalProtocolFeesAccruedUSD.plus(
        protocolFeesUSD as BigDecimal
      );
    protocolStats.totalBaseInterestAccruedUSD =
      protocolStats.totalBaseInterestAccruedUSD.plus(
        baseInterestUSD as BigDecimal
      );
    protocolStats.totalDelinquencyFeesAccruedUSD =
      protocolStats.totalDelinquencyFeesAccruedUSD.plus(
        delinquencyFeesUSD as BigDecimal
      );
    protocolStats.totalProtocolFeesAccruedUSD =
      protocolStats.totalProtocolFeesAccruedUSD.plus(
        protocolFeesUSD as BigDecimal
      );
    borrowerStats.totalBaseInterestAccruedUSD =
      borrowerStats.totalBaseInterestAccruedUSD.plus(
        baseInterestUSD as BigDecimal
      );
    borrowerStats.totalDelinquencyFeesAccruedUSD =
      borrowerStats.totalDelinquencyFeesAccruedUSD.plus(
        delinquencyFeesUSD as BigDecimal
      );
    borrowerStats.totalProtocolFeesAccruedUSD =
      borrowerStats.totalProtocolFeesAccruedUSD.plus(
        protocolFeesUSD as BigDecimal
      );
  }

  let protocolDaily = getOrCreateProtocolDailyStats(
    event.block.timestamp,
    protocolStats
  );
  let borrowerDaily = getOrCreateBorrowerDailyStats(
    market.borrower,
    event.block.timestamp,
    borrowerStats
  );
  if (baseInterestUSD) {
    protocolDaily.dayBaseInterestAccruedUSD =
      protocolDaily.dayBaseInterestAccruedUSD.plus(
        baseInterestUSD as BigDecimal
      );
    protocolDaily.dayDelinquencyFeesAccruedUSD =
      protocolDaily.dayDelinquencyFeesAccruedUSD.plus(
        delinquencyFeesUSD as BigDecimal
      );
    protocolDaily.dayProtocolFeesAccruedUSD =
      protocolDaily.dayProtocolFeesAccruedUSD.plus(
        protocolFeesUSD as BigDecimal
      );
    borrowerDaily.dayBaseInterestAccruedUSD =
      borrowerDaily.dayBaseInterestAccruedUSD.plus(
        baseInterestUSD as BigDecimal
      );
    borrowerDaily.dayDelinquencyFeesAccruedUSD =
      borrowerDaily.dayDelinquencyFeesAccruedUSD.plus(
        delinquencyFeesUSD as BigDecimal
      );
    borrowerDaily.dayProtocolFeesAccruedUSD =
      borrowerDaily.dayProtocolFeesAccruedUSD.plus(
        protocolFeesUSD as BigDecimal
      );
  } else if (
    !baseInterestAccrued.isZero() ||
    !delinquencyFeesAccrued.isZero() ||
    !protocolFee.isZero()
  ) {
    market.usdTotalsComplete = false;
    markProtocolUsdIncomplete(protocolStats, protocolDaily);
    markBorrowerUsdIncomplete(borrowerStats, borrowerDaily);
  }

  let marketDaily = getOrCreateMarketDailyStats(
    market,
    event.block.timestamp
  );
  marketDaily.dayBaseInterestAccrued =
    marketDaily.dayBaseInterestAccrued.plus(baseInterestAccrued);
  marketDaily.dayDelinquencyFeesAccrued =
    marketDaily.dayDelinquencyFeesAccrued.plus(delinquencyFeesAccrued);
  marketDaily.dayProtocolFeesAccrued =
    marketDaily.dayProtocolFeesAccrued.plus(protocolFee);

  market.save();
  protocolStats.save();
  borrowerStats.save();
  protocolDaily.save();
  borrowerDaily.save();
  marketDaily.save();
}

export function handleStateUpdated(event: StateUpdatedEvent): void {
  let isDelinquent = event.params.isDelinquent;
  let marketId = generateMarketId(event.address);
  let market = getMarket(marketId);
  let totalAssets = getTotalAssets(market, event.address);
  market.totalAssets = totalAssets;
  if (market.isDelinquent != isDelinquent) {
    let wasDelinquent = market.isDelinquent;
    market.isDelinquent = isDelinquent;
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

    let protocolStats = getOrCreateProtocolStats();
    let borrowerStats = getOrCreateBorrowerStats(market.borrower);
    if (isDelinquent && !wasDelinquent) {
      protocolStats.numDelinquentMarkets =
        protocolStats.numDelinquentMarkets + 1;
      borrowerStats.numDelinquentMarkets =
        borrowerStats.numDelinquentMarkets + 1;
    } else if (!isDelinquent && wasDelinquent) {
      protocolStats.numDelinquentMarkets =
        protocolStats.numDelinquentMarkets - 1;
      borrowerStats.numDelinquentMarkets =
        borrowerStats.numDelinquentMarkets - 1;
    }
    let protocolDaily = getOrCreateProtocolDailyStats(
      event.block.timestamp,
      protocolStats
    );
    let borrowerDaily = getOrCreateBorrowerDailyStats(
      market.borrower,
      event.block.timestamp,
      borrowerStats
    );
    protocolStats.save();
    borrowerStats.save();
    protocolDaily.save();
    borrowerDaily.save();
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
    let scaledAmount = rayDiv(value, market.scaleFactor);
    let toId = from.id;
    if (fromAddress.equals(toAddress)) {
      // Do not update the same lender twice or write its immutable interest record twice.
      let interestEarned = processLenderInterestAccrued(event, from, market);
      let lenderStats = getOrCreateLenderStats(
        fromAddress,
        event.block.timestamp
      );
      if (fromResult.wasCreated) {
        lenderStats.numMarkets = lenderStats.numMarkets + 1;
      }
      let priceMultiplier: BigDecimal | null = null;
      if (!interestEarned.isZero()) {
        priceMultiplier = getTokenPriceMultiplier(
          market.decimals,
          market.asset,
          event.block.timestamp
        );
        if (priceMultiplier) {
          lenderStats.totalInterestEarnedUSD =
            lenderStats.totalInterestEarnedUSD.plus(
              amountToUSD(interestEarned, priceMultiplier as BigDecimal)
            );
        }
      }
      let lenderDaily = getOrCreateLenderDailyStats(
        fromAddress,
        event.block.timestamp,
        lenderStats
      );
      if (!interestEarned.isZero()) {
        if (priceMultiplier) {
          lenderDaily.dayInterestEarnedUSD =
            lenderDaily.dayInterestEarnedUSD.plus(
              amountToUSD(interestEarned, priceMultiplier as BigDecimal)
            );
        } else {
          markLenderUsdIncomplete(lenderStats, lenderDaily);
        }
      }
      from.save();
      lenderStats.save();
      lenderDaily.save();
    } else {
      let toResult = getOrCreateLenderAccount(
        market,
        event.address,
        toAddress,
        event.block.timestamp
      );
      let to = toResult.entity;
      let previousFromBalance = from.scaledBalance;
      let previousToBalance = to.scaledBalance;
      let fromInterest = processLenderInterestAccrued(event, from, market);
      let toInterest = processLenderInterestAccrued(event, to, market);
      from.scaledBalance = satSub(from.scaledBalance, scaledAmount);
      to.scaledBalance = to.scaledBalance.plus(scaledAmount);
      toId = to.id;

      let protocolStats = getOrCreateProtocolStats();
      let fromStats = getOrCreateLenderStats(
        fromAddress,
        event.block.timestamp
      );
      let toStats = getOrCreateLenderStats(
        toAddress,
        event.block.timestamp
      );
      if (fromResult.wasCreated) {
        fromStats.numMarkets = fromStats.numMarkets + 1;
      }
      if (toResult.wasCreated) {
        toStats.numMarkets = toStats.numMarkets + 1;
      }
      updateLenderActiveMarketCount(
        fromStats,
        protocolStats,
        previousFromBalance,
        from.scaledBalance
      );
      updateLenderActiveMarketCount(
        toStats,
        protocolStats,
        previousToBalance,
        to.scaledBalance
      );

      let priceMultiplier: BigDecimal | null = null;
      if (!fromInterest.isZero() || !toInterest.isZero()) {
        priceMultiplier = getTokenPriceMultiplier(
          market.decimals,
          market.asset,
          event.block.timestamp
        );
        if (priceMultiplier) {
          fromStats.totalInterestEarnedUSD =
            fromStats.totalInterestEarnedUSD.plus(
              amountToUSD(fromInterest, priceMultiplier as BigDecimal)
            );
          toStats.totalInterestEarnedUSD =
            toStats.totalInterestEarnedUSD.plus(
              amountToUSD(toInterest, priceMultiplier as BigDecimal)
            );
        }
      }

      let protocolDaily = getOrCreateProtocolDailyStats(
        event.block.timestamp,
        protocolStats
      );
      let fromDaily = getOrCreateLenderDailyStats(
        fromAddress,
        event.block.timestamp,
        fromStats
      );
      let toDaily = getOrCreateLenderDailyStats(
        toAddress,
        event.block.timestamp,
        toStats
      );
      if (priceMultiplier) {
        fromDaily.dayInterestEarnedUSD =
          fromDaily.dayInterestEarnedUSD.plus(
            amountToUSD(fromInterest, priceMultiplier as BigDecimal)
          );
        toDaily.dayInterestEarnedUSD =
          toDaily.dayInterestEarnedUSD.plus(
            amountToUSD(toInterest, priceMultiplier as BigDecimal)
          );
      } else {
        if (!fromInterest.isZero()) {
          markLenderUsdIncomplete(fromStats, fromDaily);
        }
        if (!toInterest.isZero()) {
          markLenderUsdIncomplete(toStats, toDaily);
        }
      }

      from.save();
      to.save();
      protocolStats.save();
      fromStats.save();
      toStats.save();
      protocolDaily.save();
      fromDaily.save();
      toDaily.save();
    }
    createTransfer(generateEventId(event), {
      market: market.id,
      from: from.id,
      to: toId,
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
  let wasClosed = batch.isClosed;
  batch.isClosed = true;
  batch.save();

  if (!wasClosed && batch.expiration) {
    let expiration = getWithdrawalBatchExpired(batch.expiration as string);
    if (expiration.scaledAmountBurned.lt(expiration.scaledTotalAmount)) {
      let borrowerStats = getOrCreateBorrowerStats(market.borrower);
      borrowerStats.numBatchesPaidLate =
        borrowerStats.numBatchesPaidLate + 1;
      let borrowerDaily = getOrCreateBorrowerDailyStats(
        market.borrower,
        event.block.timestamp,
        borrowerStats
      );
      borrowerStats.save();
      borrowerDaily.save();
    }
  }
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

  let expiration = createWithdrawalBatchExpired(generateEventId(event), {
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
  batch.expiration = expiration.id;
  batch.save();
  market.save();

  let borrowerStats = getOrCreateBorrowerStats(market.borrower);
  borrowerStats.numBatchesExpired = borrowerStats.numBatchesExpired + 1;
  if (scaledAmountBurned.lt(scaledTotalAmount)) {
    borrowerStats.numBatchesExpiredUnpaid =
      borrowerStats.numBatchesExpiredUnpaid + 1;
  }
  let borrowerDaily = getOrCreateBorrowerDailyStats(
    market.borrower,
    event.block.timestamp,
    borrowerStats
  );
  borrowerStats.save();
  borrowerDaily.save();
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

  market.scaledPendingWithdrawals = satSub(
    market.scaledPendingWithdrawals,
    scaledAmountBurned
  );
  market.normalizedUnclaimedWithdrawals = market.normalizedUnclaimedWithdrawals.plus(
    normalizedAmountPaid
  );
  // Withdrawal batch payment burns market tokens
  let previousSupply = market.scaledTotalSupply;
  market.scaledTotalSupply = satSub(
    market.scaledTotalSupply,
    scaledAmountBurned
  );
  updateMarketTotalDebtUSD(market, event.block.timestamp);

  let protocolStats = getOrCreateProtocolStats();
  let borrowerStats = getOrCreateBorrowerStats(market.borrower);
  updateBorrowerActiveMarketCount(
    borrowerStats,
    protocolStats,
    previousSupply,
    market.scaledTotalSupply,
    market.isClosed,
    market.isClosed
  );
  let protocolDaily = getOrCreateProtocolDailyStats(
    event.block.timestamp,
    protocolStats
  );
  let borrowerDaily = getOrCreateBorrowerDailyStats(
    market.borrower,
    event.block.timestamp,
    borrowerStats
  );
  let marketDaily = getOrCreateMarketDailyStats(
    market,
    event.block.timestamp
  );
  market.save();
  protocolStats.save();
  borrowerStats.save();
  protocolDaily.save();
  borrowerDaily.save();
  marketDaily.save();
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
  market.normalizedUnclaimedWithdrawals = satSub(
    market.normalizedUnclaimedWithdrawals,
    normalizedAmount
  );
  market.totalWithdrawalsExecuted = market.totalWithdrawalsExecuted.plus(
    normalizedAmount
  );
  updateMarketTotalDebtUSD(market, event.block.timestamp);

  // Account interest is checkpointed when assets enter the withdrawal batch.
  // Once the batch is fully paid, attribute the additional batch earnings to
  // the lender exactly once using the final payout less queued value.
  let completedBatchInterest = BigInt.zero();
  if (batch.isClosed && !status.isCompleted) {
    status.isCompleted = true;
    completedBatchInterest = satSub(
      status.normalizedAmountWithdrawn,
      status.totalNormalizedRequests
    );
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

  let protocolStats = getOrCreateProtocolStats();
  let borrowerStats = getOrCreateBorrowerStats(market.borrower);
  let lenderStats = getOrCreateLenderStats(account, event.block.timestamp);
  let priceMultiplier = getTokenPriceMultiplier(
    market.decimals,
    market.asset,
    event.block.timestamp
  );
  let withdrawalUSD: BigDecimal | null = null;
  let completedBatchInterestUSD: BigDecimal | null = null;
  if (priceMultiplier) {
    withdrawalUSD = amountToUSD(
      normalizedAmount,
      priceMultiplier as BigDecimal
    );
    market.totalWithdrawalsExecutedUSD =
      market.totalWithdrawalsExecutedUSD.plus(withdrawalUSD as BigDecimal);
    protocolStats.totalWithdrawalsExecutedUSD =
      protocolStats.totalWithdrawalsExecutedUSD.plus(
        withdrawalUSD as BigDecimal
      );
    borrowerStats.totalWithdrawalsExecutedUSD =
      borrowerStats.totalWithdrawalsExecutedUSD.plus(
        withdrawalUSD as BigDecimal
      );
    lenderStats.totalWithdrawalsExecutedUSD =
      lenderStats.totalWithdrawalsExecutedUSD.plus(
        withdrawalUSD as BigDecimal
      );
    completedBatchInterestUSD = amountToUSD(
      completedBatchInterest,
      priceMultiplier as BigDecimal
    );
    lenderStats.totalInterestEarnedUSD =
      lenderStats.totalInterestEarnedUSD.plus(
        completedBatchInterestUSD as BigDecimal
      );
  }

  let protocolDaily = getOrCreateProtocolDailyStats(
    event.block.timestamp,
    protocolStats
  );
  let borrowerDaily = getOrCreateBorrowerDailyStats(
    market.borrower,
    event.block.timestamp,
    borrowerStats
  );
  let lenderDaily = getOrCreateLenderDailyStats(
    account,
    event.block.timestamp,
    lenderStats
  );
  if (withdrawalUSD) {
    protocolDaily.dayWithdrawalsExecutedUSD =
      protocolDaily.dayWithdrawalsExecutedUSD.plus(
        withdrawalUSD as BigDecimal
      );
    borrowerDaily.dayWithdrawalsExecutedUSD =
      borrowerDaily.dayWithdrawalsExecutedUSD.plus(
        withdrawalUSD as BigDecimal
      );
    lenderDaily.dayWithdrawalsExecutedUSD =
      lenderDaily.dayWithdrawalsExecutedUSD.plus(
        withdrawalUSD as BigDecimal
      );
    lenderDaily.dayInterestEarnedUSD =
      lenderDaily.dayInterestEarnedUSD.plus(
        completedBatchInterestUSD as BigDecimal
      );
  } else if (!normalizedAmount.isZero()) {
    market.usdTotalsComplete = false;
    markProtocolUsdIncomplete(protocolStats, protocolDaily);
    markBorrowerUsdIncomplete(borrowerStats, borrowerDaily);
    markLenderUsdIncomplete(lenderStats, lenderDaily);
  }
  batch.save();
  status.save();
  let marketDaily = getOrCreateMarketDailyStats(
    market,
    event.block.timestamp
  );
  marketDaily.totalWithdrawalsExecuted =
    marketDaily.totalWithdrawalsExecuted.plus(normalizedAmount);
  marketDaily.dayWithdrawalsExecuted =
    marketDaily.dayWithdrawalsExecuted.plus(normalizedAmount);
  market.save();
  protocolStats.save();
  borrowerStats.save();
  lenderStats.save();
  protocolDaily.save();
  borrowerDaily.save();
  lenderDaily.save();
  marketDaily.save();
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
  let previousLenderBalance = lender.scaledBalance;
  let interestEarned = processLenderInterestAccrued(event, lender, market);
  lender.scaledBalance = satSub(lender.scaledBalance, scaledAmount);
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

  market.totalWithdrawalsRequested = market.totalWithdrawalsRequested.plus(
    normalizedAmount
  );
  let protocolStats = getOrCreateProtocolStats();
  let borrowerStats = getOrCreateBorrowerStats(market.borrower);
  let lenderStats = getOrCreateLenderStats(account, event.block.timestamp);
  updateLenderActiveMarketCount(
    lenderStats,
    protocolStats,
    previousLenderBalance,
    lender.scaledBalance
  );

  let priceMultiplier = getTokenPriceMultiplier(
    market.decimals,
    market.asset,
    event.block.timestamp
  );
  let withdrawalUSD: BigDecimal | null = null;
  let interestUSD: BigDecimal | null = null;
  if (priceMultiplier) {
    withdrawalUSD = amountToUSD(
      normalizedAmount,
      priceMultiplier as BigDecimal
    );
    interestUSD = amountToUSD(
      interestEarned,
      priceMultiplier as BigDecimal
    );
    market.totalWithdrawalsRequestedUSD =
      market.totalWithdrawalsRequestedUSD.plus(withdrawalUSD as BigDecimal);
    protocolStats.totalWithdrawalsRequestedUSD =
      protocolStats.totalWithdrawalsRequestedUSD.plus(
        withdrawalUSD as BigDecimal
      );
    borrowerStats.totalWithdrawalsRequestedUSD =
      borrowerStats.totalWithdrawalsRequestedUSD.plus(
        withdrawalUSD as BigDecimal
      );
    lenderStats.totalWithdrawalsRequestedUSD =
      lenderStats.totalWithdrawalsRequestedUSD.plus(
        withdrawalUSD as BigDecimal
      );
    lenderStats.totalInterestEarnedUSD =
      lenderStats.totalInterestEarnedUSD.plus(interestUSD as BigDecimal);
  }

  let protocolDaily = getOrCreateProtocolDailyStats(
    event.block.timestamp,
    protocolStats
  );
  let borrowerDaily = getOrCreateBorrowerDailyStats(
    market.borrower,
    event.block.timestamp,
    borrowerStats
  );
  let lenderDaily = getOrCreateLenderDailyStats(
    account,
    event.block.timestamp,
    lenderStats
  );
  if (withdrawalUSD) {
    protocolDaily.dayWithdrawalsRequestedUSD =
      protocolDaily.dayWithdrawalsRequestedUSD.plus(
        withdrawalUSD as BigDecimal
      );
    borrowerDaily.dayWithdrawalsRequestedUSD =
      borrowerDaily.dayWithdrawalsRequestedUSD.plus(
        withdrawalUSD as BigDecimal
      );
    lenderDaily.dayWithdrawalsRequestedUSD =
      lenderDaily.dayWithdrawalsRequestedUSD.plus(
        withdrawalUSD as BigDecimal
      );
    lenderDaily.dayInterestEarnedUSD =
      lenderDaily.dayInterestEarnedUSD.plus(interestUSD as BigDecimal);
  } else {
    if (!normalizedAmount.isZero()) {
      market.usdTotalsComplete = false;
      markProtocolUsdIncomplete(protocolStats, protocolDaily);
      markBorrowerUsdIncomplete(borrowerStats, borrowerDaily);
    }
    if (!normalizedAmount.isZero() || !interestEarned.isZero()) {
      markLenderUsdIncomplete(lenderStats, lenderDaily);
    }
  }

  let marketDaily = getOrCreateMarketDailyStats(
    market,
    event.block.timestamp
  );
  marketDaily.totalWithdrawalsRequested =
    marketDaily.totalWithdrawalsRequested.plus(normalizedAmount);
  marketDaily.dayWithdrawalsRequested =
    marketDaily.dayWithdrawalsRequested.plus(normalizedAmount);

  lender.save();
  status.save();
  market.save();
  batch.save();
  protocolStats.save();
  borrowerStats.save();
  lenderStats.save();
  protocolDaily.save();
  borrowerDaily.save();
  lenderDaily.save();
  marketDaily.save();
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
