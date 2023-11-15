import { newMockEvent } from "matchstick-as";
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts";
import {
  AnnualInterestBipsUpdated,
  Approval,
  AuthorizationStatusUpdated,
  Borrow,
  DebtRepaid,
  Deposit,
  FeesCollected,
  MarketClosed,
  MaxTotalSupplyUpdated,
  ReserveRatioBipsUpdated,
  SanctionedAccountAssetsSentToEscrow,
  SanctionedAccountWithdrawalSentToEscrow,
  InterestAndFeesAccrued,
  StateUpdated,
  Transfer,
  Withdrawal,
  WithdrawalBatchClosed,
  WithdrawalBatchCreated,
  WithdrawalBatchExpired,
  WithdrawalBatchPayment,
  WithdrawalExecuted,
  WithdrawalQueued,
} from "../generated/templates/WildcatMarket/WildcatMarket";

export function createAnnualInterestBipsUpdatedEvent(
  annualInterestBipsUpdated: BigInt
): AnnualInterestBipsUpdated {
  let annualInterestBipsUpdatedEvent = changetype<AnnualInterestBipsUpdated>(
    newMockEvent()
  );

  annualInterestBipsUpdatedEvent.parameters = new Array();

  annualInterestBipsUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "annualInterestBipsUpdated",
      ethereum.Value.fromUnsignedBigInt(annualInterestBipsUpdated)
    )
  );

  return annualInterestBipsUpdatedEvent;
}

export function createApprovalEvent(
  owner: Address,
  spender: Address,
  value: BigInt
): Approval {
  let approvalEvent = changetype<Approval>(newMockEvent());

  approvalEvent.parameters = new Array();

  approvalEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  );
  approvalEvent.parameters.push(
    new ethereum.EventParam("spender", ethereum.Value.fromAddress(spender))
  );
  approvalEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  );

  return approvalEvent;
}

export function createAuthorizationStatusUpdatedEvent(
  account: Address,
  role: i32
): AuthorizationStatusUpdated {
  let authorizationStatusUpdatedEvent = changetype<AuthorizationStatusUpdated>(
    newMockEvent()
  );

  authorizationStatusUpdatedEvent.parameters = new Array();

  authorizationStatusUpdatedEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  );
  authorizationStatusUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "role",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(role))
    )
  );

  return authorizationStatusUpdatedEvent;
}

export function createBorrowEvent(assetAmount: BigInt): Borrow {
  let borrowEvent = changetype<Borrow>(newMockEvent());

  borrowEvent.parameters = new Array();

  borrowEvent.parameters.push(
    new ethereum.EventParam(
      "assetAmount",
      ethereum.Value.fromUnsignedBigInt(assetAmount)
    )
  );

  return borrowEvent;
}

export function createDebtRepaidEvent(
  from: Address,
  assetAmount: BigInt
): DebtRepaid {
  let debtRepaidEvent = changetype<DebtRepaid>(newMockEvent());

  debtRepaidEvent.parameters = new Array();

  debtRepaidEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  );
  debtRepaidEvent.parameters.push(
    new ethereum.EventParam(
      "assetAmount",
      ethereum.Value.fromUnsignedBigInt(assetAmount)
    )
  );

  return debtRepaidEvent;
}

export function createDepositEvent(
  account: Address,
  assetAmount: BigInt,
  scaledAmount: BigInt
): Deposit {
  let depositEvent = changetype<Deposit>(newMockEvent());

  depositEvent.parameters = new Array();

  depositEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  );
  depositEvent.parameters.push(
    new ethereum.EventParam(
      "assetAmount",
      ethereum.Value.fromUnsignedBigInt(assetAmount)
    )
  );
  depositEvent.parameters.push(
    new ethereum.EventParam(
      "scaledAmount",
      ethereum.Value.fromUnsignedBigInt(scaledAmount)
    )
  );

  return depositEvent;
}

export function createFeesCollectedEvent(assets: BigInt): FeesCollected {
  let feesCollectedEvent = changetype<FeesCollected>(newMockEvent());

  feesCollectedEvent.parameters = new Array();

  feesCollectedEvent.parameters.push(
    new ethereum.EventParam("assets", ethereum.Value.fromUnsignedBigInt(assets))
  );

  return feesCollectedEvent;
}

export function createMarketClosedEvent(timestamp: BigInt): MarketClosed {
  let marketClosedEvent = changetype<MarketClosed>(newMockEvent());

  marketClosedEvent.parameters = new Array();

  marketClosedEvent.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  );

  return marketClosedEvent;
}

export function createMaxTotalSupplyUpdatedEvent(
  assets: BigInt
): MaxTotalSupplyUpdated {
  let maxTotalSupplyUpdatedEvent = changetype<MaxTotalSupplyUpdated>(
    newMockEvent()
  );

  maxTotalSupplyUpdatedEvent.parameters = new Array();

  maxTotalSupplyUpdatedEvent.parameters.push(
    new ethereum.EventParam("assets", ethereum.Value.fromUnsignedBigInt(assets))
  );

  return maxTotalSupplyUpdatedEvent;
}

export function createReserveRatioBipsUpdatedEvent(
  reserveRatioBipsUpdated: BigInt
): ReserveRatioBipsUpdated {
  let reserveRatioBipsUpdatedEvent = changetype<ReserveRatioBipsUpdated>(
    newMockEvent()
  );

  reserveRatioBipsUpdatedEvent.parameters = new Array();

  reserveRatioBipsUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "reserveRatioBipsUpdated",
      ethereum.Value.fromUnsignedBigInt(reserveRatioBipsUpdated)
    )
  );

  return reserveRatioBipsUpdatedEvent;
}

export function createSanctionedAccountAssetsSentToEscrowEvent(
  account: Address,
  escrow: Address,
  amount: BigInt
): SanctionedAccountAssetsSentToEscrow {
  let sanctionedAccountAssetsSentToEscrowEvent = changetype<
    SanctionedAccountAssetsSentToEscrow
  >(newMockEvent());

  sanctionedAccountAssetsSentToEscrowEvent.parameters = new Array();

  sanctionedAccountAssetsSentToEscrowEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  );
  sanctionedAccountAssetsSentToEscrowEvent.parameters.push(
    new ethereum.EventParam("escrow", ethereum.Value.fromAddress(escrow))
  );
  sanctionedAccountAssetsSentToEscrowEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  );

  return sanctionedAccountAssetsSentToEscrowEvent;
}

export function createSanctionedAccountWithdrawalSentToEscrowEvent(
  account: Address,
  escrow: Address,
  expiry: BigInt,
  amount: BigInt
): SanctionedAccountWithdrawalSentToEscrow {
  let sanctionedAccountWithdrawalSentToEscrowEvent = changetype<
    SanctionedAccountWithdrawalSentToEscrow
  >(newMockEvent());

  sanctionedAccountWithdrawalSentToEscrowEvent.parameters = new Array();

  sanctionedAccountWithdrawalSentToEscrowEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  );
  sanctionedAccountWithdrawalSentToEscrowEvent.parameters.push(
    new ethereum.EventParam("escrow", ethereum.Value.fromAddress(escrow))
  );
  sanctionedAccountWithdrawalSentToEscrowEvent.parameters.push(
    new ethereum.EventParam("expiry", ethereum.Value.fromUnsignedBigInt(expiry))
  );
  sanctionedAccountWithdrawalSentToEscrowEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  );

  return sanctionedAccountWithdrawalSentToEscrowEvent;
}

export function createScaleFactorUpdatedEvent(
  fromTimestamp: BigInt,
  toTimestamp: BigInt,
  scaleFactor: BigInt,
  baseInterestRay: BigInt,
  delinquencyFeeRay: BigInt,
  protocolFees: BigInt
): InterestAndFeesAccrued {
  let scaleFactorUpdatedEvent = changetype<InterestAndFeesAccrued>(
    newMockEvent()
  );

  scaleFactorUpdatedEvent.parameters = new Array();

  scaleFactorUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "fromTimestamp",
      ethereum.Value.fromUnsignedBigInt(fromTimestamp)
    )
  );
  scaleFactorUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "toTimestamp",
      ethereum.Value.fromUnsignedBigInt(toTimestamp)
    )
  );
  scaleFactorUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "scaleFactor",
      ethereum.Value.fromUnsignedBigInt(scaleFactor)
    )
  );
  scaleFactorUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "baseInterestRay",
      ethereum.Value.fromUnsignedBigInt(baseInterestRay)
    )
  );
  scaleFactorUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "delinquencyFeeRay",
      ethereum.Value.fromUnsignedBigInt(delinquencyFeeRay)
    )
  );
  scaleFactorUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "protocolFees",
      ethereum.Value.fromUnsignedBigInt(protocolFees)
    )
  );

  return scaleFactorUpdatedEvent;
}

export function createStateUpdatedEvent(
  scaleFactor: BigInt,
  isDelinquent: boolean
): StateUpdated {
  let stateUpdatedEvent = changetype<StateUpdated>(newMockEvent());

  stateUpdatedEvent.parameters = new Array();

  stateUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "scaleFactor",
      ethereum.Value.fromUnsignedBigInt(scaleFactor)
    )
  );
  stateUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "isDelinquent",
      ethereum.Value.fromBoolean(isDelinquent)
    )
  );

  return stateUpdatedEvent;
}

export function createTransferEvent(
  from: Address,
  to: Address,
  value: BigInt
): Transfer {
  let transferEvent = changetype<Transfer>(newMockEvent());

  transferEvent.parameters = new Array();

  transferEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  );

  return transferEvent;
}

export function createWithdrawalEvent(
  account: Address,
  assetAmount: BigInt,
  scaledAmount: BigInt
): Withdrawal {
  let withdrawalEvent = changetype<Withdrawal>(newMockEvent());

  withdrawalEvent.parameters = new Array();

  withdrawalEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  );
  withdrawalEvent.parameters.push(
    new ethereum.EventParam(
      "assetAmount",
      ethereum.Value.fromUnsignedBigInt(assetAmount)
    )
  );
  withdrawalEvent.parameters.push(
    new ethereum.EventParam(
      "scaledAmount",
      ethereum.Value.fromUnsignedBigInt(scaledAmount)
    )
  );

  return withdrawalEvent;
}

export function createWithdrawalBatchClosedEvent(
  expiry: BigInt
): WithdrawalBatchClosed {
  let withdrawalBatchClosedEvent = changetype<WithdrawalBatchClosed>(
    newMockEvent()
  );

  withdrawalBatchClosedEvent.parameters = new Array();

  withdrawalBatchClosedEvent.parameters.push(
    new ethereum.EventParam("expiry", ethereum.Value.fromUnsignedBigInt(expiry))
  );

  return withdrawalBatchClosedEvent;
}

export function createWithdrawalBatchCreatedEvent(
  expiry: BigInt
): WithdrawalBatchCreated {
  let withdrawalBatchCreatedEvent = changetype<WithdrawalBatchCreated>(
    newMockEvent()
  );

  withdrawalBatchCreatedEvent.parameters = new Array();

  withdrawalBatchCreatedEvent.parameters.push(
    new ethereum.EventParam("expiry", ethereum.Value.fromUnsignedBigInt(expiry))
  );

  return withdrawalBatchCreatedEvent;
}

export function createWithdrawalBatchExpiredEvent(
  expiry: BigInt,
  scaledTotalAmount: BigInt,
  scaledAmountBurned: BigInt,
  normalizedAmountPaid: BigInt
): WithdrawalBatchExpired {
  let withdrawalBatchExpiredEvent = changetype<WithdrawalBatchExpired>(
    newMockEvent()
  );

  withdrawalBatchExpiredEvent.parameters = new Array();

  withdrawalBatchExpiredEvent.parameters.push(
    new ethereum.EventParam("expiry", ethereum.Value.fromUnsignedBigInt(expiry))
  );
  withdrawalBatchExpiredEvent.parameters.push(
    new ethereum.EventParam(
      "scaledTotalAmount",
      ethereum.Value.fromUnsignedBigInt(scaledTotalAmount)
    )
  );
  withdrawalBatchExpiredEvent.parameters.push(
    new ethereum.EventParam(
      "scaledAmountBurned",
      ethereum.Value.fromUnsignedBigInt(scaledAmountBurned)
    )
  );
  withdrawalBatchExpiredEvent.parameters.push(
    new ethereum.EventParam(
      "normalizedAmountPaid",
      ethereum.Value.fromUnsignedBigInt(normalizedAmountPaid)
    )
  );

  return withdrawalBatchExpiredEvent;
}

export function createWithdrawalBatchPaymentEvent(
  expiry: BigInt,
  scaledAmountBurned: BigInt,
  normalizedAmountPaid: BigInt
): WithdrawalBatchPayment {
  let withdrawalBatchPaymentEvent = changetype<WithdrawalBatchPayment>(
    newMockEvent()
  );

  withdrawalBatchPaymentEvent.parameters = new Array();

  withdrawalBatchPaymentEvent.parameters.push(
    new ethereum.EventParam("expiry", ethereum.Value.fromUnsignedBigInt(expiry))
  );
  withdrawalBatchPaymentEvent.parameters.push(
    new ethereum.EventParam(
      "scaledAmountBurned",
      ethereum.Value.fromUnsignedBigInt(scaledAmountBurned)
    )
  );
  withdrawalBatchPaymentEvent.parameters.push(
    new ethereum.EventParam(
      "normalizedAmountPaid",
      ethereum.Value.fromUnsignedBigInt(normalizedAmountPaid)
    )
  );

  return withdrawalBatchPaymentEvent;
}

export function createWithdrawalExecutedEvent(
  expiry: BigInt,
  account: Address,
  normalizedAmount: BigInt
): WithdrawalExecuted {
  let withdrawalExecutedEvent = changetype<WithdrawalExecuted>(newMockEvent());

  withdrawalExecutedEvent.parameters = new Array();

  withdrawalExecutedEvent.parameters.push(
    new ethereum.EventParam("expiry", ethereum.Value.fromUnsignedBigInt(expiry))
  );
  withdrawalExecutedEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  );
  withdrawalExecutedEvent.parameters.push(
    new ethereum.EventParam(
      "normalizedAmount",
      ethereum.Value.fromUnsignedBigInt(normalizedAmount)
    )
  );

  return withdrawalExecutedEvent;
}

export function createWithdrawalQueuedEvent(
  expiry: BigInt,
  account: Address,
  scaledAmount: BigInt,
  normalizedAmount: BigInt
): WithdrawalQueued {
  let withdrawalQueuedEvent = changetype<WithdrawalQueued>(newMockEvent());

  withdrawalQueuedEvent.parameters = new Array();

  withdrawalQueuedEvent.parameters.push(
    new ethereum.EventParam("expiry", ethereum.Value.fromUnsignedBigInt(expiry))
  );
  withdrawalQueuedEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  );
  withdrawalQueuedEvent.parameters.push(
    new ethereum.EventParam(
      "scaledAmount",
      ethereum.Value.fromUnsignedBigInt(scaledAmount)
    )
  );
  withdrawalQueuedEvent.parameters.push(
    new ethereum.EventParam(
      "normalizedAmount",
      ethereum.Value.fromUnsignedBigInt(normalizedAmount)
    )
  );

  return withdrawalQueuedEvent;
}
