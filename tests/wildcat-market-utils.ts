import { newMockEvent } from "matchstick-as";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  AnnualInterestBipsUpdated,
  AuthorizationStatusUpdated,
  Borrow,
  DebtRepaid,
  Deposit,
  MarketClosed,
  SanctionedAccountAssetsQueuedForWithdrawal,
  StateUpdated,
  WithdrawalBatchClosed,
  WithdrawalBatchCreated,
  WithdrawalBatchExpired,
  WithdrawalBatchPayment,
  WithdrawalExecuted,
  WithdrawalQueued,
} from "../generated/templates/WildcatMarket/WildcatMarket";

export function createAuthorizationStatusUpdatedEvent(
  account: Address,
  role: i32
): AuthorizationStatusUpdated {
  let event = changetype<AuthorizationStatusUpdated>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "role",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(role))
    )
  );
  return event;
}

export function createAnnualInterestBipsUpdatedEvent(
  annualInterestBipsUpdated: BigInt
): AnnualInterestBipsUpdated {
  let event = changetype<AnnualInterestBipsUpdated>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "annualInterestBipsUpdated",
      ethereum.Value.fromUnsignedBigInt(annualInterestBipsUpdated)
    )
  );
  return event;
}

export function createBorrowEvent(assetAmount: BigInt): Borrow {
  let event = changetype<Borrow>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "assetAmount",
      ethereum.Value.fromUnsignedBigInt(assetAmount)
    )
  );
  return event;
}

export function createDebtRepaidEvent(
  from: Address,
  assetAmount: BigInt
): DebtRepaid {
  let event = changetype<DebtRepaid>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "assetAmount",
      ethereum.Value.fromUnsignedBigInt(assetAmount)
    )
  );
  return event;
}

export function createDepositEvent(
  account: Address,
  assetAmount: BigInt,
  scaledAmount: BigInt
): Deposit {
  let event = changetype<Deposit>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "assetAmount",
      ethereum.Value.fromUnsignedBigInt(assetAmount)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "scaledAmount",
      ethereum.Value.fromUnsignedBigInt(scaledAmount)
    )
  );
  return event;
}

export function createWithdrawalBatchCreatedEvent(
  expiry: BigInt
): WithdrawalBatchCreated {
  let event = changetype<WithdrawalBatchCreated>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "expiry",
      ethereum.Value.fromUnsignedBigInt(expiry)
    )
  );
  return event;
}

export function createWithdrawalQueuedEvent(
  expiry: BigInt,
  account: Address,
  scaledAmount: BigInt,
  normalizedAmount: BigInt
): WithdrawalQueued {
  let event = changetype<WithdrawalQueued>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "expiry",
      ethereum.Value.fromUnsignedBigInt(expiry)
    )
  );
  event.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "scaledAmount",
      ethereum.Value.fromUnsignedBigInt(scaledAmount)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "normalizedAmount",
      ethereum.Value.fromUnsignedBigInt(normalizedAmount)
    )
  );
  return event;
}

export function createWithdrawalBatchPaymentEvent(
  expiry: BigInt,
  scaledAmountBurned: BigInt,
  normalizedAmountPaid: BigInt
): WithdrawalBatchPayment {
  let event = changetype<WithdrawalBatchPayment>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "expiry",
      ethereum.Value.fromUnsignedBigInt(expiry)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "scaledAmountBurned",
      ethereum.Value.fromUnsignedBigInt(scaledAmountBurned)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "normalizedAmountPaid",
      ethereum.Value.fromUnsignedBigInt(normalizedAmountPaid)
    )
  );
  return event;
}

export function createWithdrawalBatchExpiredEvent(
  expiry: BigInt,
  scaledTotalAmount: BigInt,
  scaledAmountBurned: BigInt,
  normalizedAmountPaid: BigInt
): WithdrawalBatchExpired {
  let event = changetype<WithdrawalBatchExpired>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "expiry",
      ethereum.Value.fromUnsignedBigInt(expiry)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "scaledTotalAmount",
      ethereum.Value.fromUnsignedBigInt(scaledTotalAmount)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "scaledAmountBurned",
      ethereum.Value.fromUnsignedBigInt(scaledAmountBurned)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "normalizedAmountPaid",
      ethereum.Value.fromUnsignedBigInt(normalizedAmountPaid)
    )
  );
  return event;
}

export function createWithdrawalBatchClosedEvent(
  expiry: BigInt
): WithdrawalBatchClosed {
  let event = changetype<WithdrawalBatchClosed>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "expiry",
      ethereum.Value.fromUnsignedBigInt(expiry)
    )
  );
  return event;
}

export function createWithdrawalExecutedEvent(
  expiry: BigInt,
  account: Address,
  normalizedAmount: BigInt
): WithdrawalExecuted {
  let event = changetype<WithdrawalExecuted>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "expiry",
      ethereum.Value.fromUnsignedBigInt(expiry)
    )
  );
  event.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "normalizedAmount",
      ethereum.Value.fromUnsignedBigInt(normalizedAmount)
    )
  );
  return event;
}

export function createSanctionedAccountAssetsQueuedForWithdrawalEvent(
  account: Address,
  expiry: BigInt,
  scaledAmount: BigInt,
  normalizedAmount: BigInt
): SanctionedAccountAssetsQueuedForWithdrawal {
  let event = changetype<SanctionedAccountAssetsQueuedForWithdrawal>(
    newMockEvent()
  );
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "expiry",
      ethereum.Value.fromUnsignedBigInt(expiry)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "scaledAmount",
      ethereum.Value.fromUnsignedBigInt(scaledAmount)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "normalizedAmount",
      ethereum.Value.fromUnsignedBigInt(normalizedAmount)
    )
  );
  return event;
}

export function createMarketClosedEvent(timestamp: BigInt): MarketClosed {
  let event = changetype<MarketClosed>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  );
  return event;
}

export function createStateUpdatedEvent(
  scaleFactor: BigInt,
  isDelinquent: boolean
): StateUpdated {
  let event = changetype<StateUpdated>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "scaleFactor",
      ethereum.Value.fromUnsignedBigInt(scaleFactor)
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
