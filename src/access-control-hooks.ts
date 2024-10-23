import {
  createAccessControlHooksProvider,
  createAccountAccessGranted,
  createAccountAccessRevoked,
  createAccountBlockedFromDeposits,
  createAccountMadeFirstDeposit,
  createAccountUnblockedFromDeposits,
  createKnownLenderStatus,
  createMinimumDepositUpdated,
  createRoleProviderAdded,
  createRoleProviderRemoved,
  createRoleProviderUpdated,
  generateAccessControlHooksProviderId,
  generateAccountAccessGrantedId,
  generateAccountAccessRevokedId,
  generateAccountBlockedFromDepositsId,
  generateAccountMadeFirstDepositId,
  generateAccountUnblockedFromDepositsId,
  generateKnownLenderStatusId,
  generateLenderAccountId,
  generateLenderHooksAccessId,
  generateMarketId,
  generateMinimumDepositUpdatedId,
  generateRoleProviderAddedId,
  generateRoleProviderRemovedId,
  generateRoleProviderUpdatedId,
  getAccessControlHooks,
  getAccessControlHooksProvider,
  getLenderHooksAccess,
  getMarket,
  getOrInitializeAccessControlHooksProvider,
  getOrInitializeLenderHooksAccess,
} from "../generated/UncrashableEntityHelpers";
import {
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
} from "../generated/templates/AccessControlHooks/AccessControlHooks";

export function handleAccountAccessGranted(
  event: AccountAccessGrantedEvent
): void {
  const hooks = getAccessControlHooks(event.address.toHex());
  const provider = getAccessControlHooksProvider(
    generateAccessControlHooksProviderId(
      event.address,
      event.params.providerAddress
    )
  );
  const lenderHooksAccess = getOrInitializeLenderHooksAccess(
    generateLenderHooksAccessId(event.address, event.params.accountAddress),
    {
      canRefresh: provider.isPullProvider,
      hooks: event.address.toHex(),
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
  createAccountAccessGranted(
    generateAccountAccessGrantedId(
      event.address,
      event.params.accountAddress,
      hooks.eventIndex
    ),
    {
      account: lenderHooksAccess.entity.id,
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      credentialTimestamp: event.params.credentialTimestamp.toI32(),
      provider: provider.id,
      eventIndex: hooks.eventIndex,
    }
  );
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleAccountAccessRevoked(
  event: AccountAccessRevokedEvent
): void {
  const hooks = getAccessControlHooks(event.address.toHex());

  const lenderHooksAccess = getLenderHooksAccess(
    generateLenderHooksAccessId(event.address, event.params.accountAddress)
  );
  createAccountAccessRevoked(
    generateAccountAccessRevokedId(
      event.address,
      event.params.accountAddress,
      hooks.eventIndex
    ),
    {
      account: lenderHooksAccess.id,
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      eventIndex: hooks.eventIndex,
    }
  );
  lenderHooksAccess.canRefresh = false;
  lenderHooksAccess.lastProvider = null;
  lenderHooksAccess.lastApprovalTimestamp = 0;

  lenderHooksAccess.save();
}

export function handleAccountBlockedFromDeposits(
  event: AccountBlockedFromDepositsEvent
): void {
  const hooks = getAccessControlHooks(event.address.toHex());
  const lenderHooksAccess = getOrInitializeLenderHooksAccess(
    generateLenderHooksAccessId(event.address, event.params.accountAddress),
    {
      canRefresh: false,
      hooks: event.address.toHex(),
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

  createAccountBlockedFromDeposits(
    generateAccountBlockedFromDepositsId(
      event.address,
      event.params.accountAddress,
      hooks.eventIndex
    ),
    {
      account: lenderHooksAccess.entity.id,
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      eventIndex: hooks.eventIndex,
    }
  );
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleAccountMadeFirstDeposit(
  event: AccountMadeFirstDepositEvent
): void {
  const hooks = getAccessControlHooks(event.address.toHex());
  const lenderStatusId = generateLenderHooksAccessId(
    event.address,
    event.params.accountAddress
  );
  const lenderAccountId = generateLenderAccountId(
    event.params.market,
    event.params.accountAddress
  );
  createKnownLenderStatus(
    generateKnownLenderStatusId(
      event.params.market,
      event.params.accountAddress
    ),
    {
      lenderStatus: lenderStatusId,
      market: generateMarketId(event.params.market),
      lenderAccount: lenderAccountId,
    }
  );
  createAccountMadeFirstDeposit(
    generateAccountMadeFirstDepositId(
      event.params.market,
      event.params.accountAddress,
      hooks.eventIndex
    ),
    {
      account: lenderStatusId,
      blockNumber: event.block.number.toI32(),
      transactionHash: event.transaction.hash,
      blockTimestamp: event.block.timestamp.toI32(),
      eventIndex: hooks.eventIndex,
    }
  );
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleAccountUnblockedFromDeposits(
  event: AccountUnblockedFromDepositsEvent
): void {
  const hooks = getAccessControlHooks(event.address.toHex());
  const lenderStatusId = generateLenderHooksAccessId(
    event.address,
    event.params.accountAddress
  );
  const access = getLenderHooksAccess(lenderStatusId);
  access.isBlockedFromDeposits = false;
  access.save();
  createAccountUnblockedFromDeposits(
    generateAccountUnblockedFromDepositsId(
      event.address,
      event.params.accountAddress,
      hooks.eventIndex
    ),
    {
      account: lenderStatusId,
      blockNumber: event.block.number.toI32(),
      transactionHash: event.transaction.hash,
      blockTimestamp: event.block.timestamp.toI32(),
      eventIndex: hooks.eventIndex,
    }
  );
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleMinimumDepositUpdated(
  event: MinimumDepositUpdatedEvent
): void {
  const hooks = getAccessControlHooks(event.address.toHex());
  const market = getMarket(generateMarketId(event.params.market));
  createMinimumDepositUpdated(
    generateMinimumDepositUpdatedId(event.params.market, hooks.eventIndex),
    {
      hooks: hooks.id,
      market: market.id,
      newMinimumDeposit: event.params.newMinimumDeposit,
      oldMinimumDeposit: market.minimumDeposit,
      blockNumber: event.block.number.toI32(),
      transactionHash: event.transaction.hash,
      blockTimestamp: event.block.timestamp.toI32(),
      eventIndex: hooks.eventIndex,
    }
  );
  market.minimumDeposit = event.params.newMinimumDeposit;
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
  market.save();
}

export function handleRoleProviderAdded(event: RoleProviderAddedEvent): void {
  const hooks = getAccessControlHooks(event.address.toHex());
  const roleProvider = getOrInitializeAccessControlHooksProvider(
    generateAccessControlHooksProviderId(
      event.address,
      event.params.providerAddress
    ),
    {
      hooks: hooks.id,
      timeToLive: event.params.timeToLive.toI32(),
      isPullProvider: event.params.pullProviderIndex != 0,
      pullProviderIndex: event.params.pullProviderIndex,
      providerAddress: event.params.providerAddress,
      isApproved: true,
    }
  );
  if (!roleProvider.wasCreated) {
    roleProvider.entity.timeToLive = event.params.timeToLive.toI32();
    roleProvider.entity.isPullProvider = event.params.pullProviderIndex != 0;
    roleProvider.entity.pullProviderIndex = event.params.pullProviderIndex;
    roleProvider.entity.isApproved = true;
    roleProvider.entity.save();
  }
  createRoleProviderAdded(
    generateRoleProviderAddedId(
      event.address,
      event.params.providerAddress,
      hooks.eventIndex
    ),
    {
      hooks: hooks.id,
      isPullProvider: roleProvider.entity.isPullProvider,
      pullProviderIndex: roleProvider.entity.pullProviderIndex,
      provider: roleProvider.entity.id,
      blockNumber: event.block.number.toI32(),
      transactionHash: event.transaction.hash,
      blockTimestamp: event.block.timestamp.toI32(),
      eventIndex: hooks.eventIndex,
      timeToLive: roleProvider.entity.timeToLive,
    }
  );
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleRoleProviderRemoved(
  event: RoleProviderRemovedEvent
): void {
  const hooks = getAccessControlHooks(event.address.toHex());
  const roleProvider = getAccessControlHooksProvider(
    generateAccessControlHooksProviderId(
      event.address,
      event.params.providerAddress
    )
  );

  createRoleProviderRemoved(
    generateRoleProviderRemovedId(
      event.address,
      event.params.providerAddress,
      hooks.eventIndex
    ),
    {
      hooks: hooks.id,
      provider: roleProvider.id,
      blockNumber: event.block.number.toI32(),
      transactionHash: event.transaction.hash,
      blockTimestamp: event.block.timestamp.toI32(),
      eventIndex: hooks.eventIndex,
    }
  );

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
  const hooks = getAccessControlHooks(event.address.toHex());
  const roleProvider = getAccessControlHooksProvider(
    generateAccessControlHooksProviderId(
      event.address,
      event.params.providerAddress
    )
  );
  roleProvider.pullProviderIndex = event.params.pullProviderIndex;
  roleProvider.timeToLive = event.params.timeToLive.toI32();
  roleProvider.isPullProvider = roleProvider.pullProviderIndex != 0;
  roleProvider.save();

  createRoleProviderUpdated(
    generateRoleProviderUpdatedId(
      event.address,
      event.params.providerAddress,
      hooks.eventIndex
    ),
    {
      hooks: hooks.id,
      provider: roleProvider.id,
      blockNumber: event.block.number.toI32(),
      transactionHash: event.transaction.hash,
      blockTimestamp: event.block.timestamp.toI32(),
      eventIndex: hooks.eventIndex,
      isPullProvider: roleProvider.isPullProvider,
      pullProviderIndex: roleProvider.pullProviderIndex,
      timeToLive: roleProvider.timeToLive,
    }
  );
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
