import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  LenderAccount,
  Wildcat4626Wrapper,
  Wildcat4626WrapperAccount,
  Wildcat4626WrapperTransactionCursor,
} from "../generated/schema";
import { satSub } from "./utils";

export class WrapperPrincipalBasisOverride {
  applies: bool;
  amount: BigInt;

  constructor(applies: bool, amount: BigInt) {
    this.applies = applies;
    this.amount = amount;
  }
}

export function generateWrapperAccountId(
  wrapperAddress: Address,
  accountAddress: Address
): string {
  return "WRAPPER-LENDER-"
    .concat(wrapperAddress.toHexString())
    .concat("-")
    .concat(accountAddress.toHexString());
}

export function generateWrapperTransactionCursorId(
  wrapperAddress: Address,
  event: ethereum.Event
): string {
  return wrapperAddress
    .toHexString()
    .concat("-")
    .concat(event.transaction.hash.toHex());
}

export function getOrCreateWrapperAccount(
  wrapper: Wildcat4626Wrapper,
  accountAddress: Address,
  event: ethereum.Event
): Wildcat4626WrapperAccount {
  let id = generateWrapperAccountId(
    Address.fromBytes(wrapper.address),
    accountAddress
  );
  let account = Wildcat4626WrapperAccount.load(id);
  if (account == null) {
    account = new Wildcat4626WrapperAccount(id);
    account.wrapper = wrapper.id;
    account.address = accountAddress;
    account.shares = BigInt.zero();
    account.principalBasis = BigInt.zero();
  }
  account.updatedAtBlock = event.block.number;
  account.updatedAtTimestamp = event.block.timestamp;
  account.updatedAtTransaction = event.transaction.hash;
  account.updatedAtLogIndex = event.logIndex;
  return account;
}

export function getOrCreateWrapperTransactionCursor(
  wrapper: Wildcat4626Wrapper,
  event: ethereum.Event
): Wildcat4626WrapperTransactionCursor {
  let id = generateWrapperTransactionCursorId(
    Address.fromBytes(wrapper.address),
    event
  );
  let cursor = Wildcat4626WrapperTransactionCursor.load(id);
  if (cursor == null) {
    cursor = new Wildcat4626WrapperTransactionCursor(id);
    cursor.wrapper = wrapper.id;
    cursor.transactionHash = event.transaction.hash;
    cursor.inboundScaledAmount = BigInt.zero();
    cursor.inboundPrincipalBasis = BigInt.zero();
    cursor.outboundScaledAmount = BigInt.zero();
    cursor.outboundPrincipalBasis = BigInt.zero();
    cursor.pendingBurnShares = BigInt.zero();
    cursor.pendingBurnPrincipalBasis = BigInt.zero();
  }
  return cursor;
}

/**
 * Wrapper redemptions must move the basis removed from the burned share
 * position, not a fresh pro-rata slice of all assets held by the wrapper.
 * Sweeps similarly move only basis attached to surplus, donated backing.
 */
export function getWrapperOutboundPrincipalBasis(
  wrapperAddress: Address,
  event: ethereum.Event,
  scaledAmount: BigInt,
  wrapperMarketAccount: LenderAccount
): WrapperPrincipalBasisOverride {
  let wrapper = Wildcat4626Wrapper.load(wrapperAddress.toHexString());
  if (
    wrapper == null ||
    !Address.fromBytes(wrapper.marketAddress).equals(event.address)
  ) {
    return new WrapperPrincipalBasisOverride(false, BigInt.zero());
  }

  let cursor = Wildcat4626WrapperTransactionCursor.load(
    generateWrapperTransactionCursorId(wrapperAddress, event)
  );
  if (
    cursor != null &&
    cursor.outboundMarketTransfer == null &&
    cursor.pendingBurnShares.equals(scaledAmount)
  ) {
    return new WrapperPrincipalBasisOverride(
      true,
      cursor.pendingBurnPrincipalBasis
    );
  }

  let surplusShares = satSub(
    wrapperMarketAccount.scaledBalance,
    wrapper.totalShares
  );
  if (scaledAmount.equals(surplusShares)) {
    return new WrapperPrincipalBasisOverride(
      true,
      satSub(wrapperMarketAccount.principalBasis, wrapper.principalBasis)
    );
  }
  return new WrapperPrincipalBasisOverride(false, BigInt.zero());
}

/**
 * Inbound market-token transfers precede the share mint and Deposit event;
 * outbound transfers follow the share burn and precede the Withdraw event.
 * Keep transaction-local state so the terminal event can attach exact basis.
 */
export function observeWrappedMarketTransfer(
  event: ethereum.Event,
  fromAddress: Address,
  toAddress: Address,
  scaledAmount: BigInt,
  principalBasisAmount: BigInt,
  transferId: string
): void {
  let inboundWrapper = Wildcat4626Wrapper.load(toAddress.toHexString());
  if (
    inboundWrapper != null &&
    Address.fromBytes(inboundWrapper.marketAddress).equals(event.address)
  ) {
    let cursor = getOrCreateWrapperTransactionCursor(inboundWrapper, event);
    cursor.inboundMarketTransfer = transferId;
    cursor.inboundScaledAmount = scaledAmount;
    cursor.inboundPrincipalBasis = principalBasisAmount;
    cursor.save();
  }

  let outboundWrapper = Wildcat4626Wrapper.load(fromAddress.toHexString());
  if (
    outboundWrapper != null &&
    Address.fromBytes(outboundWrapper.marketAddress).equals(event.address)
  ) {
    let cursor = getOrCreateWrapperTransactionCursor(outboundWrapper, event);
    cursor.outboundMarketTransfer = transferId;
    cursor.outboundScaledAmount = scaledAmount;
    cursor.outboundPrincipalBasis = principalBasisAmount;
    cursor.save();
  }
}
