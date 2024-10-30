import { generateMarketEventId } from "./utils";
import {
  createAccountAccessGranted,
  createAccountAccessRevoked,
  createAccountBlockedFromDeposits,
  createAccountMadeFirstDeposit,
  createAccountUnblockedFromDeposits,
  createDisabledForceBuyBacks,
  createFixedTermUpdated,
  createHooksNameUpdated,
  createKnownLenderStatus,
  createMinimumDepositUpdated,
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
  getMarket,
  getOrInitializeLenderHooksAccess,
  getOrInitializeRoleProvider,
  getRoleProvider,
} from "../generated/UncrashableEntityHelpers";
import { HooksInstance } from "../generated/schema";
import {
  CombinedHooks as CombinedHooksContract,
  AccountAccessGranted as AccountAccessGrantedEvent,
  AccountAccessRevoked as AccountAccessRevokedEvent,
  AccountBlockedFromDeposits as AccountBlockedFromDepositsEvent,
  AccountMadeFirstDeposit as AccountMadeFirstDepositEvent,
  AccountUnblockedFromDeposits as AccountUnblockedFromDepositsEvent,
  MinimumDepositUpdated as MinimumDepositUpdatedEvent,
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
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let provider = getRoleProvider(
    generateRoleProviderId(event.address, event.params.providerAddress)
  );
  let lenderHooksAccess = getOrInitializeLenderHooksAccess(
    generateLenderHooksAccessId(event.address, event.params.accountAddress),
    {
      canRefresh: provider.isPullProvider,
      hooks: hooks.id,
      lastApprovalTimestamp: event.params.credentialTimestamp.toI32(),
      lastProvider: provider.id,
      lender: event.params.accountAddress,
    }
  );
  if (!lenderHooksAccess.wasCreated) {
    lenderHooksAccess.entity.canRefresh = provider.isPullProvider;
    lenderHooksAccess.entity.lastApprovalTimestamp = event.params.credentialTimestamp.toI32();
    lenderHooksAccess.entity.lastProvider = provider.id;
    lenderHooksAccess.entity.save();
  }
  createAccountAccessGranted(generateHooksInstanceEventId(hooks), {
    account: lenderHooksAccess.entity.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    credentialTimestamp: event.params.credentialTimestamp.toI32(),
    provider: provider.id,
    eventIndex: hooks.eventIndex,
  });
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleAccountAccessRevoked(
  event: AccountAccessRevokedEvent
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));

  let lenderHooksAccess = getLenderHooksAccess(
    generateLenderHooksAccessId(event.address, event.params.accountAddress)
  );
  createAccountAccessRevoked(generateHooksInstanceEventId(hooks), {
    account: lenderHooksAccess.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    eventIndex: hooks.eventIndex,
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
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let lenderHooksAccess = getOrInitializeLenderHooksAccess(
    generateLenderHooksAccessId(event.address, event.params.accountAddress),
    {
      canRefresh: false,
      hooks: hooks.id,
      lastApprovalTimestamp: 0,
      lastProvider: null,
      lender: event.params.accountAddress,
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
    account: lenderHooksAccess.entity.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    eventIndex: hooks.eventIndex,
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
  let market = getMarket(generateMarketId(marketAddress));
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
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: market.eventIndex,
  });
  market.eventIndex = market.eventIndex + 1;
  market.save();
}

export function handleAccountUnblockedFromDeposits(
  event: AccountUnblockedFromDepositsEvent
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let lenderStatusId = generateLenderHooksAccessId(
    event.address,
    event.params.accountAddress
  );
  let access = getLenderHooksAccess(lenderStatusId);
  access.isBlockedFromDeposits = false;
  access.save();
  createAccountUnblockedFromDeposits(generateHooksInstanceEventId(hooks), {
    account: lenderStatusId,
    blockNumber: event.block.number.toI32(),
    transactionHash: event.transaction.hash,
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: hooks.eventIndex,
  });
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleMinimumDepositUpdated(
  event: MinimumDepositUpdatedEvent
): void {
  let hooksId = generateHooksInstanceId(event.address);
  let market = getMarket(generateMarketId(event.params.market));
  let hooksConfig = getHooksConfig(generateHooksConfigId(event.params.market));

  createMinimumDepositUpdated(generateMarketEventId(market), {
    hooks: hooksId,
    market: market.id,
    newMinimumDeposit: event.params.newMinimumDeposit,
    oldMinimumDeposit: hooksConfig.minimumDeposit,
    blockNumber: event.block.number.toI32(),
    transactionHash: event.transaction.hash,
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: market.eventIndex,
    minimumDepositUpdatedIndex: market.minimumDepositUpdatedIndex,
  });
  hooksConfig.minimumDeposit = event.params.newMinimumDeposit;
  market.eventIndex = market.eventIndex + 1;
  market.minimumDepositUpdatedIndex = market.minimumDepositUpdatedIndex + 1;
  hooksConfig.save();
  market.save();
}

export function handleFixedTermUpdated(event: FixedTermUpdatedEvent): void {
  let market = getMarket(generateMarketId(event.params.market));
  let hooksConfig = getHooksConfig(generateHooksConfigId(event.params.market));
  createFixedTermUpdated(generateMarketEventId(market), {
    hooks: generateHooksInstanceId(event.address),
    market: market.id,
    newFixedTermEndTime: event.params.fixedTermEndTime.toI32(),
    oldFixedTermEndTime: hooksConfig.fixedTermEndTime,
    blockNumber: event.block.number.toI32(),
    transactionHash: event.transaction.hash,
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: market.eventIndex,
    fixedTermUpdatedIndex: market.fixedTermUpdatedIndex,
  });
  hooksConfig.fixedTermEndTime = event.params.fixedTermEndTime.toI32();
  market.eventIndex = market.eventIndex + 1;
  market.fixedTermUpdatedIndex = market.fixedTermUpdatedIndex + 1;
  market.save();
  hooksConfig.save();
}

export function handleRoleProviderAdded(event: RoleProviderAddedEvent): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let nullProviderIndex = 2 ** 24 - 1;
  let roleProvider = getOrInitializeRoleProvider(
    generateRoleProviderId(event.address, event.params.providerAddress),
    {
      hooks: hooks.id,
      timeToLive: event.params.timeToLive.toI32(),
      isPullProvider: event.params.pullProviderIndex != nullProviderIndex,
      pullProviderIndex: event.params.pullProviderIndex,
      providerAddress: event.params.providerAddress,
      isPushProvider: event.params.pushProviderIndex != nullProviderIndex,
      pushProviderIndex: event.params.pushProviderIndex,
      isApproved: true,
    }
  );
  if (!roleProvider.wasCreated) {
    roleProvider.entity.timeToLive = event.params.timeToLive.toI32();
    roleProvider.entity.isPullProvider =
      event.params.pullProviderIndex != nullProviderIndex;
    roleProvider.entity.pullProviderIndex = event.params.pullProviderIndex;
    roleProvider.entity.isPushProvider =
      event.params.pushProviderIndex != nullProviderIndex;
    roleProvider.entity.pushProviderIndex = event.params.pushProviderIndex;
    roleProvider.entity.isApproved = true;
    roleProvider.entity.save();
  }
  createRoleProviderAdded(generateHooksInstanceEventId(hooks), {
    hooks: hooks.id,
    isPullProvider: roleProvider.entity.isPullProvider,
    pullProviderIndex: roleProvider.entity.pullProviderIndex,
    isPushProvider: roleProvider.entity.isPushProvider,
    pushProviderIndex: roleProvider.entity.pushProviderIndex,
    provider: roleProvider.entity.id,
    blockNumber: event.block.number.toI32(),
    transactionHash: event.transaction.hash,
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: hooks.eventIndex,
    timeToLive: roleProvider.entity.timeToLive,
  });
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleRoleProviderRemoved(
  event: RoleProviderRemovedEvent
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let roleProvider = getRoleProvider(
    generateRoleProviderId(event.address, event.params.providerAddress)
  );

  createRoleProviderRemoved(generateHooksInstanceEventId(hooks), {
    hooks: hooks.id,
    provider: roleProvider.id,
    blockNumber: event.block.number.toI32(),
    transactionHash: event.transaction.hash,
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: hooks.eventIndex,
  });

  roleProvider.isApproved = false;
  roleProvider.isPullProvider = false;
  roleProvider.timeToLive = 0;
  roleProvider.pullProviderIndex = 0;
  roleProvider.save();
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleRoleProviderUpdated(
  event: RoleProviderUpdatedEvent
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let roleProvider = getRoleProvider(
    generateRoleProviderId(event.address, event.params.providerAddress)
  );

  let nullProviderIndex = 2 ** 24 - 1;
  roleProvider.pullProviderIndex = event.params.pullProviderIndex;
  roleProvider.pushProviderIndex = event.params.pushProviderIndex;
  roleProvider.timeToLive = event.params.timeToLive.toI32();
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
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: hooks.eventIndex,
    isPullProvider: roleProvider.isPullProvider,
    pullProviderIndex: roleProvider.pullProviderIndex,
    isPushProvider: roleProvider.isPushProvider,
    pushProviderIndex: roleProvider.pushProviderIndex,
    timeToLive: roleProvider.timeToLive,
  });
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleTemporaryExcessReserveRatioActivated(
  event: TemporaryExcessReserveRatioActivatedEvent
): void {
  let market = getMarket(generateMarketId(event.params.market));
  market.originalAnnualInterestBips = market.annualInterestBips;
  market.originalReserveRatioBips = event.params.originalReserveRatioBips.toI32();
  market.temporaryReserveRatioExpiry = event.params.temporaryReserveRatioExpiry.toI32();
  market.temporaryReserveRatioActive = true;
  market.save();
}

export function handleTemporaryExcessReserveRatioCanceled(
  event: TemporaryExcessReserveRatioCanceledEvent
): void {
  let market = getMarket(generateMarketId(event.params.market));
  market.originalAnnualInterestBips = 0;
  market.temporaryReserveRatioActive = false;
  market.originalReserveRatioBips = 0;
  market.temporaryReserveRatioExpiry = 0;
  market.save();
}

export function handleTemporaryExcessReserveRatioExpired(
  event: TemporaryExcessReserveRatioExpiredEvent
): void {
  let market = getMarket(generateMarketId(event.params.market));
  market.originalAnnualInterestBips = 0;
  market.temporaryReserveRatioActive = false;
  market.originalReserveRatioBips = 0;
  market.temporaryReserveRatioExpiry = 0;
  market.save();
}

export function handleTemporaryExcessReserveRatioUpdated(
  event: TemporaryExcessReserveRatioUpdatedEvent
): void {
  let market = getMarket(generateMarketId(event.params.market));
  market.temporaryReserveRatioExpiry = event.params.temporaryReserveRatioExpiry.toI32();
  market.save();
}

export function handleNameUpdated(event: NameUpdatedEvent): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  createHooksNameUpdated(generateHooksInstanceEventId(hooks), {
    hooks: hooks.id,
    newName: event.params.name,
    oldName: hooks.name,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    eventIndex: hooks.eventIndex,
  });
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.name = event.params.name;
  hooks.save();
}

export function handleDisabledForceBuyBacks(
  event: DisabledForceBuyBacksEvent
): void {
  let hooksId = event.address.toHex();
  let market = getMarket(generateMarketId(event.params.market));
  createDisabledForceBuyBacks(generateMarketEventId(market), {
    hooks: hooksId,
    market: market.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    eventIndex: market.eventIndex,
  });
  let hooksConfig = getHooksConfig(generateHooksConfigId(event.params.market));
  market.eventIndex = market.eventIndex + 1;
  hooksConfig.allowForceBuyBacks = false;
  market.save();
  hooksConfig.save();
}
