import { generateMarketEventId, loadExistingMarket } from "./utils";
import {
  createAccountAccessGranted,
  createAccountAccessRevoked,
  createAccountBlockedFromDeposits,
  createAccountMadeFirstDeposit,
  createAccountUnblockedFromDeposits,
  createAnnualInterestBipsReductionExecuted,
  createAnnualInterestBipsReductionProposalCancelled,
  createAnnualInterestBipsReductionProposed,
  createDisabledForceBuyBacks,
  createFixedTermUpdated,
  createHooksNameUpdated,
  createKnownLenderStatus,
  createMinimumDepositUpdated,
  createPeriodicTermClosed,
  createPeriodicTermUpdated,
  createRoleProviderAdded,
  createRoleProviderRemoved,
  createRoleProviderUpdated,
  generateHooksConfigId,
  generateHooksInstanceId,
  generateKnownLenderStatusId,
  generateLenderAccountId,
  generateLenderHooksAccessId,
  generateMarketId,
  generateRoleProviderId,
  getHooksConfig,
  getHooksInstance,
  getLenderHooksAccess,
  getOrInitializeLenderHooksAccess,
  getOrInitializeRoleProvider,
  getRoleProvider,
} from "../generated/UncrashableEntityHelpers";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";

import { HooksConfig, HooksInstance, Market } from "../generated/schema";
import { saveMarketAndSnapshot } from "./market-domain";
import { recordMarketEvent } from "./market-event-domain";
import { getOrCreateRoleProviderInstance } from "./role-provider-domain";
import {
  CombinedHooks as CombinedHooksContract,
  AccountAccessGranted as AccountAccessGrantedEvent,
  AccountAccessRevoked as AccountAccessRevokedEvent,
  AccountBlockedFromDeposits as AccountBlockedFromDepositsEvent,
  AccountMadeFirstDeposit as AccountMadeFirstDepositEvent,
  AccountUnblockedFromDeposits as AccountUnblockedFromDepositsEvent,
  AnnualInterestBipsReductionExecuted as AnnualInterestBipsReductionExecutedEvent,
  AnnualInterestBipsReductionProposalCancelled as AnnualInterestBipsReductionProposalCancelledEvent,
  AnnualInterestBipsReductionProposed as AnnualInterestBipsReductionProposedEvent,
  MinimumDepositUpdated as MinimumDepositUpdatedEvent,
  PeriodicTermClosed as PeriodicTermClosedEvent,
  PeriodicTermUpdated as PeriodicTermUpdatedEvent,
  RoleProviderAdded as RoleProviderAddedEvent,
  RoleProviderRemoved as RoleProviderRemovedEvent,
  RoleProviderUpdated as RoleProviderUpdatedEvent,
  TemporaryExcessReserveRatioActivated as TemporaryExcessReserveRatioActivatedEvent,
  TemporaryExcessReserveRatioCanceled as TemporaryExcessReserveRatioCanceledEvent,
  TemporaryExcessReserveRatioExpired as TemporaryExcessReserveRatioExpiredEvent,
  TemporaryExcessReserveRatioUpdated as TemporaryExcessReserveRatioUpdatedEvent,
  DisabledForceBuyBacks as DisabledForceBuyBacksEvent,
  FixedTermUpdated as FixedTermUpdatedEvent,
  NameUpdated as NameUpdatedEvent,
} from "../generated/templates/CombinedHooks/CombinedHooks";

function generateHooksInstanceEventId(hooks: HooksInstance): string {
  return "RECORD" + "-" + hooks.id + "-" + hooks.eventIndex.toString();
}

export function handleAccountAccessGranted(
  event: AccountAccessGrantedEvent
): void {
  handleAccountAccessGrantedValues(
    event,
    event.params.providerAddress,
    event.params.accountAddress,
    null,
    event.params.credentialTimestamp
  );
}

export function handleAccountAccessGrantedValues(
  event: ethereum.Event,
  providerAddress: Address,
  accountAddress: Address,
  caller: Address | null,
  credentialTimestamp: BigInt
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let provider = getRoleProvider(
    generateRoleProviderId(event.address, providerAddress)
  );
  let lenderHooksAccess = getOrInitializeLenderHooksAccess(
    generateLenderHooksAccessId(event.address, accountAddress),
    {
      canRefresh: provider.isPullProvider,
      hooks: hooks.id,
      lastApprovalTimestamp: credentialTimestamp.toI32(),
      lastProvider: provider.id,
      lender: accountAddress,
      addedTimestamp: event.block.timestamp.toI32(),
    }
  );
  if (!lenderHooksAccess.wasCreated) {
    lenderHooksAccess.entity.canRefresh = provider.isPullProvider;
    lenderHooksAccess.entity.lastApprovalTimestamp = credentialTimestamp.toI32();
    lenderHooksAccess.entity.lastProvider = provider.id;
    lenderHooksAccess.entity.save();
  }
  createAccountAccessGranted(generateHooksInstanceEventId(hooks), {
    hooks: hooks.id,
    account: lenderHooksAccess.entity.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
    credentialTimestamp: credentialTimestamp.toI32(),
    provider: provider.id,
    caller: caller,
    eventIndex: hooks.eventIndex,
  });
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleAccountAccessRevoked(
  event: AccountAccessRevokedEvent
): void {
  handleAccountAccessRevokedValues(
    event,
    Address.zero(),
    false,
    event.params.accountAddress,
    null
  );
}

export function handleAccountAccessRevokedValues(
  event: ethereum.Event,
  providerAddress: Address,
  hasProvider: boolean,
  accountAddress: Address,
  caller: Address | null
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));

  let lenderHooksAccess = getLenderHooksAccess(
    generateLenderHooksAccessId(event.address, accountAddress)
  );
  let providerId: string | null = null;
  if (hasProvider) {
    providerId = generateRoleProviderId(event.address, providerAddress);
  }
  createAccountAccessRevoked(generateHooksInstanceEventId(hooks), {
    hooks: hooks.id,
    account: lenderHooksAccess.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
    eventIndex: hooks.eventIndex,
    provider: providerId,
    caller: caller,
  });
  lenderHooksAccess.canRefresh = false;
  lenderHooksAccess.lastProvider = null;
  lenderHooksAccess.lastApprovalTimestamp = 0;

  lenderHooksAccess.save();
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleAccountBlockedFromDeposits(
  event: AccountBlockedFromDepositsEvent
): void {
  handleAccountBlockedFromDepositsValues(
    event,
    null,
    event.params.accountAddress
  );
}

export function handleAccountBlockedFromDepositsValues(
  event: ethereum.Event,
  administrator: Address | null,
  accountAddress: Address
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let lenderHooksAccess = getOrInitializeLenderHooksAccess(
    generateLenderHooksAccessId(event.address, accountAddress),
    {
      canRefresh: false,
      hooks: hooks.id,
      lastApprovalTimestamp: 0,
      lastProvider: null,
      lender: accountAddress,
      addedTimestamp: event.block.timestamp.toI32(),
    }
  );
  if (!lenderHooksAccess.wasCreated) {
    lenderHooksAccess.entity.canRefresh = false;
    lenderHooksAccess.entity.lastProvider = null;
    lenderHooksAccess.entity.lastApprovalTimestamp = 0;
  }
  lenderHooksAccess.entity.isBlockedFromDeposits = true;
  lenderHooksAccess.entity.save();

  createAccountBlockedFromDeposits(generateHooksInstanceEventId(hooks), {
    hooks: hooks.id,
    account: lenderHooksAccess.entity.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
    eventIndex: hooks.eventIndex,
    administrator: administrator,
  });
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleAccountMadeFirstDeposit(
  event: AccountMadeFirstDepositEvent
): void {
  // let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let accountAddress = event.params.accountAddress;
  let marketAddress = event.params.market;
  let market = loadExistingMarket(
    generateMarketId(marketAddress),
    "handleAccountMadeFirstDeposit"
  );
  if (market == null) {
    return;
  }
  recordMarketEvent(event, market, "ACCOUNT_FIRST_DEPOSIT");
  let lenderStatusId = generateLenderHooksAccessId(
    event.address,
    accountAddress
  );
  let lenderAccountId = generateLenderAccountId(marketAddress, accountAddress);
  createKnownLenderStatus(
    generateKnownLenderStatusId(marketAddress, accountAddress),
    {
      hooksAccess: lenderStatusId,
      market: market.id,
      lenderAccount: lenderAccountId,
    }
  );
  createAccountMadeFirstDeposit(generateMarketEventId(market), {
    // account: lenderStatusId,
    lenderAccount: lenderAccountId,
    hooks: generateHooksInstanceId(event.address),
    market: market.id,
    blockNumber: event.block.number.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: market.eventIndex,
  });
  market.eventIndex = market.eventIndex + 1;
  market.save();
}

export function handleAccountUnblockedFromDeposits(
  event: AccountUnblockedFromDepositsEvent
): void {
  handleAccountUnblockedFromDepositsValues(
    event,
    null,
    event.params.accountAddress
  );
}

export function handleAccountUnblockedFromDepositsValues(
  event: ethereum.Event,
  administrator: Address | null,
  accountAddress: Address
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let lenderStatusId = generateLenderHooksAccessId(
    event.address,
    accountAddress
  );
  let access = getLenderHooksAccess(lenderStatusId);
  access.isBlockedFromDeposits = false;
  access.save();
  createAccountUnblockedFromDeposits(generateHooksInstanceEventId(hooks), {
    account: lenderStatusId,
    hooks: hooks.id,
    blockNumber: event.block.number.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: hooks.eventIndex,
    administrator: administrator,
  });
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleMinimumDepositUpdated(
  event: MinimumDepositUpdatedEvent
): void {
  handleMinimumDepositUpdatedValues(
    event,
    event.params.market,
    null,
    BigInt.fromI32(-1),
    event.params.newMinimumDeposit
  );
}

export function handleMinimumDepositUpdatedValues(
  event: ethereum.Event,
  marketAddress: Address,
  caller: Address | null,
  previousMinimumDeposit: BigInt,
  newMinimumDeposit: BigInt
): void {
  let hooksId = generateHooksInstanceId(event.address);
  let marketId = generateMarketId(marketAddress);
  let market = Market.load(marketId);
  if (market != null) {
    recordMarketEvent(event, market, "MINIMUM_DEPOSIT_UPDATED");
    let hooksConfig = getHooksConfig(generateHooksConfigId(marketAddress));
    let oldMinimumDeposit = hooksConfig.minimumDeposit;
    if (!previousMinimumDeposit.lt(BigInt.zero())) {
      oldMinimumDeposit = previousMinimumDeposit;
    }

    createMinimumDepositUpdated(generateMarketEventId(market), {
      hooks: hooksId,
      market: market.id,
      newMinimumDeposit: newMinimumDeposit,
      oldMinimumDeposit: oldMinimumDeposit,
      caller: caller,
      blockNumber: event.block.number.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      eventIndex: market.eventIndex,
      minimumDepositUpdatedIndex: market.minimumDepositUpdatedIndex,
    });
    hooksConfig.minimumDeposit = newMinimumDeposit;
    market.eventIndex = market.eventIndex + 1;
    market.minimumDepositUpdatedIndex = market.minimumDepositUpdatedIndex + 1;
    hooksConfig.save();
    market.save();
  }
}

export function handleFixedTermUpdated(event: FixedTermUpdatedEvent): void {
  handleFixedTermUpdatedValues(
    event,
    event.params.market,
    null,
    -1,
    event.params.fixedTermEndTime.toI32()
  );
}

export function handleFixedTermUpdatedValues(
  event: ethereum.Event,
  marketAddress: Address,
  caller: Address | null,
  previousFixedTermEndTime: i32,
  newFixedTermEndTime: i32
): void {
  let marketId = generateMarketId(marketAddress);
  let market = Market.load(marketId);
  if (market != null) {
    recordMarketEvent(event, market, "FIXED_TERM_UPDATED");
    let hooksConfig = getHooksConfig(generateHooksConfigId(marketAddress));
    if (previousFixedTermEndTime < 0) {
      previousFixedTermEndTime = hooksConfig.fixedTermEndTime;
    }
    createFixedTermUpdated(generateMarketEventId(market), {
      hooks: generateHooksInstanceId(event.address),
      market: market.id,
      newFixedTermEndTime: newFixedTermEndTime,
      oldFixedTermEndTime: previousFixedTermEndTime,
      caller: caller,
      blockNumber: event.block.number.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      eventIndex: market.eventIndex,
      fixedTermUpdatedIndex: market.fixedTermUpdatedIndex,
    });
    hooksConfig.fixedTermEndTime = newFixedTermEndTime;
    market.eventIndex = market.eventIndex + 1;
    market.fixedTermUpdatedIndex = market.fixedTermUpdatedIndex + 1;
    market.save();
    hooksConfig.save();
  }
}

export function handlePeriodicTermUpdated(
  event: PeriodicTermUpdatedEvent
): void {
  handlePeriodicTermUpdatedValues(
    event,
    event.params.market,
    null,
    event.params.firstWithdrawalWindowStart.toI32(),
    event.params.periodDuration.toI32(),
    event.params.withdrawalWindowDuration.toI32()
  );
}

export function handlePeriodicTermUpdatedValues(
  event: ethereum.Event,
  marketAddress: Address,
  administrator: Address | null,
  firstWithdrawalWindowStart: i32,
  periodDuration: i32,
  withdrawalWindowDuration: i32
): void {
  let marketId = generateMarketId(marketAddress);
  let market = Market.load(marketId);
  if (market != null) {
    recordMarketEvent(event, market, "PERIODIC_TERM_UPDATED");
    let hooksConfig = getHooksConfig(generateHooksConfigId(marketAddress));
    createPeriodicTermUpdated(generateMarketEventId(market), {
      hooks: generateHooksInstanceId(event.address),
      market: market.id,
      oldFirstWithdrawalWindowStart: hooksConfig.firstWithdrawalWindowStart,
      oldPeriodDuration: hooksConfig.periodDuration,
      oldWithdrawalWindowDuration: hooksConfig.withdrawalWindowDuration,
      newFirstWithdrawalWindowStart: firstWithdrawalWindowStart,
      newPeriodDuration: periodDuration,
      newWithdrawalWindowDuration: withdrawalWindowDuration,
      administrator: administrator,
      blockNumber: event.block.number.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      eventIndex: market.eventIndex,
    });
    hooksConfig.firstWithdrawalWindowStart = firstWithdrawalWindowStart;
    hooksConfig.periodDuration = periodDuration;
    hooksConfig.withdrawalWindowDuration = withdrawalWindowDuration;
    market.eventIndex = market.eventIndex + 1;
    market.save();
    hooksConfig.save();
  }
}

export function handlePeriodicTermClosed(event: PeriodicTermClosedEvent): void {
  let marketId = generateMarketId(event.params.market);
  let market = Market.load(marketId);
  if (market != null) {
    recordMarketEvent(event, market, "PERIODIC_TERM_CLOSED");
    let hooksConfig = getHooksConfig(generateHooksConfigId(event.params.market));
    createPeriodicTermClosed(generateMarketEventId(market), {
      hooks: generateHooksInstanceId(event.address),
      market: market.id,
      blockNumber: event.block.number.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      eventIndex: market.eventIndex,
    });
    hooksConfig.periodicTermClosed = true;
    market.eventIndex = market.eventIndex + 1;
    market.save();
    hooksConfig.save();
  }
}

function clearPendingAprChange(market: Address): void {
  let hooksConfig = HooksConfig.load(generateHooksConfigId(market));
  if (hooksConfig != null) {
    hooksConfig.pendingAprChangeAnnualInterestBips = 0;
    hooksConfig.pendingAprChangeProposalTimestamp = 0;
    hooksConfig.pendingAprChangeResponseWindowStart = 0;
    hooksConfig.pendingAprChangeResponseWindowEnd = 0;
    hooksConfig.save();
  }
}

// Emitted by PeriodicTermHooks templates with proposal lifecycle events when a
// pending APR reduction proposal is deleted by an APR increase or replaced by
// a new proposal. Authoritative for new template versions; older instances
// are covered by the apr-changed heuristic in handleAnnualInterestBipsUpdated
// (wildcat-market.ts).
export function handleAnnualInterestBipsReductionProposalCancelled(
  event: AnnualInterestBipsReductionProposalCancelledEvent
): void {
  let marketId = generateMarketId(event.params.market);
  let market = Market.load(marketId);
  if (market != null) {
    recordMarketEvent(event, market, "APR_REDUCTION_CANCELLED");
    createAnnualInterestBipsReductionProposalCancelled(
      generateMarketEventId(market),
      {
        hooks: generateHooksInstanceId(event.address),
        market: market.id,
        blockNumber: event.block.number.toI32(),
        transactionHash: event.transaction.hash,
        blockLogIndex: event.logIndex.toI32(),
        blockTimestamp: event.block.timestamp.toI32(),
        eventIndex: market.eventIndex,
      }
    );
    market.eventIndex = market.eventIndex + 1;
    market.save();
  }
  clearPendingAprChange(event.params.market);
}

// Emitted when a proposed APR reduction executes. The market-level
// AnnualInterestBipsUpdated handler also clears these fields; this handler
// makes the clearing exact for new template versions.
export function handleAnnualInterestBipsReductionExecuted(
  event: AnnualInterestBipsReductionExecutedEvent
): void {
  let marketId = generateMarketId(event.params.market);
  let market = Market.load(marketId);
  if (market != null) {
    recordMarketEvent(event, market, "APR_REDUCTION_EXECUTED");
    createAnnualInterestBipsReductionExecuted(generateMarketEventId(market), {
      hooks: generateHooksInstanceId(event.address),
      market: market.id,
      annualInterestBips: event.params.annualInterestBips,
      blockNumber: event.block.number.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      eventIndex: market.eventIndex,
    });
    market.eventIndex = market.eventIndex + 1;
    market.save();
  }
  clearPendingAprChange(event.params.market);
}

export function handleAnnualInterestBipsReductionProposed(
  event: AnnualInterestBipsReductionProposedEvent
): void {
  let marketId = generateMarketId(event.params.market);
  let market = Market.load(marketId);
  if (market != null) {
    recordMarketEvent(event, market, "APR_REDUCTION_PROPOSED");
    let hooksConfig = getHooksConfig(generateHooksConfigId(event.params.market));
    createAnnualInterestBipsReductionProposed(generateMarketEventId(market), {
      hooks: generateHooksInstanceId(event.address),
      market: market.id,
      annualInterestBips: event.params.annualInterestBips,
      proposalTimestamp: event.params.proposalTimestamp.toI32(),
      responseWindowStart: event.params.responseWindowStart.toI32(),
      responseWindowEnd: event.params.responseWindowEnd.toI32(),
      blockNumber: event.block.number.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      eventIndex: market.eventIndex,
    });
    hooksConfig.pendingAprChangeAnnualInterestBips =
      event.params.annualInterestBips;
    hooksConfig.pendingAprChangeProposalTimestamp = event.params.proposalTimestamp.toI32();
    hooksConfig.pendingAprChangeResponseWindowStart = event.params.responseWindowStart.toI32();
    hooksConfig.pendingAprChangeResponseWindowEnd = event.params.responseWindowEnd.toI32();
    market.eventIndex = market.eventIndex + 1;
    market.save();
    hooksConfig.save();
  }
}

export function handleRoleProviderAdded(event: RoleProviderAddedEvent): void {
  handleRoleProviderAddedValues(
    event,
    null,
    event.params.providerAddress,
    event.params.timeToLive,
    event.params.pullProviderIndex,
    event.params.pushProviderIndex
  );
}

export function handleRoleProviderAddedValues(
  event: ethereum.Event,
  administrator: Address | null,
  providerAddress: Address,
  timeToLive: BigInt,
  pullProviderIndex: i32,
  pushProviderIndex: i32
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let providerInstance = getOrCreateRoleProviderInstance(
    providerAddress
  );
  let nullProviderIndex = 2 ** 24 - 1;
  let roleProvider = getOrInitializeRoleProvider(
    generateRoleProviderId(event.address, providerAddress),
    {
      hooks: hooks.id,
      timeToLive: timeToLive,
      isPullProvider: pullProviderIndex != nullProviderIndex,
      pullProviderIndex: pullProviderIndex,
      providerAddress: providerAddress,
      providerInstance: providerInstance.id,
      isPushProvider: pushProviderIndex != nullProviderIndex,
      pushProviderIndex: pushProviderIndex,
      isApproved: true,
    }
  );
  if (!roleProvider.wasCreated) {
    roleProvider.entity.timeToLive = timeToLive;
    roleProvider.entity.isPullProvider =
      pullProviderIndex != nullProviderIndex;
    roleProvider.entity.pullProviderIndex = pullProviderIndex;
    roleProvider.entity.isPushProvider =
      pushProviderIndex != nullProviderIndex;
    roleProvider.entity.pushProviderIndex = pushProviderIndex;
    roleProvider.entity.isApproved = true;
    roleProvider.entity.save();
  }
  let roleProviderAddedId = generateHooksInstanceEventId(hooks);
  createRoleProviderAdded(roleProviderAddedId, {
    hooks: hooks.id,
    isPullProvider: roleProvider.entity.isPullProvider,
    pullProviderIndex: roleProvider.entity.pullProviderIndex,
    isPushProvider: roleProvider.entity.isPushProvider,
    pushProviderIndex: roleProvider.entity.pushProviderIndex,
    provider: roleProvider.entity.id,
    blockNumber: event.block.number.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: hooks.eventIndex,
    timeToLive: roleProvider.entity.timeToLive,
    administrator: administrator,
  });
  roleProvider.entity.addedEvent = roleProviderAddedId;
  roleProvider.entity.save();
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleRoleProviderRemoved(
  event: RoleProviderRemovedEvent
): void {
  handleRoleProviderRemovedValues(
    event,
    null,
    event.params.providerAddress,
    null,
    null,
    null
  );
}

export function handleRoleProviderRemovedValues(
  event: ethereum.Event,
  administrator: Address | null,
  providerAddress: Address,
  timeToLive: BigInt | null,
  pullProviderIndex: BigInt | null,
  pushProviderIndex: BigInt | null
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let roleProvider = getRoleProvider(
    generateRoleProviderId(event.address, providerAddress)
  );

  let roleProviderRemovedId = generateHooksInstanceEventId(hooks);
  createRoleProviderRemoved(roleProviderRemovedId, {
    hooks: hooks.id,
    provider: roleProvider.id,
    blockNumber: event.block.number.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: hooks.eventIndex,
    administrator: administrator,
    timeToLive: timeToLive,
    pullProviderIndex: pullProviderIndex,
    pushProviderIndex: pushProviderIndex,
  });

  roleProvider.isApproved = false;
  roleProvider.isPullProvider = false;
  roleProvider.isPushProvider = false;
  roleProvider.timeToLive = BigInt.zero();
  roleProvider.pullProviderIndex = 0;
  roleProvider.pushProviderIndex = 0;
  roleProvider.removedEvent = roleProviderRemovedId;
  roleProvider.save();
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleRoleProviderUpdated(
  event: RoleProviderUpdatedEvent
): void {
  handleRoleProviderUpdatedValues(
    event,
    null,
    event.params.providerAddress,
    null,
    event.params.timeToLive,
    null,
    event.params.pullProviderIndex,
    null,
    event.params.pushProviderIndex
  );
}

export function handleRoleProviderUpdatedValues(
  event: ethereum.Event,
  administrator: Address | null,
  providerAddress: Address,
  previousTimeToLive: BigInt | null,
  newTimeToLive: BigInt,
  previousPullProviderIndex: BigInt | null,
  newPullProviderIndex: i32,
  previousPushProviderIndex: BigInt | null,
  newPushProviderIndex: i32
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let roleProvider = getRoleProvider(
    generateRoleProviderId(event.address, providerAddress)
  );

  let nullProviderIndex = 2 ** 24 - 1;
  roleProvider.pullProviderIndex = newPullProviderIndex;
  roleProvider.pushProviderIndex = newPushProviderIndex;
  roleProvider.timeToLive = newTimeToLive;
  roleProvider.isPullProvider =
    roleProvider.pullProviderIndex != nullProviderIndex;
  roleProvider.isPushProvider =
    roleProvider.pushProviderIndex != nullProviderIndex;
  roleProvider.save();

  createRoleProviderUpdated(generateHooksInstanceEventId(hooks), {
    hooks: hooks.id,
    provider: roleProvider.id,
    blockNumber: event.block.number.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: hooks.eventIndex,
    isPullProvider: roleProvider.isPullProvider,
    pullProviderIndex: roleProvider.pullProviderIndex,
    isPushProvider: roleProvider.isPushProvider,
    pushProviderIndex: roleProvider.pushProviderIndex,
    timeToLive: roleProvider.timeToLive,
    administrator: administrator,
    previousTimeToLive: previousTimeToLive,
    previousPullProviderIndex: previousPullProviderIndex,
    previousPushProviderIndex: previousPushProviderIndex,
  });
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleTemporaryExcessReserveRatioActivated(
  event: TemporaryExcessReserveRatioActivatedEvent
): void {
  let market = loadExistingMarket(
    generateMarketId(event.params.market),
    "handleTemporaryExcessReserveRatioActivated"
  );
  if (market == null) {
    return;
  }
  recordMarketEvent(event, market, "TEMPORARY_RESERVE_RATIO_ACTIVATED");
  market.originalAnnualInterestBips = market.annualInterestBips;
  market.originalReserveRatioBips = event.params.originalReserveRatioBips.toI32();
  market.temporaryReserveRatioExpiry = event.params.temporaryReserveRatioExpiry.toI32();
  market.temporaryReserveRatioActive = true;
  saveMarketAndSnapshot(event, market);
}

export function handleTemporaryExcessReserveRatioCanceled(
  event: TemporaryExcessReserveRatioCanceledEvent
): void {
  let market = loadExistingMarket(
    generateMarketId(event.params.market),
    "handleTemporaryExcessReserveRatioCanceled"
  );
  if (market == null) {
    return;
  }
  recordMarketEvent(event, market, "TEMPORARY_RESERVE_RATIO_CANCELLED");
  market.originalAnnualInterestBips = 0;
  market.temporaryReserveRatioActive = false;
  market.originalReserveRatioBips = 0;
  market.temporaryReserveRatioExpiry = 0;
  saveMarketAndSnapshot(event, market);
}

export function handleTemporaryExcessReserveRatioExpired(
  event: TemporaryExcessReserveRatioExpiredEvent
): void {
  let market = loadExistingMarket(
    generateMarketId(event.params.market),
    "handleTemporaryExcessReserveRatioExpired"
  );
  if (market == null) {
    return;
  }
  recordMarketEvent(event, market, "TEMPORARY_RESERVE_RATIO_EXPIRED");
  market.originalAnnualInterestBips = 0;
  market.temporaryReserveRatioActive = false;
  market.originalReserveRatioBips = 0;
  market.temporaryReserveRatioExpiry = 0;
  saveMarketAndSnapshot(event, market);
}

export function handleTemporaryExcessReserveRatioUpdated(
  event: TemporaryExcessReserveRatioUpdatedEvent
): void {
  let market = loadExistingMarket(
    generateMarketId(event.params.market),
    "handleTemporaryExcessReserveRatioUpdated"
  );
  if (market == null) {
    return;
  }
  recordMarketEvent(event, market, "TEMPORARY_RESERVE_RATIO_UPDATED");
  market.temporaryReserveRatioExpiry = event.params.temporaryReserveRatioExpiry.toI32();
  saveMarketAndSnapshot(event, market);
}

export function handleNameUpdated(event: NameUpdatedEvent): void {
  handleNameUpdatedValues(event, null, "", false, event.params.name);
}

export function handleNameUpdatedValues(
  event: ethereum.Event,
  administrator: Address | null,
  previousName: string,
  hasPreviousName: boolean,
  newName: string
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let oldName = hooks.name;
  if (hasPreviousName) {
    oldName = previousName;
  }
  createHooksNameUpdated(generateHooksInstanceEventId(hooks), {
    hooks: hooks.id,
    newName: newName,
    oldName: oldName,
    administrator: administrator,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
    eventIndex: hooks.eventIndex,
  });
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.name = newName;
  hooks.save();
}

export function handleDisabledForceBuyBacks(
  event: DisabledForceBuyBacksEvent
): void {
  let hooksId = event.address.toHex();
  let market = loadExistingMarket(
    generateMarketId(event.params.market),
    "handleDisabledForceBuyBacks"
  );
  if (market == null) {
    return;
  }
  recordMarketEvent(event, market, "FORCE_BUYBACK_DISABLED");
  createDisabledForceBuyBacks(generateMarketEventId(market), {
    hooks: hooksId,
    market: market.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
    eventIndex: market.eventIndex,
  });
  let hooksConfig = getHooksConfig(generateHooksConfigId(event.params.market));
  market.eventIndex = market.eventIndex + 1;
  hooksConfig.allowForceBuyBacks = false;
  market.save();
  hooksConfig.save();
}
