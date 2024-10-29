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
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

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
  createAnnualInterestBipsUpdated(generateMarketEventId(market), {
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    oldAnnualInterestBips: market.annualInterestBips,
    newAnnualInterestBips: newAnnualInterestBips,
    transactionHash: event.transaction.hash,
    annualInterestBipsUpdatedIndex: market.annualInterestBipsUpdatedIndex,
    eventIndex: market.eventIndex,
    market: market.id,
  });
  market.annualInterestBips = newAnnualInterestBips;
  market.annualInterestBipsUpdatedIndex =
    market.annualInterestBipsUpdatedIndex + 1;
  market.eventIndex = market.eventIndex + 1;
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

  entity.save();
}

export function handleAuthorizationStatusUpdated(
  event: AuthorizationStatusUpdatedEvent
): void {
  let market = getMarket(generateMarketId(event.address));
  let lenderRoles = ["Null", "Blocked", "WithdrawOnly", "DepositAndWithdraw"];
  let lender = getOrCreateLenderAccount(
    market,
    event.address,
    event.params.account
  ).entity;
  lender.role = lenderRoles[event.params.role];
  lender.save();
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
  });
  market.borrowIndex = market.borrowIndex + 1;
  market.eventIndex = market.eventIndex + 1;
  market.totalBorrowed = market.totalBorrowed.plus(event.params.assetAmount);
  market.save();
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
  });
  market.debtRepaidIndex = market.debtRepaidIndex + 1;
  market.eventIndex = market.eventIndex + 1;
  market.totalRepaid = market.totalRepaid.plus(event.params.assetAmount);
  market.save();
}

function processLenderInterestAccrued(
  event: ethereum.Event,
  lender: LenderAccount,
  market: Market
): void {
  if (lender.lastScaleFactor.notEqual(market.scaleFactor)) {
    let interestEarned = calculateInterestEarned(lender, market);
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
  }
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
  let lender = getOrCreateLenderAccount(
    market,
    event.address,
    event.params.account
  ).entity;

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
  });
  market.depositIndex = market.depositIndex + 1;
  market.eventIndex = market.eventIndex + 1;

  processLenderInterestAccrued(event, lender, market);
  lender.totalDeposited = lender.totalDeposited.plus(event.params.assetAmount);
  lender.scaledBalance = lender.scaledBalance.plus(event.params.scaledAmount);
  lender.lastScaleFactor = market.scaleFactor;
  lender.save();

  market.scaledTotalSupply = market.scaledTotalSupply.plus(
    event.params.scaledAmount
  );
  market.totalDeposited = market.totalDeposited.plus(event.params.assetAmount);
  market.save();
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
  });
  market.feesCollectedIndex = market.feesCollectedIndex + 1;
  market.eventIndex = market.eventIndex + 1;

  market.save();
}

export function handleMarketClosed(event: MarketClosedEvent): void {
  let market = getMarket(generateMarketId(event.address));
  market.isClosed = true;
  createMarketClosed(generateMarketEventId(market), {
    market: market.id,
    timestamp: event.params.timestamp.toI32(),
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    eventIndex: market.eventIndex,
  });
  market.eventIndex = market.eventIndex + 1;
  market.save();
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
  });
  market.scaleFactor = scaleFactor;
  market.totalProtocolFeesAccrued = market.totalProtocolFeesAccrued.plus(
    protocolFee
  );
  market.pendingProtocolFees = market.pendingProtocolFees.plus(protocolFee);
  market.lastInterestAccruedTimestamp = toTimestamp.toI32();
  market.save();
}

export function handleStateUpdated(event: StateUpdatedEvent): void {
  let isDelinquent = event.params.isDelinquent;
  let marketId = generateMarketId(event.address);
  let market = getMarket(marketId);
  if (market.isDelinquent != isDelinquent) {
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
    });
    market.delinquencyStatusChangedIndex =
      market.delinquencyStatusChangedIndex + 1;
    market.eventIndex = market.eventIndex + 1;
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
    let from = getOrCreateLenderAccount(market, event.address, fromAddress)
      .entity;
    let to = getOrCreateLenderAccount(market, event.address, toAddress).entity;
    processLenderInterestAccrued(event, from, market);
    processLenderInterestAccrued(event, to, market);
    let scaledAmount = rayDiv(value, market.scaleFactor);
    from.scaledBalance = satSub(from.scaledBalance, scaledAmount);
    to.scaledBalance = to.scaledBalance.plus(scaledAmount);
    from.save();
    to.save();
    createTransfer(generateEventId(event), {
      market: market.id,
      from: from.id,
      to: to.id,
      scaledAmount: scaledAmount,
      amount: value,
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
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
  createWithdrawalBatchExpired(generateEventId(event), {
    batch: id,
    normalizedAmountPaid: normalizedAmountPaid,
    scaledAmountBurned: scaledAmountBurned,
    scaledTotalAmount: scaledTotalAmount,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
  });
  let market = getMarket(event.address.toHex());
  let batch = getWithdrawalBatch(id);
  processWithdrawalBatchInterestAccrued(event, batch, market);
  batch.isExpired = true;
  market.pendingWithdrawalExpiry = BigInt.zero();
  batch.save();
  market.save();
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
  market.scaledTotalSupply = market.scaledTotalSupply.minus(scaledAmountBurned);
  market.save();
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
  });
  market.withdrawalRequestsIndex = market.withdrawalRequestsIndex + 1;
  market.eventIndex = market.eventIndex + 1;
  status.requestsCount = status.requestsCount + 1;
  status.scaledAmount = status.scaledAmount.plus(scaledAmount);
  status.totalNormalizedRequests = status.totalNormalizedRequests.plus(
    normalizedAmount
  );
  processLenderInterestAccrued(event, lender, market);
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

  lender.save();
  status.save();
  market.save();
  batch.save();
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
  });
  market.forceBuyBackIndex = market.forceBuyBackIndex + 1;
  market.eventIndex = market.eventIndex + 1;
  market.save();
}
