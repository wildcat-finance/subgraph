import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  Deposit as DepositEvent,
  TokensSwept as TokensSweptEvent,
  Transfer as TransferEvent,
  Withdraw as WithdrawEvent,
} from "../generated/templates/Wildcat4626Wrapper/Wildcat4626Wrapper";
import {
  Wildcat4626Wrapper,
  Wildcat4626WrapperDeposit,
  Wildcat4626WrapperTokensSwept,
  Wildcat4626WrapperTransactionCursor,
  Wildcat4626WrapperTransfer,
  Wildcat4626WrapperWithdrawal,
} from "../generated/schema";
import { recordIndexerDiagnostic } from "./indexer-diagnostics";
import { getTransferredPrincipalBasis } from "./principal-basis";
import { generateEventId, isNullAddress, satSub } from "./utils";
import {
  generateWrapperTransactionCursorId,
  getOrCreateWrapperAccount,
  getOrCreateWrapperTransactionCursor,
} from "./wrapper-principal-basis";

function getWrapper(address: Address): Wildcat4626Wrapper | null {
  return Wildcat4626Wrapper.load(address.toHexString());
}

function loadTransactionCursor(
  wrapperAddress: Address,
  event: DepositEvent
): Wildcat4626WrapperTransactionCursor | null {
  return Wildcat4626WrapperTransactionCursor.load(
    generateWrapperTransactionCursorId(wrapperAddress, event)
  );
}

export function handleTransfer(event: TransferEvent): void {
  let wrapper = getWrapper(event.address);
  if (wrapper == null) {
    return;
  }

  let fromAddress = event.params.from;
  let toAddress = event.params.to;
  let shares = event.params.amount;
  let fromId: string | null = null;
  let toId: string | null = null;
  let principalBasisAmount = BigInt.zero();

  if (fromAddress.equals(toAddress) && !isNullAddress(fromAddress)) {
    let account = getOrCreateWrapperAccount(wrapper, fromAddress, event);
    fromId = account.id;
    toId = account.id;
    account.save();
  } else if (isNullAddress(fromAddress)) {
    let to = getOrCreateWrapperAccount(wrapper, toAddress, event);
    to.shares = to.shares.plus(shares);
    wrapper.totalShares = wrapper.totalShares.plus(shares);
    toId = to.id;
    to.save();
  } else if (isNullAddress(toAddress)) {
    let from = getOrCreateWrapperAccount(wrapper, fromAddress, event);
    principalBasisAmount = getTransferredPrincipalBasis(
      from.principalBasis,
      shares,
      from.shares
    );
    from.shares = satSub(from.shares, shares);
    from.principalBasis = satSub(
      from.principalBasis,
      principalBasisAmount
    );
    wrapper.totalShares = satSub(wrapper.totalShares, shares);
    wrapper.principalBasis = satSub(
      wrapper.principalBasis,
      principalBasisAmount
    );
    fromId = from.id;
    from.save();

    let cursor = getOrCreateWrapperTransactionCursor(wrapper, event);
    cursor.pendingBurnAccount = from.id;
    cursor.pendingBurnShares = shares;
    cursor.pendingBurnPrincipalBasis = principalBasisAmount;
    cursor.save();
  } else {
    let from = getOrCreateWrapperAccount(wrapper, fromAddress, event);
    let to = getOrCreateWrapperAccount(wrapper, toAddress, event);
    principalBasisAmount = getTransferredPrincipalBasis(
      from.principalBasis,
      shares,
      from.shares
    );
    from.shares = satSub(from.shares, shares);
    from.principalBasis = satSub(
      from.principalBasis,
      principalBasisAmount
    );
    to.shares = to.shares.plus(shares);
    to.principalBasis = to.principalBasis.plus(principalBasisAmount);
    fromId = from.id;
    toId = to.id;
    from.save();
    to.save();
  }

  let transfer = new Wildcat4626WrapperTransfer(generateEventId(event));
  transfer.wrapper = wrapper.id;
  transfer.fromAddress = fromAddress;
  transfer.toAddress = toAddress;
  transfer.from = fromId;
  transfer.to = toId;
  transfer.shares = shares;
  transfer.principalBasisAmount = principalBasisAmount;
  transfer.blockNumber = event.block.number;
  transfer.blockTimestamp = event.block.timestamp;
  transfer.transactionHash = event.transaction.hash;
  transfer.blockLogIndex = event.logIndex;
  transfer.save();
  wrapper.save();
}

export function handleDeposit(event: DepositEvent): void {
  let wrapper = getWrapper(event.address);
  if (wrapper == null) {
    return;
  }

  let account = getOrCreateWrapperAccount(wrapper, event.params.owner, event);
  let cursor = loadTransactionCursor(event.address, event);
  let principalBasisAmount = BigInt.zero();
  let marketTransfer: string | null = null;
  if (
    cursor != null &&
    cursor.inboundMarketTransfer != null &&
    cursor.inboundScaledAmount.equals(event.params.shares)
  ) {
    principalBasisAmount = cursor.inboundPrincipalBasis;
    marketTransfer = cursor.inboundMarketTransfer;
  } else {
    recordIndexerDiagnostic(
      event,
      "WRAPPER_EVENT_CORRELATION_FAILED",
      "Wrapper deposit did not match its inbound market-token transfer",
      event.params.owner
    );
  }

  account.principalBasis = account.principalBasis.plus(principalBasisAmount);
  wrapper.principalBasis = wrapper.principalBasis.plus(principalBasisAmount);
  account.save();
  wrapper.save();

  let deposit = new Wildcat4626WrapperDeposit(generateEventId(event));
  deposit.wrapper = wrapper.id;
  deposit.account = account.id;
  deposit.caller = event.params.by;
  deposit.assets = event.params.assets;
  deposit.shares = event.params.shares;
  deposit.principalBasisAmount = principalBasisAmount;
  deposit.marketTransfer = marketTransfer;
  deposit.blockNumber = event.block.number;
  deposit.blockTimestamp = event.block.timestamp;
  deposit.transactionHash = event.transaction.hash;
  deposit.blockLogIndex = event.logIndex;
  deposit.save();

  if (cursor != null) {
    cursor.inboundMarketTransfer = null;
    cursor.inboundScaledAmount = BigInt.zero();
    cursor.inboundPrincipalBasis = BigInt.zero();
    cursor.save();
  }
}

export function handleWithdraw(event: WithdrawEvent): void {
  let wrapper = getWrapper(event.address);
  if (wrapper == null) {
    return;
  }

  let account = getOrCreateWrapperAccount(wrapper, event.params.owner, event);
  let cursor = Wildcat4626WrapperTransactionCursor.load(
    generateWrapperTransactionCursorId(event.address, event)
  );
  let principalBasisAmount = BigInt.zero();
  let marketTransfer: string | null = null;
  if (
    cursor != null &&
    cursor.pendingBurnAccount == account.id &&
    cursor.pendingBurnShares.equals(event.params.shares) &&
    cursor.outboundMarketTransfer != null &&
    cursor.outboundScaledAmount.equals(event.params.shares)
  ) {
    principalBasisAmount = cursor.pendingBurnPrincipalBasis;
    marketTransfer = cursor.outboundMarketTransfer;
  } else {
    recordIndexerDiagnostic(
      event,
      "WRAPPER_EVENT_CORRELATION_FAILED",
      "Wrapper withdrawal did not match its share burn and outbound market-token transfer",
      event.params.owner
    );
  }
  account.save();

  let withdrawal = new Wildcat4626WrapperWithdrawal(generateEventId(event));
  withdrawal.wrapper = wrapper.id;
  withdrawal.account = account.id;
  withdrawal.caller = event.params.by;
  withdrawal.receiver = event.params.to;
  withdrawal.assets = event.params.assets;
  withdrawal.shares = event.params.shares;
  withdrawal.principalBasisAmount = principalBasisAmount;
  withdrawal.marketTransfer = marketTransfer;
  withdrawal.blockNumber = event.block.number;
  withdrawal.blockTimestamp = event.block.timestamp;
  withdrawal.transactionHash = event.transaction.hash;
  withdrawal.blockLogIndex = event.logIndex;
  withdrawal.save();

  if (cursor != null) {
    cursor.pendingBurnAccount = null;
    cursor.pendingBurnShares = BigInt.zero();
    cursor.pendingBurnPrincipalBasis = BigInt.zero();
    cursor.outboundMarketTransfer = null;
    cursor.outboundScaledAmount = BigInt.zero();
    cursor.outboundPrincipalBasis = BigInt.zero();
    cursor.save();
  }
}

export function handleTokensSwept(event: TokensSweptEvent): void {
  let wrapper = getWrapper(event.address);
  if (wrapper == null) {
    return;
  }

  let principalBasisAmount = BigInt.zero();
  let marketTransfer: string | null = null;
  let cursor = Wildcat4626WrapperTransactionCursor.load(
    generateWrapperTransactionCursorId(event.address, event)
  );
  if (
    event.params.token.equals(Address.fromBytes(wrapper.marketAddress)) &&
    cursor != null &&
    cursor.outboundMarketTransfer != null
  ) {
    principalBasisAmount = cursor.outboundPrincipalBasis;
    marketTransfer = cursor.outboundMarketTransfer;
    cursor.outboundMarketTransfer = null;
    cursor.outboundScaledAmount = BigInt.zero();
    cursor.outboundPrincipalBasis = BigInt.zero();
    cursor.save();
  }

  let sweep = new Wildcat4626WrapperTokensSwept(generateEventId(event));
  sweep.wrapper = wrapper.id;
  sweep.token = event.params.token;
  sweep.receiver = event.params.to;
  sweep.amount = event.params.amount;
  sweep.principalBasisAmount = principalBasisAmount;
  sweep.marketTransfer = marketTransfer;
  sweep.blockNumber = event.block.number;
  sweep.blockTimestamp = event.block.timestamp;
  sweep.transactionHash = event.transaction.hash;
  sweep.blockLogIndex = event.logIndex;
  sweep.save();
}
