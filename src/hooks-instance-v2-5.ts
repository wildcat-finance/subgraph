import { BigInt } from "@graphprotocol/graph-ts";
import {
  AccountAccessGranted,
  AccountAccessRevoked,
  AccountBlockedFromDeposits,
  AccountMadeFirstDeposit,
  AccountUnblockedFromDeposits,
  AdministratorTransferCancelled,
  AdministratorTransferRequested,
  AdministratorTransferred,
  AnnualInterestBipsReductionExecuted,
  AnnualInterestBipsReductionProposalCancelled,
  AnnualInterestBipsReductionProposed,
  FixedTermUpdated,
  MinimumDepositUpdated,
  NameUpdated,
  PeriodicTermClosed,
  PeriodicTermUpdated,
  RoleProviderAdded,
  RoleProviderRemoved,
  RoleProviderUpdated,
  TemporaryExcessReserveRatioActivated,
  TemporaryExcessReserveRatioCanceled,
  TemporaryExcessReserveRatioExpired,
  TemporaryExcessReserveRatioUpdated,
} from "../generated/templates/CombinedHooksV2_5/CombinedHooksV2_5";
import {
  AccountMadeFirstDeposit as LegacyAccountMadeFirstDeposit,
  AnnualInterestBipsReductionExecuted as LegacyAnnualInterestBipsReductionExecuted,
  AnnualInterestBipsReductionProposalCancelled as LegacyAnnualInterestBipsReductionProposalCancelled,
  AnnualInterestBipsReductionProposed as LegacyAnnualInterestBipsReductionProposed,
  PeriodicTermClosed as LegacyPeriodicTermClosed,
  TemporaryExcessReserveRatioActivated as LegacyTemporaryExcessReserveRatioActivated,
  TemporaryExcessReserveRatioCanceled as LegacyTemporaryExcessReserveRatioCanceled,
  TemporaryExcessReserveRatioExpired as LegacyTemporaryExcessReserveRatioExpired,
  TemporaryExcessReserveRatioUpdated as LegacyTemporaryExcessReserveRatioUpdated,
} from "../generated/templates/CombinedHooks/CombinedHooks";
import { HookAdministratorChange } from "../generated/schema";
import {
  generateHooksInstanceId,
  getHooksInstance,
} from "../generated/UncrashableEntityHelpers";
import {
  handleAccountAccessGrantedValues,
  handleAccountAccessRevokedValues,
  handleAccountBlockedFromDepositsValues,
  handleAccountMadeFirstDeposit as handleLegacyAccountMadeFirstDeposit,
  handleAccountUnblockedFromDepositsValues,
  handleAnnualInterestBipsReductionExecuted as handleLegacyAnnualInterestBipsReductionExecuted,
  handleAnnualInterestBipsReductionProposalCancelled as handleLegacyAnnualInterestBipsReductionProposalCancelled,
  handleAnnualInterestBipsReductionProposed as handleLegacyAnnualInterestBipsReductionProposed,
  handleFixedTermUpdatedValues,
  handleMinimumDepositUpdatedValues,
  handleNameUpdatedValues,
  handlePeriodicTermClosed as handleLegacyPeriodicTermClosed,
  handlePeriodicTermUpdatedValues,
  handleRoleProviderAddedValues,
  handleRoleProviderRemovedValues,
  handleRoleProviderUpdatedValues,
  handleTemporaryExcessReserveRatioActivated as handleLegacyTemporaryExcessReserveRatioActivated,
  handleTemporaryExcessReserveRatioCanceled as handleLegacyTemporaryExcessReserveRatioCanceled,
  handleTemporaryExcessReserveRatioExpired as handleLegacyTemporaryExcessReserveRatioExpired,
  handleTemporaryExcessReserveRatioUpdated as handleLegacyTemporaryExcessReserveRatioUpdated,
} from "./hooks-instance";
import { generateEventId } from "./utils";

export function handleAccountAccessGranted(event: AccountAccessGranted): void {
  handleAccountAccessGrantedValues(
    event,
    event.params.providerAddress,
    event.params.accountAddress,
    event.params.caller,
    event.params.credentialTimestamp
  );
}

export function handleAccountAccessRevoked(event: AccountAccessRevoked): void {
  handleAccountAccessRevokedValues(
    event,
    event.params.providerAddress,
    true,
    event.params.accountAddress,
    event.params.caller
  );
}

export function handleAccountBlockedFromDeposits(
  event: AccountBlockedFromDeposits
): void {
  handleAccountBlockedFromDepositsValues(
    event,
    event.params.administrator,
    event.params.accountAddress
  );
}

export function handleAccountMadeFirstDeposit(
  event: AccountMadeFirstDeposit
): void {
  handleLegacyAccountMadeFirstDeposit(
    changetype<LegacyAccountMadeFirstDeposit>(event)
  );
}

export function handleAccountUnblockedFromDeposits(
  event: AccountUnblockedFromDeposits
): void {
  handleAccountUnblockedFromDepositsValues(
    event,
    event.params.administrator,
    event.params.accountAddress
  );
}

function saveAdministratorChange(
  eventId: string,
  event: AdministratorTransferRequested,
  kind: string
): HookAdministratorChange {
  let change = new HookAdministratorChange(eventId);
  change.hooks = generateHooksInstanceId(event.address);
  change.kind = kind;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  return change;
}

export function handleAdministratorTransferRequested(
  event: AdministratorTransferRequested
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let change = saveAdministratorChange(
    generateEventId(event),
    event,
    "TRANSFER_REQUESTED"
  );
  change.administrator = event.params.administrator;
  change.previousPendingAdministrator =
    event.params.previousPendingAdministrator;
  change.pendingAdministrator = event.params.pendingAdministrator;
  change.save();
  hooks.pendingAdministrator = event.params.pendingAdministrator;
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleAdministratorTransferCancelled(
  event: AdministratorTransferCancelled
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let change = new HookAdministratorChange(generateEventId(event));
  change.hooks = hooks.id;
  change.kind = "TRANSFER_CANCELLED";
  change.administrator = event.params.administrator;
  change.cancelledPendingAdministrator =
    event.params.cancelledPendingAdministrator;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
  hooks.unset("pendingAdministrator");
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleAdministratorTransferred(
  event: AdministratorTransferred
): void {
  let hooks = getHooksInstance(generateHooksInstanceId(event.address));
  let change = new HookAdministratorChange(generateEventId(event));
  change.hooks = hooks.id;
  change.kind = "TRANSFERRED";
  change.previousAdministrator = event.params.previousAdministrator;
  change.newAdministrator = event.params.newAdministrator;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
  hooks.administrator = event.params.newAdministrator;
  hooks.borrower = event.params.newAdministrator;
  hooks.unset("pendingAdministrator");
  hooks.eventIndex = hooks.eventIndex + 1;
  hooks.save();
}

export function handleAnnualInterestBipsReductionProposed(
  event: AnnualInterestBipsReductionProposed
): void {
  handleLegacyAnnualInterestBipsReductionProposed(
    changetype<LegacyAnnualInterestBipsReductionProposed>(event)
  );
}

export function handleAnnualInterestBipsReductionProposalCancelled(
  event: AnnualInterestBipsReductionProposalCancelled
): void {
  handleLegacyAnnualInterestBipsReductionProposalCancelled(
    changetype<LegacyAnnualInterestBipsReductionProposalCancelled>(event)
  );
}

export function handleAnnualInterestBipsReductionExecuted(
  event: AnnualInterestBipsReductionExecuted
): void {
  handleLegacyAnnualInterestBipsReductionExecuted(
    changetype<LegacyAnnualInterestBipsReductionExecuted>(event)
  );
}

export function handleFixedTermUpdated(event: FixedTermUpdated): void {
  handleFixedTermUpdatedValues(
    event,
    event.params.market,
    event.params.caller,
    event.params.previousFixedTermEndTime.toI32(),
    event.params.newFixedTermEndTime.toI32()
  );
}

export function handleMinimumDepositUpdated(
  event: MinimumDepositUpdated
): void {
  handleMinimumDepositUpdatedValues(
    event,
    event.params.market,
    event.params.caller,
    event.params.previousMinimumDeposit,
    event.params.newMinimumDeposit
  );
}

export function handleNameUpdated(event: NameUpdated): void {
  handleNameUpdatedValues(
    event,
    event.params.administrator,
    event.params.previousName,
    true,
    event.params.newName
  );
}

export function handlePeriodicTermClosed(event: PeriodicTermClosed): void {
  handleLegacyPeriodicTermClosed(changetype<LegacyPeriodicTermClosed>(event));
}

export function handlePeriodicTermUpdated(event: PeriodicTermUpdated): void {
  handlePeriodicTermUpdatedValues(
    event,
    event.params.market,
    event.params.administrator,
    event.params.firstWithdrawalWindowStart.toI32(),
    event.params.periodDuration.toI32(),
    event.params.withdrawalWindowDuration.toI32()
  );
}

export function handleRoleProviderAdded(event: RoleProviderAdded): void {
  handleRoleProviderAddedValues(
    event,
    event.params.administrator,
    event.params.providerAddress,
    event.params.timeToLive,
    event.params.pullProviderIndex,
    event.params.pushProviderIndex
  );
}

export function handleRoleProviderRemoved(event: RoleProviderRemoved): void {
  handleRoleProviderRemovedValues(
    event,
    event.params.administrator,
    event.params.providerAddress,
    event.params.timeToLive,
    BigInt.fromI32(event.params.pullProviderIndex),
    BigInt.fromI32(event.params.pushProviderIndex)
  );
}

export function handleRoleProviderUpdated(event: RoleProviderUpdated): void {
  handleRoleProviderUpdatedValues(
    event,
    event.params.administrator,
    event.params.providerAddress,
    event.params.previousTimeToLive,
    event.params.newTimeToLive,
    BigInt.fromI32(event.params.previousPullProviderIndex),
    event.params.newPullProviderIndex,
    BigInt.fromI32(event.params.previousPushProviderIndex),
    event.params.newPushProviderIndex
  );
}

export function handleTemporaryExcessReserveRatioActivated(
  event: TemporaryExcessReserveRatioActivated
): void {
  handleLegacyTemporaryExcessReserveRatioActivated(
    changetype<LegacyTemporaryExcessReserveRatioActivated>(event)
  );
}

export function handleTemporaryExcessReserveRatioCanceled(
  event: TemporaryExcessReserveRatioCanceled
): void {
  handleLegacyTemporaryExcessReserveRatioCanceled(
    changetype<LegacyTemporaryExcessReserveRatioCanceled>(event)
  );
}

export function handleTemporaryExcessReserveRatioExpired(
  event: TemporaryExcessReserveRatioExpired
): void {
  handleLegacyTemporaryExcessReserveRatioExpired(
    changetype<LegacyTemporaryExcessReserveRatioExpired>(event)
  );
}

export function handleTemporaryExcessReserveRatioUpdated(
  event: TemporaryExcessReserveRatioUpdated
): void {
  handleLegacyTemporaryExcessReserveRatioUpdated(
    changetype<LegacyTemporaryExcessReserveRatioUpdated>(event)
  );
}
