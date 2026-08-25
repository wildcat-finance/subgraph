import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  AnnualInterestAndReserveRatioBipsUpdated,
  Approval,
  Borrow,
  BorrowerTransferCancelled,
  BorrowerTransferRequested,
  BorrowerTransferred,
  ChangedSpherexEngineAddress,
  ChangedSpherexOperator,
  DebtRepaid,
  Deposit,
  DrawnAmountUpdated,
  FeesCollected,
  InterestAndFeesAccrued,
  MarketClosed,
  MaxTotalSupplyUpdated,
  ProtocolFeeBipsUpdated,
  SanctionedAccountAssetsQueuedForWithdrawal,
  SanctionedAccountWithdrawalSentToEscrow,
  StateUpdated,
  Transfer,
  WithdrawalBatchClosed,
  WithdrawalBatchCreated,
  WithdrawalBatchExpired,
  WithdrawalBatchPayment,
  WithdrawalExecuted,
  WithdrawalQueued,
  WrapperRegistered,
} from "../generated/templates/WildcatMarketV2_5/WildcatMarketV2_5";
import {
  Approval as LegacyApproval,
  ChangedSpherexEngineAddress as LegacyChangedSpherexEngineAddress,
  ChangedSpherexOperator as LegacyChangedSpherexOperator,
  DebtRepaid as LegacyDebtRepaid,
  Deposit as LegacyDeposit,
  InterestAndFeesAccrued as LegacyInterestAndFeesAccrued,
  SanctionedAccountAssetsQueuedForWithdrawal as LegacySanctionedAccountAssetsQueuedForWithdrawal,
  SanctionedAccountWithdrawalSentToEscrow as LegacySanctionedAccountWithdrawalSentToEscrow,
  StateUpdated as LegacyStateUpdated,
  Transfer as LegacyTransfer,
  WithdrawalBatchClosed as LegacyWithdrawalBatchClosed,
  WithdrawalBatchCreated as LegacyWithdrawalBatchCreated,
  WithdrawalBatchExpired as LegacyWithdrawalBatchExpired,
  WithdrawalBatchPayment as LegacyWithdrawalBatchPayment,
  WithdrawalExecuted as LegacyWithdrawalExecuted,
  WithdrawalQueued as LegacyWithdrawalQueued,
} from "../generated/templates/WildcatMarket/WildcatMarket";
import {
  BorrowerAccount,
  DrawnAmountUpdate,
  MarketBorrowerChange,
  MarketWrapperRegistration,
} from "../generated/schema";
import {
  generateMarketId,
  getMarket,
} from "../generated/UncrashableEntityHelpers";
import {
  handleAnnualInterestAndReserveRatioBipsUpdatedValues,
  handleApproval as handleLegacyApproval,
  handleBorrowValues,
  handleChangedSpherexEngineAddress as handleLegacyChangedSpherexEngineAddress,
  handleChangedSpherexOperator as handleLegacyChangedSpherexOperator,
  handleDebtRepaid as handleLegacyDebtRepaid,
  handleDeposit as handleLegacyDeposit,
  handleFeesCollectedValues,
  handleInterestAndFeesAccrued as handleLegacyInterestAndFeesAccrued,
  handleMarketClosedValues,
  handleMaxTotalSupplyUpdatedValues,
  handleProtocolFeeBipsUpdatedValues,
  handleSanctionedAccountAssetsQueuedForWithdrawal as handleLegacySanctionedAccountAssetsQueuedForWithdrawal,
  handleSanctionedAccountWithdrawalSentToEscrow as handleLegacySanctionedAccountWithdrawalSentToEscrow,
  handleStateUpdated as handleLegacyStateUpdated,
  handleTransfer as handleLegacyTransfer,
  handleWithdrawalBatchClosed as handleLegacyWithdrawalBatchClosed,
  handleWithdrawalBatchCreated as handleLegacyWithdrawalBatchCreated,
  handleWithdrawalBatchExpired as handleLegacyWithdrawalBatchExpired,
  handleWithdrawalBatchPayment as handleLegacyWithdrawalBatchPayment,
  handleWithdrawalExecuted as handleLegacyWithdrawalExecuted,
  handleWithdrawalQueued as handleLegacyWithdrawalQueued,
} from "./wildcat-market";
import { getOrCreateBorrower } from "./borrower-domain";
import { generateBorrowerAccountId } from "./borrower-identity-domain";
import {
  getOrCreateBorrowerDailyStats,
  getOrCreateBorrowerStats,
  getOrCreateProtocolStats,
} from "./daily-stats";
import { saveMarketAndSnapshot } from "./market-domain";
import { recordMarketEvent } from "./market-event-domain";
import { generateEventId } from "./utils";

function updateBorrowerCounts(
  event: BorrowerTransferred,
  previousPrincipal: Address,
  newPrincipal: Address
): void {
  if (previousPrincipal.equals(newPrincipal)) {
    return;
  }
  let market = getMarket(generateMarketId(event.address));
  let previousStats = getOrCreateBorrowerStats(previousPrincipal);
  let newStats = getOrCreateBorrowerStats(newPrincipal);
  let previousPrincipalWasActive = previousStats.numActiveMarkets > 0;
  let newPrincipalWasActive = newStats.numActiveMarkets > 0;
  previousStats.numMarkets = previousStats.numMarkets - 1;
  newStats.numMarkets = newStats.numMarkets + 1;
  if (market.isClosed) {
    previousStats.numClosedMarkets = previousStats.numClosedMarkets - 1;
    newStats.numClosedMarkets = newStats.numClosedMarkets + 1;
  } else if (!market.scaledTotalSupply.isZero()) {
    previousStats.numActiveMarkets = previousStats.numActiveMarkets - 1;
    newStats.numActiveMarkets = newStats.numActiveMarkets + 1;
  }
  if (market.isDelinquent) {
    previousStats.numDelinquentMarkets = previousStats.numDelinquentMarkets - 1;
    newStats.numDelinquentMarkets = newStats.numDelinquentMarkets + 1;
  }
  let protocolStats = getOrCreateProtocolStats();
  if (previousPrincipalWasActive && previousStats.numActiveMarkets == 0) {
    protocolStats.numActiveBorrowers = protocolStats.numActiveBorrowers - 1;
  }
  if (!newPrincipalWasActive && newStats.numActiveMarkets > 0) {
    protocolStats.numActiveBorrowers = protocolStats.numActiveBorrowers + 1;
  }
  previousStats.save();
  newStats.save();

  getOrCreateBorrowerDailyStats(
    previousPrincipal,
    event.block.timestamp,
    previousStats
  ).save();
  getOrCreateBorrowerDailyStats(
    newPrincipal,
    event.block.timestamp,
    newStats
  ).save();
  protocolStats.save();
}

export function handleAnnualInterestAndReserveRatioBipsUpdated(
  event: AnnualInterestAndReserveRatioBipsUpdated
): void {
  handleAnnualInterestAndReserveRatioBipsUpdatedValues(
    event,
    event.params.caller,
    event.params.previousAnnualInterestBips.toI32(),
    event.params.newAnnualInterestBips.toI32(),
    event.params.previousReserveRatioBips.toI32(),
    event.params.newReserveRatioBips.toI32(),
    true
  );
}

export function handleApproval(event: Approval): void {
  handleLegacyApproval(changetype<LegacyApproval>(event));
}

export function handleBorrow(event: Borrow): void {
  handleBorrowValues(event, event.params.borrower, event.params.assetAmount);
}

export function handleBorrowerTransferRequested(
  event: BorrowerTransferRequested
): void {
  let market = getMarket(generateMarketId(event.address));
  recordMarketEvent(event, market, "BORROWER_TRANSFER_REQUESTED");
  let change = new MarketBorrowerChange(generateEventId(event));
  change.market = market.id;
  change.kind = "TRANSFER_REQUESTED";
  change.borrower = event.params.borrower;
  change.borrowerPrincipal = event.params.borrowerPrincipal;
  change.previousPendingBorrower = event.params.previousPendingBorrower;
  change.previousPendingBorrowerPrincipal =
    event.params.previousPendingBorrowerPrincipal;
  change.pendingBorrower = event.params.pendingBorrower;
  change.pendingBorrowerPrincipal = event.params.pendingBorrowerPrincipal;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
  market.pendingBorrower = event.params.pendingBorrower;
  market.pendingBorrowerPrincipal = event.params.pendingBorrowerPrincipal;
  saveMarketAndSnapshot(event, market);
}

export function handleBorrowerTransferCancelled(
  event: BorrowerTransferCancelled
): void {
  let market = getMarket(generateMarketId(event.address));
  recordMarketEvent(event, market, "BORROWER_TRANSFER_CANCELLED");
  let change = new MarketBorrowerChange(generateEventId(event));
  change.market = market.id;
  change.kind = "TRANSFER_CANCELLED";
  change.borrower = event.params.borrower;
  change.borrowerPrincipal = event.params.borrowerPrincipal;
  change.cancelledPendingBorrower = event.params.cancelledPendingBorrower;
  change.cancelledPendingBorrowerPrincipal =
    event.params.cancelledPendingBorrowerPrincipal;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
  market.unset("pendingBorrower");
  market.unset("pendingBorrowerPrincipal");
  saveMarketAndSnapshot(event, market);
}

export function handleBorrowerTransferred(event: BorrowerTransferred): void {
  let market = getMarket(generateMarketId(event.address));
  recordMarketEvent(event, market, "BORROWER_TRANSFERRED");
  let change = new MarketBorrowerChange(generateEventId(event));
  change.market = market.id;
  change.kind = "TRANSFERRED";
  change.previousBorrower = event.params.previousBorrower;
  change.previousBorrowerPrincipal = event.params.previousBorrowerPrincipal;
  change.newBorrower = event.params.newBorrower;
  change.newBorrowerPrincipal = event.params.newBorrowerPrincipal;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();

  updateBorrowerCounts(
    event,
    event.params.previousBorrowerPrincipal,
    event.params.newBorrowerPrincipal
  );
  market.borrower = event.params.newBorrower;
  market.borrowerPrincipal = event.params.newBorrowerPrincipal;
  market.borrowerProfile = getOrCreateBorrower(
    event,
    event.params.newBorrowerPrincipal
  ).id;
  let account: BorrowerAccount | null = null;
  if (market.borrowerIdentityRegistry != null) {
    account = BorrowerAccount.load(
      generateBorrowerAccountId(
        market.borrowerIdentityRegistry as string,
        event.params.newBorrower
      )
    );
  }
  if (account == null) {
    market.unset("borrowerAccount");
  } else {
    market.borrowerAccount = account.id;
  }
  market.unset("pendingBorrower");
  market.unset("pendingBorrowerPrincipal");
  saveMarketAndSnapshot(event, market);
}

export function handleChangedSpherexEngineAddress(
  event: ChangedSpherexEngineAddress
): void {
  handleLegacyChangedSpherexEngineAddress(
    changetype<LegacyChangedSpherexEngineAddress>(event)
  );
}

export function handleChangedSpherexOperator(
  event: ChangedSpherexOperator
): void {
  handleLegacyChangedSpherexOperator(
    changetype<LegacyChangedSpherexOperator>(event)
  );
}

export function handleDebtRepaid(event: DebtRepaid): void {
  handleLegacyDebtRepaid(changetype<LegacyDebtRepaid>(event));
}

export function handleDeposit(event: Deposit): void {
  handleLegacyDeposit(changetype<LegacyDeposit>(event));
}

export function handleDrawnAmountUpdated(event: DrawnAmountUpdated): void {
  let market = getMarket(generateMarketId(event.address));
  recordMarketEvent(event, market, "DRAWN_AMOUNT_UPDATED");
  let update = new DrawnAmountUpdate(generateEventId(event));
  update.market = market.id;
  update.previousDrawnAmount = event.params.previousDrawnAmount;
  update.newDrawnAmount = event.params.newDrawnAmount;
  update.blockNumber = event.block.number;
  update.blockTimestamp = event.block.timestamp;
  update.transactionHash = event.transaction.hash;
  update.blockLogIndex = event.logIndex;
  update.save();
  market.drawnAmount = event.params.newDrawnAmount;
  saveMarketAndSnapshot(event, market);
}

export function handleFeesCollected(event: FeesCollected): void {
  handleFeesCollectedValues(
    event,
    event.params.collector,
    event.params.feeRecipient,
    event.params.assets
  );
}

export function handleInterestAndFeesAccrued(
  event: InterestAndFeesAccrued
): void {
  handleLegacyInterestAndFeesAccrued(
    changetype<LegacyInterestAndFeesAccrued>(event)
  );
}

export function handleMarketClosed(event: MarketClosed): void {
  handleMarketClosedValues(
    event,
    event.params.borrower,
    event.params.timestamp
  );
}

export function handleMaxTotalSupplyUpdated(
  event: MaxTotalSupplyUpdated
): void {
  handleMaxTotalSupplyUpdatedValues(
    event,
    event.params.caller,
    event.params.previousMaxTotalSupply,
    event.params.newMaxTotalSupply
  );
}

export function handleProtocolFeeBipsUpdated(
  event: ProtocolFeeBipsUpdated
): void {
  handleProtocolFeeBipsUpdatedValues(
    event,
    event.params.caller,
    event.params.previousProtocolFeeBips.toI32(),
    event.params.newProtocolFeeBips.toI32()
  );
}

export function handleSanctionedAccountAssetsQueuedForWithdrawal(
  event: SanctionedAccountAssetsQueuedForWithdrawal
): void {
  handleLegacySanctionedAccountAssetsQueuedForWithdrawal(
    changetype<LegacySanctionedAccountAssetsQueuedForWithdrawal>(event)
  );
}

export function handleSanctionedAccountWithdrawalSentToEscrow(
  event: SanctionedAccountWithdrawalSentToEscrow
): void {
  handleLegacySanctionedAccountWithdrawalSentToEscrow(
    changetype<LegacySanctionedAccountWithdrawalSentToEscrow>(event)
  );
}

export function handleStateUpdated(event: StateUpdated): void {
  handleLegacyStateUpdated(changetype<LegacyStateUpdated>(event));
}

export function handleTransfer(event: Transfer): void {
  handleLegacyTransfer(changetype<LegacyTransfer>(event));
}

export function handleWithdrawalBatchClosed(
  event: WithdrawalBatchClosed
): void {
  handleLegacyWithdrawalBatchClosed(
    changetype<LegacyWithdrawalBatchClosed>(event)
  );
}

export function handleWithdrawalBatchCreated(
  event: WithdrawalBatchCreated
): void {
  handleLegacyWithdrawalBatchCreated(
    changetype<LegacyWithdrawalBatchCreated>(event)
  );
}

export function handleWithdrawalBatchExpired(
  event: WithdrawalBatchExpired
): void {
  handleLegacyWithdrawalBatchExpired(
    changetype<LegacyWithdrawalBatchExpired>(event)
  );
}

export function handleWithdrawalBatchPayment(
  event: WithdrawalBatchPayment
): void {
  handleLegacyWithdrawalBatchPayment(
    changetype<LegacyWithdrawalBatchPayment>(event)
  );
}

export function handleWithdrawalExecuted(event: WithdrawalExecuted): void {
  handleLegacyWithdrawalExecuted(changetype<LegacyWithdrawalExecuted>(event));
}

export function handleWithdrawalQueued(event: WithdrawalQueued): void {
  handleLegacyWithdrawalQueued(changetype<LegacyWithdrawalQueued>(event));
}

export function handleWrapperRegistered(event: WrapperRegistered): void {
  let market = getMarket(generateMarketId(event.address));
  recordMarketEvent(event, market, "WRAPPER_REGISTERED");
  let registration = new MarketWrapperRegistration(generateEventId(event));
  registration.market = market.id;
  registration.wrapper = event.params.wrapper;
  registration.blockNumber = event.block.number;
  registration.blockTimestamp = event.block.timestamp;
  registration.transactionHash = event.transaction.hash;
  registration.blockLogIndex = event.logIndex;
  registration.save();
}
